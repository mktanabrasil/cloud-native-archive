import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, como em eventos-aviso: o denomailer derrubava o worker na porta 587.
import nodemailer from 'npm:nodemailer@6.9.16';
import { emailDaDevolutiva, emailDoEnvio, type Email, type SemanarioDoEmail } from './email.ts';

addEventListener('unhandledrejection', (e) => { console.error('[semanario-aviso] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[semanario-aviso] erro solto:', e.error); e.preventDefault(); });

/**
 * Os avisos por e-mail do Semanário (PR 6, 17/11/2026). O app chama logo
 * depois de gravar, com o JWT de quem gravou:
 *
 *  - `{ semanario_id, tipo: 'envio' }`: a professora enviou. Só a dona chama.
 *    Vai para as orientadoras pedagógicas ativas do CEI do semanário.
 *  - `{ semanario_id, tipo: 'devolutiva' }`: a orientadora escreveu ou
 *    reescreveu a devolutiva. Só a orientadora da unidade chama. Vai para a
 *    professora (o e-mail da conta dela).
 *
 * Uma vez por acontecimento: a tabela `semanario_avisos` guarda o envio
 * (`enviado_em`) ou a devolutiva (`devolutiva_em`) já avisados. Desfazer e
 * enviar de novo, ou reescrever a devolutiva, é acontecimento novo e avisa de
 * novo. Apagar a devolutiva não avisa. Os destinatários são lidos aqui, nunca
 * vêm do pedido.
 *
 * Segredos (Coolify, os mesmos dos outros avisos): SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SITE_URL. Remetente: SEMANARIO_REMETENTE ou
 * "ANA Brasil · Semanário <SMTP_USER>".
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const norm = (u: string | null | undefined) => String(u ?? '').trim().toLowerCase();

async function enviar(para: string[], m: Email): Promise<void> {
  const porta = Number(Deno.env.get('SMTP_PORT') || 587);
  const tlsEnv = Deno.env.get('SMTP_TLS');
  const tlsDireto = tlsEnv ? tlsEnv !== 'false' : porta === 465;
  const usuario = Deno.env.get('SMTP_USER') || '';
  const smtp = {
    host: Deno.env.get('SMTP_HOST') || '', port: porta, secure: tlsDireto, requireTLS: !tlsDireto,
    auth: { user: usuario, pass: Deno.env.get('SMTP_PASS') || '' },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  };
  if (!smtp.host || !usuario) throw new Error('SMTP não configurado.');
  const remetente = Deno.env.get('SEMANARIO_REMETENTE') || `ANA Brasil · Semanário <${usuario}>`;
  const transporte = nodemailer.createTransport(smtp);
  try {
    await transporte.sendMail({ from: remetente, to: para.join(', '), subject: m.assunto, text: m.texto, html: m.html });
  } finally {
    transporte.close();
  }
}

async function emailDaConta(adm: ReturnType<typeof createClient>, userId: string, doPerfil: string | null): Promise<string | null> {
  const { data } = await adm.auth.admin.getUserById(userId);
  return data?.user?.email || doPerfil || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SITE = (Deno.env.get('SITE_URL') || 'https://app.anabrasil.org').replace(/\/$/, '');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem, error: erroDeQuem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (erroDeQuem || !quem?.user) return json({ error: 'Não autorizado.' }, 401);

  let corpo: { semanario_id?: string; tipo?: string } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }
  const id = String(corpo.semanario_id ?? '');
  const tipo = corpo.tipo === 'envio' || corpo.tipo === 'devolutiva' ? corpo.tipo : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !tipo) return json({ error: 'Pedido inválido.' }, 400);

  const adm = createClient(SUPABASE_URL, SERVICE);
  const { data: s, error } = await adm
    .from('semanarios')
    .select('id, professora_id, professora_nome, unidade, semana, agrupamento, dias, status, enviado_em, devolutiva, devolutiva_por, devolutiva_em')
    .eq('id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!s) return json({ error: 'Semanário não encontrado.' }, 404);

  // Quem pode pedir cada aviso: a dona pede o do envio; a orientadora da unidade, o da devolutiva.
  if (tipo === 'envio') {
    if (s.professora_id !== quem.user.id) return json({ error: 'Semanário não encontrado.' }, 404);
    if (s.status === 'preenchimento' || !s.enviado_em) return json({ enviado: false, motivo: 'não enviado' });
  } else {
    const { data: ehOrientadora } = await userClient.rpc('eh_orientadora_de', { _unidade: s.unidade });
    if (!ehOrientadora) return json({ error: 'Só a orientadora pedagógica do CEI avisa a devolutiva.' }, 403);
    if (!s.devolutiva?.trim() || !s.devolutiva_em) return json({ enviado: false, motivo: 'sem devolutiva' });
  }
  const marca = String(tipo === 'envio' ? s.enviado_em : s.devolutiva_em);

  // Reserva o aviso (uma linha por acontecimento). Já reservado: só tenta de novo se tiver falhado.
  const { error: erroDaReserva } = await adm.from('semanario_avisos').insert({ semanario_id: s.id, tipo, marca, status: 'enviando' });
  if (erroDaReserva) {
    if (erroDaReserva.code !== '23505') return json({ error: erroDaReserva.message }, 500);
    const { data: retomada } = await adm.from('semanario_avisos').update({ status: 'enviando', erro: null })
      .eq('semanario_id', s.id).eq('tipo', tipo).eq('marca', marca).eq('status', 'falhou').select('semanario_id');
    if (!retomada?.length) return json({ enviado: false, motivo: 'já avisado' });
  }
  const registrar = (status: string, destinatarios: string[], erro: string | null = null) =>
    adm.from('semanario_avisos').update({ status, destinatarios, erro }).eq('semanario_id', s.id).eq('tipo', tipo).eq('marca', marca);

  // Os destinatários, lidos aqui.
  let para: string[] = [];
  if (tipo === 'envio') {
    const { data: perfis } = await adm.from('profiles').select('user_id, email, unit, is_active').eq('bond_type', 'orientacao_pedagogica');
    const daUnidade = (perfis ?? []).filter((p: { unit: string | null; is_active: boolean | null }) => p.is_active !== false && norm(p.unit) === norm(s.unidade));
    for (const p of daUnidade as { user_id: string; email: string | null }[]) {
      const e = await emailDaConta(adm, p.user_id, p.email);
      if (e) para.push(e);
    }
  } else {
    const { data: perfil } = await adm.from('profiles').select('email').eq('user_id', s.professora_id).maybeSingle();
    const e = await emailDaConta(adm, s.professora_id, perfil?.email ?? null);
    if (e) para.push(e);
  }
  para = [...new Set(para.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!para.length) {
    await registrar('sem_destinatario', []);
    return json({ enviado: false, motivo: tipo === 'envio' ? 'sem orientadora' : 'sem e-mail' });
  }

  let reescrita = false;
  if (tipo === 'devolutiva') {
    const { data: antes } = await adm.from('semanario_avisos').select('marca').eq('semanario_id', s.id).eq('tipo', 'devolutiva').eq('status', 'enviado').neq('marca', marca).limit(1);
    reescrita = !!antes?.length;
  }
  const dados = s as unknown as SemanarioDoEmail;
  const m = tipo === 'envio' ? emailDoEnvio(dados, SITE) : emailDaDevolutiva(dados, SITE, reescrita);

  try {
    await enviar(para, m);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error('[semanario-aviso] falhou:', msg);
    await registrar('falhou', para, msg);
    return json({ error: msg.slice(0, 300) }, 502);
  }
  await registrar('enviado', para);
  return json({ enviado: true, destinatarios: para.length });
});

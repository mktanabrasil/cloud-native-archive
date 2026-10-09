import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, como em eventos-aviso: o denomailer derrubava o worker na porta 587.
import nodemailer from 'npm:nodemailer@6.9.16';

addEventListener('unhandledrejection', (e) => { console.error('[candidatura-confirmacao] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[candidatura-confirmacao] erro solto:', e.error); e.preventDefault(); });

/**
 * Os e-mails do Trabalhe Conosco para o candidato.
 *
 * 1. Confirmação (PR 8, 06/10/2026): o app chama logo depois de o candidato
 *    enviar, com o JWT DELE e o `candidatura_id`. Uma vez por candidatura
 *    (`confirmacao_enviada_em`).
 * 2. Mudança de etapa (PR 9, 09/10/2026): o painel do RH chama com
 *    `{ candidatura_id, aviso: true }` e o JWT de quem moveu (precisa ser RH
 *    ou admin). Avisa a etapa atual (Análise, Entrevista, Aprovado ou Não
 *    selecionado) uma vez cada (`etapa_avisada`). Voltar etapa não chama.
 *
 * Nos dois casos o destinatário é sempre o e-mail da conta do candidato,
 * lido pela chave de serviço; nunca um endereço vindo do pedido.
 *
 * Segredos (Coolify, os mesmos dos avisos de eventos): SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SITE_URL. Remetente: VAGAS_REMETENTE ou
 * "ANA Brasil · Trabalhe Conosco <SMTP_USER>".
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Mensagem { assunto: string; titulo: string; paragrafos: string[]; destaque?: { rotulo: string; valor: string; rodape: string }; cor?: string }

function confirmacao(nome: string, vaga: string, protocolo: string, enviadaEm: string): Mensagem {
  return {
    assunto: `Candidatura recebida · ${vaga} · ${protocolo}`,
    titulo: `Recebemos sua candidatura, ${nome}.`,
    paragrafos: [vaga, 'Próximos passos: o RH analisa as candidaturas. Se você avançar, avisamos pelo app e por e-mail.'],
    destaque: { rotulo: 'Protocolo', valor: protocolo, rodape: `enviada em ${enviadaEm}` },
  };
}

/** O aviso de cada etapa. Tom direto e cuidadoso, sem promessas que o RH não fez. */
function avisoDeEtapa(etapa: string, resultado: string | null, nome: string, vaga: string, protocolo: string): Mensagem | null {
  if (etapa === 'analise') return {
    assunto: `Sua candidatura está em análise · ${vaga}`,
    titulo: `${nome}, sua candidatura está em análise.`,
    paragrafos: [`O RH começou a analisar a sua candidatura para ${vaga} (protocolo ${protocolo}).`, 'Se você avançar, avisamos por aqui de novo.'],
  };
  if (etapa === 'entrevista') return {
    assunto: `Você avançou para a entrevista · ${vaga}`,
    titulo: `Boa notícia, ${nome}: você avançou para a entrevista.`,
    paragrafos: [`Sua candidatura para ${vaga} (protocolo ${protocolo}) passou para a etapa de entrevista.`, 'O RH vai entrar em contato pelo WhatsApp do seu perfil para combinar dia e horário. Confira se o número está certo.'],
    cor: '#E6F8F3',
  };
  if (etapa === 'resultado' && resultado === 'aprovado') return {
    assunto: `Você foi aprovado(a) · ${vaga}`,
    titulo: `Parabéns, ${nome}! Você foi aprovado(a).`,
    paragrafos: [`Você foi aprovado(a) no processo para ${vaga} (protocolo ${protocolo}).`, 'O RH vai entrar em contato com os próximos passos.'],
    cor: '#E6F8F3',
  };
  if (etapa === 'resultado' && resultado === 'nao_selecionado') return {
    assunto: `Resultado da sua candidatura · ${vaga}`,
    titulo: `${nome}, obrigado por se candidatar.`,
    paragrafos: [`Desta vez você não foi selecionado(a) para ${vaga} (protocolo ${protocolo}).`, 'Seu perfil continua no Trabalhe Conosco, e você pode se candidatar a outras vagas quando quiser.'],
  };
  return null;
}

function html(m: Mensagem, link: string): string {
  const destaque = m.destaque ? `
  <div style="background:#E6F8F3;border-radius:14px;padding:16px;text-align:center;margin:0 0 18px">
    <div style="font-size:12px;color:#555">${esc(m.destaque.rotulo)}</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:.04em">${esc(m.destaque.valor)}</div>
    <div style="font-size:12px;color:#555">${esc(m.destaque.rodape)}</div>
  </div>` : '';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:Poppins,Arial,sans-serif;color:#1F2322">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="font-size:15px;font-weight:700;margin:0 0 20px">anabrasil</p>
  <h1 style="font-size:22px;margin:0 0 12px;${m.cor ? `background:${m.cor};padding:14px 16px;border-radius:14px;` : ''}">${esc(m.titulo)}</h1>
  ${m.paragrafos.map((p) => `<p style="margin:0 0 12px;color:#333;line-height:1.55">${esc(p)}</p>`).join('\n  ')}
  ${destaque}
  <a href="${esc(link)}" style="display:inline-block;background:#1F2322;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;margin-top:6px">Acompanhar candidatura</a>
  <p style="margin:26px 0 0;font-size:12px;color:#777">Você recebeu este e-mail porque se candidatou pelo Trabalhe Conosco da ANA Brasil.</p>
</div>
<div style="height:6px;background:linear-gradient(90deg,#F5DFBB 0 20%,#FBCE00 20% 40%,#F37964 40% 60%,#81E2CF 60% 80%,#01ADFF 80% 100%)"></div>
</body></html>`;
}

const texto = (m: Mensagem, link: string) =>
  [m.titulo, '', ...m.paragrafos, ...(m.destaque ? ['', `${m.destaque.rotulo}: ${m.destaque.valor} (${m.destaque.rodape})`] : []), '', `Acompanhar: ${link}`, ''].join('\n');

async function enviar(para: string, m: Mensagem, link: string): Promise<void> {
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
  const remetente = Deno.env.get('VAGAS_REMETENTE') || `ANA Brasil · Trabalhe Conosco <${usuario}>`;
  const transporte = nodemailer.createTransport(smtp);
  try {
    await transporte.sendMail({ from: remetente, to: para, subject: m.assunto, text: texto(m, link), html: html(m, link) });
  } finally {
    transporte.close();
  }
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

  let corpo: { candidatura_id?: string; aviso?: boolean } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }
  const id = String(corpo.candidatura_id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'candidatura_id inválido.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE);
  const { data: c, error } = await admin
    .from('candidaturas')
    .select('id, user_id, protocolo, created_at, etapa, resultado, etapa_avisada, retirada_em, confirmacao_enviada_em, perfil, vagas(titulo)')
    .eq('id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!c) return json({ error: 'Candidatura não encontrada.' }, 404);

  const perfil = (c.perfil ?? {}) as Record<string, unknown>;
  const nome = String(perfil.nome_social || perfil.nome || 'candidato').split(' ')[0];
  const vaga = String((c.vagas as { titulo?: string } | null)?.titulo ?? 'Trabalhe Conosco');
  const link = `${SITE}/vagas/minha-area/${c.id}`;

  // O e-mail vai sempre para a conta do candidato, lida aqui.
  const { data: dono } = await admin.auth.admin.getUserById(c.user_id);
  const para = dono?.user?.email;
  if (!para) return json({ error: 'Candidato sem e-mail.' }, 404);

  try {
    if (corpo.aviso) {
      const { data: rh } = await userClient.rpc('is_rh_or_admin', { _user_id: quem.user.id });
      if (!rh) return json({ error: 'Só o RH avisa o candidato.' }, 403);
      if (c.retirada_em) return json({ enviado: false, motivo: 'retirada' });
      const marca = `${c.etapa}${c.resultado ? ':' + c.resultado : ''}`;
      if (c.etapa_avisada === marca) return json({ enviado: false, motivo: 'já avisado' });
      const m = avisoDeEtapa(c.etapa, c.resultado, nome, vaga, c.protocolo);
      if (!m) return json({ enviado: false, motivo: 'etapa sem aviso' });
      await enviar(para, m, link);
      await admin.from('candidaturas').update({ etapa_avisada: marca }).eq('id', c.id);
      return json({ enviado: true });
    }

    if (c.user_id !== quem.user.id) return json({ error: 'Candidatura não encontrada.' }, 404);
    if (c.confirmacao_enviada_em) return json({ enviado: false, motivo: 'já enviado' });
    await enviar(para, confirmacao(nome, vaga, c.protocolo, quando(c.created_at)), link);
    await admin.from('candidaturas').update({ confirmacao_enviada_em: new Date().toISOString() }).eq('id', c.id);
    return json({ enviado: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[candidatura-confirmacao] falhou:', msg);
    return json({ error: msg.slice(0, 300) }, 502);
  }
});

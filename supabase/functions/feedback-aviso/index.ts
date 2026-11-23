import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, como em eventos-aviso e semanario-aviso: o denomailer derrubava o worker na porta 587.
import nodemailer from 'npm:nodemailer@6.9.16';
import { emailDoFeedbackNovo, type Email, type FeedbackDoEmail } from './email.ts';

addEventListener('unhandledrejection', (e) => { console.error('[feedback-aviso] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[feedback-aviso] erro solto:', e.error); e.preventDefault(); });

/**
 * O aviso por e-mail do feedback do app (PR 1, 23/11/2026). O app chama logo
 * depois de gravar, com o JWT de quem mandou: `{ feedback_id }`. Só quem
 * mandou pode pedir. Vai ao marketing (FEEDBACK_PARA, ou mkt@anabrasil.org),
 * com o print anexado quando houver e "responder" indo para quem mandou.
 *
 * Uma vez por feedback: a tabela `feedback_avisos` guarda a reserva. Um
 * envio que falhou, ou que ficou "enviando" por mais de 5 minutos (a função
 * caiu no meio), pode ser tentado de novo: o app repete o pedido duas vezes.
 *
 * Segredos (Coolify, os mesmos dos outros avisos): SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SITE_URL. Remetente: FEEDBACK_REMETENTE ou
 * "ANA Brasil · Feedback <SMTP_USER>".
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Anexo { filename: string; content: Uint8Array; contentType: string }

async function enviar(para: string[], m: Email, responderPara: string | null, anexos: Anexo[]): Promise<void> {
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
  const remetente = Deno.env.get('FEEDBACK_REMETENTE') || `ANA Brasil · Feedback <${usuario}>`;
  const transporte = nodemailer.createTransport(smtp);
  try {
    await transporte.sendMail({
      from: remetente, to: para.join(', '), subject: m.assunto, text: m.texto, html: m.html,
      ...(responderPara ? { replyTo: responderPara } : {}),
      ...(anexos.length ? { attachments: anexos } : {}),
    });
  } finally {
    transporte.close();
  }
}

const TIPOS_DE_IMAGEM: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

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

  let corpo: { feedback_id?: string } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }
  const id = String(corpo.feedback_id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Pedido inválido.' }, 400);

  const adm = createClient(SUPABASE_URL, SERVICE);
  const { data: f, error } = await adm
    .from('feedbacks')
    .select('id, autor_id, autor_nome, autor_email, tipo, texto, setor, pagina, aparelho, navegador, print_path, criado_em')
    .eq('id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  // Só quem mandou pede o aviso (e não descobre se o feedback dos outros existe).
  if (!f || f.autor_id !== quem.user.id) return json({ error: 'Feedback não encontrado.' }, 404);

  const marca = String(f.criado_em);
  const { error: erroDaReserva } = await adm.from('feedback_avisos').insert({ feedback_id: f.id, tipo: 'novo', marca, status: 'enviando' });
  if (erroDaReserva) {
    if (erroDaReserva.code !== '23505') return json({ error: erroDaReserva.message }, 500);
    const preso = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: retomada } = await adm.from('feedback_avisos').update({ status: 'enviando', erro: null, criado_em: new Date().toISOString() })
      .eq('feedback_id', f.id).eq('tipo', 'novo').eq('marca', marca)
      .or(`status.eq.falhou,and(status.eq.enviando,criado_em.lt.${preso})`).select('feedback_id');
    if (!retomada?.length) return json({ enviado: false, motivo: 'já avisado' });
  }
  const registrar = (status: string, destinatarios: string[], erro: string | null = null) =>
    adm.from('feedback_avisos').update({ status, destinatarios, erro }).eq('feedback_id', f.id).eq('tipo', 'novo').eq('marca', marca);

  const para = [...new Set((Deno.env.get('FEEDBACK_PARA') || 'mkt@anabrasil.org').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!para.length) {
    await registrar('sem_destinatario', []);
    return json({ enviado: false, motivo: 'sem destinatário' });
  }

  // O print vai anexado; se não der para baixar, o e-mail sai sem ele.
  const anexos: Anexo[] = [];
  if (f.print_path) {
    const { data: arquivo, error: erroDoPrint } = await adm.storage.from('feedback-prints').download(f.print_path);
    if (arquivo && !erroDoPrint) {
      const ext = (f.print_path.split('.').pop() || 'png').toLowerCase();
      anexos.push({ filename: `print-do-feedback.${ext}`, content: new Uint8Array(await arquivo.arrayBuffer()), contentType: TIPOS_DE_IMAGEM[ext] ?? 'image/png' });
    } else {
      console.error('[feedback-aviso] print não baixou:', erroDoPrint?.message);
    }
  }

  const m = emailDoFeedbackNovo(f as unknown as FeedbackDoEmail, SITE, anexos.length > 0);
  try {
    await enviar(para, m, f.autor_email, anexos);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error('[feedback-aviso] falhou:', msg);
    await registrar('falhou', para, msg);
    return json({ error: msg.slice(0, 300) }, 502);
  }
  await registrar('enviado', para);
  return json({ enviado: true, destinatarios: para.length });
});

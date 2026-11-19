import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, como em eventos-aviso (o denomailer tropeça na porta 587).
import nodemailer from 'npm:nodemailer@6.9.16';
import { assuntoDaSenha, corpoDaSenhaHtml, corpoDaSenhaTexto, type Motivo } from './email.ts';

addEventListener('unhandledrejection', (e) => { console.error('[senha-pedir] promessa solta:', e.reason); e.preventDefault(); });

/**
 * "Esqueceu a senha?" (19/11/2026, PR 3 das senhas).
 *
 * Público (a pessoa ainda não entrou). Recebe o e-mail e:
 *  - conta da equipe → cria um pedido (código de 1 hora, uso único; no máximo
 *    um a cada 5 minutos) e manda o e-mail "Gerar minha senha";
 *  - qualquer outra (administração geral, marketing) → o "Esqueci a senha" de
 *    sempre do login, que deixa a pessoa escolher a senha.
 * Responde sempre a mesma coisa, para não dizer quais e-mails existem.
 *
 * `motivo: 'aprovado'` (o e-mail de acesso aprovado) só vale com a chave de
 * serviço: quem chama é a função admin-approve-user. Nesse caso a resposta diz
 * se o e-mail saiu, para quem aprovou saber.
 *
 * Segredos (Coolify, os mesmos dos avisos): SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASS, AVISOS_REMETENTE, SITE_URL.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RESPOSTA = { ok: true, mensagem: 'Se o e-mail estiver cadastrado, chega em instantes um e-mail com o caminho para entrar.' };

const base64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256(texto: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return Array.from(d, x => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const URL_ = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SITE = (Deno.env.get('SITE_URL') || 'https://app.anabrasil.org').replace(/\/$/, '');

  let corpo: { email?: unknown; motivo?: unknown } = {};
  try { corpo = await req.json(); } catch { /* sem corpo */ }
  const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Digite um e-mail válido.' }, 400);
  const doServidor = req.headers.get('Authorization') === `Bearer ${SERVICE}`;
  const motivo: Motivo = doServidor && corpo.motivo === 'aprovado' ? 'aprovado' : 'esqueci';

  const admin = createClient(URL_, SERVICE);
  try {
    const { data: userId, error: erroConta } = await admin.rpc('conta_da_equipe_pelo_email', { _email: email });
    if (erroConta) throw new Error(`conta_da_equipe_pelo_email: ${erroConta.message}`);

    // Não é conta da equipe: o "Esqueci a senha" de sempre (ou nada, se o e-mail não existir).
    if (!userId) {
      if (motivo === 'esqueci') {
        const { error } = await createClient(URL_, ANON).auth.resetPasswordForEmail(email, { redirectTo: `${SITE}/redefinir-senha` });
        if (error) console.warn('[senha-pedir] recuperação padrão:', error.message);
      }
      return json(doServidor ? { ...RESPOSTA, enviado: false, motivo: 'nao_e_da_equipe' } : RESPOSTA);
    }

    // O banco cria o pedido numa tacada só: trava por conta, um e-mail a cada
    // 5 minutos (o de aprovação passa), teto geral por hora, e os links
    // anteriores morrem. false = um limite segurou (sem e-mail).
    const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const { data: criado, error: erroPedido } = await admin.rpc('criar_pedido_de_senha', { _user_id: userId, _token_hash: await sha256(token), _motivo: motivo });
    if (erroPedido) throw new Error(`pedido: ${erroPedido.message}`);
    if (criado !== true) {
      console.log(`[senha-pedir] limite de envio segurou o pedido de ${userId}`);
      return json(doServidor ? { ...RESPOSTA, enviado: false, erro: 'limite de envio' } : RESPOSTA);
    }

    const { data: perfil } = await admin.from('profiles').select('name').eq('user_id', userId).maybeSingle();
    const nome = (perfil?.name as string | null) ?? null;

    const porta = Number(Deno.env.get('SMTP_PORT') || 587);
    const tlsEnv = Deno.env.get('SMTP_TLS');
    const tlsDireto = tlsEnv ? tlsEnv !== 'false' : porta === 465;
    const host = Deno.env.get('SMTP_HOST') || '';
    const user = Deno.env.get('SMTP_USER') || '';
    if (!host || !user) throw new Error('SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)');
    const transporte = nodemailer.createTransport({
      host, port: porta, secure: tlsDireto, requireTLS: !tlsDireto, auth: { user, pass: Deno.env.get('SMTP_PASS') || '' },
      connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
    });
    try {
      await transporte.sendMail({
        from: Deno.env.get('AVISOS_REMETENTE') || 'ANA Brasil <eventos@anabrasil.org>',
        to: email,
        subject: assuntoDaSenha(motivo),
        text: corpoDaSenhaTexto(SITE, token, motivo, nome),
        html: corpoDaSenhaHtml(SITE, token, motivo, nome),
      });
    } finally { transporte.close(); }
    console.log(`[senha-pedir] e-mail "${motivo}" enviado para a conta ${userId}`);
    return json(doServidor ? { ...RESPOSTA, enviado: true } : RESPOSTA);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[senha-pedir] falhou:', msg);
    // Quem aprovou precisa saber que o e-mail não saiu; o público recebe a resposta de sempre.
    return doServidor ? json({ ...RESPOSTA, enviado: false, erro: msg }) : json(RESPOSTA);
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, como em eventos-aviso: o denomailer derrubava o worker na porta 587.
import nodemailer from 'npm:nodemailer@6.9.16';

addEventListener('unhandledrejection', (e) => { console.error('[candidatura-confirmacao] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[candidatura-confirmacao] erro solto:', e.error); e.preventDefault(); });

/**
 * E-mail de confirmação da candidatura (Trabalhe Conosco, PR 8, 06/10/2026).
 *
 * Quem chama: o app, logo depois de o candidato enviar, com o JWT dele e o
 * `candidatura_id`. A função confere com a chave de serviço que a candidatura
 * é DESSA pessoa e que o e-mail ainda não saiu; manda só para o e-mail da
 * conta (nunca para um endereço vindo do pedido) e marca
 * `confirmacao_enviada_em`. Chamar de novo não manda outra vez.
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

function corpoHtml(nome: string, vaga: string, protocolo: string, enviadaEm: string, link: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:Poppins,Arial,sans-serif;color:#1F2322">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="font-size:15px;font-weight:700;margin:0 0 20px">anabrasil</p>
  <h1 style="font-size:22px;margin:0 0 8px">Recebemos sua candidatura, ${esc(nome)}.</h1>
  <p style="margin:0 0 18px;color:#555">${esc(vaga)}</p>
  <div style="background:#E6F8F3;border-radius:14px;padding:16px;text-align:center;margin:0 0 18px">
    <div style="font-size:12px;color:#555">Protocolo</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:.04em">${esc(protocolo)}</div>
    <div style="font-size:12px;color:#555">enviada em ${esc(enviadaEm)}</div>
  </div>
  <p style="margin:0 0 6px"><b>Próximos passos</b></p>
  <ol style="margin:0 0 20px;padding-left:20px;color:#333;line-height:1.6">
    <li>O RH analisa as candidaturas.</li>
    <li>Se você avançar, avisamos pelo app e por e-mail.</li>
  </ol>
  <a href="${esc(link)}" style="display:inline-block;background:#1F2322;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">Acompanhar candidatura</a>
  <p style="margin:26px 0 0;font-size:12px;color:#777">Você recebeu este e-mail porque se candidatou pelo Trabalhe Conosco da ANA Brasil.</p>
</div>
<div style="height:6px;background:linear-gradient(90deg,#F5DFBB 0 20%,#FBCE00 20% 40%,#F37964 40% 60%,#81E2CF 60% 80%,#01ADFF 80% 100%)"></div>
</body></html>`;
}

function corpoTexto(nome: string, vaga: string, protocolo: string, enviadaEm: string, link: string): string {
  return `Recebemos sua candidatura, ${nome}.\n\n${vaga}\nProtocolo: ${protocolo}\nEnviada em ${enviadaEm}\n\nPróximos passos:\n1. O RH analisa as candidaturas.\n2. Se você avançar, avisamos pelo app e por e-mail.\n\nAcompanhar: ${link}\n`;
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
  if (erroDeQuem || !quem?.user?.email) return json({ error: 'Não autorizado.' }, 401);

  let id = '';
  try { id = String((await req.json())?.candidatura_id ?? ''); } catch { /* corpo vazio */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'candidatura_id inválido.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE);
  const { data: c, error } = await admin
    .from('candidaturas')
    .select('id, user_id, protocolo, created_at, confirmacao_enviada_em, perfil, vagas(titulo)')
    .eq('id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!c || c.user_id !== quem.user.id) return json({ error: 'Candidatura não encontrada.' }, 404);
  if (c.confirmacao_enviada_em) return json({ enviado: false, motivo: 'já enviado' });

  const perfil = (c.perfil ?? {}) as Record<string, unknown>;
  const nome = String(perfil.nome_social || perfil.nome || 'candidato').split(' ')[0];
  const vaga = String((c.vagas as { titulo?: string } | null)?.titulo ?? 'Trabalhe Conosco');
  const link = `${SITE}/vagas/minha-area/${c.id}`;
  const enviadaEm = quando(c.created_at);

  const porta = Number(Deno.env.get('SMTP_PORT') || 587);
  const tlsEnv = Deno.env.get('SMTP_TLS');
  const tlsDireto = tlsEnv ? tlsEnv !== 'false' : porta === 465;
  const usuario = Deno.env.get('SMTP_USER') || '';
  const smtp = {
    host: Deno.env.get('SMTP_HOST') || '',
    port: porta,
    secure: tlsDireto,
    requireTLS: !tlsDireto,
    auth: { user: usuario, pass: Deno.env.get('SMTP_PASS') || '' },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  };
  if (!smtp.host || !usuario) return json({ error: 'SMTP não configurado.' }, 500);
  const remetente = Deno.env.get('VAGAS_REMETENTE') || `ANA Brasil · Trabalhe Conosco <${usuario}>`;

  const transporte = nodemailer.createTransport(smtp);
  try {
    await transporte.sendMail({
      from: remetente,
      to: quem.user.email,
      subject: `Candidatura recebida · ${vaga} · ${c.protocolo}`,
      text: corpoTexto(nome, vaga, c.protocolo, enviadaEm, link),
      html: corpoHtml(nome, vaga, c.protocolo, enviadaEm, link),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[candidatura-confirmacao] falhou:', msg);
    return json({ error: msg.slice(0, 300) }, 502);
  } finally {
    transporte.close();
  }

  await admin.from('candidaturas').update({ confirmacao_enviada_em: new Date().toISOString() }).eq('id', c.id);
  return json({ enviado: true });
});

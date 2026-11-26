/**
 * Ouvidoria do site do ANA Brasil (26/11/2026).
 *
 *   POST /ouvidoria  (multipart, parte `dados` em JSON) → o formulário do site.
 *     Guarda a mensagem (garantia), manda o e-mail para a ouvidoria com cópia
 *     para a administração e responde 201 { protocolo } na hora. O e-mail sai
 *     logo depois; se falhar, o agendamento tenta de novo a cada 5 minutos e
 *     avisa no WhatsApp da MKT.
 *   POST { acao: 'reenviar' } com x-ouvidoria-segredo → o agendamento.
 *   POST { acao: 'estado' | 'reenviar' } com login → o cartão do app
 *     (administração e marketing). Nunca devolve o conteúdo das mensagens.
 *
 * Anonimato: quando a pessoa não se identifica, esta função não guarda nem
 * registra nada dela. O endereço de quem chama só serve ao limite contra
 * robôs, em memória, por alguns minutos. (Fora daqui, o Kong do servidor
 * anota hora e navegador de cada chamada, sem o IP do visitante, que fica
 * atrás do proxy: ver o LEIA-ME.)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer@6.9.16';
import { COPIA, Limitador, PARA, esperaDepoisDaFalha, lerEnvio, montarEmail, type Mensagem, type Tipo } from './regras.ts';

// deno-lint-ignore no-explicit-any
type Banco = any;
const ENDERECO = (Deno.env.get('OUVIDORIA_URL') || 'https://supabase.anabrasil.org/functions/v1/ouvidoria').replace(/\/$/, '');
const MAX_CORPO = 64 * 1024;
/** A vez de quem está mandando um e-mail (as tentativas acabam em ~40 s). Quem criou a mensagem começa com ela. */
const VEZ_MS = 2 * 60_000;
/** Fim da vez: "ninguém está mandando". */
const SEM_VEZ = new Date(0).toISOString();
/** E-mail pendente há mais que isto: aviso no WhatsApp da MKT (uma vez por mensagem). */
const AVISAR_APOS_MS = 15 * 60_000;
/** Uma rodada de reenvio para de tentar depois disto (o pg_net e o Kong cortam aos 60 s); o resto fica para a próxima. */
const RODADA_MS = 35_000;
/**
 * Teto geral, pelo banco (sem nada de quem envia): mais que isto em 10 min é enxurrada. A mensagem
 * continua sendo guardada (nunca recusada: um robô não fecha a ouvidoria); só o e-mail espera e o
 * agendamento entrega aos poucos.
 */
const TETO_EM_10_MIN = 60;
/** Na enxurrada, o e-mail espera isto antes de o agendamento mandar. */
const ESPERA_NA_ENXURRADA_MS = 10 * 60_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const banco = (): Banco => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
function ok<T = any>(r: { data: T; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
  return r.data;
}
const limitador = new Limitador();

// --- E-mail ----------------------------------------------------------------------------------

type Linha = { id: number; protocolo: string; tipo: Tipo; mensagem: string; identificado: boolean; nome: string | null; email: string | null; criado_em: string; tentativas: number };

async function mandarEmail(l: Linha) {
  const host = Deno.env.get('SMTP_HOST'), user = Deno.env.get('SMTP_USER'), pass = Deno.env.get('SMTP_PASS');
  if (!host || !user || !pass) throw new Error('o servidor de e-mail não está configurado');
  const porta = Number(Deno.env.get('SMTP_PORT') || 587);
  const t = nodemailer.createTransport({ host, port: porta, secure: porta === 465, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  const m: Mensagem = { tipo: l.tipo, mensagem: l.mensagem, identificado: l.identificado, nome: l.nome, email: l.email };
  const e = montarEmail(m, l.protocolo, l.criado_em);
  await t.sendMail({
    from: `Ouvidoria do site <${Deno.env.get('AVISOS_REMETENTE') || user}>`,
    to: PARA, cc: COPIA, subject: e.assunto, text: e.texto, html: e.html,
    ...(e.responderPara ? { replyTo: e.responderPara } : {}),
  });
}

/**
 * Tenta mandar o e-mail de uma mensagem. Antes, "pega a vez" (enviando_ate):
 * duas chamadas nunca mandam o mesmo e-mail ao mesmo tempo. `jaEhMinha`: quem
 * acabou de criar a mensagem (já nasce com a vez). `forcar`: o "Reenviar agora"
 * pula a espera depois de uma falha, mas nunca a vez de quem está mandando.
 */
async function tentarEmail(db: Banco, l: Linha, { jaEhMinha = false, forcar = false } = {}): Promise<boolean> {
  if (!jaEhMinha) {
    const agora = new Date().toISOString();
    let q = db.from('ouvidoria_mensagens').update({ enviando_ate: new Date(Date.now() + VEZ_MS).toISOString() })
      .eq('id', l.id).is('email_enviado_em', null).lt('enviando_ate', agora);
    if (!forcar) q = q.lte('proxima_tentativa', agora);
    const vez = ok(await q.select('id'), 'pegar a vez') as unknown[];
    if (!vez?.length) return false;
  }
  try {
    await mandarEmail(l);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Nunca o conteúdo da mensagem nos registros: só o protocolo e o motivo.
    console.error('[ouvidoria] e-mail não saiu:', l.protocolo, msg.slice(0, 200));
    await db.from('ouvidoria_mensagens').update({ tentativas: l.tentativas + 1, ultimo_erro: msg.slice(0, 300), proxima_tentativa: new Date(Date.now() + esperaDepoisDaFalha(l.tentativas + 1)).toISOString(), enviando_ate: SEM_VEZ }).eq('id', l.id);
    return false;
  }
  // O e-mail saiu: marcar como enviado (tentando de novo se o banco piscar). Nunca conta como falha de envio.
  for (let i = 1; i <= 4; i++) {
    const r = await db.from('ouvidoria_mensagens').update({ email_enviado_em: new Date().toISOString(), ultimo_erro: null, tentativas: l.tentativas + 1, enviando_ate: SEM_VEZ }).eq('id', l.id).then((x: { error: unknown }) => x, () => ({ error: true }));
    if (!r.error) return true;
    await new Promise((ok) => setTimeout(ok, 500 * i));
  }
  console.error('[ouvidoria] e-mail saiu mas não consegui marcar:', l.protocolo);
  return true;
}

/** WhatsApp da MKT (o mesmo dos avisos das notícias e do portal). Sem o conteúdo das mensagens. */
async function avisar(db: Banco, texto: string) {
  const { data: cx } = await db.from('pizza_ranking_config').select('evolution_url, instancia, token, teste').eq('id', 1).maybeSingle();
  if (!cx?.evolution_url || !cx?.token || !cx?.teste) return false;
  try {
    const r = await fetch(`${String(cx.evolution_url).replace(/\/$/, '')}/message/sendText/${encodeURIComponent(cx.instancia)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cx.token }, body: JSON.stringify({ number: cx.teste, text: texto }), signal: AbortSignal.timeout(15_000),
    });
    await r.body?.cancel();
    return r.ok;
  } catch { return false; }
}

/** Já falhou, ou está pendente há mais de 2 min (o envio normal sai em segundos). */
const atrasada = (l: { tentativas: number; criado_em: string }) => l.tentativas > 0 || Date.now() - Date.parse(l.criado_em) > 2 * 60_000;

const COLUNAS = 'id, protocolo, tipo, mensagem, identificado, nome, email, criado_em, tentativas';

/** E-mails que não saíram: tenta de novo os que chegaram na vez; avisa dos atrasados. */
async function reenviar(db: Banco, forcar = false) {
  const inicio = Date.now();
  await avisarAtrasadas(db).catch(() => {});
  let q = db.from('ouvidoria_mensagens').select(COLUNAS).is('email_enviado_em', null);
  if (!forcar) q = q.lte('proxima_tentativa', new Date().toISOString());
  const pendentes = ok(await q.order('criado_em', { ascending: true }).limit(50), 'pendentes') as Linha[];
  let enviados = 0;
  for (const l of pendentes) {
    if (Date.now() - inicio > RODADA_MS) break; // o resto fica para a próxima rodada
    // "Reenviar agora" no app: só o que já falhou ou está atrasado (nunca disputa com um envio que acabou de sair).
    if (forcar && !atrasada(l)) continue;
    if (await tentarEmail(db, l, { forcar })) enviados++;
  }
  return { pendentes: pendentes.length, enviados };
}

/** Aviso (uma vez por mensagem) do que está pendente há mais de 15 min. Roda antes do reenvio: sai mesmo se o e-mail travar. */
async function avisarAtrasadas(db: Banco) {
  const atrasadas = ok(await db.from('ouvidoria_mensagens').select('id, protocolo').is('email_enviado_em', null).is('avisado_em', null)
    .lt('criado_em', new Date(Date.now() - AVISAR_APOS_MS).toISOString()).limit(20), 'atrasadas') as { id: number; protocolo: string }[];
  if (atrasadas.length) {
    const lista = atrasadas.map((a) => a.protocolo).join(', ');
    const foi = await avisar(db, `⚠️ Ouvidoria do site: ${atrasadas.length === 1 ? 'uma mensagem não saiu' : `${atrasadas.length} mensagens não saíram`} por e-mail (${lista}).\n\nEstão guardadas e o app segue tentando a cada 5 minutos. Dá para reenviar em Administração › Ouvidoria.`);
    if (foi) await db.from('ouvidoria_mensagens').update({ avisado_em: new Date().toISOString() }).in('id', atrasadas.map((a) => a.id));
  }
}

// --- O formulário do site ---------------------------------------------------------------------

/** Lê o corpo do site: multipart com `dados` (o normal) ou JSON (teste). */
async function lerCorpo(req: Request): Promise<unknown> {
  const tipo = req.headers.get('content-type') ?? '';
  if (tipo.includes('multipart/form-data') || tipo.includes('application/x-www-form-urlencoded')) {
    const f = await req.formData();
    const dados = f.get('dados');
    const base = typeof dados === 'string' ? JSON.parse(dados) : {};
    // O campo-isca pode vir solto no formulário (fora do JSON).
    for (const isca of ['site', 'website', 'empresa', 'url']) { const v = f.get(isca); if (typeof v === 'string' && v.trim() && base && typeof base === 'object') base[isca] = v; }
    return base;
  }
  const j = await req.json();
  return j && typeof j === 'object' && 'dados' in j ? (typeof j.dados === 'string' ? JSON.parse(j.dados) : j.dados) : j;
}

async function receber(req: Request, db: Banco): Promise<Response> {
  const tamanho = Number(req.headers.get('content-length') || 0);
  if (tamanho > MAX_CORPO) return json({ error: 'Envio grande demais.' }, 413);
  // Limite contra robôs, só em memória.
  const chave = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'sem-endereco';
  if (!limitador.permitir(chave)) return json({ error: 'Muitos envios seguidos. Tente de novo em alguns minutos.' }, 429);
  let bruto: unknown;
  try {
    const texto = await req.clone().text();
    if (texto.length > MAX_CORPO) return json({ error: 'Envio grande demais.' }, 413);
    bruto = await lerCorpo(req);
  } catch { return json({ error: 'Envio inválido.' }, 400); }
  const lido = lerEnvio(bruto);
  if (lido.ok === 'robo') return json({ ok: true }, 201);
  if (!lido.ok) return json({ error: lido.erro }, 400);
  const m = lido.mensagem;
  // Teto geral contra enxurrada (o limite por endereço vive na memória de cada processo): guarda igual, segura o e-mail.
  const recentes = await db.from('ouvidoria_mensagens').select('id', { count: 'exact', head: true }).gte('criado_em', new Date(Date.now() - 10 * 60_000).toISOString());
  const enxurrada = !recentes.error && (recentes.count ?? 0) >= TETO_EM_10_MIN;
  let linha: { id: number; protocolo: string; criado_em: string };
  try {
    const r = ok(await db.rpc('ouvidoria_registrar', { p_tipo: m.tipo, p_mensagem: m.mensagem, p_identificado: m.identificado, p_nome: m.nome, p_email: m.email }), 'registrar');
    linha = (Array.isArray(r) ? r[0] : r) as typeof linha;
    if (!linha?.protocolo) throw new Error('registrar: sem protocolo');
  } catch (e) {
    console.error('[ouvidoria] não consegui guardar:', e instanceof Error ? e.message.slice(0, 200) : 'erro');
    return json({ error: 'Não foi possível registrar agora. Tente de novo em instantes.' }, 503);
  }
  if (enxurrada) {
    // Guardada; o e-mail fica para o agendamento (solta a vez de quem criou e espera um pouco).
    await db.from('ouvidoria_mensagens').update({ enviando_ate: SEM_VEZ, proxima_tentativa: new Date(Date.now() + ESPERA_NA_ENXURRADA_MS).toISOString() }).eq('id', linha.id);
    return json({ ok: true, protocolo: linha.protocolo }, 201);
  }
  // O e-mail sai depois da resposta (o site espera no máximo 30 s); se falhar, o agendamento tenta de novo.
  const enviar = tentarEmail(db, { ...m, id: linha.id, protocolo: linha.protocolo, criado_em: linha.criado_em, tentativas: 0 }, { jaEhMinha: true }).catch(() => false);
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(enviar); else await enviar;
  return json({ ok: true, protocolo: linha.protocolo }, 201);
}

// --- O cartão do app -------------------------------------------------------------------------

async function podeVer(db: Banco, req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const { data } = await db.auth.getUser(auth.slice(7));
  if (!data?.user) return false;
  const [rh, mkt] = await Promise.all([
    db.rpc('is_rh_or_admin', { _user_id: data.user.id }),
    db.rpc('is_marketing_user', { _user_id: data.user.id }),
  ]);
  return rh.data === true || mkt.data === true;
}

/** Inícios do mês em Brasília, em UTC. */
function inicioDoMes(agora = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(agora).map((x) => [x.type, x.value]));
  return new Date(`${p.year}-${p.month}-01T00:00:00-03:00`).toISOString();
}

/** O que o cartão mostra: endereço, destino, contagens e pendências. Nunca o conteúdo. */
async function estado(db: Banco) {
  const [mes, ultima, ultimoEnvio, pendentes] = await Promise.all([
    db.from('ouvidoria_mensagens').select('id', { count: 'exact', head: true }).gte('criado_em', inicioDoMes()),
    db.from('ouvidoria_mensagens').select('protocolo, criado_em').order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    db.from('ouvidoria_mensagens').select('email_enviado_em').not('email_enviado_em', 'is', null).order('email_enviado_em', { ascending: false }).limit(1).maybeSingle(),
    db.from('ouvidoria_mensagens').select('protocolo, tipo, criado_em, tentativas, ultimo_erro, proxima_tentativa').is('email_enviado_em', null).order('criado_em', { ascending: true }).limit(20),
  ]);
  for (const r of [mes, ultima, ultimoEnvio, pendentes]) if (r.error) throw new Error(r.error.message);
  return {
    endereco: ENDERECO, para: PARA, copia: COPIA,
    mes: mes.count ?? 0,
    ultima: ultima.data ?? null,
    ultimo_envio: ultimoEnvio.data?.email_enviado_em ?? null,
    pendentes: (pendentes.data ?? []).filter(atrasada),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const db = banco();
    const segredo = req.headers.get('x-ouvidoria-segredo');
    const ehJson = (req.headers.get('content-type') ?? '').includes('application/json');
    if (segredo) {
      const est = ok(await db.from('ouvidoria_estado').select('segredo').eq('id', 1).single(), 'segredo');
      if (segredo !== est.segredo) return json({ error: 'Não autorizado.' }, 401);
      return json(await reenviar(db));
    }
    // O app (com login) manda { acao }; o site manda o formulário.
    if (ehJson && req.headers.get('Authorization')) {
      // deno-lint-ignore no-explicit-any
      let corpo: any = null;
      try { corpo = await req.clone().json(); } catch { /* segue como formulário */ }
      if (corpo && typeof corpo === 'object' && typeof corpo.acao === 'string') {
        if (!(await podeVer(db, req))) return json({ error: 'Só a administração e o marketing.' }, 403);
        if (corpo.acao === 'estado') return json(await estado(db));
        if (corpo.acao === 'reenviar') { const r = await reenviar(db, true); return json({ ...r, ...(await estado(db)) }); }
        return json({ error: 'Ação inválida.' }, 400);
      }
    }
    return await receber(req, db);
  } catch (e) {
    console.error('[ouvidoria]', e instanceof Error ? e.message.slice(0, 200) : 'erro');
    return json({ error: 'Erro ao responder. Tente de novo em instantes.' }, 500);
  }
});

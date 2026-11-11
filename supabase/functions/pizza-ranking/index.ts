import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer@6.9.16';
import { desenharRanking, type Recursos } from './arte.ts';
import { calcularRanking, dataCurta, diasQueFaltam, mensagemDoRanking, textoDosDias, type Pedido } from './ranking.ts';

addEventListener('unhandledrejection', (e) => { console.error('[pizza-ranking] promessa solta:', e.reason); e.preventDefault(); });

/**
 * Pizza da Alegria: o ranking da disputa no grupo de WhatsApp (11/11/2026).
 *
 * A arte (arte.ts) e a mensagem (ranking.ts) são feitas aqui, sem navegador,
 * e vão pelo Evolution API (serviço próprio no Coolify, ligado ao WhatsApp da
 * MKT) para o grupo ANABRASIL PUBLICAÇÕES, às sextas, 15h em Brasília:
 * 13/11, 20/11, 27/11 e 04/12 (decisão dele). Os campeões saem em 17/12.
 *
 * Quem chama:
 *  - o banco (pg_cron + pg_net, toda sexta às 18h UTC), com { acao: 'agendado' }
 *    e o cabeçalho x-ranking-segredo: só envia numa das datas, entre 14h45 e
 *    16h, com o envio automático ligado e se o grupo ainda não recebeu no dia;
 *  - o painel (ADM, comunicação e financeiro veem; só a comunicação envia):
 *    'estado', 'arte' (a prévia), 'enviar' (teste para o próprio número ou o
 *    grupo agora) e 'ligar' (o envio automático, que nasce desligado).
 *
 * A configuração (endereço do Evolution, instância, token, grupo, número de
 * teste, segredo do agendamento) fica em `pizza_ranking_config`, que só a
 * chave de serviço lê: o token é colado por ele no SQL Editor, nunca no
 * código nem no chat. Cada tentativa fica em `pizza_ranking_envios`.
 * Falhou o envio ao grupo: tenta de novo uma vez, depois avisa no próprio
 * WhatsApp da MKT e por e-mail (se o SMTP estiver no container).
 *
 * As fontes Poppins e a foto das pizzas vêm do site (public/ranking/); o
 * motor do SVG (resvg) vem do unpkg ou do jsDelivr. Tudo fica guardado entre
 * uma chamada e outra.
 */

/** As sextas da disputa, 15h em Brasília. */
export const DATAS_DO_ENVIO = ['2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RECURSOS_URL = (Deno.env.get('RANKING_RECURSOS_URL') || 'https://app.anabrasil.org/ranking').replace(/\/$/, '');

interface Config {
  evolution_url: string | null;
  instancia: string;
  token: string | null;
  grupo: string;
  grupo_nome: string;
  teste: string;
  aviso_email: string | null;
  segredo: string;
  ligado: boolean;
}
type Destino = 'grupo' | 'teste';
type Origem = 'agendado' | 'painel';

const hojeEmBrasilia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
function minutosEmBrasilia(d: Date): number {
  const [h, m] = d.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  return (h % 24) * 60 + m;
}
/** A próxima sexta do envio que ainda não passou das 15h. */
export function proximoEnvio(agora: Date): string | null {
  return DATAS_DO_ENVIO.find((d) => new Date(`${d}T15:00:00-03:00`).getTime() > agora.getTime()) ?? null;
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// --- A arte ----------------------------------------------------------------------------------

let recursos: Promise<Recursos> | null = null;
function carregarRecursos(): Promise<Recursos> {
  recursos ??= (async () => {
    const baixar = async (f: string) => {
      const r = await fetch(`${RECURSOS_URL}/${f}`, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`não baixei ${f} do site (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    };
    const [m, s, e, b, foto] = await Promise.all(['Poppins-Medium.ttf', 'Poppins-SemiBold.ttf', 'Poppins-ExtraBold.ttf', 'Poppins-Black.ttf', 'pizzas.jpg'].map(baixar));
    return { fontes: { 500: m, 600: s, 800: e, 900: b }, foto };
  })().catch((e) => { recursos = null; throw e; });
  return recursos;
}

// deno-lint-ignore no-explicit-any
async function pedidos(admin: any): Promise<Pedido[]> {
  const todos: Pedido[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from('pizza_confirmacoes')
      .select('nome, unidade_id, unidade_nome, quantidade, telefone, created_at')
      .order('created_at', { ascending: true }).range(de, de + 999);
    if (error) throw new Error(`banco: ${error.message}`);
    todos.push(...(data ?? []));
    if (!data || data.length < 1000) return todos;
  }
}

// deno-lint-ignore no-explicit-any
async function montar(admin: any, agora: Date) {
  const r = calcularRanking(await pedidos(admin));
  const imagem = await desenharRanking(r, dataCurta(agora), textoDosDias(diasQueFaltam(agora)), await carregarRecursos());
  return { r, imagem, mensagem: mensagemDoRanking(r, agora) };
}

// --- O WhatsApp (Evolution API) --------------------------------------------------------------

async function evolution(cfg: Config, caminho: string, corpo?: unknown): Promise<unknown> {
  const r = await fetch(`${cfg.evolution_url!.replace(/\/$/, '')}${caminho}/${encodeURIComponent(cfg.instancia)}`, {
    method: corpo ? 'POST' : 'GET',
    headers: { apikey: cfg.token!, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    // O servidor de funções encerra a chamada em 1 minuto: duas tentativas têm de caber nele.
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`WhatsApp respondeu ${r.status}: ${t.slice(0, 240)}`);
  try { return JSON.parse(t); } catch { return t; }
}

async function conferirConexao(cfg: Config) {
  if (!cfg.evolution_url || !cfg.token) throw new Error('A conexão com o WhatsApp não foi configurada (falta o endereço ou o token).');
  const e = await evolution(cfg, '/instance/connectionState') as { instance?: { state?: string } };
  const estado = e?.instance?.state;
  if (estado !== 'open') throw new Error(`O WhatsApp da MKT está desconectado do Evolution (estado: ${estado ?? 'desconhecido'}). Reconecte pelo QR Code no Manager.`);
}

async function mandarImagem(cfg: Config, numero: string, imagem: Uint8Array, legenda: string, agora: Date): Promise<string | null> {
  await conferirConexao(cfg);
  const r = await evolution(cfg, '/message/sendMedia', {
    number: numero,
    mediatype: 'image',
    mimetype: 'image/jpeg',
    caption: legenda,
    media: base64(imagem),
    fileName: `ranking-pizza-da-alegria-${hojeEmBrasilia(agora)}.jpg`,
  }) as { key?: { id?: string } };
  return r?.key?.id ?? null;
}

// --- Registro e avisos -----------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function registrar(admin: any, e: { destino: Destino; origem: Origem; situacao: 'enviado' | 'falhou' | 'pulado'; detalhe?: string | null; pizzas?: number | null; por?: string | null }) {
  const { error } = await admin.from('pizza_ranking_envios').insert({ ...e, detalhe: e.detalhe?.slice(0, 500) ?? null });
  if (error) console.error('[pizza-ranking] registro:', error.message);
}

async function avisarFalha(cfg: Config, motivo: string) {
  const texto = `⚠️ O ranking da Pizza da Alegria não foi para o grupo ${cfg.grupo_nome} hoje às 15h.\n\nMotivo: ${motivo}\n\nDá para mandar pelo painel da Pizza (Ranking para o WhatsApp → Enviar ao grupo agora) ou baixar a imagem e mandar à mão.`;
  try { await evolution(cfg, '/message/sendText', { number: cfg.teste, text: texto }); }
  catch (e) { console.error('[pizza-ranking] aviso no WhatsApp:', e instanceof Error ? e.message : e); }
  const host = Deno.env.get('SMTP_HOST'), user = Deno.env.get('SMTP_USER'), pass = Deno.env.get('SMTP_PASS');
  if (!host || !user || !pass || !cfg.aviso_email) return;
  try {
    const porta = Number(Deno.env.get('SMTP_PORT') || 587);
    const t = nodemailer.createTransport({ host, port: porta, secure: porta === 465, auth: { user, pass } });
    await t.sendMail({ from: `ANA Brasil <${Deno.env.get('AVISOS_REMETENTE') || user}>`, to: cfg.aviso_email, subject: 'Ranking da Pizza da Alegria não foi para o grupo', text: texto });
  } catch (e) { console.error('[pizza-ranking] aviso por e-mail:', e instanceof Error ? e.message : e); }
}

// --- O envio de sexta ------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function agendado(admin: any, cfg: Config) {
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  if (!DATAS_DO_ENVIO.includes(hoje)) return json({ pulado: 'fora_das_datas', hoje });
  const pular = async (detalhe: string) => { await registrar(admin, { destino: 'grupo', origem: 'agendado', situacao: 'pulado', detalhe }); return json({ pulado: detalhe }); };
  const min = minutosEmBrasilia(agora);
  if (min < 14 * 60 + 45 || min > 16 * 60) return pular(`Fora do horário (${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')} em Brasília): confira o fuso do agendamento.`);
  if (!cfg.ligado) return pular('Envio automático desligado no painel.');
  const { data: ja } = await admin.from('pizza_ranking_envios').select('id')
    .eq('destino', 'grupo').eq('situacao', 'enviado').gte('criado_em', new Date(`${hoje}T00:00:00-03:00`).toISOString()).limit(1);
  if (ja?.length) return pular('O grupo já recebeu o ranking hoje.');

  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const m = await montar(admin, agora);
      const id = await mandarImagem(cfg, cfg.grupo, m.imagem, m.mensagem, agora);
      await registrar(admin, { destino: 'grupo', origem: 'agendado', situacao: 'enviado', pizzas: m.r.pizzas, detalhe: tentativa > 1 ? `Na 2ª tentativa (a 1ª: ${ultimoErro})` : id });
      return json({ ok: true, pizzas: m.r.pizzas });
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
      console.error(`[pizza-ranking] tentativa ${tentativa}:`, ultimoErro);
      if (tentativa === 1) await espera(5_000);
    }
  }
  await registrar(admin, { destino: 'grupo', origem: 'agendado', situacao: 'falhou', detalhe: ultimoErro });
  await avisarFalha(cfg, ultimoErro);
  return json({ ok: false, error: ultimoErro }, 502);
}

// --- Entrada ---------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  // deno-lint-ignore no-explicit-any
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }

  const { data: cfg, error: erroCfg } = await admin.from('pizza_ranking_config')
    .select('evolution_url, instancia, token, grupo, grupo_nome, teste, aviso_email, segredo, ligado').eq('id', 1).maybeSingle();
  if (erroCfg || !cfg) return json({ error: 'A configuração do ranking não existe no banco (falta rodar a migração).' }, 500);

  if (corpo.acao === 'agendado') {
    const segredo = req.headers.get('x-ranking-segredo') || '';
    if (!segredo || segredo !== cfg.segredo) return json({ error: 'Não autorizado.' }, 401);
    return await agendado(admin, cfg as Config);
  }

  // Daqui para baixo, o painel.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (!quem?.user) return json({ error: 'Não autorizado.' }, 401);
  const { data: podeVer } = await userClient.rpc('pode_ver_pizza', { _user_id: quem.user.id });
  if (!podeVer) return json({ error: 'Só o ADM, a comunicação e o financeiro.' }, 403);
  const { data: ehComunicacao } = await userClient.rpc('is_marketing_user', { _user_id: quem.user.id });
  const agora = new Date();

  try {
    if (corpo.acao === 'estado') {
      const { data: envios } = await admin.from('pizza_ranking_envios')
        .select('criado_em, destino, origem, situacao, detalhe, pizzas').order('criado_em', { ascending: false }).limit(8);
      return json({
        configurado: !!(cfg.evolution_url && cfg.token),
        ligado: cfg.ligado,
        grupo: cfg.grupo_nome,
        datas: DATAS_DO_ENVIO,
        proximo: proximoEnvio(agora),
        podeEnviar: !!ehComunicacao,
        envios: envios ?? [],
      });
    }

    if (corpo.acao === 'arte') {
      const m = await montar(admin, agora);
      return json({ imagem: base64(m.imagem), mensagem: m.mensagem });
    }

    if (!ehComunicacao) return json({ error: 'Só a comunicação envia o ranking.' }, 403);

    if (corpo.acao === 'ligar') {
      const ligado = corpo.ligado === true;
      const { error } = await admin.from('pizza_ranking_config').update({ ligado, atualizado_em: agora.toISOString(), atualizado_por: quem.user.id }).eq('id', 1);
      if (error) throw new Error(error.message);
      return json({ ligado });
    }

    if (corpo.acao === 'enviar') {
      const destino: Destino = corpo.destino === 'grupo' ? 'grupo' : 'teste';
      let pizzas: number | null = null;
      try {
        const m = await montar(admin, agora);
        pizzas = m.r.pizzas;
        await mandarImagem(cfg as Config, destino === 'grupo' ? cfg.grupo : cfg.teste, m.imagem, m.mensagem, agora);
        await registrar(admin, { destino, origem: 'painel', situacao: 'enviado', pizzas, por: quem.user.id });
        return json({ ok: true });
      } catch (e) {
        const motivo = e instanceof Error ? e.message : String(e);
        await registrar(admin, { destino, origem: 'painel', situacao: 'falhou', detalhe: motivo, pizzas, por: quem.user.id });
        return json({ error: motivo }, 502);
      }
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error('[pizza-ranking]', motivo);
    return json({ error: motivo }, 500);
  }
});

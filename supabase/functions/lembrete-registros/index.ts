import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer@6.9.16';
import {
  HORA_DO_LEMBRETE, MENSAGEM_PADRAO, MODELO_PADRAO, corDoDia, diaDaSemana, ehDiaDoLembrete, hojeEmBrasilia, pecasDoDia, proximoLembrete,
  type Peca,
} from './regras.ts';

addEventListener('unhandledrejection', (e) => { console.error('[lembrete-registros] promessa solta:', e.reason); e.preventDefault(); });

/**
 * O lembrete diário dos registros das unidades (24/11/2026), no padrão do
 * ranking da Pizza (função pizza-ranking): vai pelo Evolution API (WhatsApp
 * da MKT) ao grupo ANABRASIL PUBLICAÇÕES, de segunda a sexta às 10h em
 * Brasília. As peças do dia (arte + mensagem, modelo, e às segundas o "Como
 * enviar") vêm de regras.ts; as artes, do site (public/lembretes/).
 *
 * Quem chama:
 *  - o banco (pg_cron + pg_net, seg–sex às 13h UTC), com { acao: 'agendado' }
 *    e o cabeçalho x-lembrete-segredo: só envia em dia útil, entre 9h45 e
 *    11h, com o envio automático ligado e se o grupo ainda não recebeu no dia;
 *  - o painel (Marketing › Lembretes, só o marketing): 'estado', 'salvar'
 *    (mensagem e modelo), 'ligar' e 'enviar' (teste para o próprio número ou
 *    o grupo agora).
 *
 * A conexão (endereço do Evolution, instância, token, grupo, número de teste,
 * e-mail de aviso) é a mesma do ranking: pizza_ranking_config. O interruptor,
 * o texto e o segredo ficam em lembrete_registros_config; as tentativas, em
 * lembrete_registros_envios. Falhou ao grupo: tenta de novo uma vez, depois
 * avisa no WhatsApp da MKT e por e-mail.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ARTES_URL = (Deno.env.get('LEMBRETE_ARTES_URL') || 'https://app.anabrasil.org/lembretes').replace(/\/$/, '');

interface Conexao { evolution_url: string | null; instancia: string; token: string | null; grupo: string; grupo_nome: string; teste: string; aviso_email: string | null }
interface Config { ligado: boolean; mensagem: string; modelo: string; segredo: string }
type Destino = 'grupo' | 'teste';
type Origem = 'agendado' | 'painel';

function minutosEmBrasilia(d: Date): number {
  const [h, m] = d.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  return (h % 24) * 60 + m;
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const mensagemDe = (c: Config) => c.mensagem.trim() || MENSAGEM_PADRAO;
const modeloDe = (c: Config) => c.modelo.trim() || MODELO_PADRAO;

// --- O WhatsApp (Evolution API) --------------------------------------------------------------

async function evolution(cx: Conexao, caminho: string, corpo?: unknown): Promise<unknown> {
  const r = await fetch(`${cx.evolution_url!.replace(/\/$/, '')}${caminho}/${encodeURIComponent(cx.instancia)}`, {
    method: corpo ? 'POST' : 'GET',
    headers: { apikey: cx.token!, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`WhatsApp respondeu ${r.status}: ${t.slice(0, 240)}`);
  try { return JSON.parse(t); } catch { return t; }
}

async function conferirConexao(cx: Conexao) {
  if (!cx.evolution_url || !cx.token) throw new Error('A conexão com o WhatsApp não foi configurada (falta o endereço ou o token do ranking da Pizza).');
  const e = await evolution(cx, '/instance/connectionState') as { instance?: { state?: string } };
  const estado = e?.instance?.state;
  if (estado !== 'open') throw new Error(`O WhatsApp da MKT está desconectado do Evolution (estado: ${estado ?? 'desconhecido'}). Reconecte pelo QR Code no Manager.`);
}

const artes = new Map<string, string>();
async function arte(arquivo: string): Promise<string> {
  const guardada = artes.get(arquivo);
  if (guardada) return guardada;
  const r = await fetch(`${ARTES_URL}/${arquivo}`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`não baixei a arte ${arquivo} do site (${r.status})`);
  const b = base64(new Uint8Array(await r.arrayBuffer()));
  artes.set(arquivo, b);
  return b;
}

/**
 * Manda as peças do dia, na ordem, ao número (grupo ou teste). `feitas`
 * conta as que já foram: a nova tentativa continua de onde parou, sem repetir
 * no grupo a arte que já chegou.
 */
async function mandar(cx: Conexao, numero: string, pecas: Peca[], feitas = { n: 0 }) {
  await conferirConexao(cx);
  for (const p of pecas.slice(feitas.n)) {
    if (p.tipo === 'imagem') {
      await evolution(cx, '/message/sendMedia', { number: numero, mediatype: 'image', mimetype: 'image/jpeg', caption: p.legenda, media: await arte(p.arquivo), fileName: p.arquivo });
    } else {
      await evolution(cx, '/message/sendText', { number: numero, text: p.texto });
    }
    feitas.n++;
    await espera(1_200); // a ordem certa no grupo
  }
}

// --- Registro e avisos -----------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function registrar(admin: any, e: { destino: Destino; origem: Origem; situacao: 'enviado' | 'falhou' | 'pulado'; dia?: string; pecas?: number; detalhe?: string | null; por?: string | null }) {
  const cor = e.dia ? corDoDia(e.dia) : null;
  const { error } = await admin.from('lembrete_registros_envios').insert({
    destino: e.destino, origem: e.origem, situacao: e.situacao, cor, dia: e.dia ?? null, pecas: e.pecas ?? 0,
    com_como_enviar: !!e.dia && diaDaSemana(e.dia) === 1 && e.situacao === 'enviado',
    detalhe: e.detalhe?.slice(0, 500) ?? null, por: e.por ?? null,
  });
  if (error) console.error('[lembrete-registros] registro:', error.message);
}

async function avisarFalha(cx: Conexao, motivo: string) {
  const texto = `⚠️ O lembrete dos registros não foi para o grupo ${cx.grupo_nome} hoje às ${HORA_DO_LEMBRETE}h.\n\nMotivo: ${motivo}\n\nDá para mandar pelo app (Marketing › Lembretes → Enviar ao grupo agora).`;
  try { await evolution(cx, '/message/sendText', { number: cx.teste, text: texto }); }
  catch (e) { console.error('[lembrete-registros] aviso no WhatsApp:', e instanceof Error ? e.message : e); }
  const host = Deno.env.get('SMTP_HOST'), user = Deno.env.get('SMTP_USER'), pass = Deno.env.get('SMTP_PASS');
  if (!host || !user || !pass || !cx.aviso_email) return;
  try {
    const porta = Number(Deno.env.get('SMTP_PORT') || 587);
    const t = nodemailer.createTransport({ host, port: porta, secure: porta === 465, auth: { user, pass } });
    await t.sendMail({ from: `ANA Brasil <${Deno.env.get('AVISOS_REMETENTE') || user}>`, to: cx.aviso_email, subject: 'O lembrete dos registros não foi para o grupo', text: texto });
  } catch (e) { console.error('[lembrete-registros] aviso por e-mail:', e instanceof Error ? e.message : e); }
}

/**
 * O que o grupo já recebeu do lembrete de `dia`: se chegou completo e quantas
 * peças chegaram nas tentativas que falharam no meio (para continuar dali).
 */
// deno-lint-ignore no-explicit-any
async function noGrupo(admin: any, dia: string): Promise<{ completo: boolean; pecas: number }> {
  const { data } = await admin.from('lembrete_registros_envios').select('situacao, pecas').eq('destino', 'grupo').eq('dia', dia);
  const linhas = (data ?? []) as { situacao: string; pecas: number }[];
  return { completo: linhas.some(l => l.situacao === 'enviado'), pecas: Math.max(0, ...linhas.map(l => l.pecas ?? 0)) };
}

// --- O envio agendado ------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function agendado(admin: any, cx: Conexao, cfg: Config) {
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  if (!ehDiaDoLembrete(hoje)) return json({ pulado: 'fim_de_semana', hoje });
  const pular = async (detalhe: string) => { await registrar(admin, { destino: 'grupo', origem: 'agendado', situacao: 'pulado', dia: hoje, detalhe }); return json({ pulado: detalhe }); };
  const min = minutosEmBrasilia(agora);
  if (min < HORA_DO_LEMBRETE * 60 - 15 || min > (HORA_DO_LEMBRETE + 1) * 60) return pular(`Fora do horário (${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')} em Brasília): confira o fuso do agendamento.`);
  if (!cfg.ligado) return pular('Envio automático desligado no painel.');
  const ja = await noGrupo(admin, hoje);
  if (ja.completo) return pular('O grupo já recebeu o lembrete hoje.');

  const pecas = pecasDoDia(hoje, mensagemDe(cfg), modeloDe(cfg));
  let ultimoErro = '';
  const feitas = { n: Math.min(ja.pecas, pecas.length) };
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await mandar(cx, cx.grupo, pecas, feitas);
      await registrar(admin, { destino: 'grupo', origem: 'agendado', situacao: 'enviado', dia: hoje, pecas: feitas.n, detalhe: tentativa > 1 ? `Na 2ª tentativa (a 1ª: ${ultimoErro})` : null });
      return json({ ok: true });
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
      console.error(`[lembrete-registros] tentativa ${tentativa}:`, ultimoErro);
      if (tentativa === 1) await espera(5_000);
    }
  }
  const detalhe = feitas.n ? `${ultimoErro} (chegaram ${feitas.n} de ${pecas.length} peças; o "Enviar ao grupo agora" manda só o resto)` : ultimoErro;
  await registrar(admin, { destino: 'grupo', origem: 'agendado', situacao: 'falhou', dia: hoje, pecas: feitas.n, detalhe });
  await avisarFalha(cx, detalhe);
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

  const { data: cfg, error: erroCfg } = await admin.from('lembrete_registros_config').select('ligado, mensagem, modelo, segredo').eq('id', 1).maybeSingle();
  if (erroCfg || !cfg) return json({ error: 'A configuração do lembrete não existe no banco (falta rodar a migração).' }, 500);
  const { data: cx } = await admin.from('pizza_ranking_config').select('evolution_url, instancia, token, grupo, grupo_nome, teste, aviso_email').eq('id', 1).maybeSingle();
  if (!cx) return json({ error: 'A conexão com o WhatsApp (pizza_ranking_config) não existe no banco.' }, 500);

  if (corpo.acao === 'agendado') {
    const segredo = req.headers.get('x-lembrete-segredo') || '';
    if (!segredo || segredo !== cfg.segredo) return json({ error: 'Não autorizado.' }, 401);
    return await agendado(admin, cx as Conexao, cfg as Config);
  }

  // Daqui para baixo, o painel: só o marketing.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (!quem?.user) return json({ error: 'Não autorizado.' }, 401);
  const { data: ehMarketing } = await userClient.rpc('is_marketing_user', { _user_id: quem.user.id });
  if (!ehMarketing) return json({ error: 'Só o marketing.' }, 403);
  const agora = new Date();

  try {
    if (corpo.acao === 'estado') {
      const { data: envios } = await admin.from('lembrete_registros_envios')
        .select('criado_em, destino, origem, situacao, cor, com_como_enviar, detalhe').order('criado_em', { ascending: false }).limit(10);
      const hoje = hojeEmBrasilia(agora);
      const enviadoHoje = ehDiaDoLembrete(hoje) && (await noGrupo(admin, hoje)).completo;
      return json({
        configurado: !!(cx.evolution_url && cx.token),
        ligado: cfg.ligado,
        grupo: cx.grupo_nome,
        // Se o grupo já recebeu hoje, o das 10h não manda: o próximo é o dia útil seguinte.
        proximo: enviadoHoje ? proximoLembrete(new Date(`${hoje}T23:59:00-03:00`)) : proximoLembrete(agora),
        enviadoHoje,
        mensagem: mensagemDe(cfg as Config),
        modelo: modeloDe(cfg as Config),
        envios: envios ?? [],
      });
    }

    if (corpo.acao === 'ligar') {
      const ligado = corpo.ligado === true;
      const { error } = await admin.from('lembrete_registros_config').update({ ligado, atualizado_em: agora.toISOString(), atualizado_por: quem.user.id }).eq('id', 1);
      if (error) throw new Error(error.message);
      return json({ ligado });
    }

    if (corpo.acao === 'salvar') {
      const mensagem = String(corpo.mensagem ?? '').slice(0, 3000);
      const modelo = String(corpo.modelo ?? '').slice(0, 1000);
      if (!mensagem.trim()) return json({ error: 'A mensagem não pode ficar vazia.' }, 400);
      const { error } = await admin.from('lembrete_registros_config').update({ mensagem, modelo, atualizado_em: agora.toISOString(), atualizado_por: quem.user.id }).eq('id', 1);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (corpo.acao === 'enviar') {
      const destino: Destino = corpo.destino === 'grupo' ? 'grupo' : 'teste';
      const hoje = hojeEmBrasilia(agora);
      const pecas = (d: string) => pecasDoDia(d, mensagemDe(cfg as Config), modeloDe(cfg as Config));
      const feitas = { n: 0 };
      let dia = hoje;
      if (destino === 'grupo') {
        // Ao grupo, só o lembrete de hoje, num dia útil, e só o que ainda não chegou.
        if (!ehDiaDoLembrete(hoje)) return json({ error: 'No fim de semana não vai lembrete ao grupo. Mande o teste para conferir o de segunda.' }, 400);
        const ja = await noGrupo(admin, hoje);
        if (ja.completo) return json({ error: 'O grupo já recebeu o lembrete de hoje.' }, 409);
        feitas.n = Math.min(ja.pecas, pecas(hoje).length);
      } else {
        // O teste: hoje, se for dia útil; senão, o dia que o painel mostra (para conferir o "Como enviar" de segunda).
        if (!ehDiaDoLembrete(dia)) dia = proximoLembrete(agora);
        if (typeof corpo.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia) && ehDiaDoLembrete(corpo.dia)) dia = corpo.dia;
      }
      try {
        await mandar(cx as Conexao, destino === 'grupo' ? cx.grupo : cx.teste, pecas(dia), feitas);
        await registrar(admin, { destino, origem: 'painel', situacao: 'enviado', dia, pecas: feitas.n, por: quem.user.id });
        return json({ ok: true });
      } catch (e) {
        const motivo = e instanceof Error ? e.message : String(e);
        await registrar(admin, { destino, origem: 'painel', situacao: 'falhou', dia, pecas: feitas.n, detalhe: motivo, por: quem.user.id });
        return json({ error: motivo }, 502);
      }
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error('[lembrete-registros]', motivo);
    return json({ error: motivo }, 500);
  }
});

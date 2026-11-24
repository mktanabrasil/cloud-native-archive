import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer@6.9.16';
import { ehEmailGestor } from '../google-drive-proxy/regras.ts';
import {
  ATALHO, NATIVO, PASTA, chaveDe, contar, ehChave, ehFinalizada, grupoDa, mostraNaTela, nomeDaUnidade, nomeParaBaixar, ordemDa, ordenar, quedaSuspeita, slugDe, slugLivre, tipoDo,
  type Documento, type ItemDoDrive, type ItemGuardado, type Pasta,
} from './regras.ts';

addEventListener('unhandledrejection', (e) => { console.error('[transparencia] promessa solta:', e.reason); e.preventDefault(); });

/**
 * API pública do Portal Transparência (24/11/2026), para o site do ANA.
 * Contrato e explicação em LEIA-ME.md.
 *
 * Leitura (aberta, sem login, nunca consulta o Google na hora):
 *   GET  /transparencia                        → as unidades publicadas
 *   GET  /transparencia/unidade/{slug}         → pastas e documentos da unidade
 *   GET  /transparencia/arquivo/{chave}/{nome} → o documento (passa pelo nosso
 *        servidor sem ser guardado; ?baixar=1 para baixar)
 *
 * Atualização (por trás):
 *   POST { acao: 'atualizar' } com x-transparencia-segredo: o agendamento, a
 *        cada 2 minutos. Pergunta ao Drive só o que mudou, relê as unidades
 *        afetadas e troca a lista só se a leitura deu certo. Falha que dura
 *        avisa no WhatsApp da MKT e por e-mail.
 *   POST { acao: 'atualizar' | 'estado' } com login de gestor: o painel.
 */

const BASE_PUBLICA = (Deno.env.get('TRANSPARENCIA_URL') || 'https://supabase.anabrasil.org/functions/v1/transparencia').replace(/\/$/, '');
const DRIVE = 'https://www.googleapis.com/drive/v3';
const COMECAR_UNIDADE_ATE_MS = 60_000; // depois disso, as unidades que faltam ficam para o próximo ciclo
const PRAZO_DO_CICLO_MS = 100_000;     // nenhuma leitura passa disso (a trava dura 300 s)
const TRAVA_S = 300;
const PARALELO = 6;                    // pastas lidas ao mesmo tempo
const LIMITE_DE_ITENS = 20_000;        // por unidade
const RELER_TUDO_APOS_H = 24;          // releitura completa de segurança
const AVISAR_APOS_MIN = 30;            // falha que dura mais que isso vira aviso

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, if-none-match, if-modified-since, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'etag, last-modified, content-length, content-range, accept-ranges, content-disposition',
};
const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

// deno-lint-ignore no-explicit-any
type Banco = any;
const banco = (): Banco => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Resultado do supabase-js: erro vira exceção (o supabase-js não lança sozinho). */
// deno-lint-ignore no-explicit-any
function ok<T = any>(r: { data: T; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`banco (${onde}): ${r.error.message}`);
  return r.data;
}

// --- Google (só na atualização e ao abrir um documento) ---------------------------------

class ContaDesconectada extends Error {}
class ErroDoDrive extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

let tokenGuardado: { valor: string; ate: number } | null = null;
/** Token de acesso do Google. ContaDesconectada só quando a conta caiu de fato; outra falha é passageira. */
async function tokenDoGoogle(db: Banco): Promise<string> {
  if (tokenGuardado && tokenGuardado.ate > Date.now() + 5 * 60_000) return tokenGuardado.valor;
  const cfg = ok(await db.from('global_settings').select('value').eq('key', 'google_drive_refresh_token').maybeSingle(), 'token');
  const refresh = cfg?.value?.refresh_token as string | undefined;
  if (!refresh) throw new ContaDesconectada('A conta do Google Drive do portal está desconectada. Conecte de novo em Marketing › Portal Transparência.');
  for (let i = 1; ; i++) {
    let t: { access_token?: string; expires_in?: number; error?: string } = {};
    let status = 0;
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, refresh_token: refresh, grant_type: 'refresh_token' }),
        signal: AbortSignal.timeout(15_000),
      });
      status = r.status;
      t = await r.json().catch(() => ({}));
    } catch { /* rede: tenta de novo */ }
    if (t.access_token) {
      tokenGuardado = { valor: t.access_token, ate: Date.now() + (Number(t.expires_in) || 3000) * 1000 };
      return t.access_token;
    }
    if (t.error === 'invalid_grant') throw new ContaDesconectada('A conta do Google Drive do portal foi desconectada (acesso revogado ou expirado). Conecte de novo em Marketing › Portal Transparência.');
    if (i >= 3) throw new Error(`o Google não renovou o acesso (${status || 'sem resposta'})`);
    await espera(1000 * i);
  }
}

/** Chamada ao Drive com novas tentativas para limite de uso, instabilidade, rede e token vencido. */
async function drive(db: Banco, caminho: string, params: Record<string, string>): Promise<unknown> {
  const u = new URL(`${DRIVE}${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let i = 1; ; i++) {
    const token = await tokenDoGoogle(db);
    let r: Response | null = null;
    try { r = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) }); }
    catch (e) { if (i < 4) { await espera(500 * 2 ** i + Math.random() * 300); continue; } throw new Error(`o Google Drive não respondeu (${e instanceof Error ? e.name : 'rede'})`); }
    if (r.ok) return r.json();
    const corpo = await r.text().catch(() => '');
    if (r.status === 401 && i < 4) { tokenGuardado = null; continue; }
    const limite = r.status === 429 || (r.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(corpo));
    if ((limite || r.status >= 500) && i < 4) { await espera(500 * 2 ** i + Math.random() * 300); continue; }
    throw new ErroDoDrive(r.status, `o Google Drive respondeu ${r.status}`);
  }
}

async function listarPasta(db: Banco, pastaId: string): Promise<ItemDoDrive[]> {
  const itens: ItemDoDrive[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 20; i++) {
    const params: Record<string, string> = {
      q: `'${pastaId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, shortcutDetails)',
      pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    };
    if (pagina) params.pageToken = pagina;
    const r = await drive(db, '/files', params) as { files?: ItemDoDrive[]; nextPageToken?: string };
    itens.push(...(r.files ?? []));
    pagina = r.nextPageToken;
    if (!pagina) break;
  }
  return itens;
}

class TempoEsgotado extends Error {}

/**
 * Lê a árvore inteira de uma unidade, PARALELO pastas ao mesmo tempo.
 * Qualquer erro derruba a leitura toda (a lista anterior fica valendo).
 */
async function lerUnidade(db: Banco, raizId: string, segredo: string, prazo: number): Promise<{ arvore: Pasta; itens: ItemGuardado[] }> {
  // A pasta principal precisa existir, ser pasta e não estar na lixeira: senão a leitura viria vazia.
  let raizInfo: { trashed?: boolean; mimeType?: string };
  try { raizInfo = await drive(db, `/files/${raizId}`, { fields: 'id, trashed, mimeType', supportsAllDrives: 'true' }) as typeof raizInfo; }
  catch (e) { if (e instanceof ErroDoDrive && e.status === 404) throw new Error('a conta do portal não enxerga mais a pasta principal desta unidade no Drive'); throw e; }
  if (raizInfo.trashed) throw new Error('a pasta principal desta unidade está na lixeira do Drive');
  if (raizInfo.mimeType !== PASTA) throw new Error('o endereço cadastrado desta unidade não é mais uma pasta');

  const raiz: Pasta = { nome: '', pastas: [], documentos: [] };
  const itens: ItemGuardado[] = [];
  const vistas = new Set<string>([raizId]);
  const fila: { id: string; no: Pasta; nivel: number }[] = [{ id: raizId, no: raiz, nivel: 0 }];
  let pendentes = 1; // pastas na fila ou sendo lidas
  let erro: unknown = null;
  const trabalhador = async () => {
    while (!erro && pendentes > 0) {
      const tarefa = fila.shift();
      if (!tarefa) { await espera(5); continue; } // outra pasta ainda está sendo lida e pode trazer subpastas
      try {
        if (Date.now() > prazo) throw new TempoEsgotado('tempo do ciclo esgotado');
        const { id, no, nivel } = tarefa;
        for (const f of await listarPasta(db, id)) {
          const ehAtalho = f.mimeType === ATALHO;
          const alvo = ehAtalho ? f.shortcutDetails?.targetId : f.id;
          const mime = ehAtalho ? f.shortcutDetails?.targetMimeType : f.mimeType;
          const nome = (f.name ?? '').trim() || 'Sem nome';
          if (!alvo) continue;
          if (itens.length >= LIMITE_DE_ITENS) throw new Error(`a unidade passou de ${LIMITE_DE_ITENS} itens`);
          const chave = await chaveDe(segredo, alvo);
          if (mime === PASTA) {
            if (vistas.has(alvo) || nivel >= 20) continue; // atalho em círculo
            vistas.add(alvo);
            const sub: Pasta = { nome, pastas: [], documentos: [] };
            no.pastas.push(sub);
            itens.push({ chave, drive_id: alvo, tipo: 'pasta', nome, mime: PASTA, tamanho: null, modificado_em: f.modifiedTime ?? null });
            fila.push({ id: alvo, no: sub, nivel: nivel + 1 });
            pendentes++;
          } else if (mime && mime.startsWith('application/vnd.google-apps.') && !NATIVO.test(mime)) {
            continue; // formulários, mapas e afins não são documentos
          } else {
            const tamanho = f.size ? Number(f.size) : null;
            const doc: Documento = { nome, tipo: tipoDo(mime, nome), tamanho, atualizado_em: f.modifiedTime ?? null, chave };
            no.documentos.push(doc);
            itens.push({ chave, drive_id: alvo, tipo: 'arquivo', nome, mime: mime ?? null, tamanho, modificado_em: f.modifiedTime ?? null });
          }
        }
      } catch (e) { erro ??= e; }
      finally { pendentes--; }
    }
  };
  await Promise.all(Array.from({ length: PARALELO }, trabalhador));
  if (erro) throw erro;
  return { arvore: ordenar(raiz), itens };
}

// --- Leitura pública ---------------------------------------------------------------------

interface Unidade { id: string; folder_id: string; label: string; original_folder_name: string | null; slug: string | null }
interface Cache { config_id: string; arvore: Pasta | null; pastas: number; documentos: number; atualizado_em: string | null }

/** Última resposta boa de cada endereço: serve rápido e, se o banco falhar, continua servindo. */
const memoria = new Map<string, { em: number; etag: string; corpo: string }>();
const VALE_MEMORIA = 30_000;

function resumo(u: Unidade, c: Cache | null | undefined) {
  const pasta = u.original_folder_name || u.label;
  return {
    slug: u.slug!, nome: nomeDaUnidade(pasta), nome_curto: u.label, pasta,
    grupo: grupoDa(pasta), finalizada: ehFinalizada(pasta), ordem: ordemDa(pasta),
    pastas: c?.pastas ?? 0, documentos: c?.documentos ?? 0, atualizado_em: c?.atualizado_em ?? null,
    endereco: `${BASE_PUBLICA}/unidade/${u.slug}`,
  };
}
const ORDEM_DO_GRUPO = { social: 0, educacao: 1, outros: 2 } as const;

/** Põe o endereço de cada documento na árvore (o endereço não fica guardado: a base pode mudar). */
function comEnderecos(p: Pasta): Pasta {
  return {
    nome: p.nome,
    pastas: p.pastas.map(comEnderecos),
    documentos: p.documentos.map((d) => ({ ...d, endereco: `${BASE_PUBLICA}/arquivo/${d.chave}/${encodeURIComponent(d.nome)}` })),
  };
}

/** If-None-Match pode vir em lista, com W/ ou *. */
const casaEtag = (cabecalho: string | null, etag: string) =>
  !!cabecalho && cabecalho.split(',').map((s) => s.trim().replace(/^W\//, '')).some((s) => s === '*' || s === etag);

class NaoEncontrado extends Error {}
/** Unidade cadastrada que ainda não tem nenhuma lista boa (nunca foi lida com sucesso). */
class AindaSemLista extends Error {}
const comPrazo = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, espera(ms).then(() => { throw new Error('o banco demorou para responder'); })]);

async function respostaGuardada(req: Request, chave: string, montar: () => Promise<unknown>): Promise<Response> {
  let m = memoria.get(chave);
  let velha = false;
  if (!m || Date.now() - m.em > VALE_MEMORIA) {
    try {
      // Com uma resposta boa guardada, o visitante não espera o banco mais que 2,5 s.
      const texto = JSON.stringify(await (m ? comPrazo(montar(), 2_500) : comPrazo(montar(), 15_000)));
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto)));
      const etag = `"${[...bytes.subarray(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('')}"`;
      m = { em: Date.now(), etag, corpo: texto };
      memoria.set(chave, m);
    } catch (e) {
      if (e instanceof NaoEncontrado) return json({ error: e.message }, 404, { 'Cache-Control': 'public, max-age=30' });
      if (!(e instanceof AindaSemLista)) console.error('[transparencia] leitura:', e instanceof Error ? e.message : e);
      // O banco falhou: serve a última resposta boa, se houver (e só tenta o banco de novo daqui a 10 s).
      if (!m) return json({ error: e instanceof AindaSemLista ? e.message : 'Não foi possível carregar agora. Tente de novo em instantes.' }, 503, { 'Retry-After': '30' });
      m.em = Date.now() - VALE_MEMORIA + 10_000;
      velha = true;
    }
  }
  const cab = { ...cors, 'Content-Type': 'application/json; charset=utf-8', ETag: m.etag, 'Cache-Control': velha ? 'public, max-age=30, stale-if-error=86400' : 'public, max-age=60, stale-while-revalidate=600, stale-if-error=86400' };
  if (casaEtag(req.headers.get('if-none-match'), m.etag)) return new Response(null, { status: 304, headers: cab });
  return new Response(req.method === 'HEAD' ? null : m.corpo, { status: 200, headers: cab });
}

async function listaDeUnidades(db: Banco) {
  const [us, cs] = await Promise.all([
    db.from('transparency_configs').select('id, folder_id, label, original_folder_name, slug').then((r: never) => ok(r, 'unidades')),
    db.from('transparencia_unidades').select('config_id, pastas, documentos, atualizado_em').then((r: never) => ok(r, 'listas')),
  ]);
  const porId = new Map<string, Cache>((cs ?? []).map((c: Cache) => [c.config_id, c]));
  // Só entra quem já tem uma lista boa: unidade nova aparece depois da primeira leitura.
  const unidades = ((us ?? []) as Unidade[]).filter((u) => u.slug && porId.get(u.id)?.atualizado_em).map((u) => resumo(u, porId.get(u.id)))
    .sort((a, b) => ORDEM_DO_GRUPO[a.grupo] - ORDEM_DO_GRUPO[b.grupo] || (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const datas = unidades.map((u) => u.atualizado_em).filter(Boolean) as string[];
  return { unidades, atualizado_em: datas.sort().at(-1) ?? null };
}

async function umaUnidade(db: Banco, slug: string) {
  const u = ok(await db.from('transparency_configs').select('id, folder_id, label, original_folder_name, slug').eq('slug', slug).maybeSingle(), 'unidade') as Unidade | null;
  if (!u) throw new NaoEncontrado('Unidade não encontrada.');
  const c = ok(await db.from('transparencia_unidades').select('config_id, arvore, pastas, documentos, atualizado_em').eq('config_id', u.id).maybeSingle(), 'lista') as Cache | null;
  if (!c?.arvore || !c.atualizado_em) throw new AindaSemLista('A lista desta unidade ainda está sendo carregada. Tente de novo em alguns minutos.');
  const arvore = comEnderecos(c.arvore);
  return { unidade: resumo(u, c), atualizado_em: c?.atualizado_em ?? null, pastas: arvore.pastas, documentos: arvore.documentos };
}

const PAGINA_DE_ERRO = (titulo: string, texto: string) => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} · Portal da Transparência</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#1f2322"><h1 style="font-size:22px">${titulo}</h1><p style="color:#555;line-height:1.5">${texto}</p><p style="color:#888;font-size:13px">Portal da Transparência · ANA Brasil</p></body></html>`;
const html = (status: number, titulo: string, texto: string, extra: Record<string, string> = {}) =>
  new Response(PAGINA_DE_ERRO(titulo, texto), { status, headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", ...extra } });
const INDISPONIVEL = () => html(503, 'Documento indisponível no momento', 'Não conseguimos abrir este documento agora. Tente de novo em alguns minutos.', { 'Retry-After': '60' });

/** Entrega o documento: busca no Drive e repassa ao visitante, sem guardar. */
async function arquivo(req: Request, db: Banco, chave: string, baixar: boolean): Promise<Response> {
  if (!ehChave(chave)) return html(404, 'Documento não encontrado', 'O endereço deste documento não existe.');
  let item: { drive_id: string; nome: string; mime: string | null; tamanho: number | null; modificado_em: string | null } | undefined;
  try {
    const d = ok(await comPrazo(db.from('transparencia_itens').select('drive_id, nome, mime, tamanho, modificado_em').eq('chave', chave).eq('tipo', 'arquivo').limit(1), 8_000), 'arquivo');
    item = d?.[0];
  } catch (e) { console.error('[transparencia]', e instanceof Error ? e.message : e); return INDISPONIVEL(); }
  if (!item) return html(404, 'Documento não encontrado', 'Este documento foi retirado do portal ou mudou de lugar. Volte à lista da unidade para ver a versão atual.');

  const nativo = !!item.mime && NATIVO.test(item.mime);
  const tipoReal = nativo ? 'application/pdf' : (item.mime || 'application/octet-stream');
  // Só PDF, imagem e texto simples abrem na tela; o resto sempre baixa (nada roda no nosso domínio).
  const naTela = mostraNaTela(tipoReal) && !baixar;
  const nome = nomeParaBaixar(item.nome, item.mime);
  const versao = item.modificado_em ? Date.parse(item.modificado_em) || 0 : 0;
  const etag = `"${chave}-${versao}"`;
  const cab: Record<string, string> = {
    ...cors,
    'Content-Type': naTela ? tipoReal : (mostraNaTela(tipoReal) ? tipoReal : 'application/octet-stream'),
    'Content-Disposition': `${naTela ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nome)}`,
    'Cache-Control': 'public, max-age=300', ETag: etag, 'X-Content-Type-Options': 'nosniff',
  };
  if (item.modificado_em) cab['Last-Modified'] = new Date(item.modificado_em).toUTCString();
  if (!mostraNaTela(tipoReal)) cab['Content-Security-Policy'] = "sandbox; default-src 'none'";
  if (casaEtag(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers: cab });
  if (req.method === 'HEAD') { if (item.tamanho && !nativo) cab['Content-Length'] = String(item.tamanho); return new Response(null, { status: 200, headers: cab }); }

  const u = nativo
    ? `${DRIVE}/files/${item.drive_id}/export?mimeType=application/pdf`
    : `${DRIVE}/files/${item.drive_id}?alt=media&supportsAllDrives=true`;
  // Range só vale se o If-Range (quando houver) for da versão atual.
  const ifRange = req.headers.get('if-range');
  const range = !nativo && (!ifRange || ifRange === etag) ? req.headers.get('range') : null;
  let r: Response | null = null;
  for (let i = 1; i <= 2 && !r; i++) {
    let token: string;
    try { token = await tokenDoGoogle(db); } catch (e) { console.error('[transparencia] arquivo/token', e instanceof Error ? e.message : e); return INDISPONIVEL(); }
    // Prazo só até o Google começar a responder; depois o arquivo corre sem limite. Visitante que fecha a aba cancela.
    const ctl = new AbortController();
    const prazo = setTimeout(() => ctl.abort(), 30_000);
    const cancelar = () => ctl.abort();
    req.signal?.addEventListener?.('abort', cancelar);
    try {
      const resp = await fetch(u, { headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity', ...(range ? { Range: range } : {}) }, signal: ctl.signal });
      if (resp.status === 401 && i === 1) { tokenGuardado = null; await resp.body?.cancel(); continue; }
      r = resp;
    } catch (e) {
      console.error('[transparencia] arquivo/fetch', e instanceof Error ? e.name : e);
      return INDISPONIVEL();
    } finally { clearTimeout(prazo); }
  }
  if (!r) return INDISPONIVEL();
  if (r.status === 416) {
    await r.body?.cancel();
    return new Response(null, { status: 416, headers: { ...cors, 'Content-Range': r.headers.get('content-range') ?? `bytes */${item.tamanho ?? '*'}` } });
  }
  if (!r.ok || !r.body) {
    console.error('[transparencia] arquivo', r.status);
    await r.body?.cancel();
    if (r.status === 404) return html(404, 'Documento não encontrado', 'Este documento não está mais disponível. Volte à lista da unidade para ver a versão atual.');
    return INDISPONIVEL();
  }
  for (const h of ['content-length', 'content-range', 'accept-ranges']) { const v = r.headers.get(h); if (v) cab[h] = v; }
  if (r.headers.get('content-encoding')) delete cab['content-length'];
  if (!nativo && !cab['accept-ranges']) cab['accept-ranges'] = 'bytes';
  return new Response(r.body, { status: r.status === 206 ? 206 : 200, headers: cab });
}

// --- Atualização -------------------------------------------------------------------------

/** Dá endereço (slug) às unidades que ainda não têm. */
async function completarSlugs(db: Banco) {
  const us = ok(await db.from('transparency_configs').select('id, label, original_folder_name, slug'), 'slugs') as Unidade[];
  const usados = new Set(us.map((u) => u.slug).filter(Boolean) as string[]);
  for (const u of us.filter((x) => !x.slug)) {
    const slug = slugLivre(slugDe(nomeDaUnidade(u.original_folder_name || u.label)), usados);
    usados.add(slug);
    ok(await db.from('transparency_configs').update({ slug }).eq('id', u.id), 'slug');
  }
}

const marcarTodas = async (db: Banco) => ok(await db.from('transparencia_unidades').update({ sujo: true }).eq('sujo', false), 'marcar todas');

/** Marca como "ler de novo" as unidades onde o Drive mudou algo desde a última vez. Devolve o marcador novo. */
async function marcarMudancas(db: Banco, marcador: string | null): Promise<string> {
  const inicio = async () => (await drive(db, '/changes/startPageToken', { supportsAllDrives: 'true' }) as { startPageToken: string }).startPageToken;
  if (!marcador) return await inicio();
  let pagina = marcador;
  const ids = new Set<string>();
  for (let i = 0; i < 20; i++) {
    let r: { changes?: { fileId?: string; file?: { parents?: string[] } }[]; nextPageToken?: string; newStartPageToken?: string };
    try {
      r = await drive(db, '/changes', {
        pageToken: pagina, pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', includeRemoved: 'true',
        fields: 'nextPageToken, newStartPageToken, changes(fileId, file(parents))',
      }) as typeof r;
    } catch (e) {
      // Marcador vencido: relê tudo e começa de novo.
      if (e instanceof ErroDoDrive && (e.status === 404 || e.status === 410 || e.status === 400)) { await marcarTodas(db); return await inicio(); }
      throw e;
    }
    for (const c of r.changes ?? []) { if (c.fileId) ids.add(c.fileId); for (const p of c.file?.parents ?? []) ids.add(p); }
    if (r.newStartPageToken) { pagina = r.newStartPageToken; break; }
    if (!r.nextPageToken) break;
    pagina = r.nextPageToken;
  }
  const lista = [...ids];
  const afetadas = new Set<string>();
  for (let i = 0; i < lista.length; i += 100) {
    const fatia = lista.slice(i, i + 100);
    const [a, b] = await Promise.all([
      db.from('transparencia_itens').select('config_id').in('drive_id', fatia).then((x: never) => ok(x, 'mudanças/itens')),
      db.from('transparency_configs').select('id').in('folder_id', fatia).then((x: never) => ok(x, 'mudanças/unidades')),
    ]);
    for (const x of a ?? []) afetadas.add(x.config_id);
    for (const x of b ?? []) afetadas.add(x.id);
  }
  if (afetadas.size) ok(await db.from('transparencia_unidades').update({ sujo: true }).in('config_id', [...afetadas]), 'marcar mudanças');
  return pagina;
}

async function avisar(db: Banco, texto: string, assunto: string) {
  const { data: cx } = await db.from('pizza_ranking_config').select('evolution_url, instancia, token, teste, aviso_email').eq('id', 1).maybeSingle();
  if (cx?.evolution_url && cx?.token && cx?.teste) {
    try {
      await fetch(`${String(cx.evolution_url).replace(/\/$/, '')}/message/sendText/${encodeURIComponent(cx.instancia)}`, {
        method: 'POST', headers: { apikey: cx.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ number: cx.teste, text: texto }), signal: AbortSignal.timeout(20_000),
      });
    } catch (e) { console.error('[transparencia] aviso no WhatsApp:', e instanceof Error ? e.message : e); }
  }
  const host = Deno.env.get('SMTP_HOST'), user = Deno.env.get('SMTP_USER'), pass = Deno.env.get('SMTP_PASS');
  if (!host || !user || !pass || !cx?.aviso_email) return;
  try {
    const porta = Number(Deno.env.get('SMTP_PORT') || 587);
    const t = nodemailer.createTransport({ host, port: porta, secure: porta === 465, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
    await t.sendMail({ from: `ANA Brasil <${Deno.env.get('AVISOS_REMETENTE') || user}>`, to: cx.aviso_email, subject: assunto, text: texto });
  } catch (e) { console.error('[transparencia] aviso por e-mail:', e instanceof Error ? e.message : e); }
}

/** Um ciclo de atualização. `tudo`: relê todas as unidades e aceita lista bem menor (botão do painel). */
async function atualizar(db: Banco, tudo = false) {
  const inicio = Date.now();
  const resultado = { lidas: [] as string[], falhas: [] as string[], pendentes: 0, erro: null as string | null };
  const trava = await db.rpc('transparencia_pegar_trava', { p_segundos: TRAVA_S });
  if (trava.error) {
    resultado.erro = `não consegui pegar a trava do ciclo: ${trava.error.message}`;
    await conferirAvisos(db, resultado.erro).catch(() => {});
    return resultado;
  }
  const minhaTrava = trava.data as string | null; // o "até quando" desta trava: só ela é solta no fim
  if (!minhaTrava) return { ocupado: true };
  try {
    const est = ok(await db.from('transparencia_estado').select('*').eq('id', 1).single(), 'estado');
    await completarSlugs(db);
    // Toda unidade cadastrada tem a sua linha (nasce "ler de novo").
    const cfgs = ok(await db.from('transparency_configs').select('id, folder_id, label, slug'), 'unidades') as Unidade[];
    const jaTem = ok(await db.from('transparencia_unidades').select('config_id, documentos'), 'listas') as { config_id: string; documentos: number }[];
    const tem = new Set(jaTem.map((x) => x.config_id));
    const novas = cfgs.filter((c) => !tem.has(c.id)).map((c) => ({ config_id: c.id, sujo: true }));
    if (novas.length) ok(await db.from('transparencia_unidades').insert(novas), 'novas');

    await tokenDoGoogle(db); // conta desconectada aparece aqui, antes de mexer em qualquer coisa
    if (tudo) await marcarTodas(db);
    const marcador = await marcarMudancas(db, est.marcador_de_mudancas);
    // Releitura de segurança: a cada 24 h, mesmo sem mudança registrada.
    ok(await db.from('transparencia_unidades').update({ sujo: true }).lt('atualizado_em', new Date(Date.now() - RELER_TUDO_APOS_H * 3_600_000).toISOString()), 'releitura');
    // O marcador só anda depois que as unidades afetadas foram marcadas.
    ok(await db.from('transparencia_estado').update({ marcador_de_mudancas: marcador }).eq('id', 1), 'marcador');

    const fila = ok(await db.from('transparencia_unidades').select('config_id, documentos, tentativa_em').eq('sujo', true).order('tentativa_em', { ascending: true, nullsFirst: true }), 'fila') as { config_id: string; documentos: number }[];
    const porId = new Map(cfgs.map((c) => [c.id, c]));
    for (const f of fila) {
      const comecouCedo = Date.now() - inicio < 10_000; // teve o tempo do ciclo quase inteiro
      if (Date.now() - inicio > COMECAR_UNIDADE_ATE_MS) { resultado.pendentes++; continue; }
      const cfg = porId.get(f.config_id);
      if (!cfg) continue;
      try {
        const { arvore, itens } = await lerUnidade(db, cfg.folder_id, est.segredo_das_chaves, inicio + PRAZO_DO_CICLO_MS);
        const n = contar(arvore);
        // Proteção: lista nova muito menor que a anterior só entra pelo botão do painel.
        if (!tudo && quedaSuspeita(f.documentos, n.documentos)) {
          throw new Error(`a leitura nova tem ${n.documentos} documento(s) e a lista no ar tem ${f.documentos}. Se foi de propósito, use "Atualizar agora" no painel.`);
        }
        ok(await db.rpc('transparencia_gravar', { p_config: cfg.id, p_arvore: arvore, p_pastas: n.pastas, p_documentos: n.documentos, p_itens: itens }), 'gravar');
        resultado.lidas.push(cfg.label);
      } catch (e) {
        if (e instanceof ContaDesconectada) throw e;
        // Não coube no tempo: vai para o fim da fila. Se nem com o ciclo inteiro coube, conta como falha (e avisa se durar).
        if (e instanceof TempoEsgotado && !comecouCedo) {
          resultado.pendentes++;
          await db.from('transparencia_unidades').update({ tentativa_em: new Date().toISOString() }).eq('config_id', cfg.id);
          continue;
        }
        const msg = e instanceof TempoEsgotado ? 'a leitura desta unidade não coube no tempo de um ciclo' : e instanceof Error ? e.message : String(e);
        resultado.falhas.push(`${cfg.label}: ${msg}`);
        const agora = new Date().toISOString();
        await db.from('transparencia_unidades').update({ tentativa_em: agora, erro: msg.slice(0, 500) }).eq('config_id', cfg.id);
        await db.from('transparencia_unidades').update({ falhando_desde: agora }).eq('config_id', cfg.id).is('falhando_desde', null);
      }
    }
  } catch (e) {
    resultado.erro = e instanceof Error ? e.message : String(e);
    console.error('[transparencia] ciclo:', resultado.erro);
  }
  await conferirAvisos(db, resultado.erro).catch((e) => console.error('[transparencia] avisos:', e instanceof Error ? e.message : e));
  await db.from('transparencia_estado').update({ ciclo_em: new Date().toISOString(), ciclo_erro: resultado.erro }).eq('id', 1);
  await db.from('transparencia_estado').update({ trava_ate: null }).eq('id', 1).eq('trava_ate', minhaTrava);
  // Respostas guardadas vencem (o próximo visitante busca a lista nova), mas continuam de reserva se o banco falhar.
  if (resultado.lidas.length) for (const m of memoria.values()) m.em = 0;
  return resultado;
}

/**
 * Avisa uma vez quando a atualização fica parada e uma vez quando volta.
 * Parada = o ciclo inteiro falhando há mais de 30 min (na hora, se a conta do
 * Google caiu), ou alguma unidade falhando seguidamente há mais de 30 min.
 */
async function conferirAvisos(db: Banco, erroDoCiclo: string | null) {
  const agora = Date.now();
  const limite = new Date(agora - AVISAR_APOS_MIN * 60_000).toISOString();
  const est = ok(await db.from('transparencia_estado').select('alerta_em, falhando_desde').eq('id', 1).single(), 'avisos/estado');
  const falhandoDesde: string | null = erroDoCiclo ? (est?.falhando_desde ?? new Date(agora).toISOString()) : null;
  const paradas = ok(await db.from('transparencia_unidades').select('config_id, erro, falhando_desde').not('falhando_desde', 'is', null).lt('falhando_desde', limite), 'avisos/unidades') as { erro: string | null }[];
  const problema = erroDoCiclo && (/desconectada/.test(erroDoCiclo) || (falhandoDesde && falhandoDesde < limite)) ? erroDoCiclo
    : paradas.length ? `${paradas.length} unidade(s) sem conseguir atualizar há mais de ${AVISAR_APOS_MIN} min. Último erro: ${paradas[0].erro ?? '—'}` : null;
  await db.from('transparencia_estado').update({ falhando_desde: falhandoDesde }).eq('id', 1);
  // Marca primeiro e só envia se a marcação foi deste ciclo: o mesmo aviso nunca sai duas vezes.
  if (problema && !est?.alerta_em) {
    const { data: marcou } = await db.from('transparencia_estado').update({ alerta_em: new Date(agora).toISOString(), alerta_motivo: problema.slice(0, 500) }).eq('id', 1).is('alerta_em', null).select('id');
    if (marcou?.length) await avisar(db, `⚠️ Portal da Transparência: a lista de documentos parou de atualizar.\n\nMotivo: ${problema}\n\nO site continua mostrando a última lista boa. Confira em Marketing › Portal Transparência.`, 'Portal da Transparência parou de atualizar');
  } else if (!problema && !erroDoCiclo && est?.alerta_em) {
    const { data: marcou } = await db.from('transparencia_estado').update({ alerta_em: null, alerta_motivo: null }).eq('id', 1).eq('alerta_em', est.alerta_em).select('id');
    if (marcou?.length) await avisar(db, '✅ Portal da Transparência: a lista de documentos voltou a atualizar normalmente.', 'Portal da Transparência voltou a atualizar');
  }
}

async function ehGestor(db: Banco, req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const { data } = await db.auth.getUser(auth.slice(7));
  const user = data?.user;
  if (!user) return false;
  if (ehEmailGestor(user.email)) return true;
  const { data: adm } = await db.rpc('is_admin', { _user_id: user.id });
  return adm === true;
}

async function estadoParaOPainel(db: Banco) {
  const [est, lista, us] = await Promise.all([
    db.from('transparencia_estado').select('ciclo_em, ciclo_erro, alerta_em, alerta_motivo').eq('id', 1).single().then((r: never) => ok(r, 'estado')),
    listaDeUnidades(db),
    db.from('transparencia_unidades').select('config_id, erro, tentativa_em, falhando_desde, sujo').then((r: never) => ok(r, 'situação')),
  ]);
  return { ...est, base: BASE_PUBLICA, unidades: lista.unidades, situacao: us ?? [] };
}

const decodificar = (s: string) => { try { return decodeURIComponent(s); } catch { return null; } };

// --- Entrada -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = banco();
    const url = new URL(req.url);
    // O caminho depois de ".../transparencia".
    const partes = url.pathname.replace(/^.*?\/transparencia\/?/, '').split('/').filter(Boolean).map(decodificar);
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (partes.some((p) => p === null)) return json({ error: 'Endereço não encontrado.' }, 404);
      const [a, b] = partes as string[];
      if (!a) return await respostaGuardada(req, 'indice', () => listaDeUnidades(db));
      if (a === 'unidade' && b) return await respostaGuardada(req, `u:${b}`, () => umaUnidade(db, b));
      if (a === 'arquivo' && b) return await arquivo(req, db, b, url.searchParams.get('baixar') === '1');
      return json({ error: 'Endereço não encontrado.' }, 404);
    }
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    // deno-lint-ignore no-explicit-any
    let corpo: any = {};
    try { corpo = await req.json(); } catch { /* vazio */ }
    const segredo = req.headers.get('x-transparencia-segredo');
    if (segredo) {
      const est = ok(await db.from('transparencia_estado').select('segredo').eq('id', 1).single(), 'segredo');
      if (segredo !== est.segredo) return json({ error: 'Não autorizado.' }, 401);
      if (corpo.acao === 'atualizar') return json(await atualizar(db));
      return json({ error: 'Ação inválida.' }, 400);
    }
    if (!(await ehGestor(db, req))) return json({ error: 'Só quem cuida do Portal Transparência.' }, 403);
    if (corpo.acao === 'estado') return json(await estadoParaOPainel(db));
    if (corpo.acao === 'atualizar') return json(await atualizar(db, true));
    return json({ error: 'Ação inválida.' }, 400);
  } catch (e) {
    console.error('[transparencia]', e instanceof Error ? e.message : e);
    return json({ error: 'Erro ao responder. Tente de novo em instantes.' }, 500);
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer@6.9.16';
import { chaveDe, ehChave, quedaSuspeita } from '../transparencia/regras.ts';
import {
  LADO_MINI, LADO_TELA, UNIDADES, buscarNoticias, ehImagem, ehVideo, escala, manchete, montarNoticia, resumoDe, slugDaNoticia, slugLivre,
  type MidiaGuardada, type NoticiaGuardada, type PostJson,
} from './regras.ts';

addEventListener('unhandledrejection', (e) => { console.error('[noticias] promessa solta:', e.reason); e.preventDefault(); });

/**
 * API pública de notícias (blog) do site do ANA (25/11/2026). Contrato em LEIA-ME.md.
 *
 * As notícias moram no Drive compartilhado Setor Marketing, na pasta do blog:
 * unidade › ano › "AAAA-MM-DD — Título", com post.json, capa.*, fotos/ e
 * videos/. Nada fica no servidor: guardamos só a lista e entregamos as fotos
 * (em miniatura, tamanho de tela ou original) e os vídeos pelo nosso
 * endereço, buscando no Drive na hora.
 *
 * Leitura (aberta, nunca consulta o Google para montar a lista):
 *   GET /noticias                         → lista (?unidade=&pagina=&por_pagina=)
 *   GET /noticias/noticia/{slug}          → a notícia completa
 *   GET /noticias/busca?q=                → busca (título, texto, unidade)
 *   GET /noticias/arquivo/{chave}/{nome}  → foto (?tamanho=mini|tela) ou vídeo
 * Atualização (por trás): POST { acao: 'atualizar' } com x-noticias-segredo
 * (agendamento, a cada 2 min) ou com login do marketing; { acao: 'estado' }.
 */

const BASE_PUBLICA = (Deno.env.get('NOTICIAS_URL') || 'https://supabase.anabrasil.org/functions/v1/noticias').replace(/\/$/, '');
const DRIVE = 'https://www.googleapis.com/drive/v3';
/** O Drive compartilhado Setor Marketing e a pasta do blog dentro dele. */
const DRIVE_COMPARTILHADO_ID = '0APNkRBP8bmw_Uk9PVA';
const PASTA_DO_BLOG = Deno.env.get('NOTICIAS_PASTA') || 'Blog ANA Brasil (backup do WordPress)';
const OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
const OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
const PASTA = 'application/vnd.google-apps.folder';
// O servidor (Kong) corta a chamada aos 60 s: o ciclo inteiro acaba antes.
const COMECAR_ATE_MS = 25_000;
const PRAZO_MS = 45_000;
const TRAVA_S = 110;
const PARALELO = 6;
const VARRER_TUDO_APOS_H = 24;
const AVISAR_APOS_MIN = 30;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, if-none-match, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'etag, content-length, content-range, accept-ranges, content-disposition',
};
const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

// deno-lint-ignore no-explicit-any
type Banco = any;
const banco = (): Banco => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
// deno-lint-ignore no-explicit-any
function ok<T = any>(r: { data: T; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`banco (${onde}): ${r.error.message}`);
  return r.data;
}
const comPrazo = <T>(p: Promise<T>, ms: number): Promise<T> => Promise.race([p, espera(ms).then(() => { throw new Error('o banco demorou para responder'); })]);

// --- Google (conexão do Drive do Setor Marketing, a mesma da Pizza) ---------------------

class ContaDesconectada extends Error {}
class ErroDoDrive extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

let tokenGuardado: { valor: string; ate: number } | null = null;
async function tokenDoGoogle(db: Banco): Promise<string> {
  if (tokenGuardado && tokenGuardado.ate > Date.now() + 5 * 60_000) return tokenGuardado.valor;
  const c = ok(await db.from('pizza_drive_conexao').select('refresh_token').eq('id', 1).maybeSingle(), 'conexão');
  if (!c?.refresh_token) throw new ContaDesconectada('A conexão com o Drive do Setor Marketing não existe (é a mesma da Pizza da Alegria): conecte no painel da Pizza.');
  for (let i = 1; ; i++) {
    let t: { access_token?: string; expires_in?: number; error?: string } = {};
    let status = 0;
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
        signal: AbortSignal.timeout(15_000),
      });
      status = r.status;
      t = await r.json().catch(() => ({}));
    } catch { /* rede */ }
    if (t.access_token) { tokenGuardado = { valor: t.access_token, ate: Date.now() + (Number(t.expires_in) || 3000) * 1000 }; return t.access_token; }
    if (t.error === 'invalid_grant') throw new ContaDesconectada('O Google desconectou a conta do Drive do Setor Marketing (a mesma da Pizza da Alegria): conecte de novo no painel da Pizza.');
    if (i >= 3) throw new Error(`o Google não renovou o acesso (${status || 'sem resposta'})`);
    await espera(1000 * i);
  }
}

async function drive(db: Banco, caminho: string, params: Record<string, string>, comoTexto = false): Promise<unknown> {
  const u = new URL(`${DRIVE}${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let i = 1; ; i++) {
    const token = await tokenDoGoogle(db);
    let r: Response | null = null;
    try { r = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) }); }
    catch (e) { if (i < 4) { await espera(500 * 2 ** i + Math.random() * 300); continue; } throw new Error(`o Google Drive não respondeu (${e instanceof Error ? e.name : 'rede'})`); }
    if (r.ok) return comoTexto ? r.text() : r.json();
    const corpo = await r.text().catch(() => '');
    if (r.status === 401 && i < 4) { tokenGuardado = null; continue; }
    const limite = r.status === 429 || (r.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(corpo));
    if ((limite || r.status >= 500) && i < 4) { await espera(500 * 2 ** i + Math.random() * 300); continue; }
    throw new ErroDoDrive(r.status, `o Google Drive respondeu ${r.status}`);
  }
}

interface ItemDoDrive { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; imageMediaMetadata?: { width?: number; height?: number; rotation?: number }; videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string } }
const CAMPOS = 'nextPageToken, files(id, name, mimeType, modifiedTime, size, imageMediaMetadata(width, height, rotation), videoMediaMetadata(width, height, durationMillis))';
async function filhos(db: Banco, pastaId: string): Promise<ItemDoDrive[]> {
  const itens: ItemDoDrive[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 20; i++) {
    const params: Record<string, string> = { q: `'${pastaId}' in parents and trashed = false`, fields: CAMPOS, pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'drive', driveId: DRIVE_COMPARTILHADO_ID };
    if (pagina) params.pageToken = pagina;
    const r = await drive(db, '/files', params) as { files?: ItemDoDrive[]; nextPageToken?: string };
    itens.push(...(r.files ?? []));
    pagina = r.nextPageToken;
    if (!pagina) break;
  }
  return itens;
}

// --- Leitura de uma notícia no Drive --------------------------------------------------------

interface ArquivoGuardado { chave: string; drive_id: string; nome: string; mime: string | null; tamanho: number | null; w: number | null; h: number | null; modificado_em: string | null }

/** Largura e altura como aparecem (foto girada pela câmera troca os lados). */
const dimensoes = (f: ItemDoDrive): { w: number | null; h: number | null } => {
  const m = f.imageMediaMetadata ?? f.videoMediaMetadata;
  const w = m?.width ?? null, h = m?.height ?? null;
  const girada = f.imageMediaMetadata?.rotation === 1 || f.imageMediaMetadata?.rotation === 3;
  return girada ? { w: h, h: w } : { w, h };
};

class TempoEsgotado extends Error {}

async function lerNoticia(db: Banco, segredo: string, linha: { pasta_id: string; pasta_nome: string; unidade_pasta: string | null }, prazo: number) {
  if (Date.now() > prazo) throw new TempoEsgotado('tempo do ciclo esgotado');
  const pasta = await drive(db, `/files/${linha.pasta_id}`, { fields: 'trashed', supportsAllDrives: 'true' }).catch((e) => {
    if (e instanceof ErroDoDrive && e.status === 404) return { trashed: true };
    throw e;
  }) as { trashed?: boolean };
  if (pasta.trashed) throw new Error('a pasta desta notícia está na lixeira ou foi apagada');
  const conteudo = await filhos(db, linha.pasta_id);
  const pj = conteudo.find((f) => f.name.toLowerCase() === 'post.json');
  if (!pj) throw new Error('a pasta desta notícia está sem o post.json');
  let j: PostJson = {};
  {
    const texto = await drive(db, `/files/${pj.id}`, { alt: 'media', supportsAllDrives: 'true' }, true) as string;
    try { j = JSON.parse(texto.replace(/^﻿/, '')); } catch { throw new Error('o post.json desta notícia está com o texto quebrado'); }
  }
  const sub = (nome: string) => conteudo.find((f) => f.mimeType === PASTA && f.name.toLowerCase() === nome);
  const fotosPasta = sub('fotos'), videosPasta = sub('videos');
  const [fotos, videos] = await Promise.all([fotosPasta ? filhos(db, fotosPasta.id) : [], videosPasta ? filhos(db, videosPasta.id) : []]);
  const porNome = (a: ItemDoDrive, b: ItemDoDrive) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
  const arquivos: ArquivoGuardado[] = [];
  const midia = async (f: ItemDoDrive, tipo: 'foto' | 'video'): Promise<MidiaGuardada> => {
    const chave = await chaveDe(segredo, f.id);
    const d = dimensoes(f);
    arquivos.push({ chave, drive_id: f.id, nome: f.name, mime: f.mimeType, tamanho: f.size ? Number(f.size) : null, w: d.w, h: d.h, modificado_em: f.modifiedTime ?? null });
    const dur = f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000) : null;
    return { tipo, chave, nome: f.name.replace(/^\d+\s*-\s*/, ''), w: d.w, h: d.h, duracao: dur, alt: (j.descricoes?.[f.name] ?? '').trim() };
  };
  const capaArq = conteudo.find((f) => /^capa\./i.test(f.name) && ehImagem(f.mimeType));
  const capa = capaArq ? await midia(capaArq, 'foto') : null;
  const midias: MidiaGuardada[] = [];
  for (const f of fotos.filter((x) => ehImagem(x.mimeType)).sort(porNome)) midias.push(await midia(f, 'foto'));
  for (const f of videos.filter((x) => ehVideo(x.mimeType)).sort(porNome)) midias.push(await midia(f, 'video'));
  const base = montarNoticia(j, { nome: linha.pasta_nome, unidadePasta: linha.unidade_pasta ?? '' });
  return {
    noticia: { ...base, capa: capa ?? midias.find((m) => m.tipo === 'foto') ?? null, midias },
    arquivos,
    subpastas: [fotosPasta?.id, videosPasta?.id].filter(Boolean) as string[],
    wp_id: typeof j.id === 'number' ? j.id : null,
    wp_slug: j.slug ?? null,
  };
}

// --- Varredura das pastas (unidade › ano › post) -------------------------------------------

async function acharRaiz(db: Banco): Promise<string> {
  const r = await drive(db, '/files', {
    q: `name = '${PASTA_DO_BLOG.replace(/'/g, "\\'")}' and mimeType = '${PASTA}' and trashed = false and '${DRIVE_COMPARTILHADO_ID}' in parents`,
    fields: 'files(id, name)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'drive', driveId: DRIVE_COMPARTILHADO_ID,
  }) as { files?: { id: string }[] };
  const id = r.files?.[0]?.id;
  if (!id) throw new Error(`não achei a pasta "${PASTA_DO_BLOG}" no Drive Setor Marketing`);
  return id;
}

/** Lista todas as pastas de post. Pouca coisa: 1 chamada por unidade e por ano. */
async function varrer(db: Banco, raiz: string) {
  const posts: { pasta_id: string; pasta_nome: string; unidade_pasta: string }[] = [];
  const estrutura: string[] = [raiz];
  for (const u of (await filhos(db, raiz)).filter((f) => f.mimeType === PASTA)) {
    estrutura.push(u.id);
    for (const a of (await filhos(db, u.id)).filter((f) => f.mimeType === PASTA && /^\d{4}$/.test(f.name))) {
      estrutura.push(a.id);
      for (const p of (await filhos(db, a.id)).filter((f) => f.mimeType === PASTA)) posts.push({ pasta_id: p.id, pasta_nome: p.name, unidade_pasta: u.name });
    }
  }
  return { posts, estrutura };
}

/** Quais notícias o Drive mudou desde o marcador (e se apareceu pasta nova). */
async function mudancas(db: Banco, marcador: string | null, conhecidos: Map<string, string>, estrutura: Set<string>) {
  const inicio = async () => (await drive(db, '/changes/startPageToken', { supportsAllDrives: 'true', driveId: DRIVE_COMPARTILHADO_ID }) as { startPageToken: string }).startPageToken;
  if (!marcador) return { marcador: await inicio(), sujas: new Set<string>(), varrer: true, tudo: false };
  const sujas = new Set<string>();
  let varrerDeNovo = false;
  let pagina = marcador;
  // Pasta desconhecida: sobe até 3 pastas-mãe para ver se está dentro do blog (unidade ou ano novos).
  let subidas = 0;
  const dentroDoBlog = async (id: string): Promise<boolean> => {
    let atual = id;
    for (let nivel = 0; nivel < 3 && subidas < 20; nivel++) {
      subidas++;
      let pais: string[] = [];
      try { pais = ((await drive(db, `/files/${atual}`, { fields: 'parents', supportsAllDrives: 'true' })) as { parents?: string[] }).parents ?? []; }
      catch { return false; }
      if (pais.some((p) => estrutura.has(p))) return true;
      if (!pais[0]) return false;
      atual = pais[0];
    }
    return false;
  };
  for (let i = 0; i < 20; i++) {
    let r: { changes?: { fileId?: string; removed?: boolean; file?: { parents?: string[]; mimeType?: string; trashed?: boolean } }[]; nextPageToken?: string; newStartPageToken?: string };
    try {
      r = await drive(db, '/changes', {
        pageToken: pagina, pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', includeRemoved: 'true', driveId: DRIVE_COMPARTILHADO_ID,
        fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(parents, mimeType, trashed))',
      }) as typeof r;
    } catch (e) {
      if (e instanceof ErroDoDrive && [400, 404, 410].includes(e.status)) return { marcador: await inicio(), sujas, varrer: true, tudo: true };
      throw e;
    }
    for (const c of r.changes ?? []) {
      const ids = [c.fileId, ...(c.file?.parents ?? [])].filter(Boolean) as string[];
      let achou = false;
      for (const id of ids) { const p = conhecidos.get(id); if (p) { sujas.add(p); achou = true; } }
      // A própria pasta de um post mudou (nome, lugar, lixeira): a varredura acerta nome, unidade e retirada.
      if (c.fileId && conhecidos.get(c.fileId) === c.fileId) varrerDeNovo = true;
      if (c.file?.trashed && c.fileId && conhecidos.has(c.fileId)) varrerDeNovo = true;
      // Algo dentro da estrutura (pasta nova de post, de ano ou de unidade), ou item conhecido sumiu.
      if (!achou && ids.some((id) => estrutura.has(id))) varrerDeNovo = true;
      else if (!achou && !varrerDeNovo && c.file?.mimeType === PASTA && c.fileId && await dentroDoBlog(c.fileId)) varrerDeNovo = true;
      if (c.removed && c.fileId && (conhecidos.has(c.fileId) || estrutura.has(c.fileId))) varrerDeNovo = true;
    }
    if (r.newStartPageToken) { pagina = r.newStartPageToken; break; }
    if (!r.nextPageToken) break;
    pagina = r.nextPageToken;
  }
  return { marcador: pagina, sujas, varrer: varrerDeNovo, tudo: false };
}

// --- O ciclo de atualização ---------------------------------------------------------------

async function atualizar(db: Banco, tudo = false) {
  const inicio = Date.now();
  const resultado = { lidas: 0, falhas: [] as string[], pendentes: 0, novas: 0, retiradas: 0, erro: null as string | null };
  const trava = await db.rpc('noticias_pegar_trava', { p_segundos: TRAVA_S });
  if (trava.error) { resultado.erro = `não consegui pegar a trava: ${trava.error.message}`; await conferirAvisos(db, resultado.erro).catch(() => {}); return resultado; }
  const minhaTrava = trava.data as string | null;
  if (!minhaTrava) return { ocupado: true };
  try {
    const est = ok(await db.from('noticias_estado').select('*').eq('id', 1).single(), 'estado');
    await tokenDoGoogle(db);
    const raiz = est.raiz_id || await acharRaiz(db);
    const linhas = ok(await db.from('noticias').select('pasta_id, pasta_nome, unidade_pasta, slug, subpastas, dados, sujo'), 'notícias') as { pasta_id: string; pasta_nome: string; unidade_pasta: string | null; slug: string | null; subpastas: string[]; dados: NoticiaGuardada | null; sujo: boolean }[];
    const conhecidos = new Map<string, string>();
    for (const l of linhas) { conhecidos.set(l.pasta_id, l.pasta_id); for (const s of l.subpastas ?? []) conhecidos.set(s, l.pasta_id); }
    // Cada foto, vídeo e capa já publicados: se mudar de lugar ou for apagado, o post dele é relido.
    for (const a of ok(await db.from('noticias_arquivos').select('drive_id, pasta_id'), 'arquivos') as { drive_id: string; pasta_id: string }[]) if (!conhecidos.has(a.drive_id)) conhecidos.set(a.drive_id, a.pasta_id);
    const estruturaAntes = new Set<string>(((est.estrutura ?? []) as string[]));
    const m = await mudancas(db, est.marcador_de_mudancas, conhecidos, estruturaAntes);
    const precisaVarrer = tudo || m.varrer || !est.varrido_em || Date.now() - new Date(est.varrido_em).getTime() > VARRER_TUDO_APOS_H * 3_600_000;
    if (precisaVarrer) {
      const v = await varrer(db, raiz);
      const agora = new Set(v.posts.map((p) => p.pasta_id));
      const antes = new Set(linhas.map((l) => l.pasta_id));
      const sumiram = linhas.filter((l) => !agora.has(l.pasta_id));
      // Proteção: se sumiu mais da metade, parece engano no Drive (pasta movida, lixeira): não apaga sozinho.
      if (!tudo && sumiram.length && quedaSuspeita(antes.size, agora.size)) {
        throw new Error(`a pasta do blog tem agora ${agora.size} notícias e a lista no ar tem ${antes.size}. Se foi de propósito, use "Atualizar agora".`);
      }
      const novas = v.posts.filter((p) => !antes.has(p.pasta_id));
      if (novas.length) ok(await db.from('noticias').insert(novas.map((p) => ({ ...p, sujo: true }))), 'novas');
      // Nome da pasta pode ter mudado (título editado à mão): guarda e relê.
      for (const p of v.posts) {
        const l = linhas.find((x) => x.pasta_id === p.pasta_id);
        if (l && (l.pasta_nome !== p.pasta_nome || l.unidade_pasta !== p.unidade_pasta)) ok(await db.from('noticias').update({ pasta_nome: p.pasta_nome, unidade_pasta: p.unidade_pasta, sujo: true }).eq('pasta_id', p.pasta_id), 'renomear');
      }
      if (sumiram.length) ok(await db.from('noticias').delete().in('pasta_id', sumiram.map((l) => l.pasta_id)), 'retirar');
      resultado.novas = novas.length; resultado.retiradas = sumiram.length;
      ok(await db.from('noticias_estado').update({ raiz_id: raiz, estrutura: v.estrutura, varrido_em: new Date().toISOString() }).eq('id', 1), 'estrutura');
    } else if (!est.raiz_id) {
      ok(await db.from('noticias_estado').update({ raiz_id: raiz }).eq('id', 1), 'raiz');
    }
    if (tudo || m.tudo) ok(await db.from('noticias').update({ sujo: true }).eq('sujo', false), 'reler tudo');
    // 4. Releitura de segurança: cada notícia é relida pelo menos uma vez por dia.
    ok(await db.from('noticias').update({ sujo: true }).lt('atualizado_em', new Date(Date.now() - VARRER_TUDO_APOS_H * 3_600_000).toISOString()), 'releitura diária');
    if (m.sujas.size) ok(await db.from('noticias').update({ sujo: true }).in('pasta_id', [...m.sujas]), 'marcar mudanças');
    ok(await db.from('noticias_estado').update({ marcador_de_mudancas: m.marcador }).eq('id', 1), 'marcador');

    // Lê as notícias marcadas, várias ao mesmo tempo.
    const fila = ok(await db.from('noticias').select('pasta_id, pasta_nome, unidade_pasta, slug').eq('sujo', true).order('tentativa_em', { ascending: true, nullsFirst: true }), 'fila') as { pasta_id: string; pasta_nome: string; unidade_pasta: string | null; slug: string | null }[];
    const usados = new Set((ok(await db.from('noticias').select('slug').not('slug', 'is', null), 'slugs') as { slug: string }[]).map((x) => x.slug));
    let i = 0;
    const trabalhador = async () => {
      while (i < fila.length) {
        const l = fila[i++];
        if (Date.now() - inicio > COMECAR_ATE_MS) { resultado.pendentes++; continue; }
        try {
          const lida = await lerNoticia(db, est.segredo_das_chaves, l, inicio + PRAZO_MS);
          let slug = l.slug;
          if (!slug) { slug = slugLivre(slugDaNoticia(lida.noticia.titulo, lida.wp_slug), usados); usados.add(slug); }
          const dados: NoticiaGuardada = { slug, ...lida.noticia };
          ok(await db.rpc('noticias_gravar', { p_pasta: l.pasta_id, p_slug: slug, p_dados: dados, p_data: dados.data, p_subpastas: lida.subpastas, p_wp_id: lida.wp_id, p_wp_slug: lida.wp_slug, p_arquivos: lida.arquivos }), 'gravar');
          resultado.lidas++;
        } catch (e) {
          if (e instanceof ContaDesconectada) throw e;
          if (e instanceof TempoEsgotado) { resultado.pendentes++; continue; }
          const msg = e instanceof Error ? e.message : String(e);
          resultado.falhas.push(`${l.pasta_nome}: ${msg}`);
          const agora = new Date().toISOString();
          await db.from('noticias').update({ tentativa_em: agora, erro: msg.slice(0, 500) }).eq('pasta_id', l.pasta_id);
          await db.from('noticias').update({ falhando_desde: agora }).eq('pasta_id', l.pasta_id).is('falhando_desde', null);
        }
      }
    };
    await Promise.all(Array.from({ length: PARALELO }, trabalhador));
  } catch (e) {
    resultado.erro = e instanceof Error ? e.message : String(e);
    console.error('[noticias] ciclo:', resultado.erro);
  }
  await conferirAvisos(db, resultado.erro).catch((e) => console.error('[noticias] avisos:', e instanceof Error ? e.message : e));
  await db.from('noticias_estado').update({ ciclo_em: new Date().toISOString(), ciclo_erro: resultado.erro }).eq('id', 1);
  await db.from('noticias_estado').update({ trava_ate: null }).eq('id', 1).eq('trava_ate', minhaTrava);
  if (resultado.lidas || resultado.retiradas) { if (listaGuardada) listaGuardada.em = 0; for (const v of memoria.values()) v.em = 0; }
  return resultado;
}

async function avisar(db: Banco, texto: string, assunto: string) {
  const { data: cx } = await db.from('pizza_ranking_config').select('evolution_url, instancia, token, teste, aviso_email').eq('id', 1).maybeSingle();
  if (cx?.evolution_url && cx?.token && cx?.teste) {
    try {
      await fetch(`${String(cx.evolution_url).replace(/\/$/, '')}/message/sendText/${encodeURIComponent(cx.instancia)}`, {
        method: 'POST', headers: { apikey: cx.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ number: cx.teste, text: texto }), signal: AbortSignal.timeout(20_000),
      });
    } catch (e) { console.error('[noticias] aviso no WhatsApp:', e instanceof Error ? e.message : e); }
  }
  const host = Deno.env.get('SMTP_HOST'), user = Deno.env.get('SMTP_USER'), pass = Deno.env.get('SMTP_PASS');
  if (!host || !user || !pass || !cx?.aviso_email) return;
  try {
    const porta = Number(Deno.env.get('SMTP_PORT') || 587);
    const t = nodemailer.createTransport({ host, port: porta, secure: porta === 465, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
    await t.sendMail({ from: `ANA Brasil <${Deno.env.get('AVISOS_REMETENTE') || user}>`, to: cx.aviso_email, subject: assunto, text: texto });
  } catch (e) { console.error('[noticias] aviso por e-mail:', e instanceof Error ? e.message : e); }
}

/** Um aviso quando a atualização para (30 min; na hora se a conta caiu) e um quando volta. */
async function conferirAvisos(db: Banco, erroDoCiclo: string | null) {
  const agora = Date.now();
  const limite = new Date(agora - AVISAR_APOS_MIN * 60_000).toISOString();
  const est = ok(await db.from('noticias_estado').select('alerta_em, falhando_desde').eq('id', 1).single(), 'avisos/estado');
  const falhandoDesde: string | null = erroDoCiclo ? (est?.falhando_desde ?? new Date(agora).toISOString()) : null;
  const paradas = ok(await db.from('noticias').select('pasta_nome, erro').not('falhando_desde', 'is', null).lt('falhando_desde', limite), 'avisos/notícias') as { pasta_nome: string; erro: string | null }[];
  const problema = erroDoCiclo && (/desconect|não existe/.test(erroDoCiclo) || (falhandoDesde && falhandoDesde < limite)) ? erroDoCiclo
    : paradas.length ? `${paradas.length} notícia(s) sem conseguir atualizar há mais de ${AVISAR_APOS_MIN} min. Ex.: ${paradas[0].pasta_nome}: ${paradas[0].erro ?? '—'}` : null;
  await db.from('noticias_estado').update({ falhando_desde: falhandoDesde }).eq('id', 1);
  if (problema && !est?.alerta_em) {
    const { data: marcou } = await db.from('noticias_estado').update({ alerta_em: new Date(agora).toISOString(), alerta_motivo: problema.slice(0, 500) }).eq('id', 1).is('alerta_em', null).select('id');
    if (marcou?.length) await avisar(db, `⚠️ Notícias do site: a lista parou de atualizar.\n\nMotivo: ${problema}\n\nO site continua mostrando a última lista boa.`, 'Notícias do site pararam de atualizar');
  } else if (!problema && !erroDoCiclo && est?.alerta_em) {
    const { data: marcou } = await db.from('noticias_estado').update({ alerta_em: null, alerta_motivo: null }).eq('id', 1).eq('alerta_em', est.alerta_em).select('id');
    if (marcou?.length) await avisar(db, '✅ Notícias do site: a lista voltou a atualizar normalmente.', 'Notícias do site voltaram a atualizar');
  }
}

// --- Leitura pública ----------------------------------------------------------------------

type Linha = { dados: NoticiaGuardada; atualizado_em: string };
/** Todas as notícias boas, guardadas por 60 s (um carregamento por vez; com uma velha, responde já e renova). */
let listaGuardada: { em: number; lista: Linha[] } | null = null;
let carregando: Promise<Linha[]> | null = null;
function carregarLista(db: Banco): Promise<Linha[]> {
  carregando ??= (async () => {
    try {
      const l = ok(await comPrazo(db.from('noticias').select('dados, atualizado_em').not('dados', 'is', null).not('atualizado_em', 'is', null).then((r: never) => r), 15_000), 'lista') as Linha[];
      listaGuardada = { em: Date.now(), lista: l };
      return l;
    } catch (e) {
      if (listaGuardada) { listaGuardada.em = Date.now() - 50_000; return listaGuardada.lista; }
      throw e;
    } finally { carregando = null; }
  })();
  return carregando;
}
async function lista(db: Banco): Promise<Linha[]> {
  if (listaGuardada && Date.now() - listaGuardada.em < 60_000) return listaGuardada.lista;
  // Vencida por um ciclo que acabou de ler notícias: espera a lista nova (se o banco falhar, vem a velha).
  if (listaGuardada && listaGuardada.em === 0) return await carregarLista(db);
  if (listaGuardada) { void carregarLista(db).catch(() => {}); return listaGuardada.lista; }
  return await carregarLista(db);
}

const memoria = new Map<string, { em: number; etag: string; corpo: string }>();
const casaEtag = (cab: string | null, etag: string) => !!cab && cab.split(',').map((s) => s.trim().replace(/^W\//, '')).some((s) => s === '*' || s === etag);
class NaoEncontrado extends Error {}

async function responder(req: Request, chave: string, montar: () => Promise<unknown>): Promise<Response> {
  let m = memoria.get(chave);
  let velha = false;
  if (!m || Date.now() - m.em > 30_000) {
    try {
      const texto = JSON.stringify(await montar());
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto)));
      m = { em: Date.now(), etag: `"${[...bytes.subarray(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('')}"`, corpo: texto };
      if (memoria.size > 500) memoria.clear();
      memoria.set(chave, m);
    } catch (e) {
      if (e instanceof NaoEncontrado) return json({ error: e.message }, 404, { 'Cache-Control': 'public, max-age=30' });
      console.error('[noticias] leitura:', e instanceof Error ? e.message : e);
      if (!m) return json({ error: 'Não foi possível carregar agora. Tente de novo em instantes.' }, 503, { 'Retry-After': '30' });
      m.em = Date.now() - 20_000;
      velha = true;
    }
  }
  const cab = { ...cors, 'Content-Type': 'application/json; charset=utf-8', ETag: m.etag, 'Cache-Control': velha ? 'public, max-age=30, stale-if-error=86400' : 'public, max-age=60, stale-while-revalidate=600, stale-if-error=86400' };
  if (casaEtag(req.headers.get('if-none-match'), m.etag)) return new Response(null, { status: 304, headers: cab });
  return new Response(req.method === 'HEAD' ? null : m.corpo, { status: 200, headers: cab });
}

const UNIDADES_POR_SLUG = Object.fromEntries(Object.values(UNIDADES).map((u) => [u.slug, u]));
const nomeDe = (slug: string) => UNIDADES_POR_SLUG[slug]?.nome ?? slug;

const url = (chave: string, nome: string, tamanho?: 'mini' | 'tela') => `${BASE_PUBLICA}/arquivo/${chave}/${encodeURIComponent(nome)}${tamanho ? `?tamanho=${tamanho}` : ''}`;
function fotoParaOSite(m: MidiaGuardada) {
  const tela = escala(m.w, m.h, LADO_TELA), mini = escala(m.w, m.h, LADO_MINI);
  return { tipo: 'foto' as const, src: url(m.chave, m.nome, 'tela'), w: tela?.w ?? null, h: tela?.h ?? null, alt: m.alt, original: url(m.chave, m.nome), mini: { src: url(m.chave, m.nome, 'mini'), w: mini?.w ?? null, h: mini?.h ?? null } };
}
function midiaParaOSite(m: MidiaGuardada) {
  if (m.tipo === 'foto') return fotoParaOSite(m);
  const mini = escala(m.w, m.h, LADO_MINI);
  return { tipo: 'video' as const, src: url(m.chave, m.nome), w: m.w, h: m.h, duracao: m.duracao, alt: m.alt, capa: { src: url(m.chave, m.nome, 'tela'), w: escala(m.w, m.h, LADO_TELA)?.w ?? null, h: escala(m.w, m.h, LADO_TELA)?.h ?? null, mini: { src: url(m.chave, m.nome, 'mini'), w: mini?.w ?? null, h: mini?.h ?? null } } };
}
function resumoParaOSite(n: NoticiaGuardada, destaque: boolean) {
  return {
    slug: n.slug, titulo: n.titulo, data: n.data, unidade: { slug: n.unidade, nome: nomeDe(n.unidade) }, unidades: n.unidades.map((s) => ({ slug: s, nome: nomeDe(s) })),
    resumo: resumoDe(n.texto), capa: n.capa ? fotoParaOSite(n.capa) : null,
    fotos: n.midias.filter((m) => m.tipo === 'foto').length + (n.capa && !n.midias.some((m) => m.chave === n.capa!.chave) ? 1 : 0), videos: n.midias.filter((m) => m.tipo === 'video').length,
    destaque, fixada: n.fixada, endereco: `${BASE_PUBLICA}/noticia/${n.slug}`,
  };
}

async function listaPublica(db: Banco, u: URL) {
  const todas = (await lista(db)).map((l) => l.dados).filter((n) => n.na_lista).sort((a, b) => b.data.localeCompare(a.data) || a.slug.localeCompare(b.slug));
  const unidade = u.searchParams.get('unidade') || undefined;
  const porPagina = Math.min(Math.max(Number(u.searchParams.get('por_pagina')) || 24, 1), 100);
  const pagina = Math.max(Number(u.searchParams.get('pagina')) || 1, 1);
  const filtradas = unidade ? todas.filter((n) => n.unidades.includes(unidade)) : todas;
  const topo = manchete(todas);
  const contagem = new Map<string, number>();
  for (const n of todas) for (const s of n.unidades) contagem.set(s, (contagem.get(s) ?? 0) + 1);
  return {
    total: filtradas.length, pagina, por_pagina: porPagina, paginas: Math.max(1, Math.ceil(filtradas.length / porPagina)),
    manchete: topo ? resumoParaOSite(topo, true) : null,
    unidades: [...contagem.entries()].map(([slug, total]) => ({ slug, nome: nomeDe(slug), total })).sort((a, b) => b.total - a.total),
    noticias: filtradas.slice((pagina - 1) * porPagina, pagina * porPagina).map((n) => resumoParaOSite(n, topo?.slug === n.slug)),
  };
}

async function umaNoticia(db: Banco, slug: string) {
  const n = (await lista(db)).map((l) => l.dados).find((x) => x.slug === slug);
  if (!n) throw new NaoEncontrado('Notícia não encontrada.');
  return {
    slug: n.slug, titulo: n.titulo, data: n.data, unidade: { slug: n.unidade, nome: nomeDe(n.unidade) }, unidades: n.unidades.map((s) => ({ slug: s, nome: nomeDe(s) })),
    texto: n.texto, capa: n.capa ? fotoParaOSite(n.capa) : null,
    midias: n.midias.filter((m) => m.chave !== n.capa?.chave).map(midiaParaOSite), na_lista: n.na_lista,
  };
}

async function buscaPublica(req: Request, db: Banco, u: URL): Promise<Response> {
  const q = (u.searchParams.get('q') ?? '').trim();
  const cab: Record<string, string> = { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600, stale-if-error=86400' };
  if (q.length < 2) return new Response(JSON.stringify({ q, total: 0, resultados: [] }), { status: 200, headers: cab });
  let todas: NoticiaGuardada[];
  try { todas = (await lista(db)).map((l) => l.dados); }
  catch { return json({ error: 'Não foi possível pesquisar agora. Tente de novo em instantes.' }, 503, { 'Retry-After': '30' }); }
  const r = buscarNoticias(todas, q, Object.fromEntries(Object.values(UNIDADES).map((x) => [x.slug, x.nome])), { unidade: u.searchParams.get('unidade') || undefined, limite: u.searchParams.has('limite') ? Number(u.searchParams.get('limite')) : 20 });
  const texto = JSON.stringify({ q, total: r.total, resultados: r.resultados.map((n) => resumoParaOSite(n, false)) });
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto)));
  cab.ETag = `"${[...bytes.subarray(0, 10)].map((x) => x.toString(16).padStart(2, '0')).join('')}"`;
  if (casaEtag(req.headers.get('if-none-match'), cab.ETag)) return new Response(null, { status: 304, headers: cab });
  return new Response(req.method === 'HEAD' ? null : texto, { status: 200, headers: cab });
}

// --- Arquivos (fotos e vídeos), buscados no Drive na hora -----------------------------------

const PAGINA_DE_ERRO = (titulo: string, texto: string) => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} · ANA Brasil</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#1f2322"><h1 style="font-size:22px">${titulo}</h1><p style="color:#555;line-height:1.5">${texto}</p></body></html>`;
const html = (status: number, titulo: string, texto: string) => new Response(PAGINA_DE_ERRO(titulo, texto), { status, headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
const INDISPONIVEL = () => html(503, 'Arquivo indisponível no momento', 'Não conseguimos abrir este arquivo agora. Tente de novo em alguns minutos.');

/** Miniaturas pequenas ficam na memória (são muitas na lista do site); o resto vem do Drive. */
const miniaturas = new Map<string, { bytes: Uint8Array; tipo: string; em: number }>();
const MAX_MINIATURAS = 400;
/** Endereço de miniatura do Google (vale algumas horas): guardado por 30 min, pela versão do arquivo. */
const linksDeMiniatura = new Map<string, { link: string; em: number }>();

/** Busca com prazo curto e uma tentativa só (a miniatura não pode segurar o visitante). */
async function pegarRapido(url: string, token?: string): Promise<Response | null> {
  try {
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(6_000) });
    if (r.ok) return r;
    await r.body?.cancel();
    return null;
  } catch { return null; }
}

async function linkDeMiniatura(db: Banco, driveId: string, versao: string): Promise<string | null> {
  const k = `${driveId}:${versao}`;
  const g = linksDeMiniatura.get(k);
  if (g && Date.now() - g.em < 30 * 60_000) return g.link;
  const token = await tokenDoGoogle(db);
  const r = await pegarRapido(`${DRIVE}/files/${driveId}?fields=thumbnailLink&supportsAllDrives=true`, token);
  const link = r ? ((await r.json().catch(() => ({}))) as { thumbnailLink?: string }).thumbnailLink : undefined;
  if (!link) return null;
  if (linksDeMiniatura.size > 2000) linksDeMiniatura.clear();
  linksDeMiniatura.set(k, { link, em: Date.now() });
  return link;
}

async function arquivo(req: Request, db: Banco, chave: string, tamanho: string | null): Promise<Response> {
  if (!ehChave(chave)) return html(404, 'Arquivo não encontrado', 'O endereço deste arquivo não existe.');
  let a: { drive_id: string; nome: string; mime: string | null; tamanho: number | null; modificado_em: string | null } | undefined;
  try { a = ok(await comPrazo(db.from('noticias_arquivos').select('drive_id, nome, mime, tamanho, modificado_em').eq('chave', chave).limit(1).then((r: never) => r), 8_000), 'arquivo')?.[0]; }
  catch (e) { console.error('[noticias]', e instanceof Error ? e.message : e); return INDISPONIVEL(); }
  if (!a) return html(404, 'Arquivo não encontrado', 'Este arquivo foi retirado do site.');
  const etag = `"${chave}-${tamanho ?? 'o'}-${a.modificado_em ? Date.parse(a.modificado_em) : 0}"`;
  const video = ehVideo(a.mime ?? undefined);
  const reduzido = tamanho === 'mini' || tamanho === 'tela';
  const tipoOriginal = a.mime && (ehImagem(a.mime) || video) ? a.mime : 'application/octet-stream';
  const cab: Record<string, string> = { ...cors, 'Cache-Control': 'public, max-age=86400', ETag: etag, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(a.nome.replace(/^\d+\s*-\s*/, ''))}` };
  if (casaEtag(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers: cab });

  // Foto reduzida (ou capa de vídeo): a miniatura que o próprio Drive gera, no tamanho pedido.
  if (reduzido) {
    const versao = a.modificado_em ?? '';
    const k = `${chave}:${tamanho}:${versao}`;
    const m = miniaturas.get(k);
    if (m) return new Response(req.method === 'HEAD' ? null : m.bytes, { status: 200, headers: { ...cab, 'Content-Type': m.tipo } });
    try {
      const link = await linkDeMiniatura(db, a.drive_id, versao);
      if (link) {
        const alvo = link.replace(/=s\d+(-[a-z]+)?$/, `=s${tamanho === 'mini' ? 400 : 1600}`);
        const r = (await pegarRapido(alvo)) ?? (await pegarRapido(alvo, await tokenDoGoogle(db)));
        if (r) {
          const bytes = new Uint8Array(await r.arrayBuffer());
          const tipo = r.headers.get('content-type')?.startsWith('image/') ? r.headers.get('content-type')! : 'image/jpeg';
          if (tamanho === 'mini' && bytes.length < 200_000) {
            if (miniaturas.size >= MAX_MINIATURAS) miniaturas.delete(miniaturas.keys().next().value!);
            miniaturas.set(k, { bytes, tipo, em: Date.now() });
          }
          return new Response(req.method === 'HEAD' ? null : bytes, { status: 200, headers: { ...cab, 'Content-Type': tipo } });
        }
        linksDeMiniatura.delete(`${a.drive_id}:${versao}`);
      }
    } catch (e) { console.error('[noticias] miniatura', e instanceof Error ? e.message : e); }
    // Sem miniatura: a miniatura nunca vira o original pesado (nem vídeo, nem HEIC). O navegador tenta de novo depois.
    if (tamanho === 'mini' || video || /heic|heif/i.test(a.mime ?? '')) {
      return new Response(null, { status: 503, headers: { ...cors, 'Cache-Control': 'no-store', 'Retry-After': '30' } });
    }
    // Tamanho de tela: entrega o original desta vez, sem guardar (o próximo pedido tenta a miniatura de novo).
    cab['Cache-Control'] = 'no-store';
    cab.ETag = `"${chave}-o-${a.modificado_em ? Date.parse(a.modificado_em) : 0}"`;
  }
  if (req.method === 'HEAD') { if (a.tamanho) cab['Content-Length'] = String(a.tamanho); return new Response(null, { status: 200, headers: { ...cab, 'Content-Type': tipoOriginal } }); }
  const range = !reduzido ? req.headers.get('range') : null;
  for (let i = 1; i <= 2; i++) {
    let token: string;
    try { token = await tokenDoGoogle(db); } catch { return INDISPONIVEL(); }
    const ctl = new AbortController();
    const prazo = setTimeout(() => ctl.abort(), 30_000);
    req.signal?.addEventListener?.('abort', () => ctl.abort());
    try {
      const r = await fetch(`${DRIVE}/files/${a.drive_id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity', ...(range ? { Range: range } : {}) }, signal: ctl.signal });
      clearTimeout(prazo);
      if (r.status === 401 && i === 1) { tokenGuardado = null; await r.body?.cancel(); continue; }
      if (r.status === 416) { await r.body?.cancel(); return new Response(null, { status: 416, headers: { ...cors, 'Content-Range': r.headers.get('content-range') ?? `bytes */${a.tamanho ?? '*'}` } }); }
      if (!r.ok || !r.body) { await r.body?.cancel(); return r.status === 404 ? html(404, 'Arquivo não encontrado', 'Este arquivo não está mais disponível.') : INDISPONIVEL(); }
      for (const h of ['content-length', 'content-range', 'accept-ranges']) { const v = r.headers.get(h); if (v) cab[h] = v; }
      if (!cab['accept-ranges']) cab['accept-ranges'] = 'bytes';
      return new Response(r.body, { status: r.status === 206 ? 206 : 200, headers: { ...cab, 'Content-Type': tipoOriginal } });
    } catch (e) { clearTimeout(prazo); console.error('[noticias] arquivo', e instanceof Error ? e.name : e); return INDISPONIVEL(); }
  }
  return INDISPONIVEL();
}

// --- Painel (só marketing) ----------------------------------------------------------------

async function ehMarketing(db: Banco, req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const { data } = await db.auth.getUser(auth.slice(7));
  if (!data?.user) return false;
  const { data: mkt } = await db.rpc('is_marketing_user', { _user_id: data.user.id });
  return mkt === true;
}

async function estadoParaOPainel(db: Banco) {
  const [est, ns] = await Promise.all([
    db.from('noticias_estado').select('ciclo_em, ciclo_erro, alerta_em, alerta_motivo, varrido_em').eq('id', 1).single().then((r: never) => ok(r, 'estado')),
    db.from('noticias').select('pasta_nome, erro, sujo, atualizado_em').then((r: never) => ok(r, 'notícias')),
  ]);
  const l = ns as { pasta_nome: string; erro: string | null; sujo: boolean; atualizado_em: string | null }[];
  return { ...est, base: BASE_PUBLICA, total: l.length, no_ar: l.filter((x) => x.atualizado_em).length, lendo: l.filter((x) => x.sujo && !x.erro).length, com_erro: l.filter((x) => x.erro).map((x) => ({ pasta: x.pasta_nome, erro: x.erro })) };
}

const decodificar = (s: string) => { try { return decodeURIComponent(s); } catch { return null; } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = banco();
    const u = new URL(req.url);
    const partes = u.pathname.replace(/^.*?\/noticias\/?/, '').split('/').filter(Boolean).map(decodificar);
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (partes.some((p) => p === null)) return json({ error: 'Endereço não encontrado.' }, 404);
      const [a, b] = partes as string[];
      if (!a) return await responder(req, `lista:${u.searchParams.get('unidade') ?? ''}:${u.searchParams.get('pagina') ?? ''}:${u.searchParams.get('por_pagina') ?? ''}`, () => listaPublica(db, u));
      if (a === 'noticia' && b) return await responder(req, `n:${b}`, () => umaNoticia(db, b));
      if (a === 'busca' && !b) return await buscaPublica(req, db, u);
      if (a === 'arquivo' && b) return await arquivo(req, db, b, u.searchParams.get('tamanho'));
      return json({ error: 'Endereço não encontrado.' }, 404);
    }
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    // deno-lint-ignore no-explicit-any
    let corpo: any = {};
    try { corpo = await req.json(); } catch { /* vazio */ }
    const segredo = req.headers.get('x-noticias-segredo');
    if (segredo) {
      const est = ok(await db.from('noticias_estado').select('segredo').eq('id', 1).single(), 'segredo');
      if (segredo !== est.segredo) return json({ error: 'Não autorizado.' }, 401);
      if (corpo.acao === 'atualizar') return json(await atualizar(db));
      return json({ error: 'Ação inválida.' }, 400);
    }
    if (!(await ehMarketing(db, req))) return json({ error: 'Só o marketing.' }, 403);
    if (corpo.acao === 'estado') return json(await estadoParaOPainel(db));
    if (corpo.acao === 'atualizar') return json(await atualizar(db, true));
    return json({ error: 'Ação inválida.' }, 400);
  } catch (e) {
    console.error('[noticias]', e instanceof Error ? e.message : e);
    return json({ error: 'Erro ao responder. Tente de novo em instantes.' }, 500);
  }
});


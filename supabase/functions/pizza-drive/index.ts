import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { montarPdf } from './pdf.ts';

addEventListener('unhandledrejection', (e) => { console.error('[pizza-drive] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[pizza-drive] erro solto:', e.error); e.preventDefault(); });

/**
 * Pizza da Alegria, parte 2 (07/10/2026): copia cada confirmação para o
 * Drive compartilhado "Setor Marketing":
 *
 *   Pizza da Alegria 2026 / Educação|Social / <unidade> / <pessoa> /
 *     "PZ-0137 · comprovante.jpg" e "PZ-0137 · Maria Aparecida Souza.pdf"
 *
 * O banco e o Storage são a fonte; o Drive é espelho. Quem chama:
 *  - o formulário público, logo depois de cada envio (sem login): só processa
 *    o que está pendente, então não abre nada para ninguém;
 *  - o painel (ADM e comunicação): estado da conexão, "Copiar pendentes agora",
 *    e, para a comunicação/admin, conectar e desconectar a conta Google.
 *
 * A conta Google é conectada pelo painel, como a Agenda dos eventos (OAuth,
 * GOOGLE_OAUTH_CLIENT_ID/SECRET, redirecionamento para a raiz do site, que
 * repassa ao painel). A chave de renovação fica em `pizza_drive_conexao`,
 * que só a chave de serviço lê.
 *
 * Arquivos desta função: index.ts e pdf.ts (o desenho do PDF).
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
const OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
const ESCOPO = 'https://www.googleapis.com/auth/drive';
const DRIVE_COMPARTILHADO = 'Setor Marketing';
const PASTA_RAIZ = 'Pizza da Alegria 2026';
const POR_VEZ = 12;
const PRECO = 50;

const SABORES: Record<string, string> = { marguerita: 'Marguerita', frango: 'Frango', calabresa: 'Calabresa fatiada', mucarela: 'Muçarela', lombo: 'Lombo', napolitana: 'Napolitana' };
const FORMAS: Record<string, string> = { pix: 'Pix', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', pluxee: 'Vale Pluxee' };
const AREAS: Record<string, string> = { educacao: 'Educação', social: 'Social' };

// deno-lint-ignore no-explicit-any
type Admin = any;

interface Conexao { refresh_token: string; google_email: string; drive_id: string; pasta_id: string; conectado_por: string | null; conectado_em: string; erro: string | null }

// --- Google ---------------------------------------------------------------------------

class ErroGoogle extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function google(token: string, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`https://www.googleapis.com/drive/v3${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroGoogle(r.status, `Drive ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}

async function tokenDaConexao(admin: Admin, c: Conexao): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const motivo = j.error === 'invalid_grant' ? 'o Google desconectou a conta: conecte de novo no painel' : `o Google não renovou o acesso (${r.status})`;
    await admin.from('pizza_drive_conexao').update({ erro: motivo }).eq('id', 1);
    throw new Error(motivo);
  }
  if (c.erro) await admin.from('pizza_drive_conexao').update({ erro: null }).eq('id', 1);
  return j.access_token as string;
}

const aspas = (t: string) => t.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
/** Nome de pasta ou arquivo: sem barra e sem espaço sobrando. */
const limpo = (t: string) => t.replace(/[\\/]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 150) || 'Sem nome';

async function procurar(token: string, driveId: string, pai: string, nome: string, pasta: boolean): Promise<string | null> {
  const q = `name = '${aspas(nome)}' and '${pai}' in parents and trashed = false` + (pasta ? " and mimeType = 'application/vnd.google-apps.folder'" : '');
  const p = new URLSearchParams({ q, corpora: 'drive', driveId, includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', fields: 'files(id)', pageSize: '1' });
  const r = await google(token, 'GET', `/files?${p}`);
  return r?.files?.[0]?.id ?? null;
}

async function pastaFilha(token: string, driveId: string, pai: string, nome: string, cache: Map<string, string>): Promise<string> {
  const chave = `${pai}/${nome}`;
  const visto = cache.get(chave);
  if (visto) return visto;
  const achado = await procurar(token, driveId, pai, nome, true);
  const id = achado ?? (await google(token, 'POST', '/files?supportsAllDrives=true&fields=id', { name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [pai] })).id;
  cache.set(chave, id);
  return id;
}

async function subir(token: string, pai: string, nome: string, tipo: string, bytes: Uint8Array): Promise<void> {
  const fronteira = 'pizza' + crypto.randomUUID();
  const meta = JSON.stringify({ name: nome, parents: [pai] });
  const corpo = new Blob([
    `--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${fronteira}\r\nContent-Type: ${tipo}\r\n\r\n`,
    bytes,
    `\r\n--${fronteira}--`,
  ]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${fronteira}` }, body: corpo,
  });
  if (!r.ok) throw new ErroGoogle(r.status, `upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// --- PDF ----------------------------------------------------------------------------------

let fontes: { regular: Uint8Array | null; negrito: Uint8Array | null } | null = null;
async function carregarFontes() {
  if (fontes) return fontes;
  try {
    const [r, b] = await Promise.all(['400', '700'].map(async (p) => {
      const x = await fetch(`https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-${p}-normal.ttf`);
      if (!x.ok) throw new Error(String(x.status));
      return new Uint8Array(await x.arrayBuffer());
    }));
    fontes = { regular: r, negrito: b };
  } catch (e) {
    console.error('[pizza-drive] sem Poppins, vai Helvetica:', e);
    fontes = { regular: null, negrito: null };
  }
  return fontes;
}

const quando = (iso: string) => {
  const d = new Date(iso);
  const p = (t: Intl.DateTimeFormatPartTypes) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).find((x) => x.type === t)?.value ?? '';
  return `${p('day')}/${p('month')}/${p('year')} às ${p('hour')}:${p('minute')}`;
};
const tamanho = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const tipoDoArquivo = (caminho: string): { tipo: 'jpg' | 'png' | 'pdf' | 'outro'; mime: string; ext: string } => {
  const ext = (caminho.split('.').pop() || '').toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return { tipo: 'jpg', mime: 'image/jpeg', ext: 'jpg' };
  if (ext === 'png') return { tipo: 'png', mime: 'image/png', ext: 'png' };
  if (ext === 'pdf') return { tipo: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  const mimes: Record<string, string> = { webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
  return { tipo: 'outro', mime: mimes[ext] || 'application/octet-stream', ext: ext || 'bin' };
};

// --- A cópia ---------------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function copiarUma(admin: Admin, token: string, c: Conexao, linha: any, cache: Map<string, string>) {
  const area = await pastaFilha(token, c.drive_id, c.pasta_id, AREAS[linha.area] ?? 'Outras', cache);
  const unidade = await pastaFilha(token, c.drive_id, area, limpo(linha.unidade_nome), cache);
  const pessoa = await pastaFilha(token, c.drive_id, unidade, limpo(linha.nome), cache);

  let comprovante: { nome: string; tamanho: string; tipo: 'jpg' | 'png' | 'pdf' | 'outro'; bytes?: Uint8Array } | null = null;
  if (linha.comprovante_caminho) {
    const { data, error } = await admin.storage.from('pizza-comprovantes').download(linha.comprovante_caminho);
    if (error || !data) throw new Error(`comprovante não abriu no Storage: ${error?.message ?? 'vazio'}`);
    const bytes = new Uint8Array(await data.arrayBuffer());
    const t = tipoDoArquivo(linha.comprovante_caminho);
    const nomeArq = `${linha.numero} · comprovante.${t.ext}`;
    if (!(await procurar(token, c.drive_id, pessoa, nomeArq, false))) await subir(token, pessoa, nomeArq, t.mime, bytes);
    comprovante = { nome: nomeArq, tamanho: tamanho(bytes.length), tipo: t.tipo, bytes };
  }

  const nomePdf = `${linha.numero} · ${limpo(linha.nome)}.pdf`;
  if (!(await procurar(token, c.drive_id, pessoa, nomePdf, false))) {
    const f = await carregarFontes();
    const sabores = Object.entries(linha.sabores ?? {})
      .filter(([, q]) => Number(q) > 0)
      .sort(([a], [b]) => Object.keys(SABORES).indexOf(a) - Object.keys(SABORES).indexOf(b))
      .map(([k, q]) => ({ sabor: SABORES[k] ?? k, qtd: Number(q) }));
    const pdf = await montarPdf(PDFLib, { ...f, fontkit }, {
      numero: linha.numero, quando: quando(linha.created_at), nome: linha.nome, unidade: linha.unidade_nome,
      area: AREAS[linha.area] ?? linha.area, sabores, preco: PRECO, forma: FORMAS[linha.forma] ?? linha.forma,
      dinheiro: linha.forma === 'dinheiro', comprovante, retirada: 'Na unidade · sexta, 04/12/2026',
    });
    await subir(token, pessoa, nomePdf, 'application/pdf', pdf);
  }
}

async function copiarPendentes(admin: Admin): Promise<{ copiadas: number; falharam: number; pendentes: number; motivo?: string }> {
  const { data: c } = await admin.from('pizza_drive_conexao').select('*').eq('id', 1).maybeSingle();
  if (!c) return { copiadas: 0, falharam: 0, pendentes: 0, motivo: 'Drive não conectado' };
  const token = await tokenDaConexao(admin, c as Conexao);
  // Pega as pendentes que ninguém está copiando agora (trava de 5 minutos).
  const limite = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: livres } = await admin.from('pizza_confirmacoes').select('id')
    .is('drive_copiado_em', null).or(`drive_tentando_em.is.null,drive_tentando_em.lt.${limite}`)
    .order('created_at').limit(POR_VEZ);
  let copiadas = 0, falharam = 0;
  const cache = new Map<string, string>();
  for (const { id } of (livres ?? []) as Array<{ id: string }>) {
    const { data: presa } = await admin.from('pizza_confirmacoes').update({ drive_tentando_em: new Date().toISOString() })
      .eq('id', id).is('drive_copiado_em', null).or(`drive_tentando_em.is.null,drive_tentando_em.lt.${limite}`).select('*').maybeSingle();
    if (!presa) continue;
    try {
      await copiarUma(admin, token, c as Conexao, presa, cache);
      await admin.from('pizza_confirmacoes').update({ drive_copiado_em: new Date().toISOString(), drive_erro: null, drive_tentando_em: null }).eq('id', id);
      copiadas++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[pizza-drive]', presa.numero, msg);
      await admin.from('pizza_confirmacoes').update({ drive_erro: msg.slice(0, 500), drive_tentando_em: null }).eq('id', id);
      falharam++;
    }
  }
  const { count } = await admin.from('pizza_confirmacoes').select('id', { count: 'exact', head: true }).is('drive_copiado_em', null);
  return { copiadas, falharam, pendentes: count ?? 0 };
}

// --- Entrada ------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SITE = (Deno.env.get('SITE_URL') || 'https://app.anabrasil.org').replace(/\/$/, '');
  const admin = createClient(SUPABASE_URL, SERVICE);

  // deno-lint-ignore no-explicit-any
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio = copiar pendentes */ }

  const pedeEquipe = corpo.estado || corpo.oauth_url || corpo.oauth_code || corpo.desconectar || corpo.sincronizar;
  if (!pedeEquipe) {
    // O formulário público: só copia o que estiver pendente.
    try { return json(await copiarPendentes(admin)); }
    catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  }

  // Daqui para baixo, só a equipe do painel.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (!quem?.user) return json({ error: 'Não autorizado.' }, 401);
  const { data: podeVer } = await userClient.rpc('pode_ver_pizza', { _user_id: quem.user.id });
  if (!podeVer) return json({ error: 'Só o ADM e a comunicação.' }, 403);
  const { data: ehComunicacao } = await userClient.rpc('is_marketing_user', { _user_id: quem.user.id });

  try {
    if (corpo.estado) {
      const { data: c } = await admin.from('pizza_drive_conexao').select('google_email, drive_id, pasta_id, conectado_por, conectado_em, erro').eq('id', 1).maybeSingle();
      const { count: pendentes } = await admin.from('pizza_confirmacoes').select('id', { count: 'exact', head: true }).is('drive_copiado_em', null);
      const { count: comErro } = await admin.from('pizza_confirmacoes').select('id', { count: 'exact', head: true }).is('drive_copiado_em', null).not('drive_erro', 'is', null);
      return json({
        oauth_configurado: !!OAUTH_CLIENT_ID && !!OAUTH_CLIENT_SECRET,
        pode_conectar: !!ehComunicacao,
        conexao: c ? { google_email: c.google_email, pasta_link: `https://drive.google.com/drive/folders/${c.pasta_id}`, conectado_por: c.conectado_por, conectado_em: c.conectado_em, erro: c.erro } : null,
        pendentes: pendentes ?? 0, com_erro: comErro ?? 0,
      });
    }

    if (corpo.sincronizar) return json(await copiarPendentes(admin));

    if (!ehComunicacao) return json({ error: 'Conectar o Drive é da comunicação.' }, 403);
    if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) return json({ error: 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET não estão no servidor.' }, 500);
    const redirect = `${SITE}/`;

    if (corpo.oauth_url) {
      const state = `drive:${quem.user.id}:${Date.now()}`;
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: OAUTH_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: ESCOPO,
        access_type: 'offline', prompt: 'consent', login_hint: 'mkt@anabrasil.org', hd: 'anabrasil.org', state,
      });
      return json({ url });
    }

    if (corpo.oauth_code) {
      const [marca, dono] = String(corpo.state || '').split(':');
      if (marca !== 'drive' || dono !== quem.user.id) return json({ error: 'Este retorno do Google não é desta pessoa. Comece de novo em "Conectar".' }, 400);
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: corpo.oauth_code, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET, redirect_uri: redirect, grant_type: 'authorization_code' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.refresh_token) return json({ error: `O Google não devolveu a chave de renovação: ${j.error_description || j.error || r.status}.` }, 400);
      const token = j.access_token as string;
      const sobre = await google(token, 'GET', '/about?fields=user(emailAddress)');
      const email = sobre?.user?.emailAddress ?? '';
      const drives = await google(token, 'GET', `/drives?${new URLSearchParams({ q: `name = '${aspas(DRIVE_COMPARTILHADO)}'`, pageSize: '5', fields: 'drives(id,name)' })}`);
      const drive = drives?.drives?.[0];
      if (!drive) return json({ error: `A conta ${email} não enxerga o Drive compartilhado "${DRIVE_COMPARTILHADO}". Conecte com uma conta que seja membro dele.` }, 400);
      const pasta = await pastaFilha(token, drive.id, drive.id, PASTA_RAIZ, new Map());
      const { error } = await admin.from('pizza_drive_conexao').upsert({
        id: 1, refresh_token: j.refresh_token, google_email: email, drive_id: drive.id, pasta_id: pasta,
        conectado_por: quem.user.email ?? quem.user.id, conectado_em: new Date().toISOString(), erro: null,
      });
      if (error) return json({ error: `não consegui guardar a conexão: ${error.message}` }, 500);
      console.log(`[pizza-drive] ${quem.user.email} conectou o Drive como ${email}`);
      return json({ conectado: true, google_email: email, pasta_link: `https://drive.google.com/drive/folders/${pasta}` });
    }

    if (corpo.desconectar) {
      await admin.from('pizza_drive_conexao').delete().eq('id', 1);
      return json({ conectado: false });
    }

    return json({ error: 'Pedido desconhecido.' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof ErroGoogle && /accessNotConfigured|has not been used|is disabled/i.test(msg)) {
      return json({ error: 'A API do Google Drive não está ativada no projeto do Google Cloud. Ative "Google Drive API" e tente de novo.' }, 400);
    }
    return json({ error: msg }, 500);
  }
});

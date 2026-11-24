import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  ehAcaoConhecida, ehAcaoDeGestor, ehEmailGestor, ehIdDoDrive, ehVoltaPermitida, pastasLiberadasPor,
  type ItemDoDrive,
} from './regras.ts';

/**
 * Ponte entre o Portal Transparência e o Google Drive (conta transparencia@).
 *
 * Desde 24/11/2026:
 *  - conectar, trocar, desconectar e conferir a conta do Google, e ler o nome
 *    de qualquer pasta, só para quem cuida do portal (administrador ou os
 *    e-mails de EMAILS_GESTORES), com login;
 *  - listar uma pasta é aberto ao público, mas só das pastas cadastradas no
 *    portal (transparency_configs) e do que está dentro delas;
 *  - lista a pasta inteira (até 10 mil itens), não só os primeiros 100;
 *  - erro do Google volta como erro, não como pasta vazia.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SEM_CONEXAO = { error: 'google_auth_required' };

// Memória da função (vale enquanto o processo estiver de pé). Só acelera: tudo se confere de novo quando ela falta.
let raizes: { ids: Set<string>; em: number } | null = null;
/** Pasta vista dentro de uma publicada → de qual pasta cadastrada ela veio e até quando vale. */
const liberadas = new Map<string, { raiz: string; ate: number }>();
const VALE_RAIZES = 60_000;
const VALE_LIBERADA = 5 * 60_000;

// deno-lint-ignore no-explicit-any
async function pastasCadastradas(admin: any): Promise<Set<string>> {
  if (raizes && Date.now() - raizes.em < VALE_RAIZES) return raizes.ids;
  const { data, error } = await admin.from('transparency_configs').select('folder_id');
  if (error) throw new Error(`não li as pastas do portal: ${error.message}`);
  raizes = { ids: new Set((data ?? []).map((r: { folder_id: string }) => r.folder_id)), em: Date.now() };
  return raizes.ids;
}
/** Cadastrada? Confere no banco quando a memória não tem (pasta acabou de ser adicionada). */
// deno-lint-ignore no-explicit-any
async function ehCadastrada(admin: any, pastaId: string): Promise<boolean> {
  const ids = await pastasCadastradas(admin);
  if (ids.has(pastaId)) return true;
  const { data } = await admin.from('transparency_configs').select('folder_id').eq('folder_id', pastaId).limit(1);
  if (data?.length) { ids.add(pastaId); return true; }
  return false;
}
/** Libera pastas vistas dentro de `raiz`, sem durar mais que a pasta de onde vieram (`ateMax`). */
const liberar = (ids: string[], raiz: string, ateMax = Infinity) => {
  const ate = Math.min(Date.now() + VALE_LIBERADA, ateMax);
  for (const id of ids) liberadas.set(id, { raiz, ate });
};
/**
 * A raiz de onde a pasta foi liberada, se ainda vale: a raiz precisa continuar
 * cadastrada (a lista se renova a cada minuto). Tirar uma unidade do portal
 * fecha tudo o que veio dela em até 1 minuto.
 */
// deno-lint-ignore no-explicit-any
async function raizLiberada(admin: any, id: string): Promise<{ raiz: string; ate: number } | null> {
  const l = liberadas.get(id);
  if (!l) return null;
  if (l.ate < Date.now() || !(await pastasCadastradas(admin)).has(l.raiz)) { liberadas.delete(id); return null; }
  return l;
}

async function drive(token: string, caminho: string, params: Record<string, string>) {
  const u = new URL(`${DRIVE}${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`Google Drive respondeu ${r.status}`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return corpo;
}

/** Todos os itens de uma pasta (página a página, até 10 mil). */
async function listar(token: string, pastaId: string): Promise<ItemDoDrive[]> {
  const itens: ItemDoDrive[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 10; i++) {
    const params: Record<string, string> = {
      q: `'${pastaId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, shortcutDetails)',
      orderBy: 'folder,name', pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    };
    if (pagina) params.pageToken = pagina;
    const r = await drive(token, '/files', params) as { files?: ItemDoDrive[]; nextPageToken?: string };
    itens.push(...(r.files ?? []));
    pagina = r.nextPageToken;
    if (!pagina) break;
  }
  return itens;
}

/**
 * A pasta pode ser listada pelo público? Devolve a pasta cadastrada de onde
 * ela vem (ou null). Sim se for cadastrada, se já foi vista dentro de uma
 * publicada (e essa continua publicada), se subindo pelas pastas-mãe chegar
 * numa publicada, ou se o `caminho` por onde o visitante chegou (da pasta
 * publicada até a mãe, pasta por pasta) se confirmar no Drive: é o caso dos
 * atalhos, cujo destino mora fora da árvore. Nada disso depende da memória.
 */
// deno-lint-ignore no-explicit-any
async function podeListar(admin: any, token: string, pastaId: string, caminhoDoVisitante: string[] = []): Promise<{ raiz: string; ate: number } | null> {
  if (await ehCadastrada(admin, pastaId)) return { raiz: pastaId, ate: Infinity };
  const ja = await raizLiberada(admin, pastaId);
  if (ja) return ja;
  // Sobe pelas pastas-mãe (até 15 níveis); cada mãe é conferida também no banco.
  const caminho: string[] = [pastaId];
  let atual = pastaId;
  for (let i = 0; i < 15; i++) {
    let pais: string[] = [];
    try { pais = ((await drive(token, `/files/${atual}`, { fields: 'parents', supportsAllDrives: 'true' })) as { parents?: string[] }).parents ?? []; }
    catch (e) { if ((e as { status?: number }).status === 404) break; throw e; } // 404: sem mãe visível; outro erro vira 502
    const maes = pais.filter(ehIdDoDrive);
    if (!maes.length) break;
    for (const m of maes) {
      const origem = (await ehCadastrada(admin, m)) ? { raiz: m, ate: Infinity } : await raizLiberada(admin, m);
      if (origem) { liberar(caminho, origem.raiz, origem.ate); return { raiz: origem.raiz, ate: Math.min(Date.now() + VALE_LIBERADA, origem.ate) }; }
    }
    caminho.push(maes[0]);
    atual = maes[0];
  }
  // Pelo caminho do visitante: o primeiro precisa ser publicado, e cada um seguinte estar dentro do anterior.
  const passos = caminhoDoVisitante.filter(ehIdDoDrive).slice(-20);
  if (!passos.length || passos.includes(pastaId)) return null;
  const inicio = await podeListar(admin, token, passos[0]);
  if (!inicio) return null;
  for (let k = 0; k < passos.length; k++) {
    const proximo = passos[k + 1] ?? pastaId;
    const ja2 = await raizLiberada(admin, proximo);
    if (ja2 && ja2.raiz === inicio.raiz) continue;
    const dentro = pastasLiberadasPor(await listar(token, passos[k]));
    liberar(dentro, inicio.raiz, inicio.ate);
    if (!dentro.includes(proximo)) return null;
  }
  return { raiz: inicio.raiz, ate: Math.min(Date.now() + VALE_LIBERADA, inicio.ate) };
}

// deno-lint-ignore no-explicit-any
async function ehGestor(admin: any, req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const { data } = await admin.auth.getUser(auth.slice(7));
  const user = data?.user;
  if (!user) return false;
  if (ehEmailGestor(user.email)) return true;
  const { data: adm } = await admin.rpc('is_admin', { _user_id: user.id });
  return adm === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // deno-lint-ignore no-explicit-any
    let corpo: any = {};
    try { corpo = await req.json(); } catch { /* vazio */ }
    const { action, folderId, redirectUri, code, caminho, via } = corpo ?? {};
    if (!ehAcaoConhecida(action)) return json({ error: 'Ação inválida' }, 400);
    if (ehAcaoDeGestor(action) && !(await ehGestor(admin, req))) return json({ error: 'Só quem cuida do Portal Transparência.' }, 403);

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    if (action === 'get_auth_url') {
      if (!ehVoltaPermitida(redirectUri)) return json({ error: 'Endereço de volta não permitido.' }, 400);
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.searchParams.set('client_id', clientId);
      u.searchParams.set('redirect_uri', redirectUri);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly');
      u.searchParams.set('access_type', 'offline');
      u.searchParams.set('prompt', 'consent');
      return json({ url: u.toString() });
    }

    if (action === 'exchange_code') {
      if (!ehVoltaPermitida(redirectUri) || typeof code !== 'string' || !code) return json({ error: 'Pedido inválido.' }, 400);
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const t = await r.json();
      if (!t.refresh_token) return json({ error: 'no_refresh_token' }, 400);
      const { error } = await admin.from('global_settings').upsert({ key: 'google_drive_refresh_token', value: { refresh_token: t.refresh_token } });
      if (error) throw new Error(error.message);
      return json({ connected: true });
    }

    if (action === 'disconnect') {
      const { error } = await admin.from('global_settings').delete().eq('key', 'google_drive_refresh_token');
      if (error) throw new Error(error.message);
      return json({ connected: false });
    }

    const { data: cfg } = await admin.from('global_settings').select('value').eq('key', 'google_drive_refresh_token').maybeSingle();
    const refresh = cfg?.value?.refresh_token as string | undefined;

    const novoToken = async (): Promise<string | null> => {
      if (!refresh) return null;
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: 'refresh_token' }),
      });
      const t = await r.json().catch(() => ({}));
      return t.access_token ?? null;
    };

    if (action === 'check_auth') {
      let email: string | null = null;
      const tk = await novoToken().catch(() => null);
      if (tk) {
        try { email = ((await drive(tk, '/about', { fields: 'user(emailAddress)' })) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null; }
        catch { /* sem e-mail */ }
      }
      return json({ connected: !!refresh, email });
    }

    if (!ehIdDoDrive(folderId)) return json({ error: 'Pasta inválida.' }, 400);
    const token = await novoToken();
    if (!token) return json(SEM_CONEXAO); // 200: a tela mostra "temporariamente indisponível"

    if (action === 'get_folder_name') {
      const f = await drive(token, `/files/${folderId}`, { fields: 'name, mimeType', supportsAllDrives: 'true' });
      return json(f);
    }

    // list_files
    const gestor = await ehGestor(admin, req);
    // `caminho`: as pastas por onde o visitante chegou, da publicada até a mãe (`via` = só a mãe, como antes).
    const passos: string[] = Array.isArray(caminho) ? caminho.filter((x: unknown): x is string => typeof x === 'string') : typeof via === 'string' ? [via] : [];
    const origem = gestor ? null : await podeListar(admin, token, folderId, passos);
    if (!gestor && !origem) return json({ error: 'pasta_nao_publicada' }, 403);
    const files = await listar(token, folderId);
    // Só a listagem pública libera as subpastas: um gestor navegando numa pasta fora do portal não a publica.
    if (origem) liberar(pastasLiberadasPor(files), origem.raiz, origem.ate);
    return json({ files });
  } catch (e) {
    const status = (e as { status?: number }).status;
    console.error('[google-drive-proxy]', e instanceof Error ? e.message : e);
    if (status === 404) return json({ error: 'nao_encontrada' }, 404);
    return json({ error: 'drive_indisponivel' }, 502);
  }
});

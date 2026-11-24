/**
 * Regras de acesso da função google-drive-proxy (Portal Transparência).
 * Módulo puro: a função e os testes do app importam daqui.
 */

/** Quem cuida do portal, além dos administradores (o mesmo da tela do painel). */
export const EMAILS_GESTORES = ['mkt@anabrasil.org', 'transparencia@anabrasil.org', 'contato@anabrasil.org'];

/** Ações que mexem na conexão com o Google: só gestores. */
export const ACOES_DE_GESTOR = ['get_auth_url', 'exchange_code', 'disconnect', 'check_auth', 'get_folder_name'] as const;
/** A única ação aberta ao público (a página pública e o site): listar uma pasta publicada. */
export const ACOES_PUBLICAS = ['list_files'] as const;

export type Acao = typeof ACOES_DE_GESTOR[number] | typeof ACOES_PUBLICAS[number];

export const ehAcaoConhecida = (a: unknown): a is Acao =>
  typeof a === 'string' && ([...ACOES_DE_GESTOR, ...ACOES_PUBLICAS] as string[]).includes(a);
export const ehAcaoDeGestor = (a: Acao) => (ACOES_DE_GESTOR as readonly string[]).includes(a);

/** Código de pasta/arquivo do Drive: só letras, números, _ e -. Bloqueia injeção na consulta. */
export const ehIdDoDrive = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(id);

export const ehEmailGestor = (email: string | null | undefined) =>
  !!email && EMAILS_GESTORES.includes(email.trim().toLowerCase());

/**
 * Endereço de volta do Google: só o do próprio app (painel ou localhost de
 * desenvolvimento), para ninguém usar o consentimento com outro destino.
 */
export const ehVoltaPermitida = (url: unknown) => {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const ok = (u.protocol === 'https:' && (host === 'app.anabrasil.org'))
      || (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1'));
    return ok && u.pathname.replace(/\/$/, '') === '/portal-transparencia';
  } catch { return false; }
};

export const PASTA = 'application/vnd.google-apps.folder';
export const ATALHO = 'application/vnd.google-apps.shortcut';

export interface ItemDoDrive {
  id: string;
  name?: string;
  mimeType?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

/** As pastas que uma listagem libera: as subpastas e os destinos dos atalhos de pasta. */
export function pastasLiberadasPor(itens: ItemDoDrive[]): string[] {
  const ids: string[] = [];
  for (const f of itens) {
    if (f.mimeType === PASTA && ehIdDoDrive(f.id)) ids.push(f.id);
    if (f.mimeType === ATALHO && f.shortcutDetails?.targetMimeType === PASTA && ehIdDoDrive(f.shortcutDetails.targetId)) ids.push(f.shortcutDetails.targetId!);
  }
  return ids;
}

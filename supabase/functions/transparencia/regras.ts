/**
 * Regras puras da API pública do Portal Transparência (24/11/2026).
 * A função `transparencia` e os testes do app importam daqui.
 */

export const PASTA = 'application/vnd.google-apps.folder';
export const ATALHO = 'application/vnd.google-apps.shortcut';
/** Documentos nativos do Google (Docs, Planilhas, Apresentações): saem em PDF. */
export const NATIVO = /^application\/vnd\.google-apps\.(document|spreadsheet|presentation|drawing)$/;

/** Item como o Drive devolve na listagem (só os campos que pedimos). */
export interface ItemDoDrive {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

/** Documento como a API mostra (sem nada do Google). */
export interface Documento {
  nome: string;
  tipo: string;
  tamanho: number | null;
  atualizado_em: string | null;
  chave: string;
}
export interface Pasta {
  nome: string;
  pastas: Pasta[];
  documentos: Documento[];
}

/** O que a API guarda de cada item publicado, para achar o arquivo pela chave. */
export interface ItemGuardado {
  chave: string;
  drive_id: string;
  tipo: 'pasta' | 'arquivo';
  nome: string;
  mime: string | null;
  tamanho: number | null;
  modificado_em: string | null;
}

const SEM_ACENTO: Record<string, string> = { á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n' };

/** "1 Ana Jardim Nilópolis" → "Ana Jardim Nilópolis"; "17. Parecer" → "Parecer". */
export const semNumeroNaFrente = (nome: string) => nome.replace(/^\s*\d+\s*[.\-)]?\s*/, '').trim();
/** Tira o "(Parceria Finalizada)" do nome. */
export const semFinalizada = (nome: string) => nome.replace(/\(\s*parceria\s+finalizada\s*\)/i, '').replace(/\s{2,}/g, ' ').trim();

/** Nome da unidade para o site: sem o número da frente nem o "(Parceria Finalizada)". */
export const nomeDaUnidade = (pasta: string) => semFinalizada(semNumeroNaFrente(pasta));

/** Endereço fixo da unidade: "Ana Jardim Nilópolis" → "ana-jardim-nilopolis". */
export function slugDe(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split('').map((c) => SEM_ACENTO[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unidade';
}

/** Social (unidades "Ana …"), Educação (CEIs "Bem Querer") ou outros (GOE). */
export function grupoDa(pasta: string): 'social' | 'educacao' | 'outros' {
  const n = nomeDaUnidade(pasta).toLowerCase();
  if (/^ana\b/.test(n)) return 'social';
  if (/\bcei\b|bem querer/.test(n)) return 'educacao';
  return 'outros';
}
export const ehFinalizada = (pasta: string) => /parceria\s+finalizada/i.test(pasta);
/** O número da frente do nome da pasta (ordem pensada por eles), ou null. */
export const ordemDa = (pasta: string) => { const m = pasta.match(/^\s*(\d+)/); return m ? Number(m[1]) : null; };

/** Ordem natural, como as pessoas numeram: "2 Estatuto" antes de "10 Recursos Humanos". */
export const compararNomes = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });

/** "application/pdf" → "pdf"; documento do Google → "pdf" (sai exportado). */
export function tipoDo(mime: string | undefined, nome: string): string {
  if (!mime) return extensao(nome) || 'arquivo';
  if (NATIVO.test(mime)) return 'pdf';
  const conhecidos: Record<string, string> = {
    'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'text/csv': 'csv', 'text/plain': 'txt', 'text/xml': 'xml', 'application/json': 'json',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.text': 'odt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/msword': 'doc',
  };
  return conhecidos[mime] ?? (extensao(nome) || 'arquivo');
}
const extensao = (nome: string) => { const m = nome.match(/\.([a-z0-9]{2,5})$/i); return m ? m[1].toLowerCase() : ''; };

/** Nome do arquivo para baixar: documento do Google ganha ".pdf". */
export function nomeParaBaixar(nome: string, mime: string | null): string {
  if (mime && NATIVO.test(mime) && !/\.pdf$/i.test(nome)) return `${nome}.pdf`;
  return nome;
}

/** Chave pública do documento: não revela o código do Google e não muda entre atualizações. */
export async function chaveDe(segredo: string, driveId: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(driveId)));
  let s = '';
  for (const b of sig.subarray(0, 12)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const ehChave = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z0-9_-]{16}$/.test(c);

/** Ordena a árvore (pastas e documentos pela ordem natural), em profundidade. */
export function ordenar(p: Pasta): Pasta {
  p.pastas.sort((a, b) => compararNomes(a.nome, b.nome));
  p.documentos.sort((a, b) => compararNomes(a.nome, b.nome));
  p.pastas.forEach(ordenar);
  return p;
}

export const contar = (p: Pasta): { pastas: number; documentos: number } =>
  p.pastas.reduce((t, s) => { const c = contar(s); return { pastas: t.pastas + 1 + c.pastas, documentos: t.documentos + c.documentos }; }, { pastas: 0, documentos: p.documentos.length });

/** Só estes tipos abrem na tela; o resto sempre baixa (nada que rode script no nosso domínio). */
export const mostraNaTela = (mime: string) => /^(application\/pdf|image\/(png|jpeg|webp|gif)|text\/plain|text\/csv)$/.test(mime);

/**
 * Lista nova muito menor que a do ar (zerou, ou perdeu mais da metade com 10+
 * documentos) parece acidente no Drive: não entra sozinha.
 */
export const quedaSuspeita = (antes: number, depois: number) => antes > 0 && (depois === 0 || (antes >= 10 && depois < antes / 2));

/** Escolhe um endereço que ainda não está em uso (acrescenta -2, -3…). */
export function slugLivre(base: string, usados: Set<string>): string {
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
}

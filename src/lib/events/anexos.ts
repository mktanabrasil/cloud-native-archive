import { supabase } from '@/integrations/supabase/client';
import type { Anexo } from '@/types';

/**
 * Os anexos de um evento: o que aceitamos, como guardamos, como apagamos.
 *
 * Até 04/09/2026 o campo "Anexos" só aceitava imagem (`accept="image/*"`) —
 * um ofício em PDF, a planilha de presença, o cardápio, nada entrava. O
 * arquivo subia com nome aleatório na raiz do balde e a lista mostrava
 * "Anexo 1", "Anexo 2". Tirar da lista não apagava o arquivo.
 *
 * O balde `event-attachments` é compartilhado com as fotos do Jornal
 * (`jornal/`), então o limite do balde é mais folgado (25 MB, por causa das
 * Formas ANA em SVG); o limite de 10 MB aqui é dos anexos de evento.
 */

export const BALDE = 'event-attachments';
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024;

/** O que o campo de anexos aceita. A mesma lista vai para o `accept` do input. */
export const TIPOS_ACEITOS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagem',
  'image/png': 'Imagem',
  'image/webp': 'Imagem',
  'image/gif': 'Imagem',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento',
  'application/msword': 'Documento',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Planilha',
  'application/vnd.ms-excel': 'Planilha',
  'text/csv': 'Planilha',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Apresentação',
  'text/plain': 'Texto',
};

export const ACCEPT_ANEXOS = Object.keys(TIPOS_ACEITOS).join(',');

const PREFIXO_PUBLICO = `/storage/v1/object/public/${BALDE}/`;

/** "1,4 MB", "312 KB". Zero quando não sabemos (anexo antigo). */
export function rotuloDoTamanho(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Nome de arquivo seguro para o caminho: sem acento, sem espaço, curto. */
export function limparNome(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  const base = (ponto > 0 ? nome.slice(0, ponto) : nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'arquivo';
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  return ext ? `${base}.${ext}` : base;
}

/** `anexos/2026/09/<uuid>-oficio-secretaria.pdf` — o nome vai junto, para a lista mostrar. */
export function caminhoDoAnexo(nomeOriginal: string, agora: Date = new Date(), uuid: string = crypto.randomUUID()): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `anexos/${ano}/${mes}/${uuid}-${limparNome(nomeOriginal)}`;
}

/** O caminho dentro do balde a partir da URL pública; `null` se não é deste balde. */
export function caminhoNoBalde(url: string): string | null {
  const i = url.indexOf(PREFIXO_PUBLICO);
  if (i < 0) return null;
  const caminho = decodeURIComponent(url.slice(i + PREFIXO_PUBLICO.length).split('?')[0]);
  return caminho || null;
}

/**
 * Um anexo com nome, venha de onde vier.
 *
 * Os antigos são só a URL (`string`), com nome aleatório — aí o nome vira o
 * nome do arquivo mesmo, que é melhor que "Anexo 1". Os novos já trazem
 * nome, tamanho e tipo.
 */
export function normalizarAnexo(a: string | Anexo): Anexo {
  if (typeof a !== 'string') return a;
  const caminho = caminhoNoBalde(a) ?? a;
  const arquivo = caminho.split('/').pop() || 'arquivo';
  // `<uuid>-nome.ext` → `nome.ext`
  const nome = arquivo.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '');
  return { url: a, name: nome, size: 0, type: '' };
}

export const urlDoAnexo = (a: string | Anexo): string => (typeof a === 'string' ? a : a.url);

/** Tipo curto para o ícone/rótulo: "PDF", "Imagem", "Planilha"… */
export function categoriaDoAnexo(a: Anexo): string {
  if (a.type && TIPOS_ACEITOS[a.type]) return TIPOS_ACEITOS[a.type];
  const ext = a.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'PDF';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'Imagem';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Planilha';
  if (['doc', 'docx'].includes(ext)) return 'Documento';
  if (['ppt', 'pptx'].includes(ext)) return 'Apresentação';
  return 'Arquivo';
}

/** Por que um arquivo não pode subir; `null` se pode. */
export function motivoDeRecusa(arquivo: { name: string; size: number; type: string }): string | null {
  if (arquivo.size > ANEXO_MAX_BYTES) {
    return `“${arquivo.name}” tem ${rotuloDoTamanho(arquivo.size)}; o limite é ${rotuloDoTamanho(ANEXO_MAX_BYTES)}.`;
  }
  if (arquivo.type && !TIPOS_ACEITOS[arquivo.type]) {
    return `“${arquivo.name}” não é PDF, imagem, planilha nem documento.`;
  }
  return null;
}

/**
 * Apaga do balde o que saiu da lista. Falhar aqui não pode custar o evento:
 * quem chama já gravou. Arquivo de outra pessoa (a política só deixa o dono
 * ou o admin apagar) fica órfão — paciência, é o que já acontecia com todos.
 */
export async function apagarDoBalde(urls: string[]): Promise<void> {
  const caminhos = urls.map(caminhoNoBalde).filter((c): c is string => !!c);
  if (caminhos.length === 0) return;
  try {
    await supabase.storage.from(BALDE).remove(caminhos);
  } catch {
    // silêncio: o evento já foi salvo; um órfão não é motivo para alarme
  }
}

import { JOURNAL_CORNER_KEYS, JOURNAL_ELEMENT_KEYS, type JournalCornerKey, type JournalElementKey } from './elements';
import { formatarMes, interpretarMes } from './mesDaEdicao';
import { uid } from './templates';
import {
  JOURNAL_COLOR_KEYS,
  JOURNAL_PAPER_KEYS,
  TEXT_STYLE_LABELS,
  type BlockSpan,
  type JournalBlock,
  type JournalColorKey,
  type JournalDecoration,
  type JournalPage,
  type JournalPaperKey,
  type JournalTemplate,
  type TextStyleKey,
} from './types';
import { NEWS_UNITS, type NewsUnit } from '@/lib/news/units';

/**
 * "Criar a partir de esboço" (caminho 2, 05/10/2026).
 *
 * O esboço é o que eu gero na pasta "Jornal - Esboço" a partir do PDF fora do
 * padrão que a diretora manda: `esboco.json` (o mesmo conteúdo do `dados.js`)
 * e as fotos recortadas em `fotos/foto-NN.jpg`. Aqui ele vira páginas do
 * Jornal, sem IA e sem banco: só conferência e conversão. Quem grava é o
 * caminho normal da criação, com a sessão de quem clicou.
 *
 * Diferente da importação antiga, aqui nada é "aparado em silêncio": o esboço
 * foi feito à mão para caber na régua, então o que não bate é erro de esboço,
 * e trava a criação com o motivo, em vez de virar um jornal diferente.
 */

const TIPOS: JournalTemplate[] = ['capa', 'materias', 'materia', 'galeria', 'agenda', 'numeros', 'contracapa', 'branco'];
const ESTILOS = Object.keys(TEXT_STYLE_LABELS) as TextStyleKey[];
const ALINHAMENTOS = ['left', 'center', 'right', 'justify'] as const;
const PROPORCOES = ['16/9', '4/3', '1/1', '3/4'] as const;

/** Nomes de cor do esboço que o app escreve de outro jeito. */
const COR_DO_ESBOCO: Record<string, JournalColorKey> = { verde: 'verde_agua', 'verde-agua': 'verde_agua' };

export interface PecaDoEsboco {
  kind: 'text' | 'image' | 'stat';
  style?: string;
  align?: string;
  span?: number;
  height?: number;
  content?: string;
  list?: boolean;
  ratio?: string;
  foto?: number;
  caption?: string;
  value?: string;
  label?: string;
}

export interface Esboco {
  nomeJornal?: string;
  unidade?: { nome?: string; segmento?: string };
  mes?: string;
  fundo?: string;
  formas?: { elemento?: string; cores?: Partial<Record<string, string>> };
  limite?: number;
  fotos?: Array<{ n: number }>;
  paginas?: Array<{ tipo?: string; pecas?: PecaDoEsboco[] }>;
}

export interface Conferencia {
  unidade: NewsUnit | null;
  /** "Setembro 2026", ou null quando o esboço não tem um mês legível. */
  mes: string | null;
  fundo: JournalPaperKey;
  /** Páginas prontas, com as imagens ainda sem endereço e o número da foto guardado à parte. */
  paginas: JournalPage[];
  /** Para cada bloco de imagem, o número da foto do esboço. */
  fotoDoBloco: Map<string, number>;
  /** Os números de foto usados, em ordem e sem repetir. */
  fotosUsadas: number[];
  /** Fotos listadas no esboço que não entram em nenhuma página. */
  fotosDeFora: number[];
  /** O que trava a criação. */
  erros: string[];
  /** O que só avisa. */
  avisos: string[];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** A unidade pelo nome oficial (ou o curto), ignorando acento e caixa. */
export function unidadeDoEsboco(nome: string | undefined): NewsUnit | null {
  if (!nome) return null;
  const alvo = semAcento(nome);
  return NEWS_UNITS.find((u) => semAcento(u.name) === alvo || semAcento(u.short) === alvo) ?? null;
}

/** `foto-07.jpg` → 7. Outros nomes não são fotos do esboço. */
export function numeroDaFoto(nomeDoArquivo: string): number | null {
  const m = nomeDoArquivo.match(/^foto-(\d+)\.jpe?g$/i);
  return m ? Number(m[1]) : null;
}

const largura = (n: unknown): BlockSpan | null => {
  const v = Number(n ?? 6);
  return Number.isInteger(v) && v >= 1 && v <= 6 ? (v as BlockSpan) : null;
};

const altura = (n: unknown): number | undefined => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
};

function decoracoes(formas: Esboco['formas'], erros: string[]): JournalDecoration[] {
  if (!formas?.elemento) return [];
  if (!JOURNAL_ELEMENT_KEYS.includes(formas.elemento as JournalElementKey)) {
    erros.push(`Forma ANA “${formas.elemento}” não existe no Jornal.`);
    return [];
  }
  const lista: JournalDecoration[] = [];
  for (const canto of JOURNAL_CORNER_KEYS) {
    const bruta = formas.cores?.[canto];
    if (!bruta) continue;
    const cor = COR_DO_ESBOCO[bruta] ?? bruta;
    if (!JOURNAL_COLOR_KEYS.includes(cor as JournalColorKey)) {
      erros.push(`Cor “${bruta}” do canto ${canto.replace('_', ' ')} não é uma cor do Jornal.`);
      continue;
    }
    lista.push({ element: formas.elemento as JournalElementKey, corner: canto as JournalCornerKey, color: cor as JournalColorKey });
  }
  return lista;
}

/**
 * Confere o esboço e monta as páginas. Nunca lança: o que não presta vai para
 * `erros`, e a tela mostra a lista.
 *
 * `fotosNaPasta` são os números das `foto-NN.jpg` que vieram junto.
 */
export function conferirEsboco(esboco: Esboco, fotosNaPasta: Set<number>): Conferencia {
  const erros: string[] = [];
  const avisos: string[] = [];

  const unidade = unidadeDoEsboco(esboco.unidade?.nome);
  if (!unidade) erros.push(`Unidade “${esboco.unidade?.nome ?? 'sem nome'}” não encontrada no app. Corrija o nome no esboço.`);

  const mesLido = interpretarMes(esboco.mes);
  const mes = mesLido ? formatarMes(mesLido) : null;
  if (!mes) erros.push(`Mês “${esboco.mes ?? ''}” ilegível. Use, por exemplo, “Setembro de 2026”.`);

  const fundo = JOURNAL_PAPER_KEYS.includes(esboco.fundo as JournalPaperKey) ? (esboco.fundo as JournalPaperKey) : 'off_white';
  const cantos = decoracoes(esboco.formas, erros);

  const fotoDoBloco = new Map<string, number>();
  const usadas: number[] = [];
  const paginasBrutas = Array.isArray(esboco.paginas) ? esboco.paginas : [];
  if (!paginasBrutas.length) erros.push('O esboço não tem páginas.');

  const paginas = paginasBrutas.map((p, i): JournalPage => {
    const onde = `Página ${i + 1}`;
    const template = TIPOS.includes(p.tipo as JournalTemplate) ? (p.tipo as JournalTemplate) : 'materia';
    if (!TIPOS.includes(p.tipo as JournalTemplate)) erros.push(`${onde}: tipo de página “${p.tipo}” não existe no Jornal.`);

    const blocks = (p.pecas ?? []).map((peca, j): JournalBlock | null => {
      const qual = `${onde}, peça ${j + 1}`;
      const span = largura(peca.span);
      if (!span) { erros.push(`${qual}: largura ${peca.span} fora da grade de 6 colunas.`); return null; }
      const height = altura(peca.height);

      if (peca.kind === 'text') {
        if (!ESTILOS.includes(peca.style as TextStyleKey)) { erros.push(`${qual}: função de texto “${peca.style}” não existe.`); return null; }
        const content = (peca.content ?? '').trim();
        if (!content) { avisos.push(`${qual}: texto vazio, ficou de fora.`); return null; }
        const align = (ALINHAMENTOS as readonly string[]).includes(peca.align ?? '') ? (peca.align as (typeof ALINHAMENTOS)[number]) : 'left';
        return { id: uid(), kind: 'text', style: peca.style as TextStyleKey, content, align, span, ...(height ? { height } : {}), ...(peca.list ? { list: true } : {}) };
      }

      if (peca.kind === 'image') {
        const ratio = (PROPORCOES as readonly string[]).includes(peca.ratio ?? '') ? (peca.ratio as (typeof PROPORCOES)[number]) : '16/9';
        const bloco: JournalBlock = { id: uid(), kind: 'image', url: '', caption: (peca.caption ?? '').trim(), span, ratio, fit: 'cover', ...(height ? { height } : {}) };
        if (peca.foto !== undefined) {
          const n = Number(peca.foto);
          if (!fotosNaPasta.has(n)) erros.push(`${qual}: a foto ${n} não está na pasta (fotos/foto-${String(n).padStart(2, '0')}.jpg).`);
          fotoDoBloco.set(bloco.id, n);
          if (!usadas.includes(n)) usadas.push(n);
        }
        return bloco;
      }

      if (peca.kind === 'stat') {
        const value = (peca.value ?? '').trim();
        if (!value) { avisos.push(`${qual}: número vazio, ficou de fora.`); return null; }
        return { id: uid(), kind: 'stat', value, label: (peca.label ?? '').trim(), span, ...(height ? { height } : {}) };
      }

      erros.push(`${qual}: tipo de peça “${(peca as { kind?: string }).kind}” desconhecido.`);
      return null;
    }).filter((b): b is JournalBlock => b !== null);

    return { id: uid(), template, blocks, ...(cantos.length ? { decorations: cantos.map((c) => ({ ...c })) } : {}) };
  });

  const listadas = (esboco.fotos ?? []).map((f) => Number(f.n)).filter(Number.isFinite);
  const fotosDeFora = listadas.filter((n) => !usadas.includes(n));
  if (fotosDeFora.length) avisos.push(`${fotosDeFora.length === 1 ? 'Fica de fora a foto' : `Ficam de fora ${fotosDeFora.length} fotos:`} ${fotosDeFora.join(', ')}, como no esboço.`);
  if (esboco.limite && paginas.length > esboco.limite) avisos.push(`${paginas.length} páginas, acima do limite de ${esboco.limite} da unidade.`);

  return { unidade, mes, fundo, paginas, fotoDoBloco, fotosUsadas: usadas, fotosDeFora, erros, avisos };
}

/** Coloca o endereço de cada foto enviada no seu bloco. Foto que não subiu deixa o quadro vazio. */
export function colocarFotos(paginas: JournalPage[], fotoDoBloco: Map<string, number>, enderecos: Map<number, string>): JournalPage[] {
  return paginas.map((p) => ({
    ...p,
    blocks: p.blocks.map((b) => {
      if (b.kind !== 'image') return b;
      const n = fotoDoBloco.get(b.id);
      const url = n === undefined ? undefined : enderecos.get(n);
      return url ? { ...b, url } : b;
    }),
  }));
}

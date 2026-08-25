/**
 * Modelo de dados do Jornal Institucional.
 *
 * Um jornal é uma lista de páginas A4; cada página é uma grade de 6 colunas
 * preenchida por blocos. Os estilos são travados pela identidade — a pessoa
 * escolhe apenas a *função* do texto, nunca fonte/cor/tamanho.
 */

import { JOURNAL_CORNER_KEYS, type JournalCornerKey, type JournalElementKey } from './elements';

export type JournalTemplate =
  | 'capa'
  | 'materias'
  | 'materia'
  | 'galeria'
  | 'agenda'
  | 'numeros'
  | 'contracapa'
  | 'branco';

export type TextStyleKey =
  | 'titulo_capa'
  | 'titulo_materia'
  | 'subtitulo'
  | 'corpo'
  | 'destaque'
  | 'chamada'
  | 'legenda';

export type BlockSpan = 1 | 2 | 3 | 4 | 5 | 6;

/** Cores autorizadas da identidade — nenhuma cor livre é permitida. */
export type JournalColorKey =
  | 'tinta'
  | 'areia'
  | 'amarelo'
  | 'coral'
  | 'verde_agua'
  | 'azul';

export const JOURNAL_COLOR_LABELS: Record<JournalColorKey, string> = {
  tinta: 'Tinta institucional',
  areia: 'Areia',
  amarelo: 'Amarelo ANA',
  coral: 'Coral',
  verde_agua: 'Verde-água',
  azul: 'Azul ANA',
};

/** Hex fixo (não usa var CSS) para garantir paridade preview = PDF no html2canvas. */
export const JOURNAL_COLOR_HEX: Record<JournalColorKey, string> = {
  tinta: '#1F211F',
  areia: '#F2DBBB',
  amarelo: '#FACC00',
  coral: '#F5705B',
  verde_agua: '#87E0CB',
  azul: '#00A6FF',
};

export const JOURNAL_COLOR_KEYS = Object.keys(JOURNAL_COLOR_LABELS) as JournalColorKey[];

/**
 * As cinco cores da marca, na mesma ordem das faixas do rodapé.
 *
 * Derivada do catálogo em vez de escrita à mão: uma segunda lista poderia sair
 * de ordem, e a ordem é justamente o que faz o corte por segmento funcionar.
 * A tinta fica de fora porque não é cor de marca — é a cor do texto, presente
 * em toda página dos dois segmentos.
 */
export const JOURNAL_BRAND_COLOR_KEYS = JOURNAL_COLOR_KEYS.filter((key) => key !== 'tinta');

/**
 * Cores oferecidas para as formas, dado quantas cores de marca o segmento usa
 * (ver `brandColorCount`). A tinta acompanha os dois segmentos.
 *
 * Restringe a *oferta*, não o que já está gravado: um jornal pintado antes
 * desta regra mantém a cor dele. Trocar sozinho o desenho de uma edição já
 * publicada seria pior do que a inconsistência.
 */
export const journalColorsForBrandCount = (count: number): JournalColorKey[] => [
  'tinta',
  ...JOURNAL_BRAND_COLOR_KEYS.slice(0, count),
];

export const journalColor = (key?: JournalColorKey): string =>
  JOURNAL_COLOR_HEX[key ?? 'tinta'] ?? JOURNAL_COLOR_HEX.tinta;

/**
 * Fundos autorizados da folha do jornal — aplicados ao jornal inteiro, nunca por
 * página. Cinzas de interface (área de trabalho) não entram aqui: nenhum fundo
 * da interface pode interferir na cor exportada.
 */
export type JournalPaperKey = 'off_white' | 'branco';

export const JOURNAL_PAPER_LABELS: Record<JournalPaperKey, string> = {
  off_white: 'Off-white institucional',
  branco: 'Branco',
};

/** Hex fixo (não usa var CSS) — mesma razão da paleta de tinta acima. */
export const JOURNAL_PAPER_HEX: Record<JournalPaperKey, string> = {
  off_white: '#F0EEE4',
  branco: '#FFFFFF',
};

export const JOURNAL_PAPER_KEYS = Object.keys(JOURNAL_PAPER_LABELS) as JournalPaperKey[];

export const DEFAULT_JOURNAL_PAPER: JournalPaperKey = 'off_white';

export const journalPaper = (key?: JournalPaperKey): string =>
  JOURNAL_PAPER_HEX[key ?? DEFAULT_JOURNAL_PAPER] ?? JOURNAL_PAPER_HEX[DEFAULT_JOURNAL_PAPER];

/**
 * Narrowing do fundo vindo do banco, onde a coluna é `text` e aceita qualquer
 * coisa. Nulo — o caso de todo jornal criado antes deste campo passar a ser
 * gravado — e valor desconhecido caem no padrão, em vez de vazar para o
 * `style` e deixar a folha sem cor.
 */
export const toJournalPaper = (value?: string | null): JournalPaperKey =>
  JOURNAL_PAPER_KEYS.includes(value as JournalPaperKey)
    ? (value as JournalPaperKey)
    : DEFAULT_JOURNAL_PAPER;

export interface JournalTextBlock {
  id: string;
  kind: 'text';
  /** Altura fixa em px definida pela alça inferior no canvas. Ausente = automática. */
  height?: number;
  style: TextStyleKey;
  content: string;
  align: 'left' | 'center' | 'right' | 'justify';
  span: BlockSpan;
  /** Opcional — ausente significa tinta institucional. */
  color?: JournalColorKey;
  /** Espaçamento entre linhas (1,0 a 2,0). Ausente usa o padrão da função. */
  lineHeight?: number;
  /** Tamanho da fonte em px. Ausente usa o padrão da função. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  /** Renderiza cada linha do conteúdo como item de lista. */
  list?: boolean;
}


export interface JournalImageBlock {
  id: string;
  kind: 'image';
  /** Altura fixa em px definida pela alça inferior no canvas. Ausente = automática. */
  height?: number;
  url: string;
  caption: string;
  span: BlockSpan;
  ratio: '16/9' | '4/3' | '1/1' | '3/4';
  fit: 'cover' | 'contain';
  /** Cor da legenda — ausente usa o cinza institucional padrão. */
  color?: JournalColorKey;
}

export interface JournalAgendaItem {
  id: string;
  date: string;
  title: string;
  time: string;
  place: string;
}

export interface JournalAgendaBlock {
  id: string;
  kind: 'agenda';
  /** Altura fixa em px definida pela alça inferior no canvas. Ausente = automática. */
  height?: number;
  items: JournalAgendaItem[];
  span: BlockSpan;
}

export interface JournalStatBlock {
  id: string;
  kind: 'stat';
  /** Altura fixa em px definida pela alça inferior no canvas. Ausente = automática. */
  height?: number;
  value: string;
  label: string;
  span: BlockSpan;
  /** Cor do número — ausente significa tinta institucional. */
  color?: JournalColorKey;
}

export type JournalBlock =
  | JournalTextBlock
  | JournalImageBlock
  | JournalAgendaBlock
  | JournalStatBlock;

/**
 * Forma orgânica ancorada num canto da folha.
 *
 * Escolher uma forma na biblioteca veste os quatro cantos — mesma silhueta,
 * espelhada conforme o lado e invertida em cima. Depois disso cada canto é
 * independente: dá para trocar a cor de um só, ou remover um e manter os
 * outros. Escala, ancoragem e espelhamento continuam sendo do sistema.
 */
export interface JournalDecoration {
  element: JournalElementKey;
  corner: JournalCornerKey;
  color: JournalColorKey;
}

/** Cor inicial das quatro formas — a pessoa ajusta cada canto depois. */
export const DEFAULT_DECORATION_COLOR: JournalColorKey = 'areia';

/** Uma escolha na biblioteca vale para os quatro cantos. */
export const createDecorationSet = (element: JournalElementKey): JournalDecoration[] =>
  JOURNAL_CORNER_KEYS.map((corner) => ({
    element,
    corner,
    color: DEFAULT_DECORATION_COLOR,
  }));

export interface JournalPage {
  id: string;
  template: JournalTemplate;
  blocks: JournalBlock[];
  /**
   * No máximo quatro, uma por canto. Fora de `blocks` de propósito: blocos
   * fluem na grade de 6 colunas, e estas são ancoradas nos cantos — misturá-las
   * faria a forma perder a âncora e virar elemento móvel.
   */
  decorations?: JournalDecoration[];
}

export interface JournalRecord {
  id: string;
  name: string;
  unit_id: string | null;
  profile_unit: string | null;
  reference_month: string | null;
  status: 'rascunho' | 'finalizado' | 'arquivado';
  pages: JournalPage[];
  /** Fundo da folha. Nulo nos jornais anteriores a este campo ser gravado. */
  paper: string | null;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const TEXT_STYLE_LABELS: Record<TextStyleKey, string> = {
  titulo_capa: 'Título de capa',
  titulo_materia: 'Título de matéria',
  subtitulo: 'Subtítulo',
  corpo: 'Corpo do texto',
  destaque: 'Frase de destaque',
  chamada: 'Chamada curta',
  legenda: 'Legenda',
};

/** Funções de texto oferecidas no editor (as demais existem só para conteúdo legado). */
export const SELECTABLE_TEXT_STYLES: TextStyleKey[] = [
  'titulo_capa',
  'titulo_materia',
  'subtitulo',
  'corpo',
  'destaque',
];

/** Classes tipográficas travadas — usadas no canvas, no preview e no PDF. */
export const TEXT_STYLE_CLASSES: Record<TextStyleKey, string> = {
  titulo_capa: 'text-[35px] font-extrabold uppercase leading-[1.05] tracking-tight',
  titulo_materia: 'text-[23px] font-bold leading-[1.15]',
  subtitulo: 'text-[15px] font-semibold uppercase tracking-[0.14em]',
  corpo: 'text-[18px] leading-[1.65] text-justify',
  destaque: 'text-[15px] font-semibold italic leading-[1.4] border-l-4 pl-3',
  chamada: 'text-[12px] font-medium leading-[1.4]',
  legenda: 'text-[12px] italic leading-[1.3]',
};

/** Tamanho padrão (px) de cada função tipográfica — usado no controle de fonte. */
export const TEXT_STYLE_DEFAULT_SIZES: Record<TextStyleKey, number> = {
  titulo_capa: 35,
  titulo_materia: 23,
  subtitulo: 15,
  corpo: 18,
  destaque: 15,
  chamada: 12,
  legenda: 12,
};


export const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  finalizado: 'Finalizado',
  arquivado: 'Arquivado',
};

/**
 * Cores da etiqueta de status. Mora aqui, e não na listagem, porque a mesma
 * etiqueta aparece na lista e dentro do editor — a diretora precisa reconhecer
 * o mesmo estado nos dois lugares pela mesma cor.
 */
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  rascunho: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  finalizado: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  arquivado: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

export const TEMPLATE_LABELS: Record<JournalTemplate, string> = {
  capa: 'Capa',
  materias: 'Matérias',
  materia: 'Matéria completa',
  galeria: 'Galeria',
  agenda: 'Agenda',
  numeros: 'Resultados e números',
  contracapa: 'Contracapa',
  branco: 'Em branco',
};

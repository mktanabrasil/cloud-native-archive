/**
 * Formas orgânicas ANA — biblioteca fechada do Jornal Institucional.
 *
 * Cinco silhuetas, aplicadas aos quatro cantos da folha. A pessoa escolhe
 * forma, canto e cor; escala, ancoragem e espelhamento são do sistema. Isso
 * mantém a variedade dentro da identidade sem abrir espaço para diagramação
 * livre.
 *
 * Os paths vêm dos SVGs oficiais (Elementos ANA/formas) com duas normalizações:
 *
 * 1. Máscaras e clipPaths removidos. O Figma envolve cada path numa `<mask>`
 *    luminance ou num `<clipPath>` retangular que apenas circunscreve o próprio
 *    desenho — são no-ops (medido: 2 pixels de diferença em 1,75 milhão na
 *    primeira, zero nas demais). Sem eles o html2canvas não tem máscara para
 *    interpretar errado na exportação do PDF.
 * 2. `viewBox` recortado à caixa de tinta. O original tem folga — em algumas,
 *    86% —, o que faria qualquer medida de largura render um desenho muito
 *    menor que o pedido.
 */

export type JournalElementKey =
  | 'elemento_01'
  | 'elemento_02'
  | 'elemento_03'
  | 'elemento_04'
  | 'elemento_05';

/** Cantos onde uma forma pode ser ancorada. */
export type JournalCornerKey =
  | 'superior_esquerdo'
  | 'superior_direito'
  | 'inferior_esquerdo'
  | 'inferior_direito';

export interface JournalElementDef {
  key: JournalElementKey;
  label: string;
  /** Borda de onde a forma nasce no desenho original — define quando espelhar. */
  nativeSide: 'esquerda' | 'direita';
  /** Recortado à tinta; largura em px mapeia direto para o tamanho desenhado. */
  viewBox: string;
  /** Largura ÷ altura da tinta. */
  ratio: number;
  /**
   * Fator sobre a medida global, para a silhueta que pede outra presença.
   * Ausente significa 1 — a medida padrão.
   *
   * É proporção, e não largura em px, justamente para sobreviver a mudanças de
   * escala: um número absoluto aqui deixa de fazer sentido no instante em que
   * `ELEMENT_INK_WIDTH` muda, e pode inverter a intenção sem ninguém notar.
   */
  presence?: number;
  /** Sobrescreve `ELEMENT_BLEED`. Zero mantém a forma inteira dentro da folha. */
  bleed?: number;
  paths: string[];
}

export const JOURNAL_ELEMENTS: JournalElementDef[] = [
  {
    key: 'elemento_01',
    label: 'Forma 1',
    nativeSide: 'direita',
    viewBox: '3 3 135 107',
    ratio: 1.2617,
    paths: [
      'M3.35781 109.387H137.76V22.6641C135.52 21.0879 133.243 19.7363 130.948 18.6367C127.862 17.1582 124.74 16.1309 121.618 15.625C117.812 15.0059 113.363 15.0586 108.835 15.7832C100.063 17.1875 90.9847 21.1172 85.6603 27.6113C75.0772 40.5176 88.0425 52.918 78.9491 65.2812C66.8631 81.7109 36.7456 69.6172 16.1416 88.3965C10.4322 93.6016 5.11 101.49 3.35781 109.387Z',
      'M137.76 16.5332V109.387H45.9375C46.5259 102.459 48.7025 96.4688 52.5809 92.25C53.1716 91.6035 53.8103 90.9961 54.4928 90.4258C64.7041 81.9141 80.6028 85.8359 89.9762 72.9863C99.5641 59.8379 88.2022 48.4863 94.7691 32.75C97.4247 26.3867 102.476 20.5898 108.835 15.7852C117.068 9.55859 127.498 4.99414 137.76 3.00586V16.5332Z',
      'M20.1688 109.387H137.76V16.5332C135.437 17.0996 133.166 17.8008 130.948 18.6348C124.195 21.1816 117.983 25.0078 113.468 30.1777C97.3022 48.6855 115.625 69.791 101.483 83.6875C90.9234 94.0605 71.6997 91.1484 54.4928 90.4258C41.9978 89.9004 30.5659 90.5293 24.2922 98.2402C21.4594 101.725 20.4006 105.762 20.1688 109.387Z',
    ],
  },
  {
    key: 'elemento_02',
    label: 'Forma 2',
    nativeSide: 'esquerda',
    viewBox: '3 2 135 89',
    ratio: 1.5169,
    paths: [
      'M137.762 90.4455H3.35999V2.85088C19.4906 2.73713 36.3584 8.05672 41.9934 16.5951C50.9228 30.1242 28.6037 47.1405 39.434 61.1175C43.0478 65.7848 48.3328 67.4982 62.5165 70.6992C65.765 71.4315 69.4772 72.2419 73.7428 73.1839C86.8044 76.0686 97.7987 78.5035 106.794 80.5955C126.149 85.0975 136.244 88.0194 137.762 90.4455Z',
      'M116.987 90.4455H3.35999V17.4749C8.46342 18.4506 13.1731 20.2191 16.8984 22.8353C34.5844 35.2607 19.1844 59.1909 35.8465 69.4391C43.6844 74.261 52.3359 72.1904 62.5166 70.6992C70.8947 69.471 80.3075 68.6357 91.1575 72.3521C96.6612 74.2379 102.084 77.1421 106.796 80.5972C110.854 83.5689 114.384 86.953 116.987 90.4455Z',
      'M48.8032 36.0712C53.0075 35.2376 58.2225 38.5222 58.2903 41.3961C58.391 45.5853 47.5803 49.4279 44.4894 47.2845C41.7157 45.3596 43.12 37.1963 48.8032 36.0712Z',
      'M54.8122 49.6252C56.3544 49.3195 58.2663 50.5228 58.2903 51.5767C58.3275 53.1124 54.3638 54.5218 53.2306 53.7362C52.2134 53.0306 52.7297 50.0376 54.8122 49.6252Z',
    ],
  },
  {
    key: 'elemento_03',
    label: 'Forma 3',
    nativeSide: 'esquerda',
    viewBox: '5 4 248 240',
    ratio: 1.0333,
    paths: [
      'M252.871 243.387H5.10938V6.37891C10.2734 5.01173 15.707 4.59766 20.9688 5.22657C36.8008 7.1211 50.8164 16.9961 60.957 29.2969C79.0391 51.2344 86.1914 81.7656 79.7305 109.453C76.7812 122.074 71.3906 136.141 78.1836 147.184C84.8008 157.941 100.16 159.781 112.215 156.004C124.27 152.227 134.555 144.289 146.121 139.211C157.688 134.133 172.32 132.418 182.066 140.453C189.867 146.879 192.352 157.723 192.984 167.809C193.621 177.895 192.938 188.301 196.328 197.824C201.844 213.305 216.824 223.145 231.273 230.977C238.508 234.898 246.035 238.766 252.871 243.387Z',
    ],
  },
  {
    key: 'elemento_04',
    label: 'Forma 4',
    nativeSide: 'direita',
    viewBox: '5 8 240 202',
    ratio: 1.1881,
    // Onda de pico estreito: com a sangria padrão o topo saía decepado.
    // Sem sangria a parede encosta na borda e a silhueta aparece inteira.
    // Os 84% preservam a proporção de quando esta forma valia 210px contra os
    // 250px das demais.
    presence: 0.84,
    paths: [
      'M244.77 8.80078V209.191H5.23047C6.28906 184.965 16.6016 160.996 34.4844 144.508C61.332 119.777 103.566 113.434 136.5 129.16C148.293 134.828 160.133 143.238 173.109 141.465C192.008 138.887 201.141 116.438 201.352 97.3711C201.562 78.3008 196.871 58.4336 203.805 40.6758C210.441 23.6797 226.676 12.9023 244.77 8.80078Z',
    ],
  },
  {
    key: 'elemento_05',
    label: 'Forma 5',
    nativeSide: 'esquerda',
    viewBox: '5 1 240 208',
    ratio: 1.1538,
    paths: [
      'M5.22266 1.19922V208.793H244.777C224.535 108.078 169.355 164.289 111.676 127.758C82 108.965 102.914 61.9609 83.9453 34.8633C67.418 11.25 37.1328 3.42187 5.22266 1.19922Z',
    ],
  },
];

export const JOURNAL_ELEMENT_KEYS = JOURNAL_ELEMENTS.map((e) => e.key);

export const findJournalElement = (key: JournalElementKey): JournalElementDef =>
  JOURNAL_ELEMENTS.find((e) => e.key === key) ?? JOURNAL_ELEMENTS[0];

export const JOURNAL_CORNER_LABELS: Record<JournalCornerKey, string> = {
  superior_esquerdo: 'Superior esquerdo',
  superior_direito: 'Superior direito',
  inferior_esquerdo: 'Inferior esquerdo',
  inferior_direito: 'Inferior direito',
};

export const JOURNAL_CORNER_KEYS = Object.keys(JOURNAL_CORNER_LABELS) as JournalCornerKey[];

/**
 * Medida das formas de baixo — 20% da largura da folha A4.
 *
 * Acento de canto, não fundo. Numa página cheia a forma inferior sobe por trás
 * da última coluna de texto, e é a altura dela que decide se a mancha continua
 * respirando: a 250px eram 242px de invasão, mais de um quinto da folha.
 */
export const ELEMENT_INK_WIDTH = 160;

/**
 * Medida das formas de cima — 62,5% da de baixo.
 *
 * Os dois pares não disputam o mesmo espaço: embaixo não há nada até a faixa
 * institucional. Em cima a forma divide a faixa com o logo e o texto do
 * cabeçalho, e por isso entra menor.
 *
 * Reduzir não elimina a sobreposição — o logo começa a 48px da borda e a forma
 * nasce no zero, então qualquer largura visível passa por trás dele. Mas muda
 * o quanto ela avança sobre ele: a 150px a caixa cobria os 90px do logo
 * inteiros, o que na prática proibia a tinta institucional naquele canto; a
 * 100px cobre 52px, e a leitura do logo deixa de depender da cor escolhida.
 */
export const ELEMENT_INK_WIDTH_TOP = 100;

/**
 * Sangria para fora da borda lateral — hoje zero, e por um motivo técnico, não
 * estético: o html2canvas **descarta** um SVG cuja tinta ultrapasse a borda do
 * container, em vez de recortá-la. Com sangria negativa as formas sumiam do PDF
 * enquanto apareciam no preview. Encostadas na borda, o desenho sai inteiro e
 * preview e PDF voltam a coincidir.
 *
 * Para reintroduzir sangria de verdade seria preciso recortar o `viewBox` em
 * vez de deslocar o elemento, mantendo tudo dentro da caixa.
 */
export const ELEMENT_BLEED = 0;

export const isTopCorner = (corner: JournalCornerKey): boolean =>
  corner.startsWith('superior');

/**
 * Largura e sangria efetivas da forma.
 *
 * Silhuetas diferentes não toleram a mesma ancoragem: cortar a parede de uma
 * massa sólida é inofensivo, mas cortar o pico de uma onda amputa o desenho.
 * Por isso cada forma pode declarar a sua presença.
 *
 * A composição é sempre `medida do canto × presença da forma`, nesta ordem:
 * assim a diferença entre as silhuetas sobrevive a qualquer mudança de escala,
 * em vez de precisar ser recalculada junto.
 */
export const elementInkWidth = (
  element: JournalElementDef,
  corner: JournalCornerKey,
): number =>
  Math.round(
    (isTopCorner(corner) ? ELEMENT_INK_WIDTH_TOP : ELEMENT_INK_WIDTH) * (element.presence ?? 1),
  );

export const elementBleed = (element: JournalElementDef): number =>
  element.bleed ?? ELEMENT_BLEED;

const cornerSide = (corner: JournalCornerKey) =>
  corner.endsWith('esquerdo') ? 'esquerda' : 'direita';

/**
 * Espelha só quando o canto pedido difere do lado nativo da forma. As silhuetas
 * têm orientações distintas — algumas nascem da direita, outras da esquerda —,
 * então não existe regra global do tipo "esquerda sempre espelha".
 */
export const shouldMirror = (element: JournalElementDef, corner: JournalCornerKey): boolean =>
  cornerSide(corner) !== element.nativeSide;

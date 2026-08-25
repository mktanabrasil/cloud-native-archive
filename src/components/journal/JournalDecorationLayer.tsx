import {
  elementBleed,
  elementInkWidth,
  findJournalElement,
  isTopCorner,
  shouldMirror,
  type JournalElementDef,
} from '@/lib/journal/elements';
import { journalColor, type JournalDecoration } from '@/lib/journal/types';

interface Props {
  /** Até quatro — uma por canto. */
  decorations?: JournalDecoration[];
}

/**
 * Monta a forma como documento SVG independente, em data URL.
 *
 * O espelhamento é assado no próprio desenho, não aplicado por CSS: assim a
 * imagem já nasce na orientação final e não depende de o html2canvas
 * interpretar `transform` na exportação.
 */
function toDataUrl(
  element: JournalElementDef,
  mirrored: boolean,
  flipped: boolean,
  fill: string,
  width: number,
  height: number,
): string {
  const [x, y, viewWidth, viewHeight] = element.viewBox.split(' ').map(Number);
  const paths = element.paths.map((d) => `<path d="${d}" fill="${fill}"/>`).join('');
  // espelho em torno do centro do viewBox: horizontal troca o lado, vertical
  // vira a forma de cabeça para baixo para ela nascer da borda de cima
  const inner =
    mirrored || flipped
      ? `<g transform="translate(${mirrored ? 2 * x + viewWidth : 0},` +
        `${flipped ? 2 * y + viewHeight : 0}) scale(${mirrored ? -1 : 1},${flipped ? -1 : 1})">` +
        `${paths}</g>`
      : paths;
  // `width`/`height` no próprio documento: sem eles o SVG não tem tamanho
  // intrínseco, e o navegador rasteriza numa dimensão arbitrária — o desenho
  // sai deformado na exportação, ainda que o `<img>` tenha as medidas certas.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="${element.viewBox}" preserveAspectRatio="none">${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Camada decorativa da folha — sempre atrás do conteúdo editorial.
 *
 * Precisa ficar dentro de um container cuja borda inferior coincida com o topo
 * da faixa institucional: a forma é ancorada em `bottom: -1px` — ou `top: -1px`
 * nos cantos de cima — e o `overflow-hidden` do pai absorve esse pixel. É o que
 * garante encosto sem folga branca em qualquer zoom, e sem cobrir a faixa.
 *
 * As formas de cima passam por trás do cabeçalho: a camada é `z-0` e o
 * cabeçalho `z-10`. A sobreposição é inevitável — o logo começa a 48px da borda
 * e a forma nasce no zero —, e é por isso que elas entram reduzidas
 * (`ELEMENT_INK_WIDTH_TOP`).
 *
 * A forma sai como `<img>`, e não como `<svg>` inline, por causa da exportação:
 * o html2canvas descarta SVG inline e `background-image` que fiquem abaixo da
 * viewport do navegador — e o rodapé de uma folha A4 fica sempre abaixo dela.
 * Medido: no rodapé, `<svg>` inline e `background-image` rendem zero pixel,
 * enquanto `<img>` com data URL rende a forma inteira. É também o que o logo
 * institucional já fazia, e por isso sempre apareceu no PDF.
 */
export function JournalDecorationLayer({ decorations }: Props) {
  if (!decorations?.length) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {decorations.map((decoration) => {
        const element = findJournalElement(decoration.element);
        const width = elementInkWidth(element, decoration.corner);
        const height = Math.round(width / element.ratio);
        const bleed = elementBleed(element);
        const top = isTopCorner(decoration.corner);
        const side = decoration.corner.endsWith('esquerdo')
          ? { left: -bleed }
          : { right: -bleed };

        return (
          <img
            key={decoration.corner}
            src={toDataUrl(
              element,
              shouldMirror(element, decoration.corner),
              top,
              journalColor(decoration.color),
              width,
              height,
            )}
            alt=""
            width={width}
            height={height}
            className="absolute"
            style={{ ...(top ? { top: -1 } : { bottom: -1 }), ...side }}
          />
        );
      })}
    </div>
  );
}

export default JournalDecorationLayer;

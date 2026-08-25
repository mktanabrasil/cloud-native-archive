import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { JournalDecorationLayer } from './JournalDecorationLayer';
import {
  ELEMENT_BLEED,
  ELEMENT_INK_WIDTH,
  ELEMENT_INK_WIDTH_TOP,
  JOURNAL_CORNER_KEYS,
  JOURNAL_ELEMENTS,
  elementBleed,
  elementInkWidth,
  findJournalElement,
  isTopCorner,
  shouldMirror,
  type JournalCornerKey,
} from '@/lib/journal/elements';
import {
  JOURNAL_COLOR_HEX,
  createDecorationSet,
  type JournalDecoration,
} from '@/lib/journal/types';

const uma = (decoration: JournalDecoration) =>
  render(<JournalDecorationLayer decorations={[decoration]} />).container.querySelector('img')!;

/**
 * Orientação assada no documento SVG: `[horizontal, vertical]`, onde -1 é
 * espelhado. Sem transform algum o desenho está na orientação nativa.
 */
const orientacao = (img: HTMLImageElement): [number, number] => {
  const doc = decodeURIComponent(img.getAttribute('src')!);
  const m = doc.match(/scale\((-?1),(-?1)\)/);
  return m ? [Number(m[1]), Number(m[2])] : [1, 1];
};

describe('JournalDecorationLayer', () => {
  it('não renderiza nada quando a página não tem formas', () => {
    expect(render(<JournalDecorationLayer />).container.firstChild).toBeNull();
    expect(render(<JournalDecorationLayer decorations={[]} />).container.firstChild).toBeNull();
  });

  /**
   * As silhuetas têm orientações nativas opostas: o Elemento 01 nasce da
   * direita e o 02 da esquerda. Uma regra global do tipo "esquerda sempre
   * espelha" viraria a forma errada — daí o teste cobrir as combinações.
   */
  it.each([
    ['elemento_01', 'inferior_esquerdo', true],
    ['elemento_01', 'inferior_direito', false],
    ['elemento_01', 'superior_esquerdo', true],
    ['elemento_01', 'superior_direito', false],
    ['elemento_02', 'inferior_esquerdo', false],
    ['elemento_02', 'inferior_direito', true],
    ['elemento_02', 'superior_esquerdo', false],
    ['elemento_02', 'superior_direito', true],
  ] as const)('espelha %s no canto %s: %s', (element, corner, esperado) => {
    expect(shouldMirror(findJournalElement(element), corner)).toBe(esperado);
    expect(orientacao(uma({ element, corner, color: 'areia' }))[0]).toBe(esperado ? -1 : 1);
  });

  /** Em cima a forma nasce da borda de cima: mesma silhueta de cabeça para baixo. */
  it.each(JOURNAL_CORNER_KEYS)('inverte a vertical só nos cantos de cima: %s', (corner) => {
    const esperado = isTopCorner(corner) ? -1 : 1;
    expect(orientacao(uma({ element: 'elemento_03', corner, color: 'areia' }))[1]).toBe(esperado);
  });

  /**
   * O `scale` sozinho espelha em torno da origem, e jogaria o desenho para fora
   * do viewBox: é o `translate` que o traz de volta. Cada eixo tem de usar a
   * medida do seu próprio eixo — trocar altura por largura desloca a forma sem
   * mudar nenhuma das asserções de orientação.
   */
  it('translada pela medida do eixo espelhado, para a forma cair dentro do viewBox', () => {
    JOURNAL_ELEMENTS.forEach((def) => {
      const [x, y, viewWidth, viewHeight] = def.viewBox.split(' ').map(Number);
      const translate = (corner: JournalCornerKey) =>
        decodeURIComponent(uma({ element: def.key, corner, color: 'areia' }).getAttribute('src')!)
          .match(/translate\((-?[\d.]+),(-?[\d.]+)\)/)
          ?.slice(1)
          .map(Number);

      const espelhado = def.nativeSide === 'esquerda' ? 'direita' : 'esquerda';
      const soHorizontal = espelhado === 'esquerda' ? 'inferior_esquerdo' : 'inferior_direito';
      const soVertical = espelhado === 'esquerda' ? 'superior_direito' : 'superior_esquerdo';
      const ambas = espelhado === 'esquerda' ? 'superior_esquerdo' : 'superior_direito';

      expect(translate(soHorizontal)).toEqual([2 * x + viewWidth, 0]);
      expect(translate(soVertical)).toEqual([0, 2 * y + viewHeight]);
      expect(translate(ambas)).toEqual([2 * x + viewWidth, 2 * y + viewHeight]);
    });
  });

  it('ancora cada forma na borda do seu canto', () => {
    const esq = uma({ element: 'elemento_01', corner: 'inferior_esquerdo', color: 'areia' });
    expect(esq.style.left).toBe(`${-ELEMENT_BLEED}px`);
    expect(esq.style.right).toBe('');

    const dir = uma({ element: 'elemento_01', corner: 'inferior_direito', color: 'areia' });
    expect(dir.style.right).toBe(`${-ELEMENT_BLEED}px`);
    expect(dir.style.left).toBe('');

    const supEsq = uma({ element: 'elemento_01', corner: 'superior_esquerdo', color: 'areia' });
    expect(supEsq.style.left).toBe(`${-ELEMENT_BLEED}px`);
    expect(supEsq.style.right).toBe('');
  });

  /**
   * Regressão do PDF: o html2canvas descarta o SVG inteiro quando a tinta
   * ultrapassa a borda do container — não recorta, apaga. Com deslocamento
   * negativo as formas apareciam no preview e sumiam no PDF exportado. Nenhuma
   * forma pode ser posicionada para fora da folha.
   */
  it('nenhuma forma é posicionada fora da folha', () => {
    expect(ELEMENT_BLEED).toBe(0);
    JOURNAL_ELEMENTS.forEach((def) => {
      expect(elementBleed(def)).toBe(0);
      JOURNAL_CORNER_KEYS.forEach((corner) => {
        const svg = uma({ element: def.key, corner, color: 'areia' });
        const deslocamento = parseFloat(svg.style.left || svg.style.right || '0');
        expect(deslocamento).toBeGreaterThanOrEqual(0);
      });
    });
  });

  /** O 1px negativo é o que impede a folga branca entre a forma e a faixa. */
  it('encosta na faixa institucional sem deixar folga', () => {
    const svg = uma({ element: 'elemento_02', corner: 'inferior_esquerdo', color: 'coral' });
    expect(svg.style.bottom).toBe('-1px');
    expect(svg.style.top).toBe('');
  });

  /** Mesmo encosto na borda de cima — e sem sobrar `bottom` para brigar com ele. */
  it('encosta na borda de cima sem deixar folga', () => {
    const svg = uma({ element: 'elemento_02', corner: 'superior_direito', color: 'coral' });
    expect(svg.style.top).toBe('-1px');
    expect(svg.style.bottom).toBe('');
  });

  /** Hex literal, não currentColor: o html2canvas resolve mal cor herdada. */
  it('pinta os paths com hex da paleta institucional', () => {
    const svg = uma({ element: 'elemento_01', corner: 'inferior_direito', color: 'azul' });
    const doc = decodeURIComponent(svg.getAttribute('src')!);
    const pintados = doc.split('fill="' + JOURNAL_COLOR_HEX.azul + '"').length - 1;
    expect(pintados).toBe(findJournalElement('elemento_01').paths.length);
  });

  /**
   * O Elemento 04 é uma onda de pico estreito: com a sangria padrão o topo saía
   * decepado numa vertical reta. Ele declara os próprios valores, e as demais
   * seguem os globais.
   */
  describe('ancoragem por forma', () => {
    it('o Elemento 04 usa largura menor que as demais', () => {
      const def = findJournalElement('elemento_04');
      expect(elementInkWidth(def, 'inferior_esquerdo')).toBe(210);

      const svg = uma({ element: 'elemento_04', corner: 'inferior_esquerdo', color: 'areia' });
      expect(svg.getAttribute('width')).toBe('210');
    });

    it('as demais formas seguem os valores globais', () => {
      JOURNAL_ELEMENTS.filter((e) => e.key !== 'elemento_04').forEach((def) => {
        expect(elementInkWidth(def, 'inferior_direito')).toBe(ELEMENT_INK_WIDTH);
        expect(elementInkWidth(def, 'superior_direito')).toBe(ELEMENT_INK_WIDTH_TOP);
      });
    });

    it('a altura acompanha a proporção da tinta de cada forma', () => {
      JOURNAL_ELEMENTS.forEach((def) => {
        JOURNAL_CORNER_KEYS.forEach((corner) => {
          const svg = uma({ element: def.key, corner, color: 'tinta' });
          const largura = elementInkWidth(def, corner);
          expect(svg.getAttribute('width')).toBe(String(largura));
          expect(svg.getAttribute('height')).toBe(String(Math.round(largura / def.ratio)));
        });
      });
    });

    /**
     * Sem `width`/`height` no próprio documento o SVG não tem tamanho
     * intrínseco, e a exportação rasteriza numa dimensão arbitrária — o desenho
     * sai deformado mesmo com o `<img>` medindo certo.
     */
    it('o documento SVG carrega as mesmas medidas do elemento', () => {
      JOURNAL_ELEMENTS.forEach((def) => {
        const img = uma({ element: def.key, corner: 'inferior_esquerdo', color: 'areia' });
        const doc = decodeURIComponent(img.getAttribute('src')!);
        expect(doc).toContain(`width="${img.getAttribute('width')}"`);
        expect(doc).toContain(`height="${img.getAttribute('height')}"`);
      });
    });
  });

  describe('catálogo', () => {
    it('tem cinco formas, com chaves e rótulos únicos', () => {
      expect(JOURNAL_ELEMENTS).toHaveLength(5);
      expect(new Set(JOURNAL_ELEMENTS.map((e) => e.key)).size).toBe(5);
      expect(new Set(JOURNAL_ELEMENTS.map((e) => e.label)).size).toBe(5);
    });

    it('a proporção declarada bate com o viewBox recortado à tinta', () => {
      JOURNAL_ELEMENTS.forEach((def) => {
        const [, , w, h] = def.viewBox.split(' ').map(Number);
        expect(def.ratio).toBeCloseTo(w / h, 3);
        expect(def.paths.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Embaixo não há nada até a faixa institucional; em cima a forma divide o
   * espaço com o logo e o texto do cabeçalho. Por isso o topo entra reduzido.
   */
  describe('escala do topo', () => {
    it('é menor que a da base', () => {
      expect(ELEMENT_INK_WIDTH_TOP).toBeLessThan(ELEMENT_INK_WIDTH);
    });

    it('reduz na mesma proporção em todas as formas, inclusive na de medida própria', () => {
      const fator = ELEMENT_INK_WIDTH_TOP / ELEMENT_INK_WIDTH;
      JOURNAL_ELEMENTS.forEach((def) => {
        const base = elementInkWidth(def, 'inferior_esquerdo');
        expect(elementInkWidth(def, 'superior_esquerdo')).toBe(Math.round(base * fator));
      });
      // o Elemento 04 vale 210 na base justamente por ser mais estreito, e essa
      // diferença tem de sobreviver à redução
      expect(elementInkWidth(findJournalElement('elemento_04'), 'superior_esquerdo')).toBe(126);
    });

    it('o mesmo canto de cima é menor que o de baixo no desenho renderizado', () => {
      JOURNAL_ELEMENTS.forEach((def) => {
        const cima = uma({ element: def.key, corner: 'superior_esquerdo', color: 'areia' });
        const baixo = uma({ element: def.key, corner: 'inferior_esquerdo', color: 'areia' });
        expect(Number(cima.getAttribute('width'))).toBeLessThan(
          Number(baixo.getAttribute('width')),
        );
        expect(Number(cima.getAttribute('height'))).toBeLessThan(
          Number(baixo.getAttribute('height')),
        );
      });
    });
  });

  describe('conjunto de formas', () => {
    it('createDecorationSet devolve os quatro cantos com a mesma silhueta', () => {
      const conjunto = createDecorationSet('elemento_02');
      expect(conjunto.map((d) => d.corner)).toEqual([...JOURNAL_CORNER_KEYS]);
      expect(new Set(conjunto.map((d) => d.element))).toEqual(new Set(['elemento_02']));
    });

    it('desenha as quatro, uma em cada canto, sem repetir orientação', () => {
      const { container } = render(
        <JournalDecorationLayer decorations={createDecorationSet('elemento_01')} />,
      );
      const imgs = [...container.querySelectorAll('img')];
      expect(imgs).toHaveLength(4);

      const cantos = imgs.map((img) => [
        img.style.left ? 'esquerda' : 'direita',
        img.style.top ? 'cima' : 'baixo',
      ]);
      expect(new Set(cantos.map((c) => c.join('-'))).size).toBe(4);

      // cada canto recebe uma combinação de espelhamento distinta
      expect(new Set(imgs.map((img) => orientacao(img).join(','))).size).toBe(4);
    });

    it('mantém a cor de cada canto independente', () => {
      const { container } = render(
        <JournalDecorationLayer
          decorations={[
            { element: 'elemento_01', corner: 'superior_esquerdo', color: 'verde_agua' },
            { element: 'elemento_01', corner: 'inferior_esquerdo', color: 'coral' },
            { element: 'elemento_01', corner: 'inferior_direito', color: 'azul' },
          ]}
        />,
      );
      const [cima, esq, dir] = [...container.querySelectorAll('img')];
      expect(decodeURIComponent(cima.getAttribute('src')!)).toContain(JOURNAL_COLOR_HEX.verde_agua);
      expect(decodeURIComponent(esq.getAttribute('src')!)).toContain(JOURNAL_COLOR_HEX.coral);
      expect(decodeURIComponent(dir.getAttribute('src')!)).toContain(JOURNAL_COLOR_HEX.azul);
    });

    /** Jornal gravado antes dos cantos de cima existirem continua desenhando. */
    it('desenha um jornal antigo, com só os dois cantos de baixo', () => {
      const { container } = render(
        <JournalDecorationLayer
          decorations={createDecorationSet('elemento_05').filter((d) => !isTopCorner(d.corner))}
        />,
      );
      const imgs = [...container.querySelectorAll('img')];
      expect(imgs).toHaveLength(2);
      imgs.forEach((img) => expect(img.style.bottom).toBe('-1px'));
    });
  });
});

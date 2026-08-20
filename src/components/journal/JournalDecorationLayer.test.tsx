import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { JournalDecorationLayer } from './JournalDecorationLayer';
import {
  ELEMENT_BLEED,
  ELEMENT_INK_WIDTH,
  JOURNAL_ELEMENTS,
  elementBleed,
  elementInkWidth,
  findJournalElement,
  shouldMirror,
} from '@/lib/journal/elements';
import {
  JOURNAL_COLOR_HEX,
  createDecorationPair,
  type JournalDecoration,
} from '@/lib/journal/types';

const uma = (decoration: JournalDecoration) =>
  render(<JournalDecorationLayer decorations={[decoration]} />).container.querySelector('img')!;

describe('JournalDecorationLayer', () => {
  it('não renderiza nada quando a página não tem formas', () => {
    expect(render(<JournalDecorationLayer />).container.firstChild).toBeNull();
    expect(render(<JournalDecorationLayer decorations={[]} />).container.firstChild).toBeNull();
  });

  /**
   * As duas silhuetas têm orientações nativas opostas: o Bloob 02 nasce da
   * direita e o Bloob 04 da esquerda. Uma regra global do tipo "esquerda sempre
   * espelha" viraria a forma errada — daí o teste cobrir as quatro combinações.
   */
  it.each([
    ['elemento_01', 'inferior_esquerdo', true],
    ['elemento_01', 'inferior_direito', false],
    ['elemento_02', 'inferior_esquerdo', false],
    ['elemento_02', 'inferior_direito', true],
  ] as const)('espelha %s no canto %s: %s', (element, corner, esperado) => {
    expect(shouldMirror(findJournalElement(element), corner)).toBe(esperado);
    const svg = uma({ element, corner, color: 'areia' });
    expect(decodeURIComponent(svg.getAttribute('src')!).includes('scale(-1,1)')).toBe(esperado);
  });

  it('ancora cada forma na borda do seu canto', () => {
    const esq = uma({ element: 'elemento_01', corner: 'inferior_esquerdo', color: 'areia' });
    expect(esq.style.left).toBe(`${-ELEMENT_BLEED}px`);
    expect(esq.style.right).toBe('');

    const dir = uma({ element: 'elemento_01', corner: 'inferior_direito', color: 'areia' });
    expect(dir.style.right).toBe(`${-ELEMENT_BLEED}px`);
    expect(dir.style.left).toBe('');
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
      (['inferior_esquerdo', 'inferior_direito'] as const).forEach((corner) => {
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
      expect(elementInkWidth(def)).toBe(210);

      const svg = uma({ element: 'elemento_04', corner: 'inferior_esquerdo', color: 'areia' });
      expect(svg.getAttribute('width')).toBe('210');
    });

    it('as demais formas seguem os valores globais', () => {
      JOURNAL_ELEMENTS.filter((e) => e.key !== 'elemento_04').forEach((def) => {
        expect(elementInkWidth(def)).toBe(ELEMENT_INK_WIDTH);
      });
    });

    it('a altura acompanha a proporção da tinta de cada forma', () => {
      JOURNAL_ELEMENTS.forEach((def) => {
        const svg = uma({ element: def.key, corner: 'inferior_direito', color: 'tinta' });
        const largura = elementInkWidth(def);
        expect(svg.getAttribute('width')).toBe(String(largura));
        expect(svg.getAttribute('height')).toBe(String(Math.round(largura / def.ratio)));
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

  describe('par de formas', () => {
    it('createDecorationPair devolve os dois cantos com a mesma silhueta', () => {
      const par = createDecorationPair('elemento_02');
      expect(par.map((d) => d.corner)).toEqual(['inferior_esquerdo', 'inferior_direito']);
      expect(new Set(par.map((d) => d.element))).toEqual(new Set(['elemento_02']));
    });

    it('desenha as duas, uma em cada borda, espelhadas entre si', () => {
      const { container } = render(
        <JournalDecorationLayer decorations={createDecorationPair('elemento_01')} />,
      );
      const [esq, dir] = [...container.querySelectorAll('img')];
      expect(esq.style.left).toBe(`${-ELEMENT_BLEED}px`);
      expect(dir.style.right).toBe(`${-ELEMENT_BLEED}px`);
      const espelhado = (el: Element) => decodeURIComponent(el.getAttribute('src')!).includes('scale(-1,1)');
      expect(espelhado(esq)).not.toBe(espelhado(dir));
    });

    it('mantém a cor de cada lado independente', () => {
      const { container } = render(
        <JournalDecorationLayer
          decorations={[
            { element: 'elemento_01', corner: 'inferior_esquerdo', color: 'coral' },
            { element: 'elemento_01', corner: 'inferior_direito', color: 'azul' },
          ]}
        />,
      );
      const [esq, dir] = [...container.querySelectorAll('img')];
      expect(decodeURIComponent(esq.getAttribute('src')!)).toContain(JOURNAL_COLOR_HEX.coral);
      expect(decodeURIComponent(dir.getAttribute('src')!)).toContain(JOURNAL_COLOR_HEX.azul);
    });
  });
});

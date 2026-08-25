import { describe, expect, it } from 'vitest';
import { brandColorCount, newsUnitSegment, NEWS_UNITS } from '@/lib/news/units';
import {
  JOURNAL_BRAND_COLOR_KEYS,
  JOURNAL_COLOR_KEYS,
  journalColorsForBrandCount,
} from './types';

/** Uma unidade de cada segmento, para os casos não dependerem de um id só. */
const umaDe = (segmento: 'educacao' | 'social') =>
  NEWS_UNITS.filter((u) => newsUnitSegment(u.id) === segmento).map((u) => u.id);

describe('cores por segmento', () => {
  describe('quantas cores de marca cada segmento usa', () => {
    it('Educação usa três', () => {
      umaDe('educacao').forEach((id) => expect(brandColorCount(id)).toBe(3));
    });

    it('Social usa cinco', () => {
      umaDe('social').forEach((id) => expect(brandColorCount(id)).toBe(5));
    });

    it('sem unidade vale o padrão neutro de cinco', () => {
      expect(brandColorCount(null)).toBe(5);
      expect(brandColorCount(undefined)).toBe(5);
      expect(brandColorCount('unidade-que-nao-existe')).toBe(5);
    });
  });

  describe('paleta oferecida para as formas', () => {
    it('Educação oferece tinta e as três primeiras cores de marca', () => {
      expect(journalColorsForBrandCount(3)).toEqual(['tinta', 'areia', 'amarelo', 'coral']);
    });

    it('Social oferece tinta e as cinco', () => {
      expect(journalColorsForBrandCount(5)).toEqual([
        'tinta',
        'areia',
        'amarelo',
        'coral',
        'verde_agua',
        'azul',
      ]);
    });

    /** A tinta é a cor do texto, presente nos dois segmentos — nunca é recortada. */
    it('a tinta acompanha qualquer segmento', () => {
      [0, 3, 5].forEach((n) => expect(journalColorsForBrandCount(n)[0]).toBe('tinta'));
    });

    it('a lista de marca não inclui a tinta e mantém a ordem do catálogo', () => {
      expect(JOURNAL_BRAND_COLOR_KEYS).not.toContain('tinta');
      expect(['tinta', ...JOURNAL_BRAND_COLOR_KEYS]).toEqual(JOURNAL_COLOR_KEYS);
    });
  });

  /**
   * O invariante que motivou a mudança: uma folha com rodapé de três cores e
   * forma azul se contradiz sozinha. Como as duas pontas leem a mesma
   * contagem, a paleta nunca oferece uma cor que o rodapé daquela unidade não
   * usa.
   */
  describe('rodapé e formas falam a língua do mesmo segmento', () => {
    it.each([...umaDe('educacao'), ...umaDe('social'), null])(
      'a paleta de %s não passa das faixas do rodapé',
      (id) => {
        const faixas = brandColorCount(id);
        const deMarca = journalColorsForBrandCount(faixas).filter((c) => c !== 'tinta');
        expect(deMarca).toHaveLength(faixas);
        expect(deMarca).toEqual(JOURNAL_BRAND_COLOR_KEYS.slice(0, faixas));
      },
    );
  });
});

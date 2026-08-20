import { describe, expect, it } from 'vitest';
import { ACTIVE_NEWS_UNITS, NEWS_UNIT_GROUPS, newsUnitSegment } from './units';

describe('segmento da unidade', () => {
  it('NAVEs são Social', () => {
    expect(newsUnitSegment('ana-nilopolis')).toBe('social');
    expect(newsUnitSegment('ana-dic')).toBe('social');
    expect(newsUnitSegment('ana-oziel')).toBe('social');
  });

  it('CEIs são Educação', () => {
    expect(newsUnitSegment('cei-pierre-weil')).toBe('educacao');
    expect(newsUnitSegment('cei-vandir')).toBe('educacao');
  });

  /** Decisão: o Institucional acompanha a Educação. */
  it('o Institucional (GOE) é Educação', () => {
    expect(newsUnitSegment('goe')).toBe('educacao');
  });

  /** Sem unidade não há segmento — quem chama aplica o padrão neutro. */
  it('devolve undefined sem unidade ou com id desconhecido', () => {
    expect(newsUnitSegment(null)).toBeUndefined();
    expect(newsUnitSegment(undefined)).toBeUndefined();
    expect(newsUnitSegment('')).toBeUndefined();
    expect(newsUnitSegment('unidade-que-nao-existe')).toBeUndefined();
  });

  it('toda unidade ativa tem segmento definido', () => {
    ACTIVE_NEWS_UNITS.forEach((unit) => {
      expect(newsUnitSegment(unit.id)).toBeDefined();
    });
  });

  /** O segmento tem de espelhar o agrupamento que o seletor já mostra. */
  it('acompanha os grupos do seletor', () => {
    const porRotulo = Object.fromEntries(NEWS_UNIT_GROUPS.map((g) => [g.label, g.units]));
    porRotulo.Social.forEach((u) => expect(newsUnitSegment(u.id)).toBe('social'));
    porRotulo['Educação'].forEach((u) => expect(newsUnitSegment(u.id)).toBe('educacao'));
  });
});

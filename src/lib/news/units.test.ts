import { describe, expect, it } from 'vitest';
import { ACTIVE_NEWS_UNITS, JORNAL_UNIT_GROUPS, NEWS_UNIT_GROUPS, ehUnidadeDoJornal, newsUnitSegment } from './units';

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

/** O Jornal é da Educação (16/11/2026): as NAVEs saíram do seletor dele. */
describe('as unidades do Jornal', () => {
  it('o seletor do Jornal tem só a Educação, com os CEIs e o GOE', () => {
    expect(JORNAL_UNIT_GROUPS.map((g) => g.label)).toEqual(['Educação']);
    const ids = JORNAL_UNIT_GROUPS.flatMap((g) => g.units.map((u) => u.id));
    expect(ids).toContain('goe');
    expect(ids).toContain('cei-anisio-spinola');
    expect(ids.some((id) => id.startsWith('ana-'))).toBe(false);
  });

  it('o pedido de acesso continua com as NAVEs', () => {
    expect(NEWS_UNIT_GROUPS.map((g) => g.label)).toEqual(['Social', 'Educação']);
  });

  it('ehUnidadeDoJornal: CEI e GOE sim; NAVE, desconhecida e vazia, não', () => {
    expect(ehUnidadeDoJornal('cei-vandir')).toBe(true);
    expect(ehUnidadeDoJornal('goe')).toBe(true);
    expect(ehUnidadeDoJornal('ana-dic')).toBe(false);
    expect(ehUnidadeDoJornal('nao-existe')).toBe(false);
    expect(ehUnidadeDoJornal(null)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { diasDoEvento, eDiaDeFim, eDiaDeInicio, ocorreNoDia } from './diasDoEvento';

const ev = (inicio: Date, fim: Date) => ({ start_datetime: inicio.toISOString(), end_datetime: fim.toISOString() });

describe('diasDoEvento', () => {
  it('um evento de um dia é um dia só', () => {
    const e = ev(new Date(2026, 9, 13, 8), new Date(2026, 9, 13, 17));
    expect(diasDoEvento(e)).toHaveLength(1);
    expect(ocorreNoDia(e, new Date(2026, 9, 13, 23))).toBe(true);
    expect(ocorreNoDia(e, new Date(2026, 9, 14))).toBe(false);
  });

  it('colônia de férias de 13 a 17 ocupa os cinco dias', () => {
    const e = ev(new Date(2026, 9, 13, 8), new Date(2026, 9, 17, 16));
    expect(diasDoEvento(e).map(d => d.getDate())).toEqual([13, 14, 15, 16, 17]);
    expect(ocorreNoDia(e, new Date(2026, 9, 15))).toBe(true);
    expect(eDiaDeInicio(e, new Date(2026, 9, 15))).toBe(false);
    expect(eDiaDeInicio(e, new Date(2026, 9, 13))).toBe(true);
    expect(eDiaDeFim(e, new Date(2026, 9, 17))).toBe(true);
    expect(eDiaDeFim(e, new Date(2026, 9, 16))).toBe(false);
  });

  it('termina de madrugada no dia seguinte: dois dias', () => {
    const e = ev(new Date(2026, 9, 13, 22), new Date(2026, 9, 14, 1));
    expect(diasDoEvento(e).map(d => d.getDate())).toEqual([13, 14]);
  });

  it('fim antes do início vale um dia; data inválida, nenhum', () => {
    expect(diasDoEvento(ev(new Date(2026, 9, 13), new Date(2026, 9, 10)))).toHaveLength(1);
    expect(diasDoEvento({ start_datetime: 'x', end_datetime: 'y' })).toHaveLength(0);
    expect(ocorreNoDia({ start_datetime: 'x', end_datetime: 'y' }, new Date())).toBe(false);
  });

  it('um fim digitado errado, anos à frente, não pinta a grade inteira', () => {
    expect(diasDoEvento(ev(new Date(2026, 9, 13), new Date(2099, 0, 1))).length).toBeLessThanOrEqual(62);
  });
});

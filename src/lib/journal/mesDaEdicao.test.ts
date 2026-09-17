import { describe, expect, it } from 'vitest';
import { anosDisponiveis, formatarMes, interpretarMes, mesAtual, ordenarMeses } from './mesDaEdicao';

describe('mês da edição', () => {
  it('grava e lê no mesmo formato', () => {
    expect(formatarMes({ mes: 9, ano: 2026 })).toBe('Setembro 2026');
    expect(interpretarMes('Setembro 2026')).toEqual({ mes: 9, ano: 2026 });
  });

  it('entende os textos antigos digitados à mão', () => {
    expect(interpretarMes('Julho/2026')).toEqual({ mes: 7, ano: 2026 });
    expect(interpretarMes('julho de 2026')).toEqual({ mes: 7, ano: 2026 });
    expect(interpretarMes('07/2026')).toEqual({ mes: 7, ano: 2026 });
    expect(interpretarMes('2026-07')).toEqual({ mes: 7, ano: 2026 });
    expect(interpretarMes('Agosto 2026')).toEqual({ mes: 8, ano: 2026 });
    expect(interpretarMes('edição especial')).toBeNull();
    expect(interpretarMes('')).toBeNull();
  });

  it('mês atual e anos oferecidos', () => {
    const hoje = new Date(2026, 8, 17);
    expect(mesAtual(hoje)).toEqual({ mes: 9, ano: 2026 });
    expect(anosDisponiveis(null, hoje)).toEqual([2027, 2026, 2025]);
    expect(anosDisponiveis({ mes: 1, ano: 2023 }, hoje)).toEqual([2027, 2026, 2025, 2023]);
  });

  it('ordena do mais recente para o mais antigo, com os textos estranhos no fim', () => {
    expect(ordenarMeses(['Julho/2026', 'especial', 'Setembro 2026', 'Agosto 2026'])).toEqual(['Setembro 2026', 'Agosto 2026', 'Julho/2026', 'especial']);
  });
});

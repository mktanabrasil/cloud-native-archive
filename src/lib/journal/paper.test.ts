import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOURNAL_PAPER,
  JOURNAL_PAPER_HEX,
  JOURNAL_PAPER_KEYS,
  journalPaper,
  toJournalPaper,
} from './types';

/**
 * O fundo da folha mora numa coluna `text` do banco, e por isso a leitura não
 * pode confiar no que vem de lá: jornais criados antes do campo ser gravado
 * trazem nulo, e nada impede um valor fora do catálogo.
 */
describe('fundo da folha', () => {
  it('preserva os fundos do catálogo', () => {
    JOURNAL_PAPER_KEYS.forEach((key) => {
      expect(toJournalPaper(key)).toBe(key);
    });
  });

  /** O caso do jornal antigo: a coluna existe, mas nunca foi preenchida. */
  it('cai no padrão quando não há valor gravado', () => {
    expect(toJournalPaper(null)).toBe(DEFAULT_JOURNAL_PAPER);
    expect(toJournalPaper(undefined)).toBe(DEFAULT_JOURNAL_PAPER);
    expect(toJournalPaper('')).toBe(DEFAULT_JOURNAL_PAPER);
  });

  it('cai no padrão diante de valor fora do catálogo', () => {
    ['sepia', 'BRANCO', 'off-white', '#FFFFFF'].forEach((valor) => {
      expect(toJournalPaper(valor)).toBe(DEFAULT_JOURNAL_PAPER);
    });
  });

  /**
   * O que a folha recebe é sempre hex literal, nunca `undefined` — um valor
   * vazio no `style` deixaria a folha sem cor no preview e no PDF.
   */
  it('todo fundo resolve para um hex da paleta', () => {
    JOURNAL_PAPER_KEYS.forEach((key) => {
      expect(journalPaper(key)).toMatch(/^#[0-9A-F]{6}$/i);
    });
    expect(journalPaper(toJournalPaper('valor inválido'))).toBe(
      JOURNAL_PAPER_HEX[DEFAULT_JOURNAL_PAPER],
    );
  });

  it('o catálogo tem fundos distintos e o padrão é um deles', () => {
    expect(JOURNAL_PAPER_KEYS).toContain(DEFAULT_JOURNAL_PAPER);
    const hexes = JOURNAL_PAPER_KEYS.map((key) => JOURNAL_PAPER_HEX[key]);
    expect(new Set(hexes).size).toBe(JOURNAL_PAPER_KEYS.length);
  });
});

import { describe, expect, it } from 'vitest';
import { LETRAS_DA_SENHA, gerarSenha, senhaNoPadrao } from '../../../supabase/functions/senha-gerar/senha';
import { textoDaUltimaSenha } from './painel';

/** A senha no padrão FdGhJiuPn (19/11/2026, PR 2 das senhas). */
describe('gerarSenha', () => {
  it('9 letras, maiúsculas e minúsculas, sem I, l e O', () => {
    for (let i = 0; i < 300; i++) {
      const s = gerarSenha();
      expect(s).toHaveLength(9);
      expect(senhaNoPadrao(s)).toBe(true);
      expect(s).not.toMatch(/[IlO0-9\W]/);
    }
    expect(LETRAS_DA_SENHA).not.toMatch(/[IlO]/);
  });

  it('descarta os bytes que dariam viés e exige as duas caixas', () => {
    // 255 está acima do limite (sem viés) e é descartado; 0..8 = só maiúsculas, então sorteia de novo.
    const rodadas = [[255, 0, 1, 2, 3, 4, 5, 6, 7, 8], [24, 25, 26, 0, 1, 2, 3, 4, 5]];
    let i = 0;
    const s = gerarSenha(() => Uint8Array.from(rodadas[Math.min(i++, rodadas.length - 1)]));
    expect(s).toBe('abcABCDEF');
  });

  it('sai diferente a cada vez', () => {
    expect(new Set(Array.from({ length: 50 }, () => gerarSenha())).size).toBe(50);
  });
});

describe('o texto da última senha no Painel', () => {
  it('quem gerou e quando, ou pelo e-mail', () => {
    expect(textoDaUltimaSenha({ gerada_em: '2026-11-19T13:42:00Z', gerada_por_nome: 'MKT ANA', origem: 'painel' })).toBe('gerada por MKT ANA · 19/11 às 10:42');
    expect(textoDaUltimaSenha({ gerada_em: '2026-11-19T12:14:00Z', gerada_por_nome: null, origem: 'email' })).toBe('gerada pelo e-mail · 19/11 às 09:14');
    expect(textoDaUltimaSenha({ gerada_em: null, gerada_por_nome: null, origem: null })).toBeNull();
  });
});

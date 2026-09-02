import { describe, expect, it } from 'vitest';
import { caminhoDaFoto } from './caminhoDaFoto';

/**
 * O prefixo é o que separa as fotos do Jornal das que sobraram do Informativo.
 * Se alguém o mudar de volta para `news/` sem querer, as duas pilhas voltam a
 * se misturar — e ninguém percebe até precisar limpar o balde.
 */
describe('caminho da foto do Jornal', () => {
  const emJaneiro = new Date(2027, 0, 15);

  it('mora sob o prefixo do Jornal, nunca sob o do Informativo', () => {
    const caminho = caminhoDaFoto('jpg', emJaneiro);

    expect(caminho.startsWith('jornal/')).toBe(true);
    expect(caminho).not.toContain('news/');
  });

  it('separa por ano e mês, com o mês em dois dígitos', () => {
    expect(caminhoDaFoto('jpg', emJaneiro)).toMatch(/^jornal\/2027\/01\//);
    expect(caminhoDaFoto('png', new Date(2026, 11, 1))).toMatch(/^jornal\/2026\/12\//);
  });

  it('mantém a extensão pedida e não repete nome', () => {
    expect(caminhoDaFoto('png', emJaneiro).endsWith('.png')).toBe(true);
    expect(caminhoDaFoto('jpg', emJaneiro)).not.toBe(caminhoDaFoto('jpg', emJaneiro));
  });
});

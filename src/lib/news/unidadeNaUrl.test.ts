import { describe, expect, it } from 'vitest';
import { escreverUnidadeNaUrl, lerUnidadeDaUrl } from './unidadeNaUrl';

describe('lerUnidadeDaUrl', () => {
  it('sem parâmetro, deixa a página usar a unidade padrão', () => {
    expect(lerUnidadeDaUrl(null)).toBeUndefined();
    expect(lerUnidadeDaUrl('')).toBeUndefined();
  });

  it('"geral" é a Institucional geral, que no app é null', () => {
    expect(lerUnidadeDaUrl('geral')).toBeNull();
  });

  it('id conhecido volta como está', () => {
    expect(lerUnidadeDaUrl('ana-santana')).toBe('ana-santana');
  });

  it('id desconhecido é ignorado, não quebra', () => {
    expect(lerUnidadeDaUrl('unidade-que-nao-existe')).toBeUndefined();
  });
});

describe('escreverUnidadeNaUrl', () => {
  it('vai e volta', () => {
    expect(escreverUnidadeNaUrl(null)).toBe('geral');
    expect(escreverUnidadeNaUrl('ana-dic')).toBe('ana-dic');
    expect(lerUnidadeDaUrl(escreverUnidadeNaUrl(null))).toBeNull();
    expect(lerUnidadeDaUrl(escreverUnidadeNaUrl('ana-dic'))).toBe('ana-dic');
  });
});

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

  it('unidade do Jornal (CEI ou GOE) volta como está', () => {
    expect(lerUnidadeDaUrl('cei-anisio-spinola')).toBe('cei-anisio-spinola');
    expect(lerUnidadeDaUrl('goe')).toBe('goe');
  });

  it('id desconhecido é ignorado, não quebra', () => {
    expect(lerUnidadeDaUrl('unidade-que-nao-existe')).toBeUndefined();
  });

  it('uma NAVE também é ignorada: o Jornal é só da Educação (16/11/2026)', () => {
    expect(lerUnidadeDaUrl('ana-santana')).toBeUndefined();
    expect(lerUnidadeDaUrl('ana-dic')).toBeUndefined();
  });
});

describe('escreverUnidadeNaUrl', () => {
  it('vai e volta', () => {
    expect(escreverUnidadeNaUrl(null)).toBe('geral');
    expect(escreverUnidadeNaUrl('cei-calmon')).toBe('cei-calmon');
    expect(lerUnidadeDaUrl(escreverUnidadeNaUrl(null))).toBeNull();
    expect(lerUnidadeDaUrl(escreverUnidadeNaUrl('cei-calmon'))).toBe('cei-calmon');
  });
});

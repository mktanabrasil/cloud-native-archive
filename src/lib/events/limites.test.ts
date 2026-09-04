import { describe, expect, it } from 'vitest';
import { contar, erroDeLimite, LIMITES_DE_TEXTO } from './limites';

describe('contar', () => {
  it('mostra usados/limite e não reclama dentro do limite', () => {
    const c = contar('title', 'Encontro de Famílias');
    expect(c.texto).toBe('20/120');
    expect(c.excedeu).toBe(false);
    expect(c.aviso).toBeNull();
  });

  it('no limite exato ainda passa', () => {
    expect(contar('location', 'x'.repeat(160)).excedeu).toBe(false);
  });

  it('passou: diz quanto encurtar, no singular e no plural', () => {
    expect(contar('location', 'x'.repeat(161)).aviso).toBe('encurte 1 caractere');
    expect(contar('location', 'x'.repeat(174)).aviso).toBe('encurte 14 caracteres');
  });

  it('vazio e nulo contam zero', () => {
    expect(contar('description', null).texto).toBe(`0/${LIMITES_DE_TEXTO.description}`);
    expect(contar('description', '').usados).toBe(0);
  });
});

describe('erroDeLimite', () => {
  it('nulo dentro do limite, frase completa fora', () => {
    expect(erroDeLimite('title', 'ok')).toBeNull();
    expect(erroDeLimite('title', 'x'.repeat(121))).toBe('Título passa de 120 caracteres — encurte 1 caractere');
  });
});

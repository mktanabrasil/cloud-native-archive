import { describe, expect, it } from 'vitest';
import { estadoDaCobertura, vagaDoMarketing } from './cobertura';

describe('estadoDaCobertura', () => {
  it('sem pedido, ou marketing sem cobertura, não há estado', () => {
    expect(estadoDaCobertura({ marketing_request: false, marketing_coverage: true })).toBe('nao-pedida');
    expect(estadoDaCobertura({ marketing_request: true, marketing_coverage: false })).toBe('nao-pedida');
  });

  it('pedida e sem resposta: a confirmar', () => {
    expect(estadoDaCobertura({ marketing_request: true, marketing_coverage: true, marketing_confirmed: null })).toBe('a-confirmar');
    expect(estadoDaCobertura({ marketing_request: true, marketing_coverage: true })).toBe('a-confirmar');
  });

  it('a resposta decide', () => {
    expect(estadoDaCobertura({ marketing_request: true, marketing_coverage: true, marketing_confirmed: true })).toBe('confirmada');
    expect(estadoDaCobertura({ marketing_request: true, marketing_coverage: true, marketing_confirmed: false })).toBe('sem-marketing');
  });
});

describe('vagaDoMarketing', () => {
  it('reserva a vaga enquanto não há um não', () => {
    expect(vagaDoMarketing({ marketing_request: true, marketing_coverage: true })).toBe(1);
    expect(vagaDoMarketing({ marketing_request: true, marketing_coverage: true, marketing_confirmed: true })).toBe(1);
  });

  it('com o não do marketing, a vaga sai do transporte', () => {
    expect(vagaDoMarketing({ marketing_request: true, marketing_coverage: true, marketing_confirmed: false })).toBe(0);
    expect(vagaDoMarketing({ marketing_request: false })).toBe(0);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { apagarRascunho, chaveDoRascunho, guardarRascunho, lerRascunho, quandoFoiGuardado, rascunhoDiferente } from './rascunho';

beforeEach(() => localStorage.clear());

describe('rascunho do formulário de evento', () => {
  it('a chave é por pessoa e por evento; sem evento é "novo"', () => {
    expect(chaveDoRascunho('u1', null)).toBe('evento-rascunho:u1:novo');
    expect(chaveDoRascunho('u1', 'e9')).toBe('evento-rascunho:u1:e9');
    expect(chaveDoRascunho(null, null)).toBe('evento-rascunho:anonimo:novo');
  });

  it('guarda, lê e apaga', () => {
    const chave = chaveDoRascunho('u1', null);
    guardarRascunho(chave, { title: 'Festa' }, new Date('2026-09-22T14:32:00'));
    expect(lerRascunho(chave)).toEqual({ form: { title: 'Festa' }, em: '2026-09-22T17:32:00.000Z' });
    apagarRascunho(chave);
    expect(lerRascunho(chave)).toBeNull();
  });

  it('lixo guardado não derruba: vira nulo', () => {
    localStorage.setItem('evento-rascunho:u1:novo', '{nao é json');
    expect(lerRascunho('evento-rascunho:u1:novo')).toBeNull();
    localStorage.setItem('evento-rascunho:u1:novo', JSON.stringify({ em: 'x' }));
    expect(lerRascunho('evento-rascunho:u1:novo')).toBeNull();
  });

  it('só vale oferecer se for diferente do que o formulário abriria', () => {
    const inicial = { title: '', unit: 'DIC' as const };
    expect(rascunhoDiferente({ form: { title: '', unit: 'DIC' as const }, em: 'x' }, inicial)).toBe(false);
    expect(rascunhoDiferente({ form: { title: 'Festa', unit: 'DIC' as const }, em: 'x' }, inicial)).toBe(true);
    expect(rascunhoDiferente(null, inicial)).toBe(false);
  });

  it('diz quando foi guardado em palavras', () => {
    const agora = new Date(2026, 8, 22, 15, 0);
    expect(quandoFoiGuardado(new Date(2026, 8, 22, 14, 32).toISOString(), agora)).toBe('hoje às 14:32');
    expect(quandoFoiGuardado(new Date(2026, 8, 21, 9, 5).toISOString(), agora)).toBe('ontem às 09:05');
    expect(quandoFoiGuardado(new Date(2026, 8, 18, 18, 5).toISOString(), agora)).toBe('em 18/09 às 18:05');
    expect(quandoFoiGuardado('lixo', agora)).toBe('');
  });
});

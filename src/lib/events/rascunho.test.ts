import { beforeEach, describe, expect, it } from 'vitest';
import { apagarRascunho, chaveDoRascunho, guardarRascunho, lerRascunho, quandoFoiGuardado, rascunhoDiferente, formularioAoRetomar } from './rascunho';

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

describe('retomar quando o evento mudou (varredura de 25/09/2026)', () => {
  const base = { title: 'Festa', location: 'Unidade DIC', marketing_confirmed: null as boolean | null, status: 'pendente' as const };
  const rascunho = { form: { ...base, title: 'Festa da Primavera' }, em: '2026-09-22T12:00:00Z', versao: 'v1', base };

  it('o evento mudou: parte dele como está e reaplica só o que a pessoa alterou', () => {
    const atual = { ...base, marketing_confirmed: true, status: 'confirmado' as const, location: 'Unidade Santana' };
    const { form, mesclou } = formularioAoRetomar(rascunho, atual, 'v2');
    expect(mesclou).toBe(true);
    expect(form).toEqual({ ...atual, title: 'Festa da Primavera' });
  });

  it('o evento não mudou: o rascunho volta inteiro', () => {
    expect(formularioAoRetomar(rascunho, { ...base }, 'v1')).toEqual({ form: rascunho.form, mesclou: false });
  });

  it('rascunho antigo, sem versão: volta inteiro, como antes', () => {
    const velho = { form: { title: 'X' }, em: '2026-09-22T12:00:00Z' };
    expect(formularioAoRetomar(velho, { title: 'Y' }, 'v2')).toEqual({ form: { title: 'X' }, mesclou: false });
  });
});

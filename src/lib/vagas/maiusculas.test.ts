import { describe, expect, it } from 'vitest';
import { comMaiusculas } from './maiusculas';

describe('maiúsculas automáticas', () => {
  it('nomes de pessoa, com as ligações em minúsculas', () => {
    expect(comMaiusculas('leonardo garbo rodrigues', { pessoa: true })).toBe('Leonardo Garbo Rodrigues');
    expect(comMaiusculas('maria das dores da silva e souza', { pessoa: true })).toBe('Maria das Dores da Silva e Souza');
    expect(comMaiusculas('  ana   paula  ', { pessoa: true })).toBe('Ana Paula');
    expect(comMaiusculas('LEONARDO SILVA', { pessoa: true })).toBe('Leonardo Silva');
    expect(comMaiusculas('joão-pedro d\'ávila', { pessoa: true })).toBe('João-Pedro d\'Ávila');
  });

  it('cidade com o estado', () => {
    expect(comMaiusculas('campinas/sp')).toBe('Campinas/SP');
    expect(comMaiusculas('são josé dos campos - sp')).toBe('São José dos Campos - SP');
    expect(comMaiusculas('campinas')).toBe('Campinas');
    expect(comMaiusculas('vila costa e silva')).toBe('Vila Costa e Silva');
  });

  it('o que veio com maiúscula de propósito fica', () => {
    expect(comMaiusculas('técnico em TI')).toBe('Técnico em TI');
    expect(comMaiusculas('atendente no McDonald\'s')).toBe('Atendente no McDonald\'s');
    expect(comMaiusculas('SESC')).toBe('SESC');
    expect(comMaiusculas('análise e desenvolvimento de sistemas')).toBe('Análise e Desenvolvimento de Sistemas');
  });

  it('a primeira palavra sempre ganha maiúscula, mesmo sendo ligação', () => {
    expect(comMaiusculas('da silva', { pessoa: true })).toBe('Da Silva');
    expect(comMaiusculas('')).toBe('');
  });
});

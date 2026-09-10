import { describe, expect, it } from 'vitest';
import { LOCAIS_FIXOS, OUTRO_LOCAL, localAoTrocarUnidade, localDaUnidade, localFixo, opcaoDoLocal } from './local';

describe('a lista de locais', () => {
  it('tem as três unidades e o Escritório, com os nomes decididos', () => {
    expect(LOCAIS_FIXOS.map(l => l.valor)).toEqual(['Unidade DIC', 'Unidade Nilópolis', 'Unidade Santana', 'Escritório']);
  });

  it('cada unidade do evento sugere o seu local', () => {
    expect(localDaUnidade('DIC')).toBe('Unidade DIC');
    expect(localDaUnidade('Santana')).toBe('Unidade Santana');
    expect(localDaUnidade('Administração')).toBe('Escritório');
    expect(localDaUnidade(null)).toBe('');
  });
});

describe('reconhecer o texto gravado', () => {
  it('bate ignorando caixa, acentos e espaços', () => {
    expect(localFixo('Unidade Santana')?.valor).toBe('Unidade Santana');
    expect(localFixo('  unidade nilopolis ')?.valor).toBe('Unidade Nilópolis');
    expect(localFixo('ESCRITÓRIO')?.valor).toBe('Escritório');
  });

  it('texto livre cai em Outro local, com o texto preservado por quem chama', () => {
    expect(opcaoDoLocal('Pátio')).toBe(OUTRO_LOCAL);
    expect(opcaoDoLocal('Parque Ecológico, Av. Heitor Penteado')).toBe(OUTRO_LOCAL);
    expect(opcaoDoLocal('')).toBe(OUTRO_LOCAL);
  });

  it('"Santana" sozinho não é a unidade: é texto livre, para não adivinhar', () => {
    expect(opcaoDoLocal('Santana')).toBe(OUTRO_LOCAL);
  });
});

describe('sugestão ao trocar a unidade', () => {
  it('vazio ou local fixo de outra unidade: passa a sugerir a nova', () => {
    expect(localAoTrocarUnidade('', 'DIC')).toBe('Unidade DIC');
    expect(localAoTrocarUnidade('Unidade DIC', 'Santana')).toBe('Unidade Santana');
  });

  it('texto livre não é sobrescrito', () => {
    expect(localAoTrocarUnidade('Quadra do bairro', 'Santana')).toBe('Quadra do bairro');
  });
});

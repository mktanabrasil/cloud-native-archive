import { describe, expect, it } from 'vitest';
import type { AppEvent } from '@/types';
import { abaInicial, jaAconteceu, lerAba, separarPorData } from './proximosEPassados';

/** Hoje, nos testes: 8 de setembro de 2026, 15h, no fuso da máquina. */
const agora = new Date(2026, 8, 8, 15, 0);

const ev = (id: string, inicio: string, fim: string) =>
  ({ id, title: id, start_datetime: new Date(inicio).toISOString(), end_datetime: new Date(fim).toISOString() }) as AppEvent;

describe('jaAconteceu', () => {
  it('evento de hoje fica em Próximos o dia inteiro, mesmo depois de acabar', () => {
    expect(jaAconteceu(ev('reuniao', '2026-09-08T09:00', '2026-09-08T11:00'), agora)).toBe(false);
  });

  it('retiro que termina hoje ainda é Próximo', () => {
    expect(jaAconteceu(ev('retiro', '2026-09-06T08:00', '2026-09-08T12:00'), agora)).toBe(false);
  });

  it('retiro que terminou ontem já aconteceu', () => {
    expect(jaAconteceu(ev('retiro', '2026-09-05T08:00', '2026-09-07T12:00'), agora)).toBe(true);
  });

  it('terminou ontem às 23:59: já aconteceu; à meia-noite de hoje: ainda não', () => {
    expect(jaAconteceu(ev('a', '2026-09-07T20:00', '2026-09-07T23:59'), agora)).toBe(true);
    expect(jaAconteceu(ev('b', '2026-09-07T20:00', '2026-09-08T00:00'), agora)).toBe(false);
  });

  it('o que ainda vem não aconteceu', () => {
    expect(jaAconteceu(ev('hope', '2026-10-10T08:00', '2026-10-10T16:00'), agora)).toBe(false);
  });
});

describe('separarPorData', () => {
  const pascoa = ev('pascoa', '2026-03-28T14:00', '2026-03-28T17:00');
  const familias = ev('familias', '2026-05-16T09:00', '2026-05-16T12:00');
  const hope = ev('hope', '2026-10-10T08:00', '2026-10-10T16:00');
  const natal = ev('natal', '2026-12-20T18:00', '2026-12-20T22:00');

  it('próximos do mais perto ao mais longe; passados do mais recente ao mais antigo', () => {
    const { proximos, passados } = separarPorData([natal, pascoa, hope, familias], agora);

    expect(proximos.map(e => e.id)).toEqual(['hope', 'natal']);
    expect(passados.map(e => e.id)).toEqual(['familias', 'pascoa']);
  });

  it('não perde nem repete ninguém', () => {
    const { proximos, passados } = separarPorData([natal, pascoa, hope, familias], agora);
    expect(proximos.length + passados.length).toBe(4);
  });

  it('lista vazia dá duas listas vazias', () => {
    expect(separarPorData([], agora)).toEqual({ proximos: [], passados: [] });
  });
});

describe('abaInicial', () => {
  it('abre em Próximos quando há próximos', () => {
    expect(abaInicial(2, 5)).toBe('proximos');
  });

  it('abre em Já aconteceram quando só há passados', () => {
    expect(abaInicial(0, 3)).toBe('passados');
  });

  it('sem evento nenhum, fica em Próximos', () => {
    expect(abaInicial(0, 0)).toBe('proximos');
  });
});

describe('lerAba', () => {
  it('aceita só os dois valores conhecidos', () => {
    expect(lerAba('passados')).toBe('passados');
    expect(lerAba('proximos')).toBe('proximos');
    expect(lerAba('lixeira')).toBeNull();
    expect(lerAba(null)).toBeNull();
  });
});

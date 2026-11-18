import { describe, expect, it } from 'vitest';
import {
  caiNoFimDeSemana, horasDoEvento, limitesDoMes, mesDe, mesPorExtenso, mesValido, numerosDoMes, porFuncionario, situacaoNoRh, somarMeses, textoDasHoras, textoParaCopiar,
  type EventoDaEquipe,
} from './equipeNosEventos';

const ev = (o: Partial<EventoDaEquipe>): EventoDaEquipe => ({
  id: 'e1', title: 'Evento', unit: 'DIC', location: null, start_datetime: '2026-11-26T17:00:00Z', end_datetime: '2026-11-26T19:00:00Z',
  status: 'confirmado', equipe_funcionarios: [], conferido_em: null, conferido_por_nome: null, equipe_conferida: null, ...o,
});

describe('o mês', () => {
  it('no fuso de Brasília, com a virada de ano', () => {
    expect(mesDe(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11'); // 23h de 30/11 em Brasília
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(limitesDoMes('2026-11')).toEqual({ de: '2026-11-01T00:00:00-03:00', ate: '2026-12-01T00:00:00-03:00' });
    expect(mesPorExtenso('2026-11')).toBe('novembro de 2026');
  });
});

describe('as horas', () => {
  it('de meia em meia hora; sem término, zero', () => {
    expect(horasDoEvento(ev({}))).toBe(2);
    expect(horasDoEvento(ev({ end_datetime: '2026-11-26T19:40:00Z' }))).toBe(2.5);
    expect(horasDoEvento(ev({ end_datetime: null }))).toBe(0);
    // Vários dias (e a virada do mês): fora do total, como "vários dias".
    expect(horasDoEvento(ev({ start_datetime: '2026-12-08T12:00:00Z', end_datetime: '2026-12-10T20:00:00Z' }))).toBeNull();
    expect(horasDoEvento(ev({ start_datetime: '2026-11-30T21:00:00Z', end_datetime: '2026-12-01T05:00:00Z' }))).toBeNull();
    expect(textoDasHoras(null)).toBe('vários dias');
    expect(textoDasHoras(2.5)).toBe('2h30');
    expect(textoDasHoras(3)).toBe('3h');
  });
  it('fim de semana no fuso de Brasília', () => {
    expect(caiNoFimDeSemana(ev({ start_datetime: '2026-11-22T12:00:00Z' }))).toBe(true); // domingo
    expect(caiNoFimDeSemana(ev({ start_datetime: '2026-11-23T02:00:00Z' }))).toBe(true); // ainda domingo à noite em Brasília
    expect(caiNoFimDeSemana(ev({}))).toBe(false); // quinta
  });
});

describe('o mês do endereço', () => {
  it('só mês de verdade', () => {
    expect(mesValido('2026-11')).toBe(true);
    expect(mesValido('2026-13')).toBe(false);
    expect(mesValido('2026-00')).toBe(false);
    expect(mesValido(null)).toBe(false);
  });
});

describe('a conferência', () => {
  it('a conferir, conferido, ou a equipe mudou depois', () => {
    expect(situacaoNoRh(ev({ equipe_funcionarios: ['Ana'] }))).toBe('a_conferir');
    expect(situacaoNoRh(ev({ equipe_funcionarios: ['Ana'], conferido_em: '2026-11-18T12:00:00Z', equipe_conferida: [' Ana '] }))).toBe('conferido');
    expect(situacaoNoRh(ev({ equipe_funcionarios: ['Ana', 'Bia'], conferido_em: '2026-11-18T12:00:00Z', equipe_conferida: ['Ana'] }))).toBe('mudou');
  });
});

describe('por funcionário', () => {
  const eventos = [
    ev({ id: 'a', title: 'Karatê', unit: 'Santana', start_datetime: '2026-11-22T12:00:00Z', end_datetime: '2026-11-22T15:00:00Z', equipe_funcionarios: ['Rafael Souza', 'Marina Costa'] }),
    ev({ id: 'b', title: 'Reunião', equipe_funcionarios: ['marina costa'], conferido_em: '2026-11-18T12:00:00Z', equipe_conferida: ['marina costa'] }),
  ];
  it('junta a mesma pessoa sem olhar maiúscula, soma as horas e ordena pelo nome', () => {
    const p = porFuncionario(eventos);
    expect(p.map(f => [f.nome, f.horas, f.eventos.length])).toEqual([['Marina Costa', 5, 2], ['Rafael Souza', 3, 1]]);
    expect(p[0].eventos[0].fimDeSemana).toBe(true);
  });
  it('os números do mês', () => {
    expect(numerosDoMes(eventos)).toEqual({ eventos: 2, funcionarios: 2, aConferir: 1, fimDeSemana: 1 });
  });
  it('evento de vários dias fica fora do total e aparece como tal', () => {
    const p = porFuncionario([...eventos, ev({ id: 'v', title: 'Acampamento', start_datetime: '2026-11-27T11:00:00Z', end_datetime: '2026-11-29T20:00:00Z', equipe_funcionarios: ['Rafael Souza'] })]);
    const rafael = p.find(f => f.nome === 'Rafael Souza')!;
    expect([rafael.horas, rafael.variosDias]).toEqual([3, 1]);
    expect(textoParaCopiar([rafael]).split('\n')[0]).toBe('Rafael Souza · 3h + 1 de vários dias no mês');
  });

  it('o texto para copiar: pessoa, total e uma linha por evento', () => {
    expect(textoParaCopiar(porFuncionario(eventos)).split('\n')).toEqual([
      'Marina Costa · 5h no mês',
      '  22/11 · Karatê (Santana) · 3h · fim de semana',
      '  26/11 · Reunião (DIC) · 2h',
      'Rafael Souza · 3h no mês',
      '  22/11 · Karatê (Santana) · 3h · fim de semana',
    ]);
  });
});

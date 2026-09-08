import { describe, expect, it } from 'vitest';
import { textoDaData, textoDoHorario, variosDias } from './periodo';

const ev = (ini: string, fim: string) => ({
  start_datetime: new Date(ini).toISOString(),
  end_datetime: new Date(fim).toISOString(),
});

const umDia = ev('2026-10-10T08:00', '2026-10-10T16:00');
const mesmoMes = ev('2026-10-10T08:00', '2026-10-12T16:00');
const viraMes = ev('2026-10-30T14:00', '2026-11-02T12:00');
const viraAno = ev('2026-12-30T14:00', '2027-01-02T12:00');

describe('variosDias', () => {
  it('um dia só, mesmo que atravesse a madrugada não', () => {
    expect(variosDias(umDia)).toBe(false);
    expect(variosDias(mesmoMes)).toBe(true);
  });
});

describe('textoDaData no card (com ano)', () => {
  it('um dia continua como sempre foi', () => {
    expect(textoDaData(umDia)).toBe('10 de outubro de 2026');
  });
  it('mesmo mês: "10 a 12 de outubro de 2026"', () => {
    expect(textoDaData(mesmoMes)).toBe('10 a 12 de outubro de 2026');
  });
  it('vira o mês: "30 de outubro a 2 de novembro de 2026"', () => {
    expect(textoDaData(viraMes)).toBe('30 de outubro a 2 de novembro de 2026');
  });
  it('vira o ano: os dois anos aparecem', () => {
    expect(textoDaData(viraAno)).toBe('30 de dezembro de 2026 a 2 de janeiro de 2027');
  });
});

describe('textoDaData no detalhe (sem ano)', () => {
  it('as mesmas formas, sem o ano', () => {
    expect(textoDaData(umDia, { comAno: false })).toBe('10 de outubro');
    expect(textoDaData(mesmoMes, { comAno: false })).toBe('10 a 12 de outubro');
    expect(textoDaData(viraMes, { comAno: false })).toBe('30 de outubro a 2 de novembro');
    expect(textoDaData(viraAno, { comAno: false })).toBe('30 de dezembro a 2 de janeiro');
  });
});

describe('textoDoHorario', () => {
  it('um dia: "08:00 às 16:00" no card e "08:00 - 16:00" no detalhe', () => {
    expect(textoDoHorario(umDia)).toBe('08:00 às 16:00');
    expect(textoDoHorario(umDia, { separador: ' - ' })).toBe('08:00 - 16:00');
  });
  it('vários dias: começa e termina', () => {
    expect(textoDoHorario(mesmoMes)).toBe('Começa às 08:00, termina às 16:00');
    expect(textoDoHorario(viraMes, { separador: ' - ' })).toBe('Começa às 14:00 · termina às 12:00');
  });
});

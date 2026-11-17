import { describe, expect, it } from 'vitest';
import {
  dataDoDia, diaComSemana, diasCompletos, ehSegunda, faltasParaEnviar, periodoCurto, periodoPorExtenso,
  prazoDaDevolutiva, prazoDeEnvio, proximaSegunda, segundaDaSemana, situacao, textosLongos, conteudoVazio, LIMITES,
  type DiasDoSemanario,
} from './regras';

const diaCheio = { projeto: 'Identidade', proposta: 'Roda', objetivo: 'Conversar', desenvolvimento: 'Em roda' };
const semanaCheia: DiasDoSemanario = { seg: diaCheio, ter: diaCheio, qua: diaCheio, qui: diaCheio, sex: diaCheio };

describe('datas do semanário', () => {
  it('acha a segunda-feira de qualquer dia, inclusive domingo', () => {
    expect(segundaDaSemana('2026-11-23')).toBe('2026-11-23');
    expect(segundaDaSemana('2026-11-27')).toBe('2026-11-23');
    expect(segundaDaSemana('2026-11-29')).toBe('2026-11-23');
    expect(proximaSegunda('2026-11-17')).toBe('2026-11-23');
  });

  it('prazos: envio na quarta e devolutiva na quinta anteriores', () => {
    expect(prazoDeEnvio('2026-11-23')).toBe('2026-11-18');
    expect(prazoDaDevolutiva('2026-11-23')).toBe('2026-11-19');
    expect(diaComSemana('2026-11-18')).toBe('quarta, 18/11');
  });

  it('valida a segunda e calcula cada dia', () => {
    expect(ehSegunda('2026-11-23')).toBe(true);
    expect(ehSegunda('2026-11-24')).toBe(false);
    expect(ehSegunda('23/11/2026')).toBe(false);
    expect(dataDoDia('2026-11-23', 'qui')).toBe('2026-11-26');
  });

  it('escreve o período nos três casos', () => {
    expect(periodoPorExtenso('2026-11-23')).toBe('23 a 27 de novembro');
    expect(periodoPorExtenso('2026-11-30')).toBe('30 de novembro a 4 de dezembro');
    expect(periodoPorExtenso('2026-12-28')).toBe('28 de dezembro de 2026 a 1 de janeiro de 2027');
    expect(periodoCurto('2026-11-30')).toBe('30/11 a 04/12');
  });
});

describe('conteúdo', () => {
  it('lista o que falta para enviar, sem cobrar a avaliação', () => {
    expect(faltasParaEnviar({ ...conteudoVazio() })).toEqual([
      'Agrupamento', '2ª FEIRA', '3ª FEIRA', '4ª FEIRA', '5ª FEIRA', '6ª FEIRA', 'Formas de registro', 'Materiais',
    ]);
    expect(faltasParaEnviar({ agrupamento: 'Maternal I B', dias: semanaCheia, formas_registro: 'Fotos', materiais: 'Papel' })).toEqual([]);
    expect(faltasParaEnviar({ agrupamento: 'M', dias: { ...semanaCheia, qui: { ...diaCheio, objetivo: '  ' } }, formas_registro: 'F', materiais: 'M' })).toEqual(['5ª FEIRA']);
  });

  it('conta os dias completos', () => {
    expect(diasCompletos({})).toBe(0);
    expect(diasCompletos({ seg: diaCheio, ter: { projeto: 'x' } })).toBe(1);
    expect(diasCompletos(semanaCheia)).toBe(5);
  });

  it('aponta texto acima do teto do banco', () => {
    const longo = 'a'.repeat(LIMITES.campoDoDia + 1);
    expect(textosLongos({ ...conteudoVazio(), dias: { qua: { proposta: longo } } })).toEqual(['4ª FEIRA']);
    expect(textosLongos({ ...conteudoVazio(), avaliacao: 'a'.repeat(LIMITES.avaliacao) })).toEqual([]);
  });
});

describe('situação', () => {
  const semana = '2026-11-23';
  it('em preenchimento até a quarta; atrasado depois', () => {
    expect(situacao({ semana, status: 'preenchimento' }, '2026-11-18')).toBe('em_preenchimento');
    expect(situacao({ semana, status: 'preenchimento' }, '2026-11-19')).toBe('envio_atrasado');
  });
  it('devolutiva aguardada até a quinta; atrasada depois', () => {
    expect(situacao({ semana, status: 'enviado' }, '2026-11-19')).toBe('aguardando_devolutiva');
    expect(situacao({ semana, status: 'enviado' }, '2026-11-20')).toBe('devolutiva_atrasada');
    expect(situacao({ semana, status: 'com_devolutiva' }, '2026-12-01')).toBe('com_devolutiva');
  });
});

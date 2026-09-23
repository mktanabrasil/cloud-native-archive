import { describe, expect, it } from 'vitest';
import { estaAberta, lider, ordenarPorVotos, pedacosDoTexto, percentual, tempoRestante } from './modelo';
import { fimDoTelefone, formatarTelefone, mascararTelefone, normalizarTelefone, pinValido, telefoneValido } from './telefone';

const agora = new Date('2026-09-23T15:20:00-03:00');

describe('aberta e prazo', () => {
  it('sem prazo fica aberta; com prazo, até o horário; encerrada à mão fecha', () => {
    expect(estaAberta({ encerra_em: null, encerrada_em: null, deleted_at: null }, agora)).toBe(true);
    expect(estaAberta({ encerra_em: '2026-09-23T18:00:00-03:00', encerrada_em: null, deleted_at: null }, agora)).toBe(true);
    expect(estaAberta({ encerra_em: '2026-09-23T15:00:00-03:00', encerrada_em: null, deleted_at: null }, agora)).toBe(false);
    expect(estaAberta({ encerra_em: null, encerrada_em: '2026-09-23T10:00:00-03:00', deleted_at: null }, agora)).toBe(false);
  });

  it('"faltam 2h 40" · "faltam 12 min" · "faltam 3 dias" · encerrada', () => {
    expect(tempoRestante('2026-09-23T18:00:00-03:00', agora)).toBe('faltam 2h 40');
    expect(tempoRestante('2026-09-23T15:32:00-03:00', agora)).toBe('faltam 12 min');
    expect(tempoRestante('2026-09-26T18:00:00-03:00', agora)).toBe('faltam 3 dias');
    expect(tempoRestante('2026-09-23T15:00:00-03:00', agora)).toBe('encerrada');
    expect(tempoRestante(null, agora)).toBeNull();
  });
});

describe('resultado', () => {
  const ops = [
    { id: 'a', titulo: 'A', subtitulo: '', cor: 'azul' as const },
    { id: 'b', titulo: 'B', subtitulo: '', cor: 'coral' as const },
    { id: 'c', titulo: 'C', subtitulo: '', cor: 'amarelo' as const },
  ];
  it('ordena por votos, empate mantém a ordem; líder só sem empate', () => {
    expect(ordenarPorVotos(ops, { a: 7, b: 11 }).map(o => o.id)).toEqual(['b', 'a', 'c']);
    expect(lider(ops, { a: 7, b: 11 })?.id).toBe('b');
    expect(lider(ops, { a: 7, b: 7 })).toBeNull();
    expect(lider(ops, {})).toBeNull();
    expect(percentual(11, 18)).toBe(61);
    expect(percentual(0, 0)).toBe(0);
  });
});

describe('texto com **negrito**', () => {
  it('quebra em pedaços, sem HTML', () => {
    expect(pedacosDoTexto('Teremos um **feriado no dia 12/10** e no dia **15/10 é facultativo**.')).toEqual([
      { negrito: false, texto: 'Teremos um ' },
      { negrito: true, texto: 'feriado no dia 12/10' },
      { negrito: false, texto: ' e no dia ' },
      { negrito: true, texto: '15/10 é facultativo' },
      { negrito: false, texto: '.' },
    ]);
    expect(pedacosDoTexto('sem nada')).toEqual([{ negrito: false, texto: 'sem nada' }]);
  });
});

describe('telefone', () => {
  it('normaliza, valida, formata e mascara', () => {
    expect(normalizarTelefone('(19) 99876-5432')).toBe('19998765432');
    expect(normalizarTelefone('+55 19 99876-5432')).toBe('19998765432');
    expect(telefoneValido('19 3232-1234')).toBe(true);
    expect(telefoneValido('99876-5432')).toBe(false);
    expect(formatarTelefone('1999876')).toBe('(19) 99876');
    expect(formatarTelefone('19998765432')).toBe('(19) 99876-5432');
    expect(formatarTelefone('1932321234')).toBe('(19) 3232-1234');
    expect(mascararTelefone('19998765432')).toBe('(19) •••••-5432');
    expect(fimDoTelefone('19998765432')).toBe('•••-5432');
    expect(pinValido('2026')).toBe(true);
    expect(pinValido('20a6')).toBe(false);
  });
});

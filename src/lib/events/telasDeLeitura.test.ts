import { describe, expect, it } from 'vitest';
import { diasDoEvento, fimQueConta, ocorreNoDia } from './diasDoEvento';
import { textoDaData, variosDias } from './periodo';
import { podeMexerNoEvento } from './podeMexer';

/** Varredura de lançamento (13/11/2026): as regras das telas de leitura. */

describe('terminar à meia-noite é terminar no dia anterior', () => {
  const noite = { start_datetime: '2026-11-13T20:00:00', end_datetime: '2026-11-14T00:00:00' };
  it('um dia só, sem continuação no dia seguinte', () => {
    expect(variosDias(noite)).toBe(false);
    expect(diasDoEvento(noite)).toHaveLength(1);
    expect(ocorreNoDia(noite, new Date('2026-11-14T10:00:00'))).toBe(false);
    expect(textoDaData(noite)).toBe('13 de novembro de 2026');
  });
  it('00:01 já é o outro dia; e um evento que começa à meia-noite não encolhe', () => {
    expect(variosDias({ ...noite, end_datetime: '2026-11-14T00:01:00' })).toBe(true);
    const i = new Date('2026-11-14T00:00:00');
    expect(fimQueConta(i, i).getTime()).toBe(i.getTime());
  });
});

describe('os botões das telas de leitura', () => {
  const gestora = { canEdit: true, isMarketing: false, unit: 'DIC', delegatedUnits: [] };
  it('a gestora mexe só na unidade dela; a lixeira e o arrasto, só no que não foi confirmado', () => {
    expect(podeMexerNoEvento({ unit: 'DIC', status: 'pendente' }, gestora)).toEqual({ editar: true, lixeira: true, arrastar: true });
    expect(podeMexerNoEvento({ unit: 'DIC', status: 'confirmado' }, gestora)).toEqual({ editar: true, lixeira: false, arrastar: false });
    expect(podeMexerNoEvento({ unit: 'Santana', status: 'pendente' }, gestora)).toEqual({ editar: false, lixeira: false, arrastar: false });
    expect(podeMexerNoEvento({ unit: 'Santana', status: 'pendente' }, { ...gestora, delegatedUnits: ['Santana'] }).editar).toBe(true);
  });
  it('a comunicação mexe em tudo; quem não edita, em nada', () => {
    expect(podeMexerNoEvento({ unit: 'Santana', status: 'confirmado' }, { ...gestora, isMarketing: true })).toEqual({ editar: true, lixeira: true, arrastar: true });
    expect(podeMexerNoEvento({ unit: 'DIC', status: 'pendente' }, { ...gestora, canEdit: false }).editar).toBe(false);
  });
});

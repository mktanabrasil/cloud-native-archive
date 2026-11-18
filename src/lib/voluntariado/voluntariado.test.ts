import { describe, expect, it } from 'vitest';
import {
  chaveDaPessoa, contatosParaCopiar, emOrdem, filtrarPessoas, numerosDoMes, pessoasDosEventos, situacaoDe, type Confirmacao, type EventoDoVoluntariado,
} from './voluntariado';

const ev = (o: Partial<EventoDoVoluntariado>): EventoDoVoluntariado => ({
  id: 'e', title: 'Evento', unit: 'DIC', location: null, start_datetime: '2026-11-20T12:00:00Z', end_datetime: null, status: 'confirmado', equipe_voluntarios: [], ...o,
});
const conf = (nome: string, whatsapp: string): Confirmacao => ({ id: `c-${nome}`, nome, whatsapp, primeiro_evento_id: null, criado_em: '2026-11-18T12:00:00Z', criado_por_nome: 'Marketing' });
const eventos = [
  ev({ id: 'a', start_datetime: '2026-11-10T12:00:00Z', equipe_voluntarios: [{ nome: 'Lia Souza', whatsapp: '21999990001' }, { nome: 'Caio Reis', whatsapp: '21999990002' }] }),
  ev({ id: 'b', start_datetime: '2026-11-22T12:00:00Z', equipe_voluntarios: [{ nome: '  lía  souza ', whatsapp: '(21) 99999-0001' }, { nome: 'Davi', whatsapp: '2133330003' }] }),
];

describe('voluntariado dos eventos: confirmado ou a confirmar', () => {
  it('a pessoa é o nome (sem acento, maiúscula nem espaço sobrando) + o WhatsApp', () => {
    expect(chaveDaPessoa({ nome: '  lía  souza ', whatsapp: '+55 (21) 99999-0001' })).toBe(chaveDaPessoa({ nome: 'Lia Souza', whatsapp: '21999990001' }));
    expect(chaveDaPessoa({ nome: 'Pedro', whatsapp: '21999990001' })).not.toBe(chaveDaPessoa({ nome: 'Lia Souza', whatsapp: '21999990001' }));
  });

  it('quem foi confirmado aparece confirmado em outro evento; o irmão com o mesmo número não', () => {
    const c = [conf('Lia Souza', '21999990001')];
    expect(situacaoDe({ nome: 'LIA SOUZA', whatsapp: '21999990001' }, c).status).toBe('confirmado');
    expect(situacaoDe({ nome: 'Pedro Souza', whatsapp: '21999990001' }, c)).toEqual({ status: 'a_confirmar', mesmoNumero: 'Lia Souza' });
    expect(situacaoDe({ nome: 'Caio', whatsapp: '21999990002' }, c)).toEqual({ status: 'a_confirmar', mesmoNumero: null });
  });

  it('conta cada pessoa uma vez e separa confirmados de a confirmar', () => {
    expect(numerosDoMes(eventos, [conf('Lia Souza', '21999990001')])).toEqual({ eventos: 2, voluntarios: 3, aConfirmar: 2, confirmados: 1 });
  });

  it('a lista geral junta os eventos de cada pessoa (mais recente primeiro) e inclui confirmações sem evento', () => {
    const p = pessoasDosEventos(eventos, [conf('Zé Antigo', '21911112222')]);
    const lia = p.find(x => x.nome === 'Lia Souza')!;
    expect(lia.eventos.map(e => e.id)).toEqual(['b', 'a']);
    expect(lia.primeiroEventoId).toBe('a');
    expect(p.find(x => x.nome === 'Zé Antigo')?.eventos).toEqual([]);
    expect(p).toHaveLength(4);
  });

  it('procura por nome sem acento ou pelos dígitos, em ordem alfabética', () => {
    const lista = [{ nome: 'Júlia Prado', whatsapp: '21988887777' }, { nome: 'Bruno', whatsapp: '11912345678' }];
    expect(filtrarPessoas(lista, 'julia').map(v => v.nome)).toEqual(['Júlia Prado']);
    expect(filtrarPessoas(lista, '1234').map(v => v.nome)).toEqual(['Bruno']);
    expect(emOrdem([{ nome: 'Úrsula' }, { nome: 'Ana' }, { nome: 'bia' }]).map(v => v.nome)).toEqual(['Ana', 'bia', 'Úrsula']);
  });

  it('copia um contato por linha, com o WhatsApp formatado', () => {
    expect(contatosParaCopiar([{ nome: 'Lia ', whatsapp: '21999990001' }, { nome: 'Davi', whatsapp: '2133330003' }]))
      .toBe('Lia — (21) 99999-0001\nDavi — (21) 3333-0003');
  });
});

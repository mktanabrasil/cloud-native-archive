import { describe, expect, it } from 'vitest';
import { apoiadoresDoLado, filtrarApoiadores, numerosDoLado, textoParaCopiar, type EventoComApoiadores } from './apoiadores';

/** Padrinhos e Parceiros lidos dos eventos (18/11/2026, PR 6). */
const ev = (o: Partial<EventoComApoiadores>): EventoComApoiadores => ({
  id: 'e', title: 'Evento', unit: 'DIC', start_datetime: '2026-11-20T12:00:00Z', end_datetime: null, status: 'confirmado',
  partners: [], partner_type: null, partner_name: null, external_collaborators: [], ...o,
});
const eventos = [
  ev({ id: 'a', title: 'Festa', start_datetime: '2026-10-10T12:00:00Z', partners: [{ type: 'padrinho', name: 'José Lima' }, { type: 'empresa', name: 'Padaria Sol' }] }),
  ev({ id: 'b', title: 'Natal', unit: 'Grupo ANA Brasil', start_datetime: '2026-12-08T12:00:00Z', status: 'pendente', partners: [{ type: 'doador', name: 'jose lima ' }, { type: 'figura_publica', name: 'Cantora X' }],
    external_collaborators: ['CRAS Centro', { name: 'Escola Azul', details: 'cede o pátio' }] }),
  // O formato antigo, um parceiro só.
  ev({ id: 'c', title: 'Bazar', start_datetime: '2026-09-01T12:00:00Z', partner_type: 'doador', partner_name: 'Maria Doa' }),
  // Lista nova vazia de nomes: nada.
  ev({ id: 'd', partners: [{ type: 'padrinho', name: '  ' }] }),
];

describe('padrinhos e doadores', () => {
  it('cada nome uma vez (sem acento nem maiúscula), com os tipos e os eventos, do mais recente', () => {
    const l = apoiadoresDoLado(eventos, 'padrinhos');
    expect(l.map(a => a.nome)).toEqual(['jose lima', 'Maria Doa']);
    const jose = l[0];
    expect(jose.tipos).toEqual(['doador', 'padrinho']);
    expect(jose.eventos.map(e => e.id)).toEqual(['b', 'a']);
    expect(l[1].eventos.map(e => e.id)).toEqual(['c']);
  });
});

describe('parceiros', () => {
  it('empresas, figuras públicas e as instituições participantes (com o detalhe)', () => {
    const l = apoiadoresDoLado(eventos, 'parceiros');
    expect(l.map(a => `${a.nome}:${a.tipos.join('+')}`)).toEqual(['Cantora X:figura_publica', 'CRAS Centro:instituicao', 'Escola Azul:instituicao', 'Padaria Sol:empresa']);
    expect(l.find(a => a.nome === 'Escola Azul')?.eventos[0].detalhe).toBe('cede o pátio');
  });
});

describe('números, filtro e cópia', () => {
  it('conta nomes, eventos e os que ainda vêm', () => {
    expect(numerosDoLado(apoiadoresDoLado(eventos, 'padrinhos'), new Date('2026-11-18T12:00:00Z'))).toEqual({ nomes: 2, eventos: 3, proximos: 1 });
  });
  it('filtra pelo tipo e procura pelo nome sem acento', () => {
    const l = apoiadoresDoLado(eventos, 'parceiros');
    expect(filtrarApoiadores(l, '', 'instituicao').map(a => a.nome)).toEqual(['CRAS Centro', 'Escola Azul']);
    expect(filtrarApoiadores(l, 'padaria', null).map(a => a.nome)).toEqual(['Padaria Sol']);
  });
  it('uma linha por nome, com os eventos', () => {
    expect(textoParaCopiar(apoiadoresDoLado(eventos, 'padrinhos'))).toBe(
      'jose lima (Doador, Padrinho) — 2 eventos: 08/12/2026 Natal (Grupo ANA Brasil); 10/10/2026 Festa (DIC)\nMaria Doa (Doador) — 1 evento: 01/09/2026 Bazar (DIC)',
    );
  });
});

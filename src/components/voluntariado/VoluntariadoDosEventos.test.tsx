import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Confirmacao, EventoDoVoluntariado } from '@/lib/voluntariado/voluntariado';

/** Administração › Voluntariado (18/11/2026, PR 4): só o controle, confirmado ou a confirmar. */
const espiao = vi.hoisted(() => ({
  eventos: [] as EventoDoVoluntariado[],
  confirmacoes: [] as Confirmacao[],
  falha: null as null | 'semBanco',
  meses: [] as (string | null)[],
  confirmados: [] as { nome: string; whatsapp: string; primeiro_evento_id?: string | null }[],
  desfeitos: [] as string[],
  jaConfirmadoPorOutro: false,
}));
vi.mock('@/lib/voluntariado/voluntariadoApi', () => ({
  lerEventosDoVoluntariado: vi.fn(async (mes: string | null) => {
    espiao.meses.push(mes);
    if (espiao.falha) throw Object.assign(new Error('semBanco'), { semBanco: true });
    return espiao.eventos;
  }),
  lerConfirmacoes: vi.fn(async () => espiao.confirmacoes),
  confirmarVoluntario: vi.fn(async (v: { nome: string; whatsapp: string; primeiro_evento_id?: string | null }) => {
    espiao.confirmados.push(v);
    const nova = { id: `v${espiao.confirmados.length}`, nome: v.nome, whatsapp: v.whatsapp, primeiro_evento_id: v.primeiro_evento_id ?? null, criado_em: '2026-11-18T12:00:00Z', criado_por_nome: 'Marketing' };
    if (espiao.jaConfirmadoPorOutro) { espiao.confirmacoes = [...espiao.confirmacoes, nova]; return null; }
    return nova;
  }),
  desfazerConfirmacao: vi.fn(async (id: string) => { espiao.desfeitos.push(id); }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { VoluntariosNosEventos, ListaDeVoluntarios } = await import('./VoluntariadoDosEventos');

const ev = (o: Partial<EventoDoVoluntariado>): EventoDoVoluntariado => ({
  id: 'e', title: 'Evento', unit: 'DIC', location: null, start_datetime: '2026-11-22T12:00:00Z', end_datetime: '2026-11-22T15:00:00Z', status: 'confirmado', equipe_voluntarios: [], ...o,
});
const abrir = (el: JSX.Element, url = '/administracao/voluntariado?mes=2026-11') => render(<MemoryRouter initialEntries={[url]}>{el}</MemoryRouter>);

beforeEach(() => {
  espiao.falha = null; espiao.meses = []; espiao.confirmados = []; espiao.desfeitos = []; espiao.jaConfirmadoPorOutro = false;
  espiao.confirmacoes = [{ id: 'c1', nome: 'Lia Souza', whatsapp: '21999990001', primeiro_evento_id: null, criado_em: '2026-11-01T12:00:00Z', criado_por_nome: 'Marketing' }];
  espiao.eventos = [
    ev({ id: 'k', title: 'Karatê no Santana', unit: 'Santana', equipe_voluntarios: [{ nome: 'Lia Souza', whatsapp: '21999990001' }, { nome: 'Caio Reis', whatsapp: '21999990002' }] }),
    ev({ id: 'f', title: 'Festa das famílias', start_datetime: '2026-11-28T12:00:00Z', equipe_voluntarios: [{ nome: 'lia souza', whatsapp: '21999990001' }, { nome: 'Pedro Souza', whatsapp: '21999990001' }] }),
  ];
});

describe('voluntários nos eventos', () => {
  it('cada voluntário com o WhatsApp e o status; quem já foi confirmado aparece confirmado em outro evento', async () => {
    abrir(<VoluntariosNosEventos />);
    const lista = await screen.findByRole('list', { name: 'Eventos com voluntários' });
    expect(espiao.meses).toEqual(['2026-11']);
    expect(screen.getByText('a confirmar').previousSibling).toHaveTextContent('2');
    const karate = within(lista).getByRole('list', { name: 'Voluntários de Karatê no Santana' });
    expect(karate).toHaveTextContent('(21) 99999-0002');
    expect(within(karate).getByText('Confirmado')).toBeInTheDocument();
    expect(within(karate).getByRole('button', { name: 'Confirmar Caio Reis' })).toBeInTheDocument();
    const festa = within(lista).getByRole('list', { name: 'Voluntários de Festa das famílias' });
    // O mesmo nome escrito de outro jeito: já confirmado. O irmão com o mesmo número: a confirmar, com o aviso.
    expect(within(festa).getByText('Confirmado')).toBeInTheDocument();
    expect(within(festa).getByText(/mesmo WhatsApp de Lia Souza/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cadastrar/ })).toBeNull();
  });

  it('confirmar grava a pessoa com o evento de origem e troca o selo', async () => {
    abrir(<VoluntariosNosEventos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Caio Reis' }));
    await waitFor(() => expect(espiao.confirmados).toEqual([{ nome: 'Caio Reis', whatsapp: '21999990002', primeiro_evento_id: 'k' }]));
    const karate = screen.getByRole('list', { name: 'Voluntários de Karatê no Santana' });
    await waitFor(() => expect(within(karate).getAllByText('Confirmado')).toHaveLength(2));
  });

  it('confirmado por outra pessoa nesse meio-tempo: relê a lista em vez de duplicar', async () => {
    espiao.jaConfirmadoPorOutro = true;
    abrir(<VoluntariosNosEventos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Caio Reis' }));
    const karate = screen.getByRole('list', { name: 'Voluntários de Karatê no Santana' });
    await waitFor(() => expect(within(karate).getAllByText('Confirmado')).toHaveLength(2));
  });

  it('desfazer volta para a confirmar', async () => {
    abrir(<VoluntariosNosEventos />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Desfazer a confirmação de Lia Souza' }))[0]);
    await waitFor(() => expect(espiao.desfeitos).toEqual(['c1']));
    expect(await screen.findByRole('button', { name: 'Confirmar Lia Souza' })).toBeInTheDocument();
  });

  it('sem o SQL aplicado, avisa em vez de quebrar', async () => {
    espiao.falha = 'semBanco';
    abrir(<VoluntariosNosEventos />);
    expect(await screen.findByText(/ainda depende de uma atualização do banco/)).toBeInTheDocument();
  });
});

describe('a lista de voluntários', () => {
  it('todos que já apareceram nos eventos, uma vez cada, com os eventos e o status', async () => {
    abrir(<ListaDeVoluntarios />, '/administracao/voluntariado?tela=voluntarios');
    const tabela = await screen.findByRole('table');
    expect(espiao.meses).toEqual([null]);
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas.map(l => l.querySelector('td span')?.textContent)).toEqual(['Caio Reis', 'Lia Souza', 'Pedro Souza']);
    const lia = linhas[1];
    expect(lia).toHaveTextContent('Karatê no Santana');
    expect(lia).toHaveTextContent('Festa das famílias');
    expect(lia).toHaveTextContent('Confirmado');
  });

  it('filtra por status e confirma dali mesmo', async () => {
    abrir(<ListaDeVoluntarios />, '/administracao/voluntariado?tela=voluntarios');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /A confirmar/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pedro Souza' }));
    await waitFor(() => expect(espiao.confirmados).toEqual([{ nome: 'Pedro Souza', whatsapp: '21999990001', primeiro_evento_id: 'f' }]));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));
  });
});

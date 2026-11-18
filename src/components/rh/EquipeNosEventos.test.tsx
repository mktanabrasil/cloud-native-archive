import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EventoDaEquipe } from '@/lib/rh/equipeNosEventos';

/** Administração › RH › Eventos e Por funcionário (18/11/2026, PR 3). */
const espiao = vi.hoisted(() => ({
  eventos: [] as EventoDaEquipe[],
  falha: null as null | 'semBanco' | 'erro',
  meses: [] as string[],
  conferidos: [] as [string, boolean][],
  equipes: [] as string[][],
}));
vi.mock('@/lib/rh/equipeNosEventosApi', () => ({
  lerEventosDaEquipe: vi.fn(async (mes: string) => {
    espiao.meses.push(mes);
    if (espiao.falha) throw Object.assign(new Error(espiao.falha), { semBanco: espiao.falha === 'semBanco' });
    return espiao.eventos;
  }),
  conferirEvento: vi.fn(async (id: string, c: boolean, equipe: string[]) => { espiao.conferidos.push([id, c]); espiao.equipes.push(equipe); }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { EquipeNosEventos } = await import('./EquipeNosEventos');

const ev = (o: Partial<EventoDaEquipe>): EventoDaEquipe => ({
  id: 'e1', title: 'Evento', unit: 'DIC', location: 'Unidade DIC', start_datetime: '2026-11-26T17:00:00Z', end_datetime: '2026-11-26T19:00:00Z',
  status: 'confirmado', equipe_funcionarios: [], conferido_em: null, conferido_por_nome: null, equipe_conferida: null, ...o,
});
const abrir = (vista: 'eventos' | 'funcionarios', url = '/administracao/rh') => render(
  <MemoryRouter initialEntries={[url]}><EquipeNosEventos vista={vista} /></MemoryRouter>,
);

beforeEach(() => {
  espiao.falha = null; espiao.meses = []; espiao.conferidos = []; espiao.equipes = [];
  espiao.eventos = [
    ev({ id: 'k', title: 'Karatê no Santana', unit: 'Santana', start_datetime: '2026-11-22T12:00:00Z', end_datetime: '2026-11-22T15:00:00Z', equipe_funcionarios: ['Rafael Souza', 'Bruna Lima'] }),
    ev({ id: 'r', title: 'Reunião com as famílias', equipe_funcionarios: ['Marina Costa', 'Juliana Prado'], conferido_em: '2026-11-18T12:00:00Z', conferido_por_nome: 'RH', equipe_conferida: ['Marina Costa', 'Juliana Prado'] }),
    ev({ id: 'n', title: 'Natal Feliz', unit: 'Grupo ANA Brasil', start_datetime: '2026-11-28T11:00:00Z', end_datetime: '2026-11-28T20:00:00Z', equipe_funcionarios: ['Marina Costa', 'Ana Ribeiro'], conferido_em: '2026-11-10T12:00:00Z', equipe_conferida: ['Marina Costa'] }),
  ];
});

describe('a equipe nos eventos', () => {
  it('mostra os números, os nomes e a situação de cada evento', async () => {
    abrir('eventos', '/administracao/rh?tela=eventos&mes=2026-11');
    const lista = await screen.findByRole('list', { name: 'Eventos com funcionários' });
    expect(espiao.meses).toEqual(['2026-11']);
    expect(screen.getByText('a conferir pelo RH').previousSibling).toHaveTextContent('2');
    expect(within(lista).getByRole('list', { name: 'Funcionários de Karatê no Santana' })).toHaveTextContent('Rafael Souza');
    expect(within(lista).getByText('A conferir')).toBeInTheDocument();
    expect(within(lista).getByText(/Conferido · 18\/11 · RH/)).toBeInTheDocument();
    expect(within(lista).getByText('A equipe mudou depois da conferência')).toBeInTheDocument();
  });

  it('marcar como conferido grava e troca o selo; desfazer volta', async () => {
    abrir('eventos', '/administracao/rh?mes=2026-11');
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar Karatê no Santana como conferido' }));
    await waitFor(() => expect(espiao.conferidos).toEqual([['k', true]]));
    // A equipe que o RH viu vai junto (se a unidade trocou nesse meio-tempo, o banco guarda esta).
    expect(espiao.equipes[0]).toEqual(['Rafael Souza', 'Bruna Lima']);
    expect(await screen.findByText(/Conferido · .* · você/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Desfazer/ })[0]);
    await waitFor(() => expect(espiao.conferidos).toContainEqual(['k', false]));
  });

  it('troca de mês pelo endereço', async () => {
    abrir('eventos', '/administracao/rh?mes=2026-11');
    await screen.findByRole('list', { name: 'Eventos com funcionários' });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect(espiao.meses).toEqual(['2026-11', '2026-12']));
  });

  it('mês impossível no endereço abre o mês atual, sem quebrar', async () => {
    abrir('eventos', '/administracao/rh?mes=2026-13');
    await screen.findByRole('list', { name: 'Eventos com funcionários' });
    expect(espiao.meses[0]).not.toBe('2026-13');
  });

  it('sem eventos no mês, explica de onde vêm os nomes', async () => {
    espiao.eventos = [];
    abrir('eventos', '/administracao/rh?mes=2026-11');
    expect(await screen.findByText(/Os nomes entram pelo formulário de eventos/)).toBeInTheDocument();
  });

  it('sem o SQL aplicado, avisa em vez de quebrar', async () => {
    espiao.falha = 'semBanco';
    abrir('eventos');
    expect(await screen.findByText(/ainda depende de uma atualização do banco/)).toBeInTheDocument();
  });
});

describe('por funcionário', () => {
  it('cada pessoa com os eventos e as horas do mês', async () => {
    abrir('funcionarios', '/administracao/rh?mes=2026-11');
    const tabela = await screen.findByRole('table');
    const linhas = within(tabela).getAllByRole('row').slice(1).map(l => l.querySelector('td')?.textContent);
    expect(linhas).toEqual(['Ana Ribeiro', 'Bruna Lima', 'Juliana Prado', 'Marina Costa', 'Rafael Souza']);
    const marina = within(tabela).getAllByRole('row').find(l => l.textContent?.startsWith('Marina Costa'))!;
    expect(marina).toHaveTextContent('11h');
    expect(screen.getByRole('button', { name: /Copiar o mês/ })).toBeInTheDocument();
  });
});

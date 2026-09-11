import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AppEvent } from '@/types';

/**
 * A lixeira dos eventos, agora uma aba do hub.
 *
 * Antes ela morava dentro da página pública e chegou a quebrar sem dar erro:
 * o título virava "Lixeira" e a grade seguia mostrando os ativos. Aqui a
 * lista é uma só e vem da lixeira; os testes fixam isso e as duas saídas.
 */
const espiao = vi.hoisted(() => ({
  eventos: [] as unknown[],
  restore: vi.fn(),
  remove: vi.fn(),
  carregando: false,
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    events: espiao.eventos,
    deleteEvent: espiao.remove,
    restoreEvent: espiao.restore,
    loading: espiao.carregando,
    erroAoCarregar: false,
    refetchEvents: vi.fn(),
  }),
}));
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: true, canEdit: true, viewRestrictions: null, permissionLevel: 'admin_geral' }),
}));
vi.mock('@/hooks/useViewConfigs', () => ({ useViewConfigs: () => ({ configs: null }) }));

const { default: LixeiraPage } = await import('./LixeiraPage');

const evento = (over: Partial<AppEvent>): AppEvent =>
  ({
    id: 'e1',
    title: 'Evento',
    description: '',
    unit: 'DIC',
    event_type: 'reunião',
    start_datetime: '2026-10-01T13:00:00.000Z',
    end_datetime: '2026-10-01T15:00:00.000Z',
    location: 'Sede',
    status: 'confirmado',
    visibility: 'publico',
    has_conflict: false,
    created_by: 'alguem',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    notes: '',
    marketing_request: false,
    partner_involved: false,
    partners: [],
    has_unit_collaboration: false,
    collaborating_units: [],
    external_collaborators: [],
    attachments: [],
    ...over,
  }) as AppEvent;

const ativo = evento({ id: 'ativo-1', title: 'Festa da Primavera' });
const naLixeira = evento({
  id: 'lixo-1',
  title: 'Reunião cancelada',
  visibility: 'interno',
  status: 'pendente',
  deleted_at: '2026-08-20T12:00:00.000Z',
});

const noCard = (titulo: string) => screen.queryAllByRole('heading', { level: 3, name: titulo }).length;

beforeEach(() => {
  espiao.eventos = [ativo, naLixeira];
  espiao.restore.mockClear();
  espiao.remove.mockClear();
});

describe('a lista', () => {
  it('mostra só o que está na lixeira, inclusive evento interno', () => {
    render(<LixeiraPage />);

    expect(noCard('Reunião cancelada')).toBe(1);
    expect(noCard('Festa da Primavera')).toBe(0);
    expect(screen.getByText(/excluído em 20\/08\/2026/i)).toBeInTheDocument();
  });

  it('avisa que está vazia em vez de mandar ajustar a busca', () => {
    espiao.eventos = [ativo];
    render(<LixeiraPage />);

    expect(screen.getByText(/a lixeira está vazia/i)).toBeInTheDocument();
  });

  it('não separa em Próximos e Já aconteceram', () => {
    render(<LixeiraPage />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('as duas saídas', () => {
  it('restaura pelo botão do card', () => {
    render(<LixeiraPage />);

    fireEvent.click(screen.getByRole('button', { name: /restaurar/i }));

    expect(espiao.restore).toHaveBeenCalledWith('lixo-1');
  });

  it('não apaga de vez sem perguntar antes', async () => {
    render(<LixeiraPage />);

    fireEvent.click(screen.getByRole('button', { name: /^excluir$/i }));

    expect(espiao.remove).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText('Reunião cancelada')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: /excluir definitivamente/i }));

    expect(espiao.remove).toHaveBeenCalledWith('lixo-1');
  });
});

describe('enquanto carrega', () => {
  it('mostra o esqueleto em vez de "A lixeira está vazia"', () => {
    espiao.carregando = true;
    espiao.eventos = [];
    render(<LixeiraPage />);

    expect(screen.getByTestId('esqueleto-da-lixeira')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando a lixeira');
    expect(screen.queryByText('A lixeira está vazia')).toBeNull();
    espiao.carregando = false;
  });
});

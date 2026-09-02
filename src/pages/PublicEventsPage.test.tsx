import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppEvent } from '@/types';

/**
 * A lixeira das Programações.
 *
 * O jeito de ela quebrar não foi dar erro: o título virava "Lixeira de Eventos"
 * e a grade continuava mostrando os eventos **ativos**, porque lia da lista da
 * vitrine, que ignora o `showTrash`. Quem clicasse concluiria que tinha
 * apagado tudo. Os testes abaixo fixam de qual lista a grade lê em cada modo.
 */

const espiao = vi.hoisted(() => ({
  eventos: [] as unknown[],
  restore: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    events: espiao.eventos,
    updateEvent: vi.fn(),
    deleteEvent: espiao.remove,
    restoreEvent: espiao.restore,
    setSelectedEvent: vi.fn(),
    selectedEvent: null,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: true, canEdit: true, viewRestrictions: null, permissionLevel: 'admin_geral' }),
}));

vi.mock('@/hooks/useViewConfigs', () => ({
  useViewConfigs: () => ({ configs: null }),
}));

vi.mock('@/hooks/useUIVersions', () => ({
  useUIVersions: () => ({ showBetaUI: false }),
}));

/* Os diálogos entram fechados e trazem meia árvore junto; fora do caminho. */
vi.mock('@/components/EventDetailDialog', () => ({ EventDetailDialog: () => null }));
vi.mock('@/components/EventFormDialog', () => ({ default: () => null }));
vi.mock('@/components/BannerMissingDialog', () => ({ BannerMissingDialog: () => null }));
vi.mock('@/components/ConflictDialog', () => ({ default: () => null }));
vi.mock('@/components/FilteredEventsDialog', () => ({ default: () => null }));
vi.mock('@/components/EventDetailPanel', () => ({ default: () => null }));

const { default: PublicEventsPage } = await import('./PublicEventsPage');

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
    partner_type: '',
    partner_name: '',
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

const montar = () =>
  render(
    <MemoryRouter>
      <PublicEventsPage />
    </MemoryRouter>,
  );

const abrirLixeira = () => fireEvent.click(screen.getByRole('button', { name: /ver lixeira/i }));

/**
 * Quantas vezes o título aparece na tela.
 *
 * Sem imagem de capa, o card escreve o título duas vezes — uma no bloco
 * colorido que substitui a capa, outra no cabeçalho. Contar evita casar com
 * a errada; o que importa aqui é se o evento está ou não na grade.
 */
const naTela = (titulo: string) => screen.queryAllByText(titulo).length;

/** Nos testes de ação há um único card na lixeira, então a tela basta. */
const esperarLixeira = (titulo: string) =>
  waitFor(() => expect(naTela(titulo)).toBeGreaterThan(0));

beforeEach(() => {
  espiao.eventos = [ativo, naLixeira];
  espiao.restore.mockClear();
  espiao.remove.mockClear();
});

describe('a grade lê da lista certa', () => {
  it('nos eventos ativos, mostra a vitrine e não o que está na lixeira', () => {
    montar();

    expect(naTela('Festa da Primavera')).toBeGreaterThan(0);
    expect(naTela('Reunião cancelada')).toBe(0);
  });

  it('na lixeira, troca de lista em vez de repetir os ativos', async () => {
    montar();
    abrirLixeira();

    await waitFor(() => expect(naTela('Reunião cancelada')).toBeGreaterThan(0));
    expect(naTela('Festa da Primavera')).toBe(0);
  });

  it('mostra na lixeira o evento interno, que a vitrine nunca mostraria', async () => {
    // A lixeira guarda evento de qualquer visibilidade — por isso ela não pode
    // sair da lista pública.
    montar();
    abrirLixeira();

    await waitFor(() => expect(naTela('Reunião cancelada')).toBeGreaterThan(0));
  });

  it('avisa que está vazia em vez de mandar ajustar a busca', async () => {
    espiao.eventos = [ativo];
    montar();
    abrirLixeira();

    await waitFor(() => expect(screen.getByText(/a lixeira está vazia/i)).toBeInTheDocument());
  });
});

describe('o campo de busca', () => {
  it('não fixa a cor de fundo, para acompanhar o tema', () => {
    // Ele já esteve com `bg-white`: no escuro ficava branco com o texto claro
    // por cima, 1,06:1, e a pessoa digitava sem ver. O jsdom não calcula
    // Tailwind, então o que dá para fixar aqui é a causa — a cor crua.
    montar();

    const busca = screen.getByPlaceholderText(/buscar por/i);

    expect(busca.className).not.toMatch(/bg-white/);
    expect(busca.className).toMatch(/bg-card/);
  });
});

describe('as duas saídas da lixeira', () => {
  it('restaura pelo botão do card', async () => {
    montar();
    abrirLixeira();

    await esperarLixeira('Reunião cancelada');
    fireEvent.click(screen.getByRole('button', { name: /restaurar/i }));

    expect(espiao.restore).toHaveBeenCalledWith('lixo-1');
  });

  it('não apaga de vez sem perguntar antes', async () => {
    montar();
    abrirLixeira();

    await esperarLixeira('Reunião cancelada');
    fireEvent.click(screen.getByRole('button', { name: /^excluir$/i }));

    // O clique abre a confirmação; quem apaga é o botão de dentro dela.
    expect(espiao.remove).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: /excluir definitivamente/i }));

    expect(espiao.remove).toHaveBeenCalledWith('lixo-1');
  });
});

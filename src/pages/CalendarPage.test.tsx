import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppEvent } from '@/types';

/**
 * O calendário da equipe.
 *
 * Três coisas fixadas aqui (11/09/2026): um evento de vários dias aparece em
 * cada dia que atravessa; excluir pergunta antes, e o lote avisa uma vez com
 * a conta; no celular a visão inicial é a Lista.
 */
const espiao = vi.hoisted(() => ({
  eventos: [] as AppEvent[],
  mobile: false,
  deleteEvent: vi.fn(),
  updateEvent: vi.fn(),
  refetch: vi.fn(),
  toastOk: vi.fn(),
  toastErro: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: espiao.toastOk, error: espiao.toastErro } }));
vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    events: espiao.eventos,
    selectedMonth: new Date(2026, 9, 1),
    setSelectedMonth: vi.fn(),
    setSelectedEvent: vi.fn(),
    deleteEvent: espiao.deleteEvent,
    updateEvent: espiao.updateEvent,
    detectConflicts: () => [],
    loading: false,
    refetchEvents: espiao.refetch,
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ canEdit: true, canCreate: true, userName: 'Admin', unit: 'Administração', isAdmin: true }),
}));
vi.mock('@/hooks/useFilteredEvents', () => ({ useFilteredEvents: () => espiao.eventos }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => espiao.mobile }));
vi.mock('@/components/EventFormDialog', () => ({ default: () => null }));
// O Select do Radix não abre no jsdom: vira um <select> nativo, como no teste do formulário.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const Ctx = React.createContext<{ value: string; onValueChange: (v: string) => void }>({ value: '', onValueChange: () => {} });
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const Select = ({ value, onValueChange, children }: any) => (
    <Ctx.Provider value={{ value: value ?? '', onValueChange }}><div data-select>{children}</div></Ctx.Provider>
  );
  const SelectTrigger = ({ children, className }: any) => {
    const c = React.useContext(Ctx);
    return <button type="button" role="combobox" className={className} data-value={c.value}>{children}</button>;
  };
  const SelectValue = ({ placeholder }: any) => {
    const c = React.useContext(Ctx);
    return <span>{c.value || placeholder || ''}</span>;
  };
  const SelectContent = ({ children }: any) => {
    const c = React.useContext(Ctx);
    return (
      <select aria-label="opções" value={c.value} onChange={e => c.onValueChange(e.target.value)}>
        <option value="" hidden></option>
        {children}
      </select>
    );
  };
  const SelectItem = ({ value, children }: any) => <option value={value}>{children}</option>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});
vi.mock('@/components/PageGuide', () => ({ default: () => null }));
vi.mock('@/components/EventDetailPanel', () => ({
  default: (p: { event: AppEvent | null; open: boolean; onDelete?: (id: string) => void }) =>
    p.open && p.event ? (
      <div data-testid="painel">
        {p.event.title}
        {p.onDelete && <button onClick={() => p.onDelete!(p.event!.id)}>Mover para a lixeira</button>}
      </div>
    ) : null,
}));

const { default: CalendarPage } = await import('./CalendarPage');

const evento = (dados: Partial<AppEvent>): AppEvent =>
  ({
    id: 'e',
    title: 'Evento',
    unit: 'DIC',
    location: 'Unidade DIC',
    status: 'confirmado',
    visibility: 'interno',
    event_type: 'evento institucional',
    start_datetime: new Date(2026, 9, 13, 8).toISOString(),
    end_datetime: new Date(2026, 9, 13, 17).toISOString(),
    has_conflict: false,
    deleted_at: null,
    attachments: [],
    ...dados,
  }) as AppEvent;

const montar = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>);
/** O Radix ativa a aba no mouseDown, não no click. */
const trocarPara = (nome: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name: nome }), { button: 0 });

beforeEach(() => {
  espiao.mobile = false;
  espiao.deleteEvent.mockReset().mockResolvedValue(undefined);
  espiao.updateEvent.mockReset().mockResolvedValue(undefined);
  espiao.refetch.mockReset().mockResolvedValue(undefined);
  espiao.toastOk.mockClear();
  espiao.toastErro.mockClear();
  espiao.eventos = [
    evento({ id: 'colonia', title: 'Colônia de férias', start_datetime: new Date(2026, 9, 13, 8).toISOString(), end_datetime: new Date(2026, 9, 17, 16).toISOString() }),
    evento({ id: 'pais', title: 'Reunião de pais', unit: 'Santana', start_datetime: new Date(2026, 9, 15, 19).toISOString(), end_datetime: new Date(2026, 9, 15, 21).toISOString() }),
  ];
});

describe('evento de vários dias', () => {
  it('aparece em cada dia, com o primeiro arrastável e os demais como continuação', () => {
    montar();
    const barras = screen.getAllByRole('button', { name: /colônia de férias/i });
    expect(barras).toHaveLength(5);

    const inicio = barras.filter(b => !b.dataset.continuacao);
    const meio = barras.filter(b => b.dataset.continuacao === 'sim');
    expect(inicio).toHaveLength(1);
    expect(meio).toHaveLength(4);
    expect(inicio[0].getAttribute('draggable')).toBe('true');
    expect(meio[0].getAttribute('draggable')).toBe('false');
    expect(meio[0]).toHaveAccessibleName(/continua/);
  });

  it('a Lista mostra o evento uma vez, com o período', () => {
    montar();
    trocarPara(/lista/i);

    expect(screen.getAllByText('Colônia de férias')).toHaveLength(1);
    expect(screen.getByText('13/10 a 17/10/2026')).toBeInTheDocument();
  });
});

describe('excluir pergunta antes', () => {
  it('pelo painel de detalhe: nada acontece até confirmar, e o texto é "lixeira"', async () => {
    montar();
    fireEvent.click(screen.getAllByRole('button', { name: /reunião de pais/i })[0]);
    fireEvent.click(within(screen.getByTestId('painel')).getByRole('button', { name: /mover para a lixeira/i }));

    expect(espiao.deleteEvent).not.toHaveBeenCalled();
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Mover "Reunião de pais" para a lixeira?');
    expect(dialogo).toHaveTextContent(/dá para restaurar depois/i);

    fireEvent.click(within(dialogo).getByRole('button', { name: /^mover para a lixeira$/i }));
    await waitFor(() => expect(espiao.deleteEvent).toHaveBeenCalledWith('pais'));
  });

  it('em lote: confirma uma vez, grava tudo junto, avisa a conta e mantém selecionado o que o banco recusou', async () => {
    espiao.deleteEvent.mockImplementation(async (id: string) => {
      if (id === 'colonia') throw Object.assign(new Error('permission denied'), { code: '42501' });
    });
    montar();
    trocarPara(/lista/i);
    for (const cb of screen.getAllByRole('checkbox')) fireEvent.click(cb);
    fireEvent.click(screen.getByRole('button', { name: /^mover para a lixeira$/i }));

    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Mover 2 eventos para a lixeira?');
    fireEvent.click(within(dialogo).getByRole('button', { name: /mover 2 para a lixeira/i }));

    await waitFor(() => expect(espiao.toastOk).toHaveBeenCalled());
    expect(espiao.deleteEvent).toHaveBeenCalledTimes(2);
    expect(espiao.deleteEvent).toHaveBeenCalledWith('pais', { emLote: true });
    expect(espiao.toastOk).toHaveBeenCalledWith('1 evento movido para a lixeira', {
      description: expect.stringMatching(/^1 evento não pôde ser movido: já estão confirmados/),
    });
    expect(espiao.refetch).toHaveBeenCalledTimes(1);
    // o recusado continua selecionado
    expect(screen.getByText(/1 evento\(s\) selecionado/)).toBeInTheDocument();
  });

  it('mudar status em lote: uma gravação por evento, um recarregamento, um aviso', async () => {
    montar();
    trocarPara(/lista/i);
    for (const cb of screen.getAllByRole('checkbox')) fireEvent.click(cb);

    const barra = screen.getByText((t) => t.startsWith('2 evento(s) selecionado')).closest('[class*="sticky"]') as HTMLElement;
    fireEvent.change(within(barra).getByLabelText('opções'), { target: { value: 'cancelado' } });

    await waitFor(() => expect(espiao.toastOk).toHaveBeenCalledWith('2 eventos alterados para "cancelado"', { description: undefined }));
    expect(espiao.updateEvent).toHaveBeenCalledTimes(2);
    expect(espiao.updateEvent.mock.calls[0][1]).toEqual({ emLote: true });
    expect(espiao.refetch).toHaveBeenCalledTimes(1);
  });
});

describe('no celular', () => {
  it('abre em Lista, e a escolha da pessoa prevalece', async () => {
    espiao.mobile = true;
    montar();

    await waitFor(() => expect(screen.getByRole('tab', { name: /lista/i })).toHaveAttribute('data-state', 'active'));
    expect(screen.getByText('13/10 a 17/10/2026')).toBeInTheDocument();
    trocarPara(/mês/i);
    expect(screen.getByRole('tab', { name: /mês/i })).toHaveAttribute('data-state', 'active');
  });

  it('as setas têm nome', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument();
  });
});

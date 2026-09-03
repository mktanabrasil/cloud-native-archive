import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AppEvent } from '@/types';

/**
 * Quem pode mandar um evento para o site.
 *
 * "Onde este evento deve aparecer?" não tinha guarda nenhuma: qualquer pessoa
 * que abrisse o formulário podia marcar público. E o bloco de compartilhamento
 * estava atrás de `isAdmin`, que deixa a comunicação de fora. Os dois passaram
 * a usar `isMarketing` — "admin geral ou comunicação".
 */

const espiao = vi.hoisted(() => ({
  papel: { userName: 'Quem preenche', unit: 'DIC', isAdmin: false, isMarketing: false },
  addEvent: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => espiao.papel }));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    addEvent: espiao.addEvent,
    updateEvent: vi.fn(),
    detectConflicts: () => [],
    setSelectedEvent: vi.fn(),
    events: [] as AppEvent[],
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('./FileUpload', () => ({ FileUpload: () => null }));
vi.mock('./EventDetailDialog', () => ({ EventDetailDialog: () => null }));
vi.mock('./BannerMissingDialog', () => ({ BannerMissingDialog: () => null }));

const { default: EventFormDialog } = await import('./EventFormDialog');

const abrir = () =>
  render(<EventFormDialog open onOpenChange={() => {}} />);

const temVisibilidade = () => !!screen.queryByText('Onde este evento deve aparecer?');
const temCompartilhamento = () => !!screen.queryByText(/Configurações de Compartilhamento/i);

beforeEach(() => {
  espiao.papel = { userName: 'Quem preenche', unit: 'DIC', isAdmin: false, isMarketing: false };
  espiao.addEvent.mockClear();
});

describe('publicar no site', () => {
  it('a gestão de unidade não vê nenhum dos dois blocos', () => {
    abrir();

    expect(temVisibilidade()).toBe(false);
    expect(temCompartilhamento()).toBe(false);
  });

  it('a comunicação vê os dois, mesmo sem ser admin', () => {
    // Era este o caso quebrado: `isAdmin` escondia o compartilhamento de quem
    // cuida da comunicação.
    espiao.papel = { ...espiao.papel, isAdmin: false, isMarketing: true };
    abrir();

    expect(temVisibilidade()).toBe(true);
    expect(temCompartilhamento()).toBe(true);
  });

  it('o admin geral vê os dois', () => {
    espiao.papel = { ...espiao.papel, isAdmin: true, isMarketing: true };
    abrir();

    expect(temVisibilidade()).toBe(true);
    expect(temCompartilhamento()).toBe(true);
  });
});

describe('Tipo e Status', () => {
  it.each([
    ['Tipo', 'reunião'],
    ['Status', 'pendente'],
  ])('%s mostra o escolhido com a mesma letra da lista', (_campo, valor) => {
    // A lista tinha `capitalize` e o gatilho não: escolhido, "Evento
    // Institucional" virava "evento institucional". O mesmo no Status.
    abrir();

    const gatilho = screen.getByText(valor).closest('button');

    expect(gatilho?.className).toMatch(/capitalize/);
  });
});

describe('as pendências', () => {
  it('resume no topo e conta no botão quando o formulário está vazio', () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    abrir();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    expect(screen.getByText(/faltam \d+ campos para criar a programação/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar programação \(\d+ pendências\)/i })).toBeInTheDocument();
    expect(espiao.addEvent).not.toHaveBeenCalled();
  });
});

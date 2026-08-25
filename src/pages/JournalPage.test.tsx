import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createPage } from '@/lib/journal/templates';
import type { JournalRecord } from '@/lib/journal/types';

const espiao = vi.hoisted(() => ({
  remove: vi.fn(),
  duplicate: vi.fn(),
  journals: [] as unknown[],
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({
    isMarketing: true,
    loading: false,
    unit: null,
    userName: 'Diretora de teste',
  }),
}));

vi.mock('@/hooks/useJournals', () => ({
  useJournals: () => ({
    journals: espiao.journals,
    loading: false,
    saving: false,
    savedAt: null,
    create: vi.fn(),
    save: vi.fn(),
    remove: espiao.remove,
    duplicate: espiao.duplicate,
  }),
}));

const { default: JournalPage } = await import('./JournalPage');

const jornal = (): JournalRecord => ({
  id: 'jornal-1',
  name: 'Jornal ANA — Agosto',
  unit_id: null,
  profile_unit: null,
  reference_month: 'Agosto 2026',
  status: 'rascunho',
  pages: [createPage('capa')],
  paper: null,
  created_by: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
});

const clicarExcluir = () =>
  fireEvent.click(screen.getByRole('button', { name: /excluir/i }));

/** O diálogo abre em portal; procurar dentro dele evita casar com o card. */
const dialogo = () => screen.findByRole('alertdialog');

beforeEach(() => {
  espiao.remove.mockClear();
  espiao.journals = [jornal()];
});

/**
 * O botão excluía direto, sem pergunta — um clique errado num card apagava a
 * edição, e não há como restaurá-la pela interface.
 */
describe('exclusão de jornal', () => {
  it('não exclui ao clicar em Excluir: só abre a confirmação', async () => {
    render(<JournalPage />);
    clicarExcluir();

    expect(await dialogo()).toBeInTheDocument();
    expect(espiao.remove).not.toHaveBeenCalled();
  });

  it('mostra qual edição será excluída', async () => {
    render(<JournalPage />);
    clicarExcluir();

    expect(within(await dialogo()).getByText('Jornal ANA — Agosto')).toBeInTheDocument();
  });

  it('cancelar fecha a confirmação sem excluir', async () => {
    render(<JournalPage />);
    clicarExcluir();

    fireEvent.click(within(await dialogo()).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(espiao.remove).not.toHaveBeenCalled();
  });

  it('confirmar exclui a edição escolhida', async () => {
    render(<JournalPage />);
    clicarExcluir();

    fireEvent.click(within(await dialogo()).getByRole('button', { name: /sim, excluir/i }));

    await waitFor(() => expect(espiao.remove).toHaveBeenCalledTimes(1));
    expect(espiao.remove).toHaveBeenCalledWith('jornal-1');
  });
});

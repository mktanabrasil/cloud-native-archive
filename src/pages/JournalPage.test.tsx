import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createPage } from '@/lib/journal/templates';
import type { JournalRecord } from '@/lib/journal/types';

const espiao = vi.hoisted(() => ({
  remove: vi.fn(),
  duplicate: vi.fn(),
  journals: [] as unknown[],
  /** Quem está olhando a página. Cada teste ajusta o que precisa. */
  papel: {
    canAccessJournal: true,
    isMarketing: true,
    loading: false,
    unit: null as string | null,
    userName: 'Quem está olhando',
  },
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => espiao.papel,
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
  espiao.papel = {
    canAccessJournal: true,
    isMarketing: true,
    loading: false,
    unit: null,
    userName: 'Quem está olhando',
  };
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

/**
 * A página é da comunicação e da gestão de unidade — e de mais ninguém.
 *
 * O portão vive em `canAccessJournal` (`useUserRole`) e é o mesmo que a rota
 * consulta. Ele ficou separado do `MarketingRoute` de propósito: aquele
 * protege Auditoria, Manual de Design, Portal da Transparência e Widgets, e
 * afrouxá-lo para receber a gestão abriria as quatro juntas.
 */
describe('quem entra na página', () => {
  it('mostra o jornal para quem tem acesso', async () => {
    render(<JournalPage />);
    expect(await screen.findByText(/jornal da unidade/i)).toBeInTheDocument();
  });

  it('barra quem não tem, sem mostrar edição alguma', async () => {
    espiao.papel = { ...espiao.papel, canAccessJournal: false };

    render(<JournalPage />);

    expect(await screen.findByText(/área da comunicação/i)).toBeInTheDocument();
    expect(screen.queryByText(/jornal da unidade/i)).not.toBeInTheDocument();
  });
});

/**
 * Quem é dono do jornal decide o que a tela oferece.
 *
 * A comparação é por `profile_unit` — o mesmo campo que a RLS compara com
 * `profiles.unit`. Não é o `unit_id`: aquele é o id do catálogo, usado para
 * desenhar a folha; a posse mora no rótulo.
 */
describe('jornal de outra unidade', () => {
  const deOutraUnidade = (): JournalRecord => ({
    ...jornal(),
    unit_id: 'ana-nilopolis',
    profile_unit: 'Outra Unidade',
  });

  const gestoraDeNilopolis = {
    canAccessJournal: true,
    isMarketing: false,
    loading: false,
    unit: 'Nilópolis',
    userName: 'Gestora',
  };

  it('oferece duplicar para a minha unidade, e não excluir', async () => {
    espiao.papel = gestoraDeNilopolis;
    espiao.journals = [deOutraUnidade()];

    render(<JournalPage />);

    expect(
      await screen.findByRole('button', { name: /duplicar para minha unidade/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^excluir$/i })).not.toBeInTheDocument();
  });

  it('duplica para a unidade de quem clicou, não para a de origem', async () => {
    espiao.papel = gestoraDeNilopolis;
    espiao.journals = [deOutraUnidade()];

    render(<JournalPage />);
    fireEvent.click(await screen.findByRole('button', { name: /duplicar para minha unidade/i }));

    await waitFor(() => expect(espiao.duplicate).toHaveBeenCalled());
    expect(espiao.duplicate.mock.calls[0][1]).toEqual({
      unitId: 'ana-nilopolis',
      profileUnit: 'Nilópolis',
    });
  });

  it('no próprio jornal, mantém excluir', async () => {
    espiao.papel = gestoraDeNilopolis;
    espiao.journals = [{ ...jornal(), unit_id: 'ana-nilopolis', profile_unit: 'Nilópolis' }];

    render(<JournalPage />);

    expect(await screen.findByRole('button', { name: /^excluir$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /duplicar para minha unidade/i }),
    ).not.toBeInTheDocument();
  });
});

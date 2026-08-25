import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createPage } from '@/lib/journal/templates';
import type { JournalRecord } from '@/lib/journal/types';

const espiao = vi.hoisted(() => ({
  remove: vi.fn(),
  duplicate: vi.fn(),
  journals: [] as unknown[],
  marcarVisto: vi.fn(),
  tutorial: { jaViu: true, pronto: true },
}));

vi.mock('@/hooks/useTutorial', () => ({
  useTutorial: () => ({
    jaViu: espiao.tutorial.jaViu,
    pronto: espiao.tutorial.pronto,
    marcarVisto: espiao.marcarVisto,
  }),
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
  cover_url: null,
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
  espiao.marcarVisto.mockClear();
  espiao.journals = [jornal()];
  // o padrão dos testes de exclusão é "já viu": sem isso o tutorial abriria
  // por cima e roubaria o foco dos diálogos
  espiao.tutorial = { jaViu: true, pronto: true };
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

const tutorialNaTela = () => screen.queryByText('Bem-vinda ao Jornal');

/**
 * O tutorial aparece uma vez só, por usuário. A marca de "já visto" vem do
 * banco; aqui ela é simulada para exercitar as três situações que importam.
 */
describe('tutorial de primeiro acesso', () => {
  it('abre sozinho quando a diretora ainda não viu', async () => {
    espiao.tutorial = { jaViu: false, pronto: true };
    render(<JournalPage />);

    await waitFor(() => expect(tutorialNaTela()).toBeInTheDocument());
  });

  it('não abre para quem já viu', async () => {
    espiao.tutorial = { jaViu: true, pronto: true };
    render(<JournalPage />);

    await waitFor(() => expect(screen.getByText(/Aqui ficam os jornais/i)).toBeInTheDocument());
    expect(tutorialNaTela()).not.toBeInTheDocument();
  });

  /** Abrir antes da consulta voltar faria o tutorial piscar para quem já viu. */
  it('não abre enquanto a consulta ao banco não voltou', async () => {
    espiao.tutorial = { jaViu: false, pronto: false };
    render(<JournalPage />);

    await waitFor(() => expect(screen.getByText(/Aqui ficam os jornais/i)).toBeInTheDocument());
    expect(tutorialNaTela()).not.toBeInTheDocument();
  });

  it('o botão Ajuda reabre para quem já viu', async () => {
    espiao.tutorial = { jaViu: true, pronto: true };
    render(<JournalPage />);
    expect(tutorialNaTela()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));

    await waitFor(() => expect(tutorialNaTela()).toBeInTheDocument());
  });

  it('fechar marca como visto, para não voltar sozinho', async () => {
    espiao.tutorial = { jaViu: false, pronto: true };
    render(<JournalPage />);
    await waitFor(() => expect(tutorialNaTela()).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /pular tutorial/i }));

    await waitFor(() => expect(espiao.marcarVisto).toHaveBeenCalledTimes(1));
  });

  it('percorre os oito passos até o fim', async () => {
    espiao.tutorial = { jaViu: false, pronto: true };
    render(<JournalPage />);
    await waitFor(() => expect(tutorialNaTela()).toBeInTheDocument());

    for (let n = 1; n < 8; n++) {
      fireEvent.click(screen.getByRole('button', { name: /^próximo$/i }));
    }
    expect(screen.getByText('Pronto, é isso!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /começar a usar/i }));
    await waitFor(() => expect(espiao.marcarVisto).toHaveBeenCalledTimes(1));
  });
});

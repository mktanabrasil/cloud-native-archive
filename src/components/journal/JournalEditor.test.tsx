import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createPage } from '@/lib/journal/templates';
import type { JournalRecord } from '@/lib/journal/types';

/**
 * O editor nunca teve teste. Este cobre o PR "não perder trabalho" da
 * varredura de 16/09/2026: finalizar com Desfazer, excluir página com
 * confirmação, selo "Não salvou" quando a gravação falha, e a pergunta ao
 * sair com mudança pendente.
 */
const espiao = vi.hoisted(() => ({
  onSave: vi.fn(),
  onBack: vi.fn(),
  toasts: [] as Array<{ tipo: string; titulo: string; opcoes?: { action?: { label: string; onClick: () => void } } }>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (titulo: string, opcoes?: unknown) => espiao.toasts.push({ tipo: 'success', titulo, opcoes: opcoes as never }),
    error: (titulo: string, opcoes?: unknown) => espiao.toasts.push({ tipo: 'error', titulo, opcoes: opcoes as never }),
    warning: (titulo: string, opcoes?: unknown) => espiao.toasts.push({ tipo: 'warning', titulo, opcoes: opcoes as never }),
  },
}));
vi.mock('@/hooks/useTutoriaisVistos', () => ({
  useTutoriaisVistos: () => ({ carregado: true, jaViu: () => true, marcarVisto: vi.fn(), esquecer: vi.fn() }),
}));
/* Popover do Radix fica inline: fechar um popover neste DOM grande leva dezenas de
   segundos no jsdom (foco e aria-hidden varrendo as folhas), e não é o que se testa aqui. */
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-popover-falso>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ default: vi.fn() }));

class ResizeObserverFalso { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso;

const { JournalEditor } = await import('./JournalEditor');

const jornal = (): JournalRecord => ({
  id: 'j1',
  name: 'Jornal ANA — Setembro',
  unit_id: null,
  profile_unit: null,
  reference_month: 'Setembro 2026',
  status: 'rascunho',
  pages: [createPage('capa'), createPage('galeria')],
  paper: null,
  created_by: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
});

const montar = (extra: Partial<JournalRecord> = {}) =>
  render(<JournalEditor journal={{ ...jornal(), ...extra }} saving={false} savedAt="14:53" onBack={espiao.onBack} onSave={espiao.onSave} somenteLeitura={false} podeTrocarUnidade={false} />);

beforeEach(() => {
  espiao.onSave.mockReset(); espiao.onSave.mockResolvedValue(true);
  espiao.onBack.mockReset();
  espiao.toasts = [];
});

describe('JournalEditor · não perder trabalho', () => {
  it('Finalizar edição finaliza na hora e oferece Desfazer, que volta a rascunho', async () => {
    montar();
    fireEvent.click(screen.getAllByText(/finalizar edição/i, { selector: 'button' })[0]);

    expect(espiao.onSave).toHaveBeenCalledWith('j1', { status: 'finalizado' });
    const aviso = espiao.toasts.find(t => t.titulo === 'Jornal finalizado');
    expect(aviso?.opcoes?.action?.label).toBe('Desfazer');
    expect(screen.getAllByText(/reabrir como rascunho/i, { selector: 'button' })[0]).toBeInTheDocument();

    aviso!.opcoes!.action!.onClick();
    await waitFor(() => expect(espiao.onSave).toHaveBeenCalledWith('j1', { status: 'rascunho' }));
    expect(screen.getAllByText(/finalizar edição/i, { selector: 'button' })[0]).toBeInTheDocument();
  });

  it('Excluir página pergunta, diz quantas peças, e só apaga ao confirmar', async () => {
    montar();
    expect(screen.getByText(/Página 02 ·/)).toBeInTheDocument();

    // Consultas por texto e por seletor: a árvore do editor é grande e byRole é lento no jsdom.
    const dialogo = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
    const abrirMenuEExcluir = async () => {
      // popover inline no teste: o item da página 2 é o segundo "Excluir página" da tela
      fireEvent.click(screen.getAllByText('Excluir página', { selector: 'button' })[1]);
      await waitFor(() => expect(dialogo()).not.toBeNull());
    };

    await abrirMenuEExcluir();
    expect(dialogo()).toHaveTextContent(/Excluir a página 2?/);
    expect(dialogo()).toHaveTextContent(/peça/);
    fireEvent.click(within(dialogo()!).getByText('Cancelar'));
    await waitFor(() => expect(dialogo()).toBeNull());
    expect(screen.getByText(/Página 02 ·/)).toBeInTheDocument();

    await abrirMenuEExcluir();
    fireEvent.click(within(dialogo()!).getByText('Excluir página', { selector: 'button' }));
    await waitFor(() => expect(screen.queryByText(/Página 02 ·/)).not.toBeInTheDocument());
  }, 20000);

  it('quando a gravação falha, o selo diz "Não salvou" e Voltar pergunta antes de sair', async () => {
    espiao.onSave.mockResolvedValue(false);
    montar();

    fireEvent.change(screen.getByDisplayValue('Jornal ANA — Setembro'), { target: { value: 'Jornal ANA — Outubro' } });
    await waitFor(() => expect(espiao.onSave).toHaveBeenCalled(), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('selo-de-gravacao')).toHaveTextContent(/não salvou/i));
    expect(espiao.toasts.some(t => t.titulo === 'Não consegui salvar o jornal')).toBe(true);

    fireEvent.click(screen.getByText(/^voltar$/i, { selector: 'button' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent(/Sair sem salvar\?/);
    expect(espiao.onBack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /sair sem salvar/i }));
    await waitFor(() => expect(espiao.onBack).toHaveBeenCalled());
  }, 20000);

  it('sem mudança pendente, Voltar sai direto', () => {
    montar();
    fireEvent.click(screen.getByText(/^voltar$/i, { selector: 'button' }));
    expect(espiao.onBack).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

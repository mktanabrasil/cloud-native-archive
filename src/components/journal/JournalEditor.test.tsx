import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: /finalizar edição/i }));

    expect(espiao.onSave).toHaveBeenCalledWith('j1', { status: 'finalizado' });
    const aviso = espiao.toasts.find(t => t.titulo === 'Jornal finalizado');
    expect(aviso?.opcoes?.action?.label).toBe('Desfazer');
    expect(screen.getByRole('button', { name: /reabrir como rascunho/i })).toBeInTheDocument();

    aviso!.opcoes!.action!.onClick();
    await waitFor(() => expect(espiao.onSave).toHaveBeenCalledWith('j1', { status: 'rascunho' }));
    expect(screen.getByRole('button', { name: /finalizar edição/i })).toBeInTheDocument();
  });

  it('Excluir página pergunta, diz quantas peças, e só apaga ao confirmar', async () => {
    montar();
    expect(screen.getByText(/Página 02 ·/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /excluir página/i })[1]);
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent(/Excluir a página 2\?/);
    expect(dialogo).toHaveTextContent(/peça/);

    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText(/Página 02 ·/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /excluir página/i })[1]);
    fireEvent.click(await screen.findByRole('button', { name: /^excluir página$/i }));
    await waitFor(() => expect(screen.queryByText(/Página 02 ·/)).not.toBeInTheDocument());
  });

  it('quando a gravação falha, o selo diz "Não salvou" e Voltar pergunta antes de sair', async () => {
    espiao.onSave.mockResolvedValue(false);
    montar();

    fireEvent.change(screen.getByDisplayValue('Jornal ANA — Setembro'), { target: { value: 'Jornal ANA — Outubro' } });
    await waitFor(() => expect(espiao.onSave).toHaveBeenCalled(), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('selo-de-gravacao')).toHaveTextContent(/não salvou/i));
    expect(espiao.toasts.some(t => t.titulo === 'Não consegui salvar o jornal')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent(/Sair sem salvar\?/);
    expect(espiao.onBack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /sair sem salvar/i }));
    await waitFor(() => expect(espiao.onBack).toHaveBeenCalled());
  }, 10000);

  it('sem mudança pendente, Voltar sai direto', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    expect(espiao.onBack).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

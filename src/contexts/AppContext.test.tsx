import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * Excluir e restaurar diante de um RLS que filtra em silêncio.
 *
 * Um UPDATE ou DELETE que a política não deixa passar não dá erro: afeta zero
 * linhas. `updateEvent` já tratava isso; excluir e restaurar diziam "feito"
 * para uma gestora tentando apagar um evento confirmado, e ele continuava lá.
 */
const espiao = vi.hoisted(() => ({
  linhas: [] as unknown[],
  operacoes: [] as string[],
  toastOk: vi.fn(),
  toastErro: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: espiao.toastOk, error: espiao.toastErro } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => {
  const resposta = () => Promise.resolve({ data: espiao.linhas, error: null });
  const cadeia = (op: string) => {
    espiao.operacoes.push(op);
    return { eq: () => ({ select: resposta }) };
  };
  return {
    supabase: {
      from: () => ({
        // a busca da lista, na montagem e depois de cada gravação
        select: () => Promise.resolve({ data: [], error: null }),
        update: () => cadeia('update'),
        delete: () => cadeia('delete'),
      }),
    },
  };
});

const { AppProvider, useApp } = await import('./AppContext');

const montar = () =>
  renderHook(() => useApp(), { wrapper: ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider> });

beforeEach(() => {
  espiao.linhas = [];
  espiao.operacoes = [];
  espiao.toastOk.mockClear();
  espiao.toastErro.mockClear();
});

describe('mover para a lixeira', () => {
  it('quando o banco não altera nenhuma linha, lança permissão negada e não diz "movido"', async () => {
    espiao.linhas = [];
    const { result } = montar();

    await expect(act(() => result.current.deleteEvent('e1'))).rejects.toMatchObject({ code: '42501' });

    expect(espiao.toastOk).not.toHaveBeenCalled();
    expect(espiao.toastErro).toHaveBeenCalledWith('Sem permissão para mover este evento para a lixeira');
    expect(espiao.operacoes).toContain('update');
  });

  it('quando uma linha mudou, avisa que moveu', async () => {
    espiao.linhas = [{ id: 'e1' }];
    const { result } = montar();

    await act(() => result.current.deleteEvent('e1'));

    expect(espiao.toastOk).toHaveBeenCalledWith('Evento movido para a lixeira');
    expect(espiao.toastErro).not.toHaveBeenCalled();
  });
});

describe('restaurar', () => {
  it('zero linhas é permissão negada, não "restaurado"', async () => {
    espiao.linhas = [];
    const { result } = montar();

    await expect(act(() => result.current.restoreEvent('e1'))).rejects.toMatchObject({ code: '42501' });

    expect(espiao.toastOk).not.toHaveBeenCalled();
    expect(espiao.toastErro).toHaveBeenCalledWith('Sem permissão para restaurar este evento');
  });
});

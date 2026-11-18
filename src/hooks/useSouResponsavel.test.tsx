import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * useResponsavel (18/11/2026): o `carregado` só vale para a resposta da conta
 * de agora. Sem isso, a página do RH mandaria o responsável ao portal no meio
 * segundo em que a resposta ainda não chegou.
 */
const estado = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; user_metadata: Record<string, unknown> }, isAuthenticated: false, loading: false },
  rpc: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => estado.rpc(...a) } }));

const { useResponsavel } = await import('./useSouResponsavel');

const equipe = (id: string) => ({ user: { id, user_metadata: {} }, isAuthenticated: true, loading: false });

beforeEach(() => {
  estado.auth = { user: null, isAuthenticated: false, loading: false };
  estado.rpc = vi.fn();
});

describe('useResponsavel', () => {
  it('com o login ainda carregando, não está carregado', () => {
    estado.auth = { user: null, isAuthenticated: false, loading: true };
    const { result } = renderHook(() => useResponsavel());
    expect(result.current).toEqual({ sou: false, carregado: false });
  });

  it('candidato: não é, sem perguntar ao banco', async () => {
    estado.auth = { user: { id: 'c1', user_metadata: { conta: 'candidato' } }, isAuthenticated: true, loading: false };
    const { result } = renderHook(() => useResponsavel());
    await waitFor(() => expect(result.current.carregado).toBe(true));
    expect(result.current.sou).toBe(false);
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it('equipe: espera a resposta; o sim chega como sim', async () => {
    let responder: (v: { data: boolean }) => void = () => {};
    estado.rpc.mockReturnValue(new Promise(r => { responder = r; }));
    estado.auth = equipe('u1');
    const { result } = renderHook(() => useResponsavel());
    expect(result.current.carregado).toBe(false);
    responder({ data: true });
    await waitFor(() => expect(result.current).toEqual({ sou: true, carregado: true }));
  });

  it('trocou de conta: volta a esperar a resposta da conta nova', async () => {
    estado.rpc.mockResolvedValueOnce({ data: true });
    estado.auth = equipe('u1');
    const { result, rerender } = renderHook(() => useResponsavel());
    await waitFor(() => expect(result.current.sou).toBe(true));
    estado.rpc.mockReturnValue(new Promise(() => {}));
    estado.auth = equipe('u2');
    rerender();
    expect(result.current).toEqual({ sou: false, carregado: false });
  });

  it('o banco falhou: não é, e está carregado', async () => {
    estado.rpc.mockRejectedValue(new Error('rede'));
    estado.auth = equipe('u1');
    const { result } = renderHook(() => useResponsavel());
    await waitFor(() => expect(result.current).toEqual({ sou: false, carregado: true }));
  });
});

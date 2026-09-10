import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * A marca de "já vi" do tutorial, por conta.
 */
const espiao = vi.hoisted(() => ({
  userId: 'u1' as string | null,
  linhas: [] as { percurso: string }[],
  upserts: [] as unknown[],
  deletes: 0,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: espiao.userId ? { id: espiao.userId } : null }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: espiao.linhas, error: null }) }),
      upsert: (linha: unknown) => { espiao.upserts.push(linha); return Promise.resolve({ error: null }); },
      delete: () => ({ eq: () => { espiao.deletes++; return Promise.resolve({ error: null }); } }),
    }),
  },
}));

const { useTutoriaisVistos } = await import('./useTutoriaisVistos');

beforeEach(() => {
  espiao.userId = 'u1';
  espiao.linhas = [];
  espiao.upserts = [];
  espiao.deletes = 0;
});

describe('useTutoriaisVistos', () => {
  it('só se diz carregado depois que a lista chega, e lê o que está no banco', async () => {
    espiao.linhas = [{ percurso: 'listagem' }];
    const { result } = renderHook(() => useTutoriaisVistos());

    expect(result.current.carregado).toBe(false);
    await waitFor(() => expect(result.current.carregado).toBe(true));
    expect(result.current.jaViu('listagem')).toBe(true);
    expect(result.current.jaViu('editor')).toBe(false);
  });

  it('marcar vale na hora e grava a linha da pessoa', async () => {
    const { result } = renderHook(() => useTutoriaisVistos());
    await waitFor(() => expect(result.current.carregado).toBe(true));

    act(() => result.current.marcarVisto('editor'));

    expect(result.current.jaViu('editor')).toBe(true);
    expect(espiao.upserts).toEqual([{ user_id: 'u1', percurso: 'editor' }]);
  });

  it('marcar duas vezes não grava duas vezes', async () => {
    const { result } = renderHook(() => useTutoriaisVistos());
    await waitFor(() => expect(result.current.carregado).toBe(true));

    act(() => result.current.marcarVisto('editor'));
    act(() => result.current.marcarVisto('editor'));

    // a segunda ainda dispara o upsert (idempotente no banco), mas a marca é uma só
    expect(result.current.jaViu('editor')).toBe(true);
  });

  it('esquecer apaga as linhas e volta ao início', async () => {
    espiao.linhas = [{ percurso: 'listagem' }, { percurso: 'editor' }];
    const { result } = renderHook(() => useTutoriaisVistos());
    await waitFor(() => expect(result.current.carregado).toBe(true));

    act(() => result.current.esquecer());

    expect(result.current.jaViu('listagem')).toBe(false);
    expect(espiao.deletes).toBe(1);
  });

  it('sem sessão não consulta o banco e fica em memória', async () => {
    espiao.userId = null;
    const { result } = renderHook(() => useTutoriaisVistos());

    await waitFor(() => expect(result.current.carregado).toBe(true));
    act(() => result.current.marcarVisto('listagem'));

    expect(result.current.jaViu('listagem')).toBe(true);
    expect(espiao.upserts).toEqual([]);
  });
});

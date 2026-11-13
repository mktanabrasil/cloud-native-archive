import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SELECT_PUBLICO } from '@/lib/events/camposPublicos';

/**
 * A conta de candidato (Trabalhe Conosco) não é equipe (13/11/2026).
 *
 * Com a sessão dela, o banco não entrega evento nenhum (regra restritiva
 * `events_so_a_equipe_logada`). A vitrine dela pede sem a sessão, só as
 * colunas públicas — o mesmo que a família recebe.
 */
const estado = vi.hoisted(() => ({
  auth: { isAuthenticated: true, loading: false, user: null as unknown },
  pedidos: [] as { cliente: string; colunas: string }[],
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useAvisosDoEvento', () => ({ processarAvisosPendentes: () => Promise.resolve() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
const cliente = (nome: string) => ({
  from: () => ({ select: (colunas: string) => { estado.pedidos.push({ cliente: nome, colunas }); return Promise.resolve({ data: [], error: null }); } }),
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: cliente('sessao') }));
vi.mock('@/lib/supabaseSemSessao', () => ({ supabaseSemSessao: () => cliente('sem-sessao') }));

const { AppProvider, useApp } = await import('./AppContext');
const montar = () => renderHook(() => useApp(), { wrapper: ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider> });

beforeEach(() => { estado.pedidos = []; });

describe('quem busca os eventos, e com qual sessão', () => {
  it('a equipe busca com a própria sessão e todas as colunas', async () => {
    estado.auth = { isAuthenticated: true, loading: false, user: { id: 'u1', user_metadata: {} } };
    montar();
    await waitFor(() => expect(estado.pedidos).toHaveLength(1));
    expect(estado.pedidos[0]).toEqual({ cliente: 'sessao', colunas: '*' });
  });

  it('a conta de candidato busca sem a sessão, só as colunas da vitrine', async () => {
    estado.auth = { isAuthenticated: true, loading: false, user: { id: 'u2', user_metadata: { conta: 'candidato' } } };
    montar();
    await waitFor(() => expect(estado.pedidos).toHaveLength(1));
    expect(estado.pedidos[0]).toEqual({ cliente: 'sem-sessao', colunas: SELECT_PUBLICO });
  });

  it('sem sessão, como sempre: o cliente de sempre, só as colunas da vitrine', async () => {
    estado.auth = { isAuthenticated: false, loading: false, user: null };
    montar();
    await waitFor(() => expect(estado.pedidos).toHaveLength(1));
    expect(estado.pedidos[0]).toEqual({ cliente: 'sessao', colunas: SELECT_PUBLICO });
  });
});

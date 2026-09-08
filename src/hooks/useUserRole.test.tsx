import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * O papel de quem está logado.
 *
 * Ao voltar de outra aba, o Supabase reconfere a sessão e avisa o app com um
 * evento de login, mesmo sem nada ter mudado. O contexto gravava um objeto de
 * usuário **novo** para a mesma pessoa, este hook via um "usuário novo",
 * voltava a `loading` e refazia as consultas — e a guarda da rota, enquanto
 * carregava, desmontava a página inteira. No Jornal, a unidade escolhida
 * voltava para a geral e o editor voltava para a lista (08/09/2026).
 *
 * Estes testes fixam que a mesma identidade não reinicia o hook.
 */
const espiao = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; user_metadata?: Record<string, unknown> },
  consultas: 0,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: espiao.user, isAuthenticated: !!espiao.user }),
}));
vi.mock('@/contexts/TestViewContext', () => ({ useTestView: () => ({ activePersona: null }) }));
vi.mock('@/integrations/supabase/client', () => {
  const resposta = (data: unknown) => Promise.resolve({ data, error: null });
  const cadeia = (data: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) c[m] = () => c;
    c.maybeSingle = () => { espiao.consultas++; return resposta(data); };
    return c;
  };
  return {
    supabase: {
      from: (tabela: string) =>
        tabela === 'user_roles'
          ? cadeia({ role: 'criador' })
          : tabela === 'profiles'
            ? cadeia({ permission_level: 'gestor_unidade', name: 'Gestora', is_active: true, unit: 'Santana', view_restrictions: null, delegated_units: [], is_beta_tester: false, bond_type: null })
            : cadeia(null),
    },
  };
});

const { useUserRole } = await import('./useUserRole');

beforeEach(() => {
  espiao.consultas = 0;
  espiao.user = { id: 'u1', email: 'gestora@ana.org' };
});

describe('useUserRole', () => {
  it('carrega o papel uma vez', async () => {
    const { result } = renderHook(() => useUserRole());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe('criador');
    expect(result.current.unit).toBe('Santana');
    const consultasIniciais = espiao.consultas;
    expect(consultasIniciais).toBeGreaterThan(0);
  });

  it('um objeto de usuário novo com a mesma identidade não volta a carregar nem reconsulta', async () => {
    const { result, rerender } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const consultasIniciais = espiao.consultas;

    // o que o Supabase faz ao voltar da aba: mesma pessoa, objeto novo
    espiao.user = { id: 'u1', email: 'gestora@ana.org', user_metadata: { atualizado: true } };
    rerender();
    await new Promise(r => setTimeout(r, 30));

    expect(result.current.loading).toBe(false);
    expect(result.current.role).toBe('criador');
    expect(espiao.consultas).toBe(consultasIniciais);
  });

  it('outra identidade recarrega de verdade', async () => {
    const { result, rerender } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const consultasIniciais = espiao.consultas;

    espiao.user = { id: 'u2', email: 'outra@ana.org' };
    rerender();

    await waitFor(() => expect(espiao.consultas).toBeGreaterThan(consultasIniciais));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('sair zera o papel', async () => {
    const { result, rerender } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));

    espiao.user = null;
    rerender();

    await waitFor(() => expect(result.current.role).toBeNull());
    expect(result.current.loading).toBe(false);
  });
});

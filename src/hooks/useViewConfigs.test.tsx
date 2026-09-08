import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * As configurações de visão por cargo só fazem sentido para quem está
 * logado; o visitante anônimo da página pública não tem cargo. Mesmo assim o
 * hook consultava `view_configs` para todo mundo e recebia a recusa do RLS:
 * tráfego e erro de console sem uso.
 */
const espiao = vi.hoisted(() => ({ autenticado: false, select: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: espiao.autenticado }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: espiao.select }) },
}));

const { useViewConfigs } = await import('./useViewConfigs');

const montar = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useViewConfigs(), { wrapper });
};

beforeEach(() => {
  espiao.select.mockReset();
  espiao.select.mockResolvedValue({ data: [{ key: 'enable_role_based_view', value: true }], error: null });
});

describe('useViewConfigs', () => {
  it('não consulta o banco para o visitante anônimo', async () => {
    espiao.autenticado = false;
    const { result } = montar();

    await new Promise(r => setTimeout(r, 50));

    expect(espiao.select).not.toHaveBeenCalled();
    expect(result.current.configs).toBeUndefined();
  });

  it('consulta para quem está logado', async () => {
    espiao.autenticado = true;
    const { result } = montar();

    await waitFor(() => expect(result.current.configs?.enable_role_based_view).toBe(true));
    expect(espiao.select).toHaveBeenCalledTimes(1);
  });
});

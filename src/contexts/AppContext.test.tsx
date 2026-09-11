import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
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
  lista: [] as unknown[],
  operacoes: [] as string[],
  apagados: [] as string[][],
  toastOk: vi.fn(),
  toastErro: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: espiao.toastOk, error: espiao.toastErro } }));
vi.mock('@/lib/events/anexos', async (original) => ({
  ...(await original<typeof import('@/lib/events/anexos')>()),
  apagarDoBalde: async (urls: string[]) => { espiao.apagados.push(urls); },
}));
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
        select: () => Promise.resolve({ data: espiao.lista, error: null }),
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
  espiao.lista = [];
  espiao.operacoes = [];
  espiao.apagados = [];
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

/**
 * Excluir de vez apagava a linha e deixava anexos e banners no balde, públicos
 * e sem ninguém apontando para eles. Agora eles vão junto — menos o que outro
 * evento ainda usa.
 */
describe('excluir de vez', () => {
  const B = 'https://supabase.anabrasil.org/storage/v1/object/public/event-attachments/';
  const base = { unit: 'DIC', title: 'x', start_datetime: '2026-10-01T10:00:00Z', end_datetime: '2026-10-01T12:00:00Z', status: 'confirmado', visibility: 'interno' };

  it('leva os arquivos do evento, e poupa o que outro evento compartilha', async () => {
    espiao.lista = [
      { ...base, id: 'e1', deleted_at: '2026-09-01T00:00:00Z', attachments: [`${B}anexos/a.pdf`], banner_image_desktop: `${B}banner.jpg`, event_logo_url: `${B}logo.png` },
      { ...base, id: 'e2', deleted_at: null, attachments: [], banner_image_desktop: `${B}banner.jpg` },
    ];
    espiao.linhas = [{ id: 'e1' }];
    const { result } = montar();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.deleteEvent('e1'));

    expect(espiao.operacoes).toContain('delete');
    expect(espiao.apagados).toEqual([[`${B}anexos/a.pdf`, `${B}logo.png`]]);
    expect(espiao.toastOk).toHaveBeenCalledWith('Evento excluído permanentemente');
  });

  it('sem arquivos, não chama o balde', async () => {
    espiao.lista = [{ ...base, id: 'e1', deleted_at: '2026-09-01T00:00:00Z', attachments: [] }];
    espiao.linhas = [{ id: 'e1' }];
    const { result } = montar();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.deleteEvent('e1'));

    expect(espiao.apagados).toEqual([]);
  });
});

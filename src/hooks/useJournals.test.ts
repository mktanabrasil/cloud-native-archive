import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * Espiões do cliente Supabase. Ficam em `vi.hoisted` porque `vi.mock` sobe
 * para o topo do módulo e não enxergaria um `const` comum.
 */
const espiao = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  rows: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        is: () => ({
          order: () => Promise.resolve({ data: espiao.rows, error: null }),
        }),
      }),
      update: (row: Record<string, unknown>) => {
        espiao.updates.push(row);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert: (row: Record<string, unknown>) => {
        espiao.inserts.push(row);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'novo' }, error: null }),
          }),
        };
      },
    }),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'usuario-1' } }),
}));

const { useJournals } = await import('./useJournals');

async function montar() {
  const { result } = renderHook(() => useJournals());
  await waitFor(() => expect(result.current.loading).toBe(false));
  espiao.updates.length = 0;
  espiao.inserts.length = 0;
  return result;
}

/** Última gravação enviada ao banco, já sem o ruído do carregamento inicial. */
const ultimoUpdate = () => espiao.updates.at(-1);

beforeEach(() => {
  espiao.updates.length = 0;
  espiao.inserts.length = 0;
  espiao.rows = [];
});

describe('useJournals', () => {
  /**
   * Regressão: a coluna `paper` existia no banco, mas o hook nunca a escrevia.
   * O fundo escolhido valia só enquanto o editor estava aberto e voltava ao
   * padrão na reabertura.
   */
  it('grava o fundo da folha escolhido', async () => {
    const result = await montar();
    await act(async () => {
      await result.current.save('jornal-1', { paper: 'branco' });
    });
    expect(ultimoUpdate()).toEqual({ paper: 'branco' });
  });

  it('grava o fundo junto com o resto da edição', async () => {
    const result = await montar();
    await act(async () => {
      await result.current.save('jornal-1', { name: 'Edição de agosto', paper: 'off_white' });
    });
    expect(ultimoUpdate()).toEqual({ name: 'Edição de agosto', paper: 'off_white' });
  });

  /**
   * Cada campo só entra na gravação quando foi informado — é o que permite
   * salvar o nome sem apagar o fundo já escolhido.
   */
  it('não toca no fundo quando a edição não o menciona', async () => {
    const result = await montar();
    await act(async () => {
      await result.current.save('jornal-1', { name: 'Só o nome' });
    });
    expect(ultimoUpdate()).not.toHaveProperty('paper');
  });

  /**
   * O caminho existia desde sempre no hook, mas nada o acionava: não havia
   * controle de status em lugar nenhum, e todo jornal morria como rascunho.
   */
  it('grava o status quando a edição é finalizada', async () => {
    const result = await montar();
    await act(async () => {
      await result.current.save('jornal-1', { status: 'finalizado' });
    });
    expect(ultimoUpdate()).toEqual({ status: 'finalizado' });
  });

  it('grava a volta para rascunho', async () => {
    const result = await montar();
    await act(async () => {
      await result.current.save('jornal-1', { status: 'rascunho' });
    });
    expect(ultimoUpdate()).toEqual({ status: 'rascunho' });
  });

  it('a cópia nasce com o mesmo fundo do original', async () => {
    const result = await montar();
    await act(async () => {
      await result.current.duplicate({
        id: 'jornal-1',
        name: 'Edição de agosto',
        unit_id: null,
        profile_unit: null,
        reference_month: null,
        status: 'finalizado',
        pages: [],
        paper: 'branco',
        created_by: null,
        created_at: '',
        updated_at: '',
      });
    });
    expect(espiao.inserts.at(-1)).toMatchObject({ paper: 'branco' });
  });
});

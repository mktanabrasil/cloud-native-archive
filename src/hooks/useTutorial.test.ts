import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const espiao = vi.hoisted(() => ({
  /** Resposta da consulta de leitura. */
  resposta: { data: null as unknown, error: null as unknown },
  upserts: [] as { linha: unknown; opcoes: unknown }[],
  usuario: { id: 'usuario-1' } as { id: string } | null,
}));

vi.mock('@/integrations/supabase/client', () => {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: () => Promise.resolve(espiao.resposta),
    upsert: (linha: unknown, opcoes: unknown) => {
      espiao.upserts.push({ linha, opcoes });
      return Promise.resolve({ error: null });
    },
  };
  return { supabase: { from: () => consulta } };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: espiao.usuario }),
}));

const { useTutorial } = await import('./useTutorial');

beforeEach(() => {
  espiao.resposta = { data: null, error: null };
  espiao.upserts.length = 0;
  espiao.usuario = { id: 'usuario-1' };
});

describe('useTutorial', () => {
  it('quem não tem marca no banco ainda não viu', async () => {
    const { result } = renderHook(() => useTutorial('jornal'));
    await waitFor(() => expect(result.current.pronto).toBe(true));
    expect(result.current.jaViu).toBe(false);
  });

  it('quem tem marca no banco já viu', async () => {
    espiao.resposta = { data: { tutorial: 'jornal' }, error: null };
    const { result } = renderHook(() => useTutorial('jornal'));
    await waitFor(() => expect(result.current.pronto).toBe(true));
    expect(result.current.jaViu).toBe(true);
  });

  /**
   * O caso que protege a publicação: enquanto a migração não roda, a consulta
   * falha. O tutorial é um extra — melhor não aparecer do que abrir em laço na
   * cara de quem só quer trabalhar.
   */
  it('erro de leitura conta como já visto, em vez de abrir sem parar', async () => {
    espiao.resposta = { data: null, error: { message: 'relation does not exist' } };
    const { result } = renderHook(() => useTutorial('jornal'));
    await waitFor(() => expect(result.current.pronto).toBe(true));
    expect(result.current.jaViu).toBe(true);
  });

  /** Sem usuário não há a quem atribuir a marca; nada é consultado nem gravado. */
  it('sem usuário não consulta nem grava', async () => {
    espiao.usuario = null;
    const { result } = renderHook(() => useTutorial('jornal'));
    expect(result.current.pronto).toBe(false);
    expect(result.current.jaViu).toBe(true);

    await act(async () => {
      await result.current.marcarVisto();
    });
    expect(espiao.upserts).toHaveLength(0);
  });

  it('marcar como visto grava a chave do tutorial junto do usuário', async () => {
    const { result } = renderHook(() => useTutorial('jornal'));
    await waitFor(() => expect(result.current.pronto).toBe(true));

    await act(async () => {
      await result.current.marcarVisto();
    });

    expect(result.current.jaViu).toBe(true);
    expect(espiao.upserts).toHaveLength(1);
    expect(espiao.upserts[0].linha).toEqual({ user_id: 'usuario-1', tutorial: 'jornal' });
  });

  /**
   * Quem reabre pelo botão de ajuda e termina de novo grava a mesma chave. Sem
   * ignorar o duplicado, a segunda gravação bateria na chave primária — e
   * atualizar exigiria uma permissão de UPDATE que a tabela não concede.
   */
  it('a segunda gravação ignora o duplicado, sem exigir UPDATE', async () => {
    const { result } = renderHook(() => useTutorial('jornal'));
    await waitFor(() => expect(result.current.pronto).toBe(true));

    await act(async () => {
      await result.current.marcarVisto();
      await result.current.marcarVisto();
    });

    expect(espiao.upserts).toHaveLength(2);
    espiao.upserts.forEach(({ opcoes }) =>
      expect(opcoes).toMatchObject({ ignoreDuplicates: true, onConflict: 'user_id,tutorial' }),
    );
  });
});

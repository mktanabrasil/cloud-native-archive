import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Gerar a senha pelo Painel (19/11/2026, PR 2 das senhas). O marketing e a
 * administração geral geram a senha de qualquer conta da equipe (padrão
 * FdGhJiuPn); a função `senha-gerar` faz tudo no servidor e devolve a senha
 * uma vez só.
 */
export interface SenhaNoPainel {
  user_id: string;
  /** Conta da equipe: a senha é gerada (as demais, administração geral e marketing, trocam a própria). */
  da_equipe: boolean;
  gerada_em: string | null;
  gerada_por_nome: string | null;
  origem: 'painel' | 'email' | null;
}

/** De cada conta, se é da equipe e a última senha gerada. Sem o SQL do PR 2, `null`. */
export async function lerSenhasDoPainel(): Promise<Map<string, SenhaNoPainel> | null> {
  try {
    const { data, error } = await (supabase as unknown as SupabaseClient).rpc('senhas_do_painel');
    if (error) return null;
    return new Map(((data ?? []) as SenhaNoPainel[]).map(s => [s.user_id, s]));
  } catch { return null; }
}

/** Gera a senha e devolve. Erro com a mensagem da função. */
export async function gerarSenhaDe(userId: string): Promise<{ senha: string; sessoesEncerradas: boolean }> {
  const { data, error } = await supabase.functions.invoke('senha-gerar', { body: { userId } });
  let detalhe = (data as { error?: string } | null)?.error ?? '';
  if (error && !detalhe) {
    const ctx = (error as { context?: Response }).context;
    try { detalhe = ctx ? ((await ctx.clone().json()) as { error?: string }).error ?? '' : ''; } catch { /* sem corpo */ }
  }
  if (error || detalhe) throw new Error(detalhe || 'A função de senhas não respondeu. Ela já foi publicada?');
  const r = data as { senha?: string; sessoes_encerradas?: boolean };
  if (!r?.senha) throw new Error('A função não devolveu a senha.');
  return { senha: r.senha, sessoesEncerradas: r.sessoes_encerradas !== false };
}

const FUSO = 'America/Sao_Paulo';
/** "gerada por MKT ANA · 19/11 às 10:42" / "gerada pelo e-mail · 19/11 às 09:14". */
export function textoDaUltimaSenha(s: Pick<SenhaNoPainel, 'gerada_em' | 'gerada_por_nome' | 'origem'>): string | null {
  if (!s.gerada_em) return null;
  const d = new Date(s.gerada_em);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${s.origem === 'email' ? 'gerada pelo e-mail' : `gerada por ${s.gerada_por_nome || 'Painel'}`} · ${dia} às ${hora}`;
}

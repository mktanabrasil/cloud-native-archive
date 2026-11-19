import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * O cadeado das senhas (19/11/2026, PR 1 das senhas). Toda conta da equipe,
 * menos a administração geral e o marketing, tem a senha definida pelo app:
 * a pessoa não escolhe nem troca. O banco recusa a troca (gatilho em
 * auth.users); aqui só o que a tela precisa saber.
 */
export const AVISO_DA_SENHA_TRANCADA =
  'A senha desta conta é definida pela administração e não pode ser trocada aqui. Se precisar de uma nova, fale com o marketing.';

/**
 * A troca recusada pelo cadeado, como o login devolve. O GoTrue esconde a
 * mensagem do banco: na troca da própria senha, devolve "Error during password
 * storage" (500); em outros caminhos, "Database error updating user".
 */
export function ehErroDeSenhaTrancada(erro: { message?: string; code?: string } | null | undefined): boolean {
  const m = erro?.message ?? '';
  return /senha_trancada/.test(m) || /error during password storage/i.test(m) || /database error (updating|saving) user/i.test(m);
}

/** "A minha senha é trancada?" Sem o SQL do cadeado, ou com erro, não. */
export async function minhaSenhaTrancada(): Promise<boolean> {
  try {
    const { data, error } = await (supabase as unknown as SupabaseClient).rpc('minha_senha_trancada');
    return !error && data === true;
  } catch { return false; }
}

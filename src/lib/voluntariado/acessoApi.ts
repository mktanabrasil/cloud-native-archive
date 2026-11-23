import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AcessoLiberado } from '@/components/administracao/QuemMaisVe';

/**
 * Quem mais vê o Voluntariado (23/11/2026; SQL 20261123100000): além do
 * vínculo e do marketing, os e-mails que a administração geral liberar.
 */
const db = supabase as unknown as SupabaseClient;

/** "Eu vejo o Voluntariado?" Sem o SQL, ou com erro, não (vale só o vínculo). */
export async function vejoVoluntariado(): Promise<boolean> {
  const { data, error } = await db.rpc('vejo_voluntariado');
  return !error && data === true;
}

/** Quem mais vê (só a administração geral lê). */
export async function lerAcessoDoVoluntariado(): Promise<AcessoLiberado[]> {
  const { data, error } = await db.rpc('acesso_voluntariado_lista');
  if (error) throw new Error(error.message);
  return (data ?? []) as AcessoLiberado[];
}

/** Libera ou tira o acesso de um e-mail (só a administração geral). */
export async function mudarAcessoDoVoluntariado(email: string, liberar: boolean): Promise<void> {
  const { error } = await db.rpc('acesso_voluntariado_mudar', { _email: email, _liberar: liberar });
  if (error) throw new Error(error.message);
}

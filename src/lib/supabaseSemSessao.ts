import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

let cliente: SupabaseClient<Database> | null = null;

/**
 * O mesmo banco, sem a sessão de quem está no navegador: o que um visitante vê.
 *
 * Para a conta de candidato (Trabalhe Conosco) que abre a vitrine dos eventos
 * logada (13/11/2026). Com a sessão dela, o banco não entrega evento nenhum
 * (ela não é da equipe); sem a sessão, recebe o que a família recebe. Criado
 * só quando alguém precisa, e sem guardar nada no navegador.
 */
export function supabaseSemSessao(): SupabaseClient<Database> {
  cliente ??= createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-sem-sessao' },
  });
  return cliente;
}

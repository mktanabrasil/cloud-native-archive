import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { comMaiusculas } from '@/lib/vagas/maiusculas';

/**
 * A conta do Calendário Anual (14/11/2026).
 *
 * As coordenadoras do Social preenchem o calendário com conta própria, no
 * mesmo esquema da conta de candidato: o mesmo Supabase Auth, mas a conta
 * nasce com `conta: 'calendario'` nos metadados. No banco, o desvio na
 * `handle_new_user` (migração 20261114100000) não cria perfil: o banco não
 * entrega nada da equipe a ela. No app, a mesma marca a leva sempre para
 * `/calendario`, de qualquer endereço.
 *
 * Criar a conta não basta para entrar: o e-mail precisa estar liberado pelo
 * marketing (`calendario_acessos`). Sem isso, ela entra e vê só o aviso.
 */
export const ROTA_DO_CALENDARIO = '/calendario';

export const ehContaDoCalendario = (u: Pick<User, 'user_metadata'> | null | undefined): boolean =>
  u?.user_metadata?.conta === 'calendario';

export async function entrarNoCalendario(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) throw error;
}

/** Primeiro acesso: cria a senha. Sem sessão de volta = falta confirmar o e-mail. */
export async function criarContaDoCalendario(nome: string, email: string, senha: string): Promise<{ precisaConfirmar: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: senha,
    options: {
      emailRedirectTo: `${window.location.origin}${ROTA_DO_CALENDARIO}`,
      data: { conta: 'calendario', name: comMaiusculas(nome, { pessoa: true }) },
    },
  });
  if (error) throw error;
  return { precisaConfirmar: !data.session };
}

/** O link de troca de senha volta para a tela de redefinir; de lá, para o calendário. */
export async function recuperarSenhaDoCalendario(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) throw error;
}

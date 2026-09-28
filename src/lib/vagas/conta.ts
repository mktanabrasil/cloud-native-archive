import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * A conta do candidato (Trabalhe Conosco, fase 2, PR 6 — 28/09/2026).
 *
 * Usa o mesmo Supabase Auth da equipe, mas nasce marcada com
 * `conta: 'candidato'` nos metadados. No banco, o desvio na `handle_new_user`
 * (migração 20260928120000) leva essa conta só para `candidatos`: sem perfil,
 * sem papel e sem pedido de acesso no Painel. No app, a mesma marca faz o
 * candidato ver o app como visitante e cair na área dele, não na da equipe.
 */

export const ROTAS_DO_CANDIDATO = {
  entrar: '/vagas/entrar',
  criarConta: '/vagas/criar-conta',
  recuperarSenha: '/vagas/recuperar-senha',
  minhaArea: '/vagas/minha-area',
  privacidade: '/vagas/privacidade',
} as const;

/**
 * Versão dos Termos e do Aviso de Privacidade que a pessoa aceita. É
 * provisória até o jurídico/DPO validar o texto; quando mudar, sobe aqui e a
 * nova versão fica gravada no aceite de quem criar conta depois.
 */
export const VERSAO_DOS_TERMOS = 'provisoria-2026-09';

export const ehCandidato = (u: Pick<User, 'user_metadata'> | null | undefined): boolean =>
  u?.user_metadata?.conta === 'candidato';

export const SENHA_MINIMA = 8;

export const emailValido = (t: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.trim());

/** O que falta na senha, ou null se está boa. */
export function problemaDaSenha(s: string): string | null {
  if (s.length < SENHA_MINIMA) return `Use pelo menos ${SENHA_MINIMA} caracteres.`;
  if (!/[A-Za-zÀ-ÿ]/.test(s) || !/\d/.test(s)) return 'Misture letras e números.';
  return null;
}

/** Mensagem para a pessoa a partir do erro do Supabase Auth. */
export function mensagemDaConta(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (t.includes('invalid login credentials')) return 'E-mail ou senha não conferem.';
  if (t.includes('already registered') || t.includes('already been registered')) return 'Já existe uma conta com esse e-mail. Entre ou recupere a senha.';
  if (t.includes('email not confirmed')) return 'Confirme o e-mail pelo link que enviamos antes de entrar.';
  if (t.includes('rate limit') || t.includes('security purposes')) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  if (t.includes('password')) return 'Essa senha não foi aceita. Use pelo menos 8 caracteres, com letras e números.';
  return 'Não deu certo agora. Confira a internet e tente de novo.';
}

export async function criarContaDeCandidato(nome: string, email: string, senha: string): Promise<{ precisaConfirmar: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: senha,
    options: {
      emailRedirectTo: `${window.location.origin}${ROTAS_DO_CANDIDATO.minhaArea}`,
      data: { conta: 'candidato', name: nome.trim().replace(/\s+/g, ' ') },
    },
  });
  if (error) throw error;
  // Sem sessão = o projeto pede confirmação por e-mail antes do primeiro acesso.
  if (!data.session) return { precisaConfirmar: true };
  await registrarAceite();
  return { precisaConfirmar: false };
}

/** Grava o aceite dos termos; se o gatilho não criou a linha, cria aqui. */
export async function registrarAceite(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('candidatos').upsert({
    user_id: user.id,
    nome: String(user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Candidato').slice(0, 120),
    email: user.email ?? '',
    aceite_termos_em: new Date().toISOString(),
    aceite_termos_versao: VERSAO_DOS_TERMOS,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function entrarComoCandidato(email: string, senha: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) throw error;
  return data.user;
}

export async function pedirNovaSenha(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) throw error;
}

/** Primeiro nome, para o "Olá, Leonardo". */
export const primeiroNome = (u: Pick<User, 'user_metadata' | 'email'> | null | undefined): string =>
  String(u?.user_metadata?.name ?? u?.email?.split('@')[0] ?? '').trim().split(/\s+/)[0] ?? '';

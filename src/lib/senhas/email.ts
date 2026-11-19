import { supabase } from '@/integrations/supabase/client';

/**
 * A senha pelo e-mail (19/11/2026, PR 3 das senhas): o "Esqueceu a senha?" e a
 * página "Gerar minha senha". Quem decide e gera é o servidor (senha-pedir e
 * senha-resgatar).
 */

async function detalheDoErro(error: unknown, data: unknown, padrao: string): Promise<string> {
  const doCorpo = (data as { error?: string } | null)?.error;
  if (doCorpo) return doCorpo;
  const ctx = (error as { context?: Response } | null)?.context;
  try { const j = ctx ? ((await ctx.clone().json()) as { error?: string }) : null; if (j?.error) return j.error; } catch { /* sem corpo */ }
  return padrao;
}

/** Pede o e-mail. A resposta é a mesma exista o e-mail ou não. */
export async function pedirSenhaNova(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('senha-pedir', { body: { email: email.trim().toLowerCase() } });
  if (error || (data as { error?: string } | null)?.error) throw new Error(await detalheDoErro(error, data, 'Não consegui pedir agora. Tente de novo em instantes.'));
}

/** Usa o código do e-mail: gera a senha e devolve, uma vez. */
export async function gerarMinhaSenha(token: string): Promise<{ senha: string; email: string | null }> {
  const { data, error } = await supabase.functions.invoke('senha-resgatar', { body: { token } });
  if (error || (data as { error?: string } | null)?.error || !(data as { senha?: string } | null)?.senha) {
    throw new Error(await detalheDoErro(error, data, 'Não consegui gerar a senha agora. Tente de novo em instantes.'));
  }
  const r = data as { senha: string; email?: string | null };
  return { senha: r.senha, email: r.email ?? null };
}

/** O código do link (?t=), se tiver o formato certo. */
export const codigoDoLink = (busca: string) => {
  const t = new URLSearchParams(busca).get('t') ?? '';
  return /^[A-Za-z0-9_-]{30,64}$/.test(t) ? t : null;
};

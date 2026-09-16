import { supabase } from '@/integrations/supabase/client';

/**
 * Sessão morta: o navegador guarda um token com validade no futuro, mas o
 * servidor de login já não tem a sessão (saiu em outro aparelho, renovação
 * concorrente, encerramento). Ler dados continua funcionando — o banco só
 * confere a assinatura —, mas tudo que pergunta "quem é essa pessoa?" ao
 * servidor (as Edge Functions, por exemplo) responde "não autorizado".
 *
 * Aqui fica a conferência e a saída: sair localmente, deixar um aviso para a
 * tela de login e deixar o roteador levar a pessoa para lá (16/09/2026).
 */

export const AVISO_DE_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo para continuar.';
const CHAVE = 'ana_aviso_login';

/** Os sinais do servidor de login de que a sessão não existe mais. */
export function sessaoMorta(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as { code?: string; status?: number; message?: string };
  const codigo = (e.code || '').toLowerCase();
  const msg = (e.message || '').toLowerCase();
  return codigo === 'session_not_found'
    || codigo === 'refresh_token_not_found'
    || codigo === 'invalid_grant'
    || codigo === 'user_not_found'
    || msg.includes('session from session_id claim') // texto do GoTrue para session_not_found
    || msg.includes('refresh token not found')
    || msg.includes('invalid refresh token');
}

export function guardarAvisoDeLogin(texto: string): void {
  try { sessionStorage.setItem(CHAVE, texto); } catch { /* aba sem armazenamento: o aviso só não aparece */ }
}

/** Lê e apaga o aviso: aparece uma vez, na tela de login. */
export function consumirAvisoDeLogin(): string | null {
  try {
    const t = sessionStorage.getItem(CHAVE);
    if (t) sessionStorage.removeItem(CHAVE);
    return t;
  } catch { return null; }
}

/**
 * Pergunta ao servidor se a sessão guardada ainda vale. Se não vale, sai
 * (só localmente — no servidor ela já não existe) e guarda o aviso. Devolve
 * true quando a sessão está viva, false quando a pessoa foi deslogada.
 * Erros de rede não derrubam ninguém: sem resposta, nada muda.
 */
export async function conferirSessao(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { error } = await supabase.auth.getUser();
  if (!error) return true;
  if (!sessaoMorta(error)) return true;
  guardarAvisoDeLogin(AVISO_DE_SESSAO_EXPIRADA);
  await supabase.auth.signOut({ scope: 'local' });
  return false;
}

/**
 * Para quem chamou uma função e recebeu "Não autorizado": confere a sessão e,
 * se ela morreu, a pessoa já está a caminho do login. Devolve true nesse caso,
 * para o chamador não mostrar um erro por cima.
 */
export async function tratarNaoAutorizado(): Promise<boolean> {
  const viva = await conferirSessao();
  return !viva;
}

import { supabase } from '@/integrations/supabase/client';
import type { Tipo } from '../../../supabase/functions/ouvidoria/regras.ts';

/**
 * Administração › Ouvidoria (26/11/2026): o cartão da ligação com o site. As
 * mensagens chegam só por e-mail; o app nunca recebe o conteúdo delas.
 */

export interface Pendente {
  protocolo: string;
  tipo: Tipo;
  criado_em: string;
  tentativas: number;
  ultimo_erro: string | null;
  proxima_tentativa: string;
}

/** O que a função `ouvidoria` devolve ao cartão ({ acao: 'estado' }). */
export interface EstadoDaOuvidoria {
  endereco: string;
  para: string;
  copia: string[];
  /** Quantas chegaram neste mês (horário de Brasília). */
  mes: number;
  ultima: { protocolo: string; criado_em: string } | null;
  ultimo_envio: string | null;
  /** E-mails que falharam ou estão atrasados (só protocolo, tipo e motivo). */
  pendentes: Pendente[];
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ouvidoria', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const estadoDaOuvidoria = () => chamar<EstadoDaOuvidoria>({ acao: 'estado' });
/** Tenta de novo, na hora, os e-mails que falharam. */
export const reenviarOuvidoria = () => chamar<EstadoDaOuvidoria & { enviados: number }>({ acao: 'reenviar' });

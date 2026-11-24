import { supabase } from '@/integrations/supabase/client';
import type { Cor } from '../../../supabase/functions/lembrete-registros/regras';

/** Um envio do lembrete (teste ou grupo), como a função `lembrete-registros` registra. */
export interface EnvioDoLembrete {
  criado_em: string;
  destino: 'grupo' | 'teste';
  origem: 'agendado' | 'painel';
  situacao: 'enviado' | 'falhou' | 'pulado';
  cor: Cor | null;
  com_como_enviar: boolean;
  detalhe: string | null;
}

export interface EstadoDoLembrete {
  configurado: boolean;
  ligado: boolean;
  grupo: string;
  /** O próximo dia útil do envio das 10h (AAAA-MM-DD). */
  proximo: string;
  /** O grupo já recebeu o lembrete completo hoje (o das 10h não manda de novo). */
  enviadoHoje: boolean;
  mensagem: string;
  modelo: string;
  envios: EnvioDoLembrete[];
}

/** Chama a função do lembrete como a pessoa logada, com a mensagem de erro dela. */
async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('lembrete-registros', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const estadoDoLembrete = () => chamar<EstadoDoLembrete>({ acao: 'estado' });
export const ligarLembrete = (ligado: boolean) => chamar<{ ligado: boolean }>({ acao: 'ligar', ligado });
export const salvarTextoDoLembrete = (mensagem: string, modelo: string) => chamar<{ ok: true }>({ acao: 'salvar', mensagem, modelo });
export const enviarLembrete = (destino: 'teste' | 'grupo', dia?: string) => chamar<{ ok: true }>({ acao: 'enviar', destino, ...(dia ? { dia } : {}) });

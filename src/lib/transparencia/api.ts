import { supabase } from '@/integrations/supabase/client';

/** Endereço público da API (o site do ANA lê daqui). */
export const ENDERECO_DA_API = 'https://supabase.anabrasil.org/functions/v1/transparencia';

/** Uma unidade como a API publica (resumo). */
export interface UnidadeNoSite {
  slug: string;
  nome: string;
  nome_curto: string;
  documentos: number;
  pastas: number;
  atualizado_em: string | null;
}

/** Situação da leitura de cada unidade (por id do cadastro). */
export interface SituacaoDaUnidade {
  config_id: string;
  erro: string | null;
  tentativa_em: string | null;
  falhando_desde: string | null;
  sujo: boolean;
}

/** O que a função `transparencia` devolve ao painel ({ acao: 'estado' }). */
export interface EstadoDoSite {
  ciclo_em: string | null;
  ciclo_erro: string | null;
  alerta_em: string | null;
  alerta_motivo: string | null;
  base: string;
  unidades: UnidadeNoSite[];
  situacao: SituacaoDaUnidade[];
}

export interface ResultadoDaAtualizacao {
  ocupado?: boolean;
  lidas?: string[];
  falhas?: string[];
  pendentes?: number;
  erro?: string | null;
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('transparencia', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const estadoDoSite = () => chamar<EstadoDoSite>({ acao: 'estado' });
/** Relê todas as unidades (aceita lista bem menor). O ciclo roda até ~45 s; o que faltar, o agendamento termina. */
export const atualizarSiteAgora = () => chamar<ResultadoDaAtualizacao>({ acao: 'atualizar' });

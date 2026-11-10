import { supabase } from '@/integrations/supabase/client';

export { ROTA_DA_RETIRADA, linkDaRetirada, numeroLido, semAcento } from './qr';

/** A retirada com leitor (10/11/2026): as chamadas ao banco. O QR Code está em qr.ts. */

// --- Banco ----------------------------------------------------------------------------------

export interface PedidoNaRetirada {
  numero: string;
  nome: string;
  unidade_nome: string;
  sabores: Record<string, number>;
  quantidade: number;
  retirada_em: string | null;
  retirada_por: string | null;
}

export type ResultadoDaRetirada =
  | { status: 'registrada'; pedido: PedidoNaRetirada }
  | { status: 'ja_retirada'; pedido: PedidoNaRetirada }
  | { status: 'nao_encontrado' };

/** Dá baixa (uma vez só: se já foi retirada, devolve quando e quem). */
export async function registrarRetirada(numero: string): Promise<ResultadoDaRetirada> {
  const { data, error } = await supabase.rpc('registrar_retirada_pizza', { p_numero: numero });
  if (error) throw error;
  return data as unknown as ResultadoDaRetirada;
}

/** Desfaz uma baixa feita no pedido errado. */
export async function desfazerRetirada(numero: string): Promise<void> {
  const { error } = await supabase.rpc('desfazer_retirada_pizza', { p_numero: numero });
  if (error) throw error;
}


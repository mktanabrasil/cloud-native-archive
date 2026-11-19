import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { tituloEmTexto } from '@/lib/events/titulo';
import { limitesDoMes } from '@/lib/rh/equipeNosEventos';
import type { EventoDoFinanceiro, Situacao } from './compras';

const db = supabase as unknown as SupabaseClient;

/** Os eventos do mês com compras da ANA (`financeiro_eventos`). `semBanco`: o SQL ainda não foi aplicado. */
export async function lerComprasDoMes(mes: string): Promise<EventoDoFinanceiro[]> {
  const { de, ate } = limitesDoMes(mes);
  const { data, error } = await db.rpc('financeiro_eventos', { _de: de, _ate: ate });
  if (error) {
    const semBanco = error.code === 'PGRST202' || (/financeiro_eventos/.test(error.message ?? '') && /find|exist/i.test(error.message ?? ''));
    throw Object.assign(new Error(semBanco ? 'semBanco' : error.message), { semBanco });
  }
  return ((data ?? []) as EventoDoFinanceiro[]).map(e => ({ ...e, title: tituloEmTexto(e.title ?? ''), food_items: e.food_items ?? [], itens: e.itens ?? [] }));
}

/** Marca a situação de um item (só o Financeiro e o marketing). */
export async function marcarItem(p: { eventoId: string; chave: string; situacao: Situacao; valor: number | null; fornecedor: string | null; assinatura: string }): Promise<void> {
  const { error } = await db.rpc('financeiro_marcar', {
    _event_id: p.eventoId, _chave: p.chave, _situacao: p.situacao, _valor: p.valor, _fornecedor: p.fornecedor, _assinatura: p.assinatura,
  });
  if (error) throw new Error(error.message);
}

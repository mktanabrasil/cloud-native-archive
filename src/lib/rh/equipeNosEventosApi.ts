import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { tituloEmTexto } from '@/lib/events/titulo';
import { limitesDoMes, type EventoDaEquipe } from './equipeNosEventos';

const db = supabase as unknown as SupabaseClient;

/**
 * Os eventos do mês com funcionários (função `rh_eventos_da_equipe`, que só
 * responde ao RH). `semBanco`: o SQL do PR 3 ainda não foi aplicado.
 */
export async function lerEventosDaEquipe(mes: string): Promise<EventoDaEquipe[]> {
  const { de, ate } = limitesDoMes(mes);
  const { data, error } = await db.rpc('rh_eventos_da_equipe', { _de: de, _ate: ate });
  if (error) {
    const semBanco = error.code === 'PGRST202' || /rh_eventos_da_equipe/.test(error.message ?? '') && /find|exist/i.test(error.message ?? '');
    throw Object.assign(new Error(semBanco ? 'semBanco' : error.message), { semBanco });
  }
  // O título vem com o marcador de quebra (<br>) do formulário: aqui ele é só texto.
  return ((data ?? []) as EventoDaEquipe[]).map(e => ({ ...e, title: tituloEmTexto(e.title ?? ''), equipe_funcionarios: e.equipe_funcionarios ?? [], equipe_conferida: e.equipe_conferida ?? null }));
}

/**
 * Marca ou desmarca o evento como conferido pelo RH. Guarda a equipe que o RH
 * VIU na tela: se a unidade trocou os nomes nesse meio-tempo, o evento volta a
 * aparecer como "a equipe mudou depois da conferência".
 */
export async function conferirEvento(id: string, conferido: boolean, equipeVista: string[]): Promise<void> {
  const { error } = await db.rpc('rh_conferir_evento', { _id: id, _conferido: conferido, _equipe: equipeVista });
  if (error) throw new Error(error.message);
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppEvent, VoluntarioDoEvento } from '@/types';

/**
 * Troca só a equipe de um evento já confirmado (a unidade ou a comunicação).
 * O banco confere quem pede; sem linha de volta, não trocou.
 */
export async function trocarEquipeDoEvento(id: string, funcionarios: string[], voluntarios: VoluntarioDoEvento[]): Promise<AppEvent> {
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc('trocar_equipe_do_evento', { _id: id, _funcionarios: funcionarios, _voluntarios: voluntarios });
  if (error) throw error;
  const linha = (data as AppEvent[] | null)?.[0];
  if (!linha) throw new Error('Este evento não existe mais ou foi para a lixeira.');
  return linha;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { digitosDoWhatsapp } from '@/lib/events/equipe';
import { tituloEmTexto } from '@/lib/events/titulo';
import { limitesDoMes } from '@/lib/rh/equipeNosEventos';
import type { Confirmacao, EventoDoVoluntariado } from './voluntariado';

const db = supabase as unknown as SupabaseClient;
const COLUNAS = 'id, nome, whatsapp, primeiro_evento_id, criado_em, criado_por_nome';

type ErroDoBanco = { code?: string; message?: string } | null;
/** O SQL do PR 4 ainda não foi aplicado (a função ou a tabela não existem). */
const faltaBanco = (e: ErroDoBanco) =>
  !!e && (e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || (/voluntari/.test(e.message ?? '') && /find|exist|schema cache/i.test(e.message ?? '')));
const falha = (e: NonNullable<ErroDoBanco>) => Object.assign(new Error(faltaBanco(e) ? 'semBanco' : e.message ?? 'Erro'), { semBanco: faltaBanco(e) });

/**
 * Os eventos confirmados ou concluídos com voluntários (função
 * `voluntariado_eventos`, que só responde ao Voluntariado e ao marketing).
 * Sem mês: todos, para a lista geral.
 */
export async function lerEventosDoVoluntariado(mes: string | null): Promise<EventoDoVoluntariado[]> {
  const args = mes ? { _de: limitesDoMes(mes).de, _ate: limitesDoMes(mes).ate } : {};
  const { data, error } = await db.rpc('voluntariado_eventos', args);
  if (error) throw falha(error);
  // O título vem com o marcador de quebra (<br>) do formulário: aqui ele é só texto.
  return ((data ?? []) as EventoDoVoluntariado[]).map(e => ({ ...e, title: tituloEmTexto(e.title ?? ''), equipe_voluntarios: e.equipe_voluntarios ?? [] }));
}

/** Quem já foi confirmado. */
export async function lerConfirmacoes(): Promise<Confirmacao[]> {
  const { data, error } = await db.from('voluntarios').select(COLUNAS).order('nome');
  if (error) throw falha(error);
  return (data ?? []) as Confirmacao[];
}

/**
 * Marca a pessoa (nome + WhatsApp) como confirmada. Se alguém confirmou nesse
 * meio-tempo, devolve `null`: quem chamou relê a lista.
 */
export async function confirmarVoluntario(v: { nome: string; whatsapp: string; primeiro_evento_id?: string | null }): Promise<Confirmacao | null> {
  const { data, error } = await db.from('voluntarios')
    .insert({ nome: v.nome.trim(), whatsapp: digitosDoWhatsapp(v.whatsapp), primeiro_evento_id: v.primeiro_evento_id ?? null })
    .select(COLUNAS).single();
  if (error) {
    if (error.code === '23505') return null;
    throw falha(error);
  }
  return data as Confirmacao;
}

/** Desfaz a confirmação (os eventos continuam como estão). */
export async function desfazerConfirmacao(id: string): Promise<void> {
  const { error } = await db.from('voluntarios').delete().eq('id', id);
  if (error) throw falha(error);
}

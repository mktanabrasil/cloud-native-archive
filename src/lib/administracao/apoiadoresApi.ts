import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { tituloEmTexto } from '@/lib/events/titulo';
import type { EventoComApoiadores } from './apoiadores';

const db = supabase as unknown as SupabaseClient;
type ErroDoBanco = { code?: string; message?: string };
/** O SQL do PR 6 ainda não foi aplicado. */
const faltaBanco = (e: ErroDoBanco) => e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42883' || /apoiadores/.test(e.message ?? '') && /find|exist|schema cache/i.test(e.message ?? '');
const falha = (e: ErroDoBanco) => Object.assign(new Error(faltaBanco(e) ? 'semBanco' : e.message ?? 'Erro'), { semBanco: faltaBanco(e) });

/** Os eventos com padrinhos, doadores, empresas ou instituições (`apoiadores_dos_eventos`). */
export async function lerApoiadores(): Promise<EventoComApoiadores[]> {
  const { data, error } = await db.rpc('apoiadores_dos_eventos');
  if (error) throw falha(error);
  // O título vem com o marcador de quebra (<br>) do formulário: aqui ele é só texto.
  return ((data ?? []) as EventoComApoiadores[]).map(e => ({
    ...e, title: tituloEmTexto(e.title ?? ''), partners: e.partners ?? [], external_collaborators: e.external_collaborators ?? [],
  }));
}

/** "Eu vejo Padrinhos e Parceiros?" Sem o SQL, ou com erro, não. */
export async function vejoApoiadores(): Promise<boolean> {
  const { data, error } = await db.rpc('vejo_apoiadores');
  return !error && data === true;
}

export interface AcessoLiberado { email: string; adicionado_em: string; adicionado_por: string | null }

/** Quem mais vê (só o admin lê). */
export async function lerAcesso(): Promise<AcessoLiberado[]> {
  const { data, error } = await db.rpc('acesso_apoiadores_lista');
  if (error) throw falha(error);
  return (data ?? []) as AcessoLiberado[];
}

/** Libera ou tira o acesso de um e-mail (só o admin). */
export async function mudarAcesso(email: string, liberar: boolean): Promise<void> {
  const { error } = await db.rpc('acesso_apoiadores_mudar', { _email: email, _liberar: liberar });
  if (error) throw falha(error);
}

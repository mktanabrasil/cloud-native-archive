import type { User } from '@supabase/supabase-js';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import { ROTA_DO_CALENDARIO, ehContaDoCalendario } from '@/lib/calendario/conta';

/**
 * As contas que entram no app sem ser da equipe (14/11/2026): a de candidato
 * (Trabalhe Conosco) e a do Calendário Anual. Nenhuma tem perfil no banco;
 * no app, cada uma tem um endereço só, e qualquer rota da equipe a devolve
 * para lá.
 */
export function destinoDaContaRestrita(u: Pick<User, 'user_metadata'> | null | undefined): string | null {
  if (ehCandidato(u)) return ROTAS_DO_CANDIDATO.minhaArea;
  if (ehContaDoCalendario(u)) return ROTA_DO_CALENDARIO;
  return null;
}

export const ehContaRestrita = (u: Pick<User, 'user_metadata'> | null | undefined): boolean => destinoDaContaRestrita(u) !== null;

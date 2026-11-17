import type { User } from '@supabase/supabase-js';

/**
 * A conta antiga "só do Calendário Anual" (14/11 a 17/11/2026).
 *
 * Por três dias, as coordenadoras puderam criar uma conta só para o
 * calendário (`conta: 'calendario'` nos metadados, sem perfil no banco). Desde
 * 17/11/2026 o calendário é uma página do setor Social, preenchida pela gestão
 * de cada unidade com a conta da equipe; não há mais entrada nem lista
 * própria. Quem ainda entrar com uma conta dessas vê um aviso (ver
 * `CalendarioAnualPage`), e qualquer rota da equipe a devolve para lá.
 */
export const ROTA_DO_CALENDARIO = '/social/calendario';

export const ehContaDoCalendario = (u: Pick<User, 'user_metadata'> | null | undefined): boolean =>
  u?.user_metadata?.conta === 'calendario';

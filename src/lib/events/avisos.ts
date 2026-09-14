import type { AppEvent } from '@/types';

/**
 * Avisos por e-mail: o que a tela e a função do servidor combinam.
 *
 * A fila (`avisos_de_evento`) nasce de um gatilho no banco; a Edge Function
 * `eventos-aviso` envia. Aqui ficam as regras puras que os dois lados
 * seguem — destinatários e tipo do aviso — para a tela explicar o que vai
 * acontecer e os testes fixarem a decisão de 14/09/2026.
 */

export type TipoDeAviso = 'confirmado' | 'cancelado' | 'alterado';
export type StatusDoAviso = 'pendente' | 'enviado' | 'falhou';

export interface AvisoDeEvento {
  id: string;
  event_id: string;
  tipo: TipoDeAviso;
  status: StatusDoAviso;
  destinatarios: string[];
  erro: string | null;
  tentativas: number;
  criado_em: string;
  enviado_em: string | null;
}

/** As caixas da ANA que recebem sempre, seja quem for que preencheu. */
export const SEMPRE_RECEBEM = [
  'mkt@anabrasil.org',
  'contato@anabrasil.org',
  'parceiros@anabrasil.org',
  'eventos@anabrasil.org',
] as const;

export interface PerfilParaAviso {
  email: string | null;
  name: string | null;
  unit: string | null;
  is_active: boolean | null;
  permission_level: string | null;
}

/**
 * Quem recebe o aviso de um evento: as caixas fixas, os perfis ativos da
 * unidade do evento (a unidade vem do pedido de acesso, então o sistema já
 * sabe quem é da DIC, de Nilópolis e de Santana), e quem criou. Sem repetir,
 * em minúsculas. Leitores ("usuario_padrao") ficam de fora: não gerem nada.
 */
export function destinatariosDoAviso(
  evento: Pick<AppEvent, 'unit' | 'created_by'>,
  perfis: PerfilParaAviso[],
): string[] {
  const lista = new Set<string>(SEMPRE_RECEBEM);
  const norm = (e: string | null | undefined) => (e || '').trim().toLowerCase();

  for (const p of perfis) {
    if (!p.email || p.is_active === false) continue;
    const daUnidade = !!p.unit && p.unit === evento.unit && p.unit !== 'Administração' && p.permission_level !== 'usuario_padrao';
    const criou = !!p.name && !!evento.created_by && p.name.trim().toLowerCase() === evento.created_by.trim().toLowerCase();
    if (daUnidade || criou) lista.add(norm(p.email));
  }
  return Array.from(lista).filter(Boolean);
}

/**
 * Espelho do gatilho do banco, para a tela e os testes:
 * confirmado quando vira confirmado; cancelado quando um confirmado vai para
 * cancelado ou lixeira; alterado quando um confirmado muda data, horário ou
 * local. Qualquer outra mudança: nenhum aviso.
 */
export function tipoDoAviso(
  antes: Pick<AppEvent, 'status' | 'deleted_at' | 'start_datetime' | 'end_datetime' | 'location'> | null,
  depois: Pick<AppEvent, 'status' | 'deleted_at' | 'start_datetime' | 'end_datetime' | 'location'>,
): TipoDeAviso | null {
  const confirmado = (e: typeof depois) => e.status === 'confirmado' && !e.deleted_at;
  const esta = confirmado(depois);
  if (!antes) return esta ? 'confirmado' : null;
  const era = confirmado(antes);
  if (esta && !era) return 'confirmado';
  if (era && !esta && (depois.status === 'cancelado' || !!depois.deleted_at)) return 'cancelado';
  if (era && esta && (
    antes.start_datetime !== depois.start_datetime ||
    antes.end_datetime !== depois.end_datetime ||
    (antes.location || '') !== (depois.location || '')
  )) return 'alterado';
  return null;
}

export const ROTULO_DO_TIPO: Record<TipoDeAviso, string> = {
  confirmado: 'Evento confirmado',
  cancelado: 'Evento cancelado',
  alterado: 'Data alterada',
};

/** "Aviso enviado a 7 endereços" / "a 1 endereço". */
export const textoDeEnviado = (n: number) => `Aviso enviado a ${n === 1 ? '1 endereço' : `${n} endereços`}`;

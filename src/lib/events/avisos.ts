import type { AppEvent } from '@/types';

/**
 * Avisos por e-mail: o que a tela e a função do servidor combinam.
 *
 * A fila (`avisos_de_evento`) nasce de um gatilho no banco; a Edge Function
 * `eventos-aviso` envia. Aqui ficam as regras puras que os dois lados
 * seguem — destinatários e tipo do aviso — para a tela explicar o que vai
 * acontecer e os testes fixarem a decisão de 14/09/2026.
 */

/** "atualizado" = título/descrição/visibilidade/unidade de um confirmado mudou: só agenda, sem e-mail. */
/** "devolvido" (13/11/2026): o e-mail para quem enviou, quando a administração devolve. */
export type TipoDeAviso = 'confirmado' | 'cancelado' | 'alterado' | 'atualizado' | 'devolvido';
export type StatusDoAviso = 'pendente' | 'enviado' | 'falhou' | 'ignorado';

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
  /** O passo "agenda do Google", independente do e-mail (15/09/2026). */
  agenda_status?: StatusDoAviso;
  agenda_erro?: string | null;
  agenda_em?: string | null;
  agenda_link?: string | null;
}

/**
 * As caixas da ANA que recebem sempre, seja quem for que preencheu. adm@ e
 * financeiro@ entraram em 13/11/2026 (pedido de 16/09). Espelho de
 * `SEMPRE_RECEBEM` em supabase/functions/eventos-aviso/fila.ts.
 */
export const SEMPRE_RECEBEM = [
  'mkt@anabrasil.org',
  'contato@anabrasil.org',
  'parceiros@anabrasil.org',
  'eventos@anabrasil.org',
  'adm@anabrasil.org',
  'financeiro@anabrasil.org',
] as const;

/** "mkt@, contato@, …, adm@ e financeiro@": as caixas fixas, para os textos do Painel. */
export const CAIXAS_FIXAS_EM_TEXTO = (() => {
  const curtas = SEMPRE_RECEBEM.map(e => e.slice(0, e.indexOf('@') + 1));
  return `${curtas.slice(0, -1).join(', ')} e ${curtas[curtas.length - 1]}`;
})();

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
    // Sem nível de acesso, fora — como no Painel e na função (13/11/2026).
    if (!p.email || p.is_active === false || !p.permission_level) continue;
    // Evento do Grupo ANA Brasil (11/11/2026) avisa as gestoras das três unidades.
    const daUnidade = !!p.unit && p.unit !== 'Administração' && p.permission_level !== 'usuario_padrao'
      && (p.unit === evento.unit || (evento.unit === 'Grupo ANA Brasil' && ['DIC', 'Nilópolis', 'Santana'].includes(p.unit)));
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
type CamposDoGatilho = Pick<AppEvent, 'status' | 'deleted_at' | 'start_datetime' | 'end_datetime' | 'location'> &
  Partial<Pick<AppEvent, 'title' | 'description' | 'visibility' | 'unit'>>;

export function tipoDoAviso(antes: CamposDoGatilho | null, depois: CamposDoGatilho): TipoDeAviso | null {
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
  if (era && esta && (
    (antes.title ?? '') !== (depois.title ?? '') ||
    (antes.description ?? '') !== (depois.description ?? '') ||
    (antes.visibility ?? '') !== (depois.visibility ?? '') ||
    (antes.unit ?? '') !== (depois.unit ?? '')
  )) return 'atualizado';
  return null;
}

export const ROTULO_DO_TIPO: Record<TipoDeAviso, string> = {
  confirmado: 'Evento confirmado',
  cancelado: 'Evento cancelado',
  alterado: 'Data alterada',
  atualizado: 'Detalhes atualizados',
  devolvido: 'Devolução',
};

/** "Aviso enviado a 7 endereços" / "a 1 endereço". */
export const textoDeEnviado = (n: number) => `Aviso enviado a ${n === 1 ? '1 endereço' : `${n} endereços`}`;

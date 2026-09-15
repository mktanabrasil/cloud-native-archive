import type { AppEvent } from '@/types';
import type { AvisoDeEvento } from './avisos';

/**
 * Agenda do Google: o que a tela mostra a partir do evento e do último aviso.
 *
 * O robô (função `eventos-aviso`) grava em `events.google_event_link` o que
 * criou no Google e, em cada aviso, o estado do passo "agenda". Aqui fica a
 * leitura pura desses dois lados, para o painel de detalhe, o cartão e os
 * testes falarem a mesma língua (decisões de 15/09/2026).
 */

export type EstadoDaAgenda = 'sincronizado' | 'aguardando' | 'falhou' | 'removido';

export interface LeituraDaAgenda {
  estado: EstadoDaAgenda;
  /** Também está na agenda pública "Programação ANA". */
  publico: boolean;
  link: string | null;
  erro: string | null;
  /** ISO do momento que a tela mostra (quando sincronizou, ou quando entrou na fila). */
  quando: string;
}

type EventoParaAgenda = Pick<AppEvent, 'status' | 'deleted_at' | 'google_event_id' | 'google_event_link' | 'google_public_event_id'>;
type AvisoParaAgenda = Pick<AvisoDeEvento, 'agenda_status' | 'agenda_erro' | 'agenda_em' | 'agenda_link' | 'criado_em'>;

/**
 * null = nada a mostrar: evento que nunca foi confirmado, ou aviso anterior à
 * agenda existir ("ignorado" sem nada no Google).
 */
export function leituraDaAgenda(evento: EventoParaAgenda, ultimo: AvisoParaAgenda | null): LeituraDaAgenda | null {
  const confirmado = evento.status === 'confirmado' && !evento.deleted_at;
  const noGoogle = !!evento.google_event_id;

  if (!confirmado) {
    // Cancelado ou na lixeira: só vale a pena dizer algo se ele já esteve lá.
    if (ultimo?.agenda_status === 'enviado' && !noGoogle) return { estado: 'removido', publico: false, link: null, erro: null, quando: ultimo.agenda_em || ultimo.criado_em };
    if (ultimo?.agenda_status === 'falhou') return { estado: 'falhou', publico: false, link: null, erro: ultimo.agenda_erro || null, quando: ultimo.criado_em };
    if (ultimo?.agenda_status === 'pendente') return { estado: 'aguardando', publico: false, link: null, erro: null, quando: ultimo.criado_em };
    return null;
  }

  if (ultimo?.agenda_status === 'falhou') return { estado: 'falhou', publico: false, link: evento.google_event_link || null, erro: ultimo.agenda_erro || null, quando: ultimo.criado_em };
  if (ultimo?.agenda_status === 'pendente') return { estado: 'aguardando', publico: false, link: evento.google_event_link || null, erro: null, quando: ultimo.criado_em };
  if (noGoogle) return { estado: 'sincronizado', publico: !!evento.google_public_event_id, link: evento.google_event_link || null, erro: null, quando: ultimo?.agenda_em || ultimo?.criado_em || '' };
  return null;
}

export const ROTULO_DA_AGENDA: Record<EstadoDaAgenda, string> = {
  sincronizado: 'Na agenda do Google',
  aguardando: 'Agenda do Google aguardando',
  falhou: 'Não entrou na agenda do Google',
  removido: 'Removido da agenda do Google',
};

/** "Enviar os 14 confirmados que faltam" / "Enviar o 1 confirmado que falta" / "Todos os confirmados já estão na agenda". */
export function textoDaCarga(faltam: number): string {
  if (faltam <= 0) return 'Todos os confirmados já estão na agenda';
  if (faltam === 1) return 'Enviar o 1 confirmado que falta';
  return `Enviar os ${faltam} confirmados que faltam`;
}

export interface ContagemDaAgenda { confirmados: number; naAgenda: number; faltam: number; comErro: number }

/** Conta, sobre a lista de eventos já carregada no app, o que está e o que falta no Google. */
export function contagemDaAgenda(eventos: Array<Pick<AppEvent, 'status' | 'deleted_at' | 'google_event_id'>>, avisosComErro: number): ContagemDaAgenda {
  const confirmados = eventos.filter(e => e.status === 'confirmado' && !e.deleted_at);
  const naAgenda = confirmados.filter(e => !!e.google_event_id).length;
  return { confirmados: confirmados.length, naAgenda, faltam: confirmados.length - naAgenda, comErro: avisosComErro };
}

import type { AppEvent } from '@/types';

/**
 * O estado do pedido de cobertura, para o detalhe e para a conta do transporte.
 *
 * Pedir cobertura não garante presença: a equipe de marketing é pequena e
 * atende todas as unidades. A resposta é `marketing_confirmed` — `null` a
 * confirmar, `true` presente, `false` sem marketing. Em todo caso, o registro
 * do evento (fotos e vídeos pelo celular) é da unidade.
 */

export type EstadoDaCobertura = 'nao-pedida' | 'a-confirmar' | 'confirmada' | 'sem-marketing';

export function estadoDaCobertura(e: Partial<Pick<AppEvent, 'marketing_request' | 'marketing_coverage' | 'marketing_confirmed'>>): EstadoDaCobertura {
  if (!e.marketing_request || !e.marketing_coverage) return 'nao-pedida';
  if (e.marketing_confirmed === true) return 'confirmada';
  if (e.marketing_confirmed === false) return 'sem-marketing';
  return 'a-confirmar';
}

/** O texto curto do badge, por estado. */
export const ROTULO_DA_COBERTURA: Record<Exclude<EstadoDaCobertura, 'nao-pedida'>, string> = {
  'a-confirmar': 'presença a confirmar',
  'confirmada': 'marketing confirmado',
  'sem-marketing': 'sem marketing — registro pela unidade',
};

/**
 * A vaga do marketing no transporte: existe enquanto a cobertura foi pedida
 * e o marketing não disse não. "A confirmar" reserva a vaga — é mais barato
 * sobrar um lugar do que faltar.
 */
export function vagaDoMarketing(e: Partial<Pick<AppEvent, 'marketing_request' | 'marketing_coverage' | 'marketing_confirmed'>>): 0 | 1 {
  const estado = estadoDaCobertura(e);
  return estado === 'a-confirmar' || estado === 'confirmada' ? 1 : 0;
}

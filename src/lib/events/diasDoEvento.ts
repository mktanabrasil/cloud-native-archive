import { eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';

/**
 * Em que dias um evento aparece no calendário.
 *
 * Até 11/09/2026 o calendário só olhava `start_datetime`: uma colônia de
 * férias de 13 a 17 ocupava a célula do dia 13 e mais nada. Quem olhava o
 * dia 15 via vazio e agendava em cima; o conflito só aparecia depois.
 *
 * Aqui o evento entra em cada dia entre o início e o fim, em hora local.
 * Um fim antes do início (dado antigo, ou um `end_datetime` inválido) vale
 * como um dia só. E há um teto: um evento com fim digitado errado, em 2099,
 * não pode pintar a grade inteira.
 */
const TETO_DE_DIAS = 62;

interface Periodo {
  start_datetime: string;
  end_datetime: string;
}

export function diasDoEvento(e: Periodo): Date[] {
  const inicio = startOfDay(new Date(e.start_datetime));
  if (Number.isNaN(inicio.getTime())) return [];
  let fim = startOfDay(new Date(e.end_datetime));
  if (Number.isNaN(fim.getTime()) || fim < inicio) fim = inicio;
  const dias = eachDayOfInterval({ start: inicio, end: fim });
  return dias.length > TETO_DE_DIAS ? dias.slice(0, TETO_DE_DIAS) : dias;
}

/** O evento acontece neste dia (começa, termina ou passa por ele). */
export function ocorreNoDia(e: Periodo, dia: Date): boolean {
  const inicio = startOfDay(new Date(e.start_datetime));
  if (Number.isNaN(inicio.getTime())) return false;
  let fim = startOfDay(new Date(e.end_datetime));
  if (Number.isNaN(fim.getTime()) || fim < inicio) fim = inicio;
  const d = startOfDay(dia);
  return d >= inicio && d <= fim && diasDoEvento(e).some(x => isSameDay(x, d));
}

/** É o primeiro dia do evento: o que tem a borda colorida e aceita arrasto. */
export const eDiaDeInicio = (e: Periodo, dia: Date): boolean => isSameDay(new Date(e.start_datetime), dia);

/** É o último dia de um evento que passou por mais de um. */
export function eDiaDeFim(e: Periodo, dia: Date): boolean {
  const dias = diasDoEvento(e);
  return dias.length > 1 && isSameDay(dias[dias.length - 1], dia);
}

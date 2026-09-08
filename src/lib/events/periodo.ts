import { format, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AppEvent } from '@/types';

/**
 * Data e horário do evento como texto, no card e no detalhe.
 *
 * Até 08/09/2026 os dois mostravam só a data de início e "HH:mm às HH:mm":
 * um retiro de sexta a domingo parecia acabar no mesmo dia. Aqui o evento de
 * vários dias diz quando termina; o de um dia continua exatamente como era.
 */
type Periodo = Pick<AppEvent, 'start_datetime' | 'end_datetime'>;

const datas = (e: Periodo) => ({ ini: new Date(e.start_datetime), fim: new Date(e.end_datetime) });

/** Início e término em dias diferentes. Mesma régua da aba "Já aconteceram". */
export const variosDias = (e: Periodo): boolean => {
  const { ini, fim } = datas(e);
  return !isSameDay(ini, fim);
};

const dia = (d: Date) => format(d, 'd', { locale: ptBR });
const diaMes = (d: Date) => format(d, "d 'de' MMMM", { locale: ptBR });
const diaMesAno = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/**
 * "10 de outubro de 2026", "10 a 12 de outubro de 2026",
 * "30 de outubro a 2 de novembro de 2026", "30 de dezembro de 2026 a 2 de janeiro de 2027".
 * Sem ano (detalhe): as mesmas formas, sem o "de yyyy".
 */
export const textoDaData = (e: Periodo, { comAno = true }: { comAno?: boolean } = {}): string => {
  const { ini, fim } = datas(e);
  const completo = comAno ? diaMesAno : diaMes;
  if (!variosDias(e)) return completo(ini);
  if (isSameMonth(ini, fim)) return `${dia(ini)} a ${completo(fim)}`;
  if (isSameYear(ini, fim) || !comAno) return `${diaMes(ini)} a ${completo(fim)}`;
  return `${diaMesAno(ini)} a ${diaMesAno(fim)}`;
};

/**
 * Um dia: "08:00 às 16:00" (card) ou "08:00 - 16:00" (detalhe), como sempre foi.
 * Vários dias: "Começa às 08:00, termina às 16:00" — o separador muda para o
 * do detalhe (" · ") quando pedido.
 */
export const textoDoHorario = (e: Periodo, { separador = ' às ' }: { separador?: string } = {}): string => {
  const { ini, fim } = datas(e);
  const h = (d: Date) => format(d, 'HH:mm');
  if (!variosDias(e)) return `${h(ini)}${separador}${h(fim)}`;
  const virgula = separador.trim() === '-' ? ' · ' : ', ';
  return `Começa às ${h(ini)}${virgula}termina às ${h(fim)}`;
};

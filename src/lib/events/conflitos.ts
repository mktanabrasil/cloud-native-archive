import type { AppEvent } from '@/types';

/**
 * Conflito de horário, calculado — não gravado.
 *
 * `has_conflict` era escrito no banco ao salvar: nos dois eventos, quando um
 * novo batia com outro. Mover um deles para outro dia não limpava o outro, e
 * a bandeira vermelha ficava para sempre; arrastar no calendário e mudar
 * status em lote nem passavam pela detecção. Eventos na lixeira ainda
 * contavam para o admin (a política dele não filtra `deleted_at`).
 *
 * Aqui a bandeira nasce das datas, na leitura: dois eventos conflitam se se
 * sobrepõem no tempo, nenhum está cancelado nem na lixeira, e estão no mesmo
 * âmbito — a mesma unidade, ou um deles é da Administração, que conflita com
 * todas. A coluna `has_conflict` continua no banco por compatibilidade; o
 * que a tela mostra vem daqui.
 */

const ativo = (e: AppEvent) => e.status !== 'cancelado' && !e.deleted_at;

const mesmoAmbito = (a: AppEvent, b: AppEvent) =>
  a.unit === b.unit || a.unit === 'Administração' || b.unit === 'Administração';

const sobrepoem = (a: AppEvent, b: AppEvent) => {
  const aIni = new Date(a.start_datetime).getTime();
  const aFim = new Date(a.end_datetime).getTime();
  const bIni = new Date(b.start_datetime).getTime();
  const bFim = new Date(b.end_datetime).getTime();
  if ([aIni, aFim, bIni, bFim].some(Number.isNaN)) return false;
  return aIni < bFim && bIni < aFim;
};

/** `a` e `b` conflitam entre si. */
export function conflitam(a: AppEvent, b: AppEvent): boolean {
  if (a.id === b.id) return false;
  if (!ativo(a) || !ativo(b)) return false;
  return mesmoAmbito(a, b) && sobrepoem(a, b);
}

/** Com quem `evento` conflita dentro de `todos` (ele próprio fica de fora). */
export function conflitosDe(evento: AppEvent, todos: AppEvent[]): AppEvent[] {
  return todos.filter(outro => conflitam(evento, outro));
}

/**
 * A lista inteira com `has_conflict` recalculado. O que vier do banco na
 * coluna é ignorado — é exatamente a bandeira velha que queremos esquecer.
 */
export function marcarConflitos(eventos: AppEvent[]): AppEvent[] {
  return eventos.map(e => ({ ...e, has_conflict: conflitosDe(e, eventos).length > 0 }));
}

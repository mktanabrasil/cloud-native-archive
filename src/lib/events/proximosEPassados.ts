import type { AppEvent } from '@/types';

/**
 * Separa a vitrine em "Próximos" e "Já aconteceram".
 *
 * A grade pública ordenava tudo por data crescente e não olhava o dia: em
 * setembro, um evento de março abria a página, embaixo do texto que promete
 * "os próximos eventos". O herói já escondia os passados; a grade, não.
 *
 * A regra olha o **término**, não o início: um retiro de sexta a domingo
 * continua em "Próximos" até o domingo, e um evento de hoje fica lá o dia
 * inteiro, mesmo depois de acabar — é a mesma janela que o herói usa
 * (00:00 de hoje). Só passa para "Já aconteceram" quem terminou antes de
 * hoje começar.
 */
export type Aba = 'proximos' | 'passados';

export const inicioDoDia = (agora: Date): Date => {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const jaAconteceu = (evento: Pick<AppEvent, 'end_datetime'>, agora: Date = new Date()): boolean =>
  new Date(evento.end_datetime).getTime() < inicioDoDia(agora).getTime();

const porInicio = (a: AppEvent, b: AppEvent) =>
  new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();

/** Próximos em ordem crescente (o mais perto primeiro); passados em decrescente (o mais recente primeiro). */
export const separarPorData = (
  eventos: AppEvent[],
  agora: Date = new Date(),
): { proximos: AppEvent[]; passados: AppEvent[] } => {
  const proximos: AppEvent[] = [];
  const passados: AppEvent[] = [];
  for (const e of eventos) (jaAconteceu(e, agora) ? passados : proximos).push(e);
  proximos.sort(porInicio);
  passados.sort((a, b) => porInicio(b, a));
  return { proximos, passados };
};

/**
 * Qual aba abrir quando ninguém escolheu ainda.
 *
 * Se só há passados, abrir em "Próximos" mostraria uma grade vazia com a
 * programação inteira escondida numa aba ao lado; nesse caso abre em
 * "Já aconteceram". Nos demais, "Próximos".
 */
export const abaInicial = (proximos: number, passados: number): Aba =>
  proximos === 0 && passados > 0 ? 'passados' : 'proximos';

export const lerAba = (valor: string | null): Aba | null =>
  valor === 'passados' || valor === 'proximos' ? valor : null;

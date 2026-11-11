import type { Unit } from '@/types';

/**
 * Grupo ANA Brasil (11/11/2026, pedido dele): a unidade do evento geral, com
 * todas as unidades juntas — o Natal Feliz, por exemplo. Ela já tinha
 * existido (maio de 2026) e fora fundida na Administração em julho; voltou
 * só para eventos.
 *
 * Decisões de 11/11/2026: cor grafite (#484848); o evento do Grupo aparece no
 * filtro de todas as unidades e avisa por e-mail as gestoras das três.
 */
export const GRUPO: Unit = 'Grupo ANA Brasil';

/** As unidades que o Grupo abrange: as que têm gestora e chip na vitrine. */
export const UNIDADES_DO_GRUPO: Unit[] = ['DIC', 'Nilópolis', 'Santana'];

/**
 * A cor do texto sobre a cor da unidade (selos). As quatro são claras e levam
 * texto escuro; o grafite do Grupo leva texto branco (no escuro, o Grupo vira
 * cinza-claro e o texto volta a escuro, pela variável).
 */
export const tintaNaCorDaUnidade = (unidade: string): string =>
  unidade === GRUPO ? 'text-[hsl(var(--unit-grupo-ink))]' : 'text-slate-900';

/** O evento entra no filtro desta unidade? O do Grupo entra no de todas. */
export const eventoNaUnidade = (unidadeDoEvento: string, filtro: string): boolean =>
  unidadeDoEvento === filtro || (unidadeDoEvento === GRUPO && (UNIDADES_DO_GRUPO as string[]).includes(filtro));

import { findNewsUnit } from './units';

/**
 * A unidade que o Jornal está mostrando, na URL: `?unidade=ana-santana`.
 *
 * Até 10/09/2026 ela vivia só na memória da página. Qualquer coisa que
 * remontasse a página (voltar de outra aba, até o #93) ou recarregasse a aba
 * devolvia a pessoa para a unidade dela. Na URL, a escolha sobrevive ao
 * recarregamento e vira um link direto para a unidade.
 *
 * `null` é a "Institucional geral", que na URL se escreve `geral`.
 */
export const PARAMETRO_UNIDADE = 'unidade';
export const GERAL = 'geral';

/**
 * Lê o parâmetro. Devolve `undefined` quando não há escolha na URL (ou ela não
 * corresponde a unidade nenhuma), para quem chama usar a unidade padrão; `null`
 * para a geral; o id quando é uma unidade conhecida.
 */
export function lerUnidadeDaUrl(valor: string | null): string | null | undefined {
  if (valor === null || valor === '') return undefined;
  if (valor === GERAL) return null;
  return findNewsUnit(valor) ? valor : undefined;
}

/** O que gravar na URL para uma unidade. */
export const escreverUnidadeNaUrl = (unitId: string | null): string => unitId ?? GERAL;

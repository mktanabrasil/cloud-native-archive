/**
 * O aviso depois de uma ação em lote.
 *
 * A barra de seleção disparava uma gravação por evento sem esperar nem
 * capturar erro, e sumia como se tudo tivesse dado certo. Aqui as gravações
 * rodam juntas (`Promise.allSettled`) e um aviso só conta o que gravou e o
 * que o banco recusou — quase sempre um evento já confirmado, que a gestora
 * não altera (`events_gestor_update`).
 */

export interface ResultadoDoLote {
  /** Ids que gravaram. */
  feitos: string[];
  /** Ids que o banco recusou; continuam selecionados para a pessoa ver quais. */
  recusados: string[];
}

export async function executarEmLote(ids: string[], acao: (id: string) => Promise<unknown>): Promise<ResultadoDoLote> {
  const resultados = await Promise.allSettled(ids.map(id => acao(id)));
  const feitos: string[] = [];
  const recusados: string[] = [];
  resultados.forEach((r, i) => (r.status === 'fulfilled' ? feitos : recusados).push(ids[i]));
  return { feitos, recusados };
}

/** Frases por número: `feito(3)` → "3 eventos movidos para a lixeira". */
export interface FrasesDoLote {
  feito: (n: number) => string;
  naoFeito: (n: number) => string;
  /** Por que o banco recusou, em uma frase. */
  motivo: string;
}

export const MOTIVO_PADRAO = 'já estão confirmados pela administração, ou fora da sua unidade.';

/**
 * Título e descrição do aviso. Só o título quando tudo deu certo; quando
 * nada deu, o título é a recusa.
 */
export function textoDoLote(r: ResultadoDoLote, frases: FrasesDoLote): { titulo: string; descricao?: string; tudoRecusado: boolean } {
  if (r.feitos.length === 0) {
    return { titulo: frases.naoFeito(r.recusados.length), descricao: frases.motivo, tudoRecusado: true };
  }
  const titulo = frases.feito(r.feitos.length);
  if (r.recusados.length === 0) return { titulo, tudoRecusado: false };
  return { titulo, descricao: `${frases.naoFeito(r.recusados.length)}: ${frases.motivo}`, tudoRecusado: false };
}

const n = (q: number, um: string, varios: string) => (q === 1 ? `1 ${um}` : `${q} ${varios}`);

export const FRASES_LIXEIRA: FrasesDoLote = {
  feito: q => `${n(q, 'evento movido', 'eventos movidos')} para a lixeira`,
  naoFeito: q => `${n(q, 'evento não pôde ser movido', 'eventos não puderam ser movidos')}`,
  motivo: MOTIVO_PADRAO,
};

export const frasesDeStatus = (status: string): FrasesDoLote => ({
  feito: q => `${n(q, 'evento alterado', 'eventos alterados')} para "${status}"`,
  naoFeito: q => `${n(q, 'evento não pôde ser alterado', 'eventos não puderam ser alterados')}`,
  motivo: MOTIVO_PADRAO,
});

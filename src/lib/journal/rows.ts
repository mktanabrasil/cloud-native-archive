import type { JournalBlock } from './types';

/** Colunas da grade da folha — espelha o `grid-cols-6` do `JournalPageView`. */
export const GRID_COLUMNS = 6;

/**
 * Agrupa os blocos em fileiras, do jeito que o CSS Grid os quebra na tela.
 *
 * O modelo não tem noção de linha: `JournalPage.blocks` é uma lista plana, e a
 * fileira emerge do auto-flow do grid. Como o `JournalPageView` não usa
 * `grid-auto-flow: dense`, a regra é direta — os blocos entram na ordem e a
 * linha quebra quando a soma dos `span` passaria de seis.
 *
 * Derivar isso do modelo, e não do DOM, é o que permite achar a vizinha de um
 * bloco sem medir nada e sem depender do zoom do canvas.
 */
export function journalRows(blocks: Pick<JournalBlock, 'id' | 'span'>[]): string[][] {
  const rows: string[][] = [];
  let atual: string[] = [];
  let ocupado = 0;

  for (const block of blocks) {
    // Um span maior que a grade não existe pelo tipo, mas se existisse ocuparia
    // a linha inteira — o clamp evita um laço com fileira vazia.
    const span = Math.max(1, Math.min(GRID_COLUMNS, block.span));

    if (ocupado > 0 && ocupado + span > GRID_COLUMNS) {
      rows.push(atual);
      atual = [];
      ocupado = 0;
    }

    atual.push(block.id);
    ocupado += span;
  }

  if (atual.length > 0) rows.push(atual);
  return rows;
}

/**
 * Os outros blocos da mesma fileira. Vazio quando o bloco ocupa a linha sozinho.
 */
export function rowSiblings(
  blocks: Pick<JournalBlock, 'id' | 'span'>[],
  blockId: string,
): string[] {
  const row = journalRows(blocks).find((ids) => ids.includes(blockId));
  return row ? row.filter((id) => id !== blockId) : [];
}

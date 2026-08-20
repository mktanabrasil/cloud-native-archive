import { describe, expect, it } from 'vitest';
import { journalRows, rowSiblings } from './rows';

/** O helper só olha `id` e `span`; o resto do bloco não importa aqui. */
const b = (id: string, span: number) => ({ id, span: span as never });

describe('fileiras da grade', () => {
  it('duas imagens de 3 colunas ficam na mesma fileira', () => {
    expect(journalRows([b('a', 3), b('b', 3)])).toEqual([['a', 'b']]);
  });

  it('três de 2 colunas também fecham uma fileira', () => {
    expect(journalRows([b('a', 2), b('b', 2), b('c', 2)])).toEqual([['a', 'b', 'c']]);
  });

  it('quebra a linha quando a soma passaria de seis', () => {
    expect(journalRows([b('a', 4), b('b', 3)])).toEqual([['a'], ['b']]);
  });

  /**
   * O caso que o editor produz ao alargar um bloco. O `a` de quatro colunas
   * deixa duas sobrando, mas o `b` de três não cabe e desce. O `c` de duas
   * também não volta para o buraco: sem `grid-auto-flow: dense`, o preenchimento
   * é só para frente.
   */
  it('não volta para preencher o buraco deixado na fileira anterior', () => {
    expect(journalRows([b('a', 4), b('b', 3), b('c', 2)])).toEqual([['a'], ['b', 'c']]);
  });

  it('um bloco de seis ocupa a fileira sozinho', () => {
    expect(journalRows([b('t', 6), b('a', 3), b('b', 3)])).toEqual([['t'], ['a', 'b']]);
  });

  it('sequência de largura um enche a fileira até seis', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(journalRows(ids.map((id) => b(id, 1)))).toEqual([
      ['a', 'b', 'c', 'd', 'e', 'f'],
      ['g'],
    ]);
  });

  it('lista vazia não produz fileira nenhuma', () => {
    expect(journalRows([])).toEqual([]);
  });

  /** Todo bloco aparece uma vez só, e na ordem original. */
  it('preserva a ordem e não duplica nem perde bloco', () => {
    const blocks = [b('a', 3), b('b', 4), b('c', 2), b('d', 6), b('e', 1)];
    const planos = journalRows(blocks).flat();
    expect(planos).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('vizinhas de fileira', () => {
  it('devolve a outra imagem do par', () => {
    expect(rowSiblings([b('a', 3), b('b', 3)], 'a')).toEqual(['b']);
    expect(rowSiblings([b('a', 3), b('b', 3)], 'b')).toEqual(['a']);
  });

  it('devolve as duas outras numa fileira de três', () => {
    const blocks = [b('a', 2), b('b', 2), b('c', 2)];
    expect(rowSiblings(blocks, 'b')).toEqual(['a', 'c']);
  });

  it('não devolve vizinha para bloco que ocupa a linha inteira', () => {
    expect(rowSiblings([b('t', 6), b('a', 3), b('b', 3)], 't')).toEqual([]);
  });

  it('não atravessa a quebra de linha', () => {
    // 'b' cai sozinho na segunda fileira: não é vizinho de 'a'
    expect(rowSiblings([b('a', 4), b('b', 3)], 'a')).toEqual([]);
  });

  it('devolve vazio para id que não existe', () => {
    expect(rowSiblings([b('a', 3), b('b', 3)], 'inexistente')).toEqual([]);
  });
});

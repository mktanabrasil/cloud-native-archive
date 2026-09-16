import { describe, expect, it } from 'vitest';
import { avisoDeFotosSemMedida, linhaDoTransbordo, mensagemDoErroDoPdf, tituloDoTransbordo } from './errosDoPdf';

describe('mensagemDoErroDoPdf', () => {
  it('canvas contaminado vira "uma foto da página N"', () => {
    const m = mensagemDoErroDoPdf(new Error('contaminado na folha 2 de 6 · limpa sem fotos · 3 imagens embutidas'));
    expect(m.descricao).toMatch(/foto da página 2/);
    expect(m.descricao).not.toMatch(/contaminad/);
  });

  it('folha vazia vira falta de memória, com a saída leve', () => {
    const m = mensagemDoErroDoPdf(new Error('a folha 4 de 6 voltou vazia na escala 3'));
    expect(m.descricao).toMatch(/memória para a página 4/);
    expect(m.descricao).toMatch(/Para enviar por WhatsApp/);
  });

  it('nenhuma escala e erro desconhecido têm frase própria, sem texto técnico', () => {
    expect(mensagemDoErroDoPdf(new Error('nenhuma escala funcionou')).descricao).toMatch(/computador/);
    const m = mensagemDoErroDoPdf(new TypeError('Cannot read properties of undefined'));
    expect(m.descricao).not.toMatch(/undefined/);
  });
});

describe('avisoDeFotosSemMedida', () => {
  it('conta fotos e nomeia as páginas', () => {
    expect(avisoDeFotosSemMedida(new Map())).toBeNull();
    expect(avisoDeFotosSemMedida(new Map([[3, 1]]))?.titulo).toBe('O PDF saiu sem 1 foto da página 3');
    expect(avisoDeFotosSemMedida(new Map([[3, 2], [5, 1]]))?.titulo).toBe('O PDF saiu sem 3 fotos das páginas 3 e 5');
  });
});

describe('transbordo antes do PDF', () => {
  it('título e linhas concordam em número', () => {
    expect(tituloDoTransbordo([{ indice: 2, pecasFora: 2 }])).toBe('A página 3 tem conteúdo que não cabe');
    expect(tituloDoTransbordo([{ indice: 2, pecasFora: 2 }, { indice: 4, pecasFora: 1 }])).toBe('2 páginas têm conteúdo que não cabe');
    expect(linhaDoTransbordo({ indice: 0, pecasFora: 1 })).toBe('1 peça não cabe');
    expect(linhaDoTransbordo({ indice: 0, pecasFora: 3 })).toBe('3 peças não cabem');
  });
});

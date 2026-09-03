import { describe, expect, it } from 'vitest';
import { createPage, JOURNAL_MODELS } from './templates';
import type { JournalBlock, JournalPage } from './types';

/**
 * A galeria tinha duas composições para a mesma coisa.
 *
 * Pelo "Adicionar página" ela vinha com uma linha de introdução e uma imagem de
 * largura cheia que a do modelo não tinha — e esses dois blocos a mais faziam a
 * última fileira de fotos terminar 10px abaixo da área visível, onde o rodapé a
 * comia. Medido na folha real: área até 1022px, última fileira em 1032px.
 */

const forma = (blocos: JournalBlock[]) =>
  blocos.map(b => (b.kind === 'image' ? `imagem ${b.span} ${b.ratio}` : `${b.kind} ${b.span}`));

const galeriasDosModelos = (): JournalPage[] =>
  JOURNAL_MODELS.flatMap(m => m.build()).filter(p => p.template === 'galeria');

describe('a página de galeria', () => {
  it('tem a mesma composição pelas duas portas de entrada', () => {
    const avulsa = createPage('galeria');
    const dosModelos = galeriasDosModelos();

    expect(dosModelos.length).toBeGreaterThan(0);
    for (const pagina of dosModelos) {
      expect(forma(pagina.blocks)).toEqual(forma(avulsa.blocks));
    }
  });

  it('não leva imagem de largura cheia — era ela que estourava a folha', () => {
    const imagens = createPage('galeria').blocks.filter(b => b.kind === 'image');

    expect(imagens).toHaveLength(4);
    expect(imagens.every(i => i.span === 3)).toBe(true);
  });

  it('deixa cada modelo com o seu próprio título', () => {
    const titulos = galeriasDosModelos().map(p => {
      const primeiro = p.blocks[0];
      return primeiro.kind === 'text' ? primeiro.content : '';
    });

    expect(new Set(titulos).size).toBe(titulos.length);
    expect(titulos.every(t => t.trim().length > 0)).toBe(true);
  });
});

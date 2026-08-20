import { describe, expect, it } from 'vitest';
import { createPage, setDecorationsOnAllPages } from './templates';
import { createDecorationPair, type JournalPage } from './types';

const jornal = (): JournalPage[] => [createPage('capa'), createPage('materia'), createPage('galeria')];

describe('formas do jornal', () => {
  it('grava o par em todas as páginas, não só na ativa', () => {
    const paginas = setDecorationsOnAllPages(jornal(), createDecorationPair('elemento_01'));
    expect(paginas).toHaveLength(3);
    paginas.forEach((page) => {
      expect(page.decorations?.map((d) => d.corner)).toEqual([
        'inferior_esquerdo',
        'inferior_direito',
      ]);
      expect(page.decorations?.every((d) => d.element === 'elemento_01')).toBe(true);
    });
  });

  it('a troca de cor de um lado vale para o jornal inteiro', () => {
    const comPar = setDecorationsOnAllPages(jornal(), createDecorationPair('elemento_02'));
    const alterado = comPar[0].decorations!.map((d) =>
      d.corner === 'inferior_direito' ? { ...d, color: 'azul' as const } : d,
    );
    const paginas = setDecorationsOnAllPages(comPar, alterado);
    paginas.forEach((page) => {
      expect(page.decorations?.find((d) => d.corner === 'inferior_direito')?.color).toBe('azul');
      expect(page.decorations?.find((d) => d.corner === 'inferior_esquerdo')?.color).toBe('areia');
    });
  });

  it('remover um lado mantém o outro em todas as páginas', () => {
    const comPar = setDecorationsOnAllPages(jornal(), createDecorationPair('elemento_01'));
    const restante = comPar[0].decorations!.filter((d) => d.corner !== 'inferior_esquerdo');
    setDecorationsOnAllPages(comPar, restante).forEach((page) => {
      expect(page.decorations).toHaveLength(1);
      expect(page.decorations?.[0].corner).toBe('inferior_direito');
    });
  });

  /** Lista vazia some do JSON em vez de virar array vazio. */
  it('remover as duas apaga o campo', () => {
    const comPar = setDecorationsOnAllPages(jornal(), createDecorationPair('elemento_01'));
    const limpo = setDecorationsOnAllPages(comPar, []);
    limpo.forEach((page) => expect(page.decorations).toBeUndefined());
    expect(JSON.stringify(limpo)).not.toContain('decorations');
  });

  /** Converge mesmo se uma página tiver nascido antes da forma existir. */
  it('corrige páginas divergentes na operação seguinte', () => {
    const [capa, ...resto] = setDecorationsOnAllPages(jornal(), createDecorationPair('elemento_01'));
    const divergente: JournalPage[] = [capa, ...resto.map((p) => ({ ...p, decorations: undefined }))];
    setDecorationsOnAllPages(divergente, capa.decorations!).forEach((page) =>
      expect(page.decorations).toHaveLength(2),
    );
  });
});

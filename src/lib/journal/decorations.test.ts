import { describe, expect, it } from 'vitest';
import { createPage, setDecorationsOnAllPages } from './templates';
import { createDecorationSet, type JournalPage } from './types';

const jornal = (): JournalPage[] => [createPage('capa'), createPage('materia'), createPage('galeria')];

describe('formas do jornal', () => {
  it('grava o conjunto em todas as páginas, não só na ativa', () => {
    const paginas = setDecorationsOnAllPages(jornal(), createDecorationSet('elemento_01'));
    expect(paginas).toHaveLength(3);
    paginas.forEach((page) => {
      expect(page.decorations?.map((d) => d.corner)).toEqual([
        'superior_esquerdo',
        'superior_direito',
        'inferior_esquerdo',
        'inferior_direito',
      ]);
      expect(page.decorations?.every((d) => d.element === 'elemento_01')).toBe(true);
    });
  });

  it('a troca de cor de um canto vale para o jornal inteiro', () => {
    const comFormas = setDecorationsOnAllPages(jornal(), createDecorationSet('elemento_02'));
    const alterado = comFormas[0].decorations!.map((d) =>
      d.corner === 'superior_direito' ? { ...d, color: 'azul' as const } : d,
    );
    setDecorationsOnAllPages(comFormas, alterado).forEach((page) => {
      expect(page.decorations?.find((d) => d.corner === 'superior_direito')?.color).toBe('azul');
      expect(page.decorations?.find((d) => d.corner === 'superior_esquerdo')?.color).toBe('areia');
      expect(page.decorations?.find((d) => d.corner === 'inferior_direito')?.color).toBe('areia');
    });
  });

  it('remover um canto mantém os outros em todas as páginas', () => {
    const comFormas = setDecorationsOnAllPages(jornal(), createDecorationSet('elemento_01'));
    const restante = comFormas[0].decorations!.filter((d) => d.corner !== 'superior_esquerdo');
    setDecorationsOnAllPages(comFormas, restante).forEach((page) => {
      expect(page.decorations).toHaveLength(3);
      expect(page.decorations?.map((d) => d.corner)).not.toContain('superior_esquerdo');
    });
  });

  /** Lista vazia some do JSON em vez de virar array vazio. */
  it('remover as quatro apaga o campo', () => {
    const comFormas = setDecorationsOnAllPages(jornal(), createDecorationSet('elemento_01'));
    const limpo = setDecorationsOnAllPages(comFormas, []);
    limpo.forEach((page) => expect(page.decorations).toBeUndefined());
    expect(JSON.stringify(limpo)).not.toContain('decorations');
  });

  /** Converge mesmo se uma página tiver nascido antes da forma existir. */
  it('corrige páginas divergentes na operação seguinte', () => {
    const [capa, ...resto] = setDecorationsOnAllPages(jornal(), createDecorationSet('elemento_01'));
    const divergente: JournalPage[] = [capa, ...resto.map((p) => ({ ...p, decorations: undefined }))];
    setDecorationsOnAllPages(divergente, capa.decorations!).forEach((page) =>
      expect(page.decorations).toHaveLength(4),
    );
  });

  /**
   * Jornais gravados antes dos cantos de cima existirem continuam com duas
   * formas. Nada os migra: eles seguem válidos, e só passam a ter quatro se
   * alguém escolher uma forma de novo ou repor os que faltam.
   */
  it('aceita jornais antigos com apenas os dois cantos de baixo', () => {
    const antigo = createDecorationSet('elemento_03').filter((d) => d.corner.startsWith('inferior'));
    setDecorationsOnAllPages(jornal(), antigo).forEach((page) => {
      expect(page.decorations).toHaveLength(2);
      expect(page.decorations?.map((d) => d.corner)).toEqual([
        'inferior_esquerdo',
        'inferior_direito',
      ]);
    });
  });
});

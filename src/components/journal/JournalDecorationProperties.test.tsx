import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JournalDecorationProperties } from './JournalDecorationProperties';
import { JOURNAL_COLOR_LABELS, type JournalColorKey } from '@/lib/journal/types';

const forma = (color: JournalColorKey) =>
  ({ element: 'elemento_03', corner: 'inferior_esquerdo', color }) as const;

function abrir(unitId: string | null, color: JournalColorKey = 'areia') {
  return render(
    <JournalDecorationProperties
      decoration={forma(color)}
      unitId={unitId}
      onChangeColor={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
}

/** Cores oferecidas na paleta, pelo rótulo de cada bolinha. */
const oferecidas = () =>
  Object.values(JOURNAL_COLOR_LABELS).filter((label) => screen.queryByRole('button', { name: label }));

describe('paleta da forma por segmento', () => {
  it('unidade de Educação oferece tinta e três cores de marca', () => {
    abrir('cei-pierre-weil');
    expect(oferecidas()).toEqual([
      JOURNAL_COLOR_LABELS.tinta,
      JOURNAL_COLOR_LABELS.areia,
      JOURNAL_COLOR_LABELS.amarelo,
      JOURNAL_COLOR_LABELS.coral,
    ]);
  });

  it('unidade do Social oferece a paleta inteira', () => {
    abrir('ana-dic');
    expect(oferecidas()).toHaveLength(6);
    expect(screen.getByRole('button', { name: JOURNAL_COLOR_LABELS.azul })).toBeInTheDocument();
  });

  it('sem unidade vale o padrão neutro, com as cinco', () => {
    abrir(null);
    expect(oferecidas()).toHaveLength(6);
  });

  /**
   * Um jornal de CEI pintado de azul antes da regra. A cor fica — o que muda é
   * a oferta —, e o aviso existe para a pessoa não achar que a tela quebrou ao
   * ver uma cor que não está na paleta.
   */
  describe('cor aplicada fora do segmento', () => {
    it('avisa, nomeando a cor e o segmento', () => {
      abrir('cei-pierre-weil', 'azul');
      const aviso = screen.getByText(/não faz parte das cores/i);
      expect(aviso).toHaveTextContent(/azul ana/i);
      expect(aviso).toHaveTextContent(/Educação/);
    });

    it('não oferece a cor de volta na paleta', () => {
      abrir('cei-pierre-weil', 'azul');
      expect(
        screen.queryByRole('button', { name: JOURNAL_COLOR_LABELS.azul }),
      ).not.toBeInTheDocument();
    });

    it('fica calado quando a cor pertence ao segmento', () => {
      abrir('cei-pierre-weil', 'coral');
      expect(screen.queryByText(/não faz parte das cores/i)).not.toBeInTheDocument();
    });

    it('fica calado no Social, onde todas as cores valem', () => {
      abrir('ana-dic', 'azul');
      expect(screen.queryByText(/não faz parte das cores/i)).not.toBeInTheDocument();
    });
  });
});

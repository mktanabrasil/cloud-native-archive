import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { JournalPageView } from './JournalPageView';
import { createPage } from '@/lib/journal/templates';
import type { JournalPage } from '@/lib/journal/types';

const pagina: JournalPage = createPage('capa');

/** Conta as faixas do rodapé institucional renderizadas na folha. */
function faixas(unitId?: string | null) {
  const { container } = render(
    <JournalPageView page={pagina} index={0} total={1} edition="Agosto/2026" unitName="" unitId={unitId} />,
  );
  const barra = [...container.querySelectorAll('div')].find((element) =>
    [...element.children].some((child) => child.className.includes('bg-news-brand-1')),
  );
  return [...(barra?.children ?? [])].map(
    (child) => child.className.match(/bg-news-brand-(\d)/)?.[1],
  );
}

describe('faixa do rodapé por segmento', () => {
  it('Educação usa as três primeiras cores', () => {
    expect(faixas('cei-pierre-weil')).toEqual(['1', '2', '3']);
    expect(faixas('cei-vandir')).toEqual(['1', '2', '3']);
  });

  /** Decisão do time: o Institucional acompanha a Educação. */
  it('o Institucional (GOE) também usa três', () => {
    expect(faixas('goe')).toEqual(['1', '2', '3']);
  });

  it('Social mantém as cinco', () => {
    expect(faixas('ana-nilopolis')).toEqual(['1', '2', '3', '4', '5']);
    expect(faixas('ana-oziel')).toEqual(['1', '2', '3', '4', '5']);
  });

  /** Sem unidade definida, o padrão neutro são as cinco. */
  it('jornal sem unidade mantém as cinco', () => {
    expect(faixas(null)).toEqual(['1', '2', '3', '4', '5']);
    expect(faixas(undefined)).toEqual(['1', '2', '3', '4', '5']);
    expect(faixas('id-inexistente')).toEqual(['1', '2', '3', '4', '5']);
  });
});

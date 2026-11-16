import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { JournalRecord } from '@/lib/journal/types';

/**
 * Jornais das unidades (16/11/2026): o feed da Educação com os jornais
 * finalizados dos CEIs e do GOE, para ler e baixar.
 */
const espiao = vi.hoisted(() => ({
  jornais: [] as unknown[],
  erro: null as null | { message: string },
  filtros: [] as string[],
}));

vi.mock('@/integrations/supabase/client', () => {
  const cadeia: Record<string, unknown> = {};
  cadeia.select = () => cadeia;
  cadeia.eq = (c: string, v: string) => { espiao.filtros.push(`${c}=${v}`); return cadeia; };
  cadeia.is = (c: string, v: unknown) => { espiao.filtros.push(`${c} is ${v}`); return cadeia; };
  cadeia.order = () => Promise.resolve({ data: espiao.erro ? null : espiao.jornais, error: espiao.erro });
  return { supabase: { from: () => cadeia } };
});
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
// A folha de verdade e o editor inteiro não são o que se testa aqui.
vi.mock('@/components/journal/JournalPageView', () => ({ A4_W: 794, A4_H: 1123, JournalPageView: () => <div data-testid="miniatura" /> }));
vi.mock('@/components/journal/JournalEditor', () => ({
  JournalEditor: ({ journal, somenteLeitura, abrirMenuDoPdf, onBack }: { journal: JournalRecord; somenteLeitura?: boolean; abrirMenuDoPdf?: boolean; onBack: () => void }) => (
    <div data-testid="leitor" data-leitura={String(!!somenteLeitura)} data-menu-do-pdf={String(!!abrirMenuDoPdf)}>
      {journal.name}
      <button type="button" onClick={onBack}>Voltar</button>
    </div>
  ),
}));

const { default: JornaisDasUnidadesPage } = await import('./JornaisDasUnidadesPage');

const jornal = (id: string, unit_id: string | null, reference_month: string, updated_at: string): JournalRecord => ({
  id, name: `Jornal ${id}`, unit_id, profile_unit: null, reference_month, status: 'finalizado',
  pages: [{ id: `p-${id}`, template: 'capa', blocks: [] } as unknown as JournalRecord['pages'][number]],
  paper: null, created_by: null, created_at: updated_at, updated_at,
});

function Endereco() {
  const l = useLocation();
  return <p data-testid="endereco">{l.pathname + l.search}</p>;
}
const abrir = (url = '/jornais-das-unidades') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<><JornaisDasUnidadesPage /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
const cartoes = () => screen.getAllByRole('listitem');
const titulos = () => cartoes().map((c) => within(c).getByRole('heading').textContent);

beforeEach(() => {
  espiao.erro = null;
  espiao.filtros = [];
  espiao.jornais = [
    jornal('outubro-anisio', 'cei-anisio-spinola', 'Outubro 2026', '2026-11-01T12:00:00Z'),
    jornal('novembro-goe', 'goe', 'Novembro 2026', '2026-11-10T12:00:00Z'),
    jornal('novembro-dic', 'ana-dic', 'Novembro 2026', '2026-11-15T12:00:00Z'),
    jornal('novembro-geral', null, 'Novembro 2026', '2026-11-15T12:00:00Z'),
    jornal('novembro-calmon', 'cei-calmon', 'Novembro 2026', '2026-11-14T12:00:00Z'),
  ];
});

describe('o feed', () => {
  it('pede ao banco só os finalizados, fora da lixeira', async () => {
    abrir();
    await screen.findAllByRole('listitem');
    expect(espiao.filtros).toEqual(['status=finalizado', 'deleted_at is null']);
  });

  it('mostra só as unidades da Educação, do mês mais novo para o mais antigo', async () => {
    abrir();
    await screen.findAllByRole('listitem');
    // Novembro: o Calmon gravou por último; depois o GOE; Outubro por fim. NAVE e geral ficam de fora.
    expect(titulos()).toEqual(['Jornal novembro-calmon', 'Jornal novembro-goe', 'Jornal outubro-anisio']);
    expect(within(cartoes()[0]).getByText(/Novembro 2026 ·/)).toHaveTextContent('Novembro 2026 · 1 página · atualizado em 14/11');
  });

  it('com o mês já no nome do jornal, não repete o mês', async () => {
    espiao.jornais = [{ ...jornal('x', 'cei-calmon', 'Novembro 2026', '2026-11-14T12:00:00Z'), name: 'Jornal Calmon — Novembro 2026' }];
    abrir();
    const [cartao] = await screen.findAllByRole('listitem');
    expect(within(cartao).getByText(/atualizado em/).closest('p')).toHaveTextContent(/^1 página · atualizado em 14\/11$/);
  });

  it('o filtro tem só as unidades com jornal, e filtra pelo endereço', async () => {
    abrir();
    const filtro = await screen.findByRole('group', { name: 'Filtrar por unidade' });
    expect(within(filtro).getAllByRole('button').map((b) => b.textContent)).toEqual(['Todas as unidades', 'GOE', 'Calmon', 'Anísio']);

    fireEvent.click(within(filtro).getByRole('button', { name: 'Anísio' }));
    expect(titulos()).toEqual(['Jornal outubro-anisio']);
    expect(screen.getByTestId('endereco')).toHaveTextContent('?unidade=cei-anisio-spinola');
    expect(within(filtro).getByRole('button', { name: 'Anísio' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('?unidade= de uma unidade sem jornal mostra todas', async () => {
    abrir('/jornais-das-unidades?unidade=ana-dic');
    await screen.findAllByRole('listitem');
    expect(titulos()).toHaveLength(3);
  });

  it('"Ler" abre o jornal só para leitura, e Voltar devolve ao feed', async () => {
    abrir();
    const [primeiro] = await screen.findAllByRole('listitem');
    fireEvent.click(within(primeiro).getByRole('button', { name: /^Ler$/ }));

    const leitor = screen.getByTestId('leitor');
    expect(leitor).toHaveTextContent('Jornal novembro-calmon');
    expect(leitor).toHaveAttribute('data-leitura', 'true');
    expect(leitor).toHaveAttribute('data-menu-do-pdf', 'false');
    expect(screen.getByTestId('endereco')).toHaveTextContent('?ler=novembro-calmon');

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByTestId('leitor')).not.toBeInTheDocument();
    expect(titulos()).toHaveLength(3);
  });

  it('"Baixar PDF" abre o jornal com o menu do PDF aberto', async () => {
    abrir();
    const [, segundo] = await screen.findAllByRole('listitem');
    fireEvent.click(within(segundo).getByRole('button', { name: /Baixar PDF/ }));
    expect(screen.getByTestId('leitor')).toHaveAttribute('data-menu-do-pdf', 'true');
    expect(screen.getByTestId('leitor')).toHaveTextContent('Jornal novembro-goe');
  });

  it('sem jornal finalizado, diz o que vai aparecer aqui', async () => {
    espiao.jornais = [jornal('so-nave', 'ana-dic', 'Novembro 2026', '2026-11-15T12:00:00Z')];
    abrir();
    expect(await screen.findByText('Nenhum jornal finalizado ainda')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filtrar por unidade' })).not.toBeInTheDocument();
  });

  it('se o banco falhar, avisa e oferece tentar de novo', async () => {
    espiao.erro = { message: 'falhou' };
    abrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui carregar os jornais.');
    espiao.erro = null;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findAllByRole('listitem')).toHaveLength(3);
  });
});

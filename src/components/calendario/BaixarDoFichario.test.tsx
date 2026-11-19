import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AlteracaoDoCalendario, AnoDoCalendario } from '@/lib/calendario/regras';
import { mesesQueMudaram } from '@/lib/calendario/regras';

/** Baixar para imprimir no fichário (19/11/2026): de quem, o quê, e o PDF só com as partes pedidas. */
const api = vi.hoisted(() => ({ linkDoArquivo: vi.fn(async () => 'https://capa') }));
vi.mock('@/lib/calendario/api', () => api);
const gerar = vi.hoisted(() => ({ gerarPdfDoCalendario: vi.fn(async () => ({ blob: new Blob(['%PDF']), paginas: 2, paginasDeTexto: 0, celulasCheias: [] })) }));
vi.mock('@/lib/calendario/pdf/gerar', () => gerar);

import { BaixarDoFichario, folhasDosMeses, nomeDoArquivo } from './BaixarDoFichario';

const ano = { ano: 2027, tema: 'T', percursos: [], textos: {}, meses_revisados: [], capa_url: '2027/capa.jpg', status: 'aprovado', observacao: null, enviado_em: null, enviado_por: null,
  aprovado_em: '2026-11-30T15:00:00Z', aprovado_por: 'MKT', pdf_url: 'a.pdf', pdf_impresso_url: 'a.pdf', impresso_em: '2026-11-30T15:00:00Z', atualizado_em: '', atualizado_por: null } as AnoDoCalendario;
const alt = (o: Partial<AlteracaoDoCalendario>): AlteracaoDoCalendario => ({ id: Math.random().toString(36), ano: 2027, mes: 3, dia: '2027-03-12', acao: 'entrou', tipo: 'atividade', texto: 'X', unidades: ['DIC'], item_id: null, quem: null, em: '2027-03-02T10:00:00Z', ...o });
const alteracoes = [alt({}), alt({ mes: 4, dia: '2027-04-02', unidades: ['Nilópolis'] }), alt({ mes: 6, dia: '2027-06-18', unidades: [] }), alt({ mes: 9, dia: '2027-09-01', tipo: 'tema', unidades: [] })];

beforeEach(() => {
  gerar.gerarPdfDoCalendario.mockClear(); api.linkDoArquivo.mockClear();
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});

describe('os meses que mudaram para cada unidade', () => {
  it('a da unidade, as de todas, o tema e as datas; a de outra unidade, não', () => {
    expect(mesesQueMudaram(alteracoes, 'DIC')).toEqual([3, 6, 9]);
    expect(mesesQueMudaram(alteracoes, 'Nilópolis')).toEqual([4, 6, 9]);
    expect(mesesQueMudaram(alteracoes, null)).toEqual([3, 4, 6, 9]);
    // "mudou" não guarda as unidades de antes: vale para todas.
    expect(mesesQueMudaram([alt({ mes: 7, dia: '2027-07-01', acao: 'mudou', unidades: ['Santana'] })], 'DIC')).toEqual([7]);
  });
  it('o nome do arquivo e as folhas', () => {
    expect(nomeDoArquivo(2027, 'DIC', 'mudaram', [3])).toBe('Calendário Anual 2027 · DIC · Março.pdf');
    expect(nomeDoArquivo(2027, 'geral', 'mudaram', [3, 6])).toBe('Calendário Anual 2027 · Geral · 2 meses.pdf');
    expect(nomeDoArquivo(2027, 'geral', 'inteiro', [])).toBe('Calendário Anual 2027 · Geral · inteiro.pdf');
    expect(nomeDoArquivo(2027, 'DIC', 'mudaram', [], 1)).toBe('Calendário Anual 2027 · DIC · 1 folha extra.pdf');
    expect(nomeDoArquivo(2027, 'DIC', 'mudaram', [3], 2)).toBe('Calendário Anual 2027 · DIC · Março + 2 folhas extras.pdf');
    expect(folhasDosMeses([3, 6], false)).toBe(2);
    expect(folhasDosMeses([3, 6], true)).toBe(6);
  });
});

describe('a janela de baixar', () => {
  const abrir = (o: { marketing?: boolean; unidade?: string | null; mesInicial?: number | null } = {}) =>
    render(<BaixarDoFichario ano={ano} itens={[]} alteracoes={alteracoes} marketing={o.marketing ?? false} unidade={o.unidade === undefined ? 'DIC' : o.unidade} mesInicial={o.mesInicial} aberto onFechar={() => {}} />);

  it('a gestão: primeiro a unidade dela, com os meses que mudaram para ela marcados; só a grade', async () => {
    abrir();
    const deQuem = screen.getByRole('radiogroup', { name: 'De quem' });
    expect(within(deQuem).getAllByRole('radio').map(r => r.textContent)).toEqual([expect.stringContaining('Só da DIC'), expect.stringContaining('Geral')]);
    expect(within(deQuem).getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('resumo-do-download')).toHaveTextContent('3 folhas · Março, Junho, Setembro');
    fireEvent.click(screen.getByRole('button', { name: /baixar para imprimir/i }));
    await waitFor(() => expect(gerar.gerarPdfDoCalendario).toHaveBeenCalled());
    const [, , opcoes] = gerar.gerarPdfDoCalendario.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>];
    expect(opcoes).toMatchObject({ previa: false, unidade: 'DIC', partes: { capa: false, textos: false, meses: [3, 6, 9], anotacoes: false, fim: false } });
    expect(api.linkDoArquivo).not.toHaveBeenCalled();
  });

  it('geral muda os meses marcados; dá para tirar um mês e pedir as 3 folhas', async () => {
    abrir();
    fireEvent.click(screen.getByRole('radio', { name: /Geral/ }));
    expect(screen.getByTestId('resumo-do-download')).toHaveTextContent('4 folhas · Março, Abril, Junho, Setembro');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Abril (mudou)' }));
    fireEvent.click(screen.getByRole('radio', { name: /2 folhas de anotação/ }));
    expect(screen.getByTestId('resumo-do-download')).toHaveTextContent('9 folhas');
    fireEvent.click(screen.getByRole('button', { name: /baixar para imprimir/i }));
    await waitFor(() => expect(gerar.gerarPdfDoCalendario).toHaveBeenCalled());
    expect((gerar.gerarPdfDoCalendario.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>])[2]).toMatchObject({ unidade: null, partes: { meses: [3, 6, 9], anotacoes: true } });
  });

  it('as folhas extras da unidade que mudaram depois da impressão vêm marcadas e vão junto', async () => {
    const extras = [
      { id: 'f1', ano: 2027, titulo: 'Festa da Família', depois_do_mes: 3, unidades: ['DIC'], texto: '', pauta: true, criado_em: '2027-03-03T10:00:00Z' },
      { id: 'f2', ano: 2027, titulo: 'Velha', depois_do_mes: null, unidades: [], texto: '', pauta: true, criado_em: '2026-11-20T10:00:00Z' },
      { id: 'f3', ano: 2027, titulo: 'Passeio Nil', depois_do_mes: 4, unidades: ['Nilópolis'], texto: '', pauta: true, criado_em: '2027-03-03T10:00:00Z' },
    ];
    render(<BaixarDoFichario ano={ano} itens={[]} extras={extras} alteracoes={alteracoes} marketing={false} unidade="DIC" aberto onFechar={() => {}} />);
    const lista = screen.getByTestId('folhas-para-baixar');
    expect(within(lista).getByRole('checkbox', { name: 'Festa da Família (mudou)' })).toHaveAttribute('aria-checked', 'true');
    expect(within(lista).getByRole('checkbox', { name: 'Velha' })).toHaveAttribute('aria-checked', 'false');
    expect(within(lista).queryByRole('checkbox', { name: /Passeio Nil/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('resumo-do-download')).toHaveTextContent('3 folhas · Março, Junho, Setembro + 1 folha extra');
    fireEvent.click(screen.getByRole('button', { name: /baixar para imprimir/i }));
    await waitFor(() => expect(gerar.gerarPdfDoCalendario).toHaveBeenCalled());
    expect(((gerar.gerarPdfDoCalendario.mock.calls[0] as unknown as [unknown, unknown, { extras: { id: string }[] }])[2]).extras.map(x => x.id)).toEqual(['f1']);
  });

  it('aberto a partir de um mês: só ele vem marcado', () => {
    abrir({ mesInicial: 5 });
    expect(screen.getByTestId('resumo-do-download')).toHaveTextContent('1 folha · Maio');
  });

  it('reaberto pelo botão de um mês, volta ao padrão mesmo depois de escolher o inteiro e 3 folhas', () => {
    const props = { ano, itens: [], alteracoes, marketing: false, unidade: 'DIC', onFechar: () => {} };
    const { rerender } = render(<BaixarDoFichario {...props} aberto mesInicial={null} />);
    fireEvent.click(screen.getByRole('radio', { name: /2 folhas de anotação/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Geral/ }));
    fireEvent.click(screen.getByRole('radio', { name: /calendário inteiro/i }));
    rerender(<BaixarDoFichario {...props} aberto={false} mesInicial={null} />);
    rerender(<BaixarDoFichario {...props} aberto mesInicial={3} />);
    expect(screen.getByTestId('resumo-do-download')).toHaveTextContent('1 folha · Março');
    expect(screen.getByRole('radio', { name: /Só da DIC/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('avisa quando um dia não coube inteiro na folha', async () => {
    const { toast } = await import('sonner');
    const aviso = vi.spyOn(toast, 'warning');
    gerar.gerarPdfDoCalendario.mockResolvedValueOnce({ blob: new Blob(['%PDF']), paginas: 1, paginasDeTexto: 0, celulasCheias: ['2027-03-14'] } as never);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /baixar para imprimir/i }));
    await waitFor(() => expect(aviso).toHaveBeenCalledWith(expect.stringContaining('14/3'), expect.anything()));
  });

  it('o inteiro sai com a capa; o marketing escolhe qualquer unidade', async () => {
    abrir({ marketing: true, unidade: null });
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Só de Santana')]));
    fireEvent.click(screen.getByRole('radio', { name: /calendário inteiro/i }));
    fireEvent.click(screen.getByRole('button', { name: /baixar para imprimir/i }));
    await waitFor(() => expect(gerar.gerarPdfDoCalendario).toHaveBeenCalled());
    expect(api.linkDoArquivo).toHaveBeenCalledWith('2027/capa.jpg');
    expect((gerar.gerarPdfDoCalendario.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>])[2]).toMatchObject({ capaUrl: 'https://capa', partes: undefined, unidade: null });
  });
});

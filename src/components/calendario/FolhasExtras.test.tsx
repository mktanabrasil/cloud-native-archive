import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnoDoCalendario, FolhaExtra } from '@/lib/calendario/regras';

/** As folhas extras do fichário (19/11/2026): criar, mudar só a sua, ver e baixar. */
const api = vi.hoisted(() => ({
  criarFolhaExtra: vi.fn(async (ano: number, c: object) => ({ id: 'nova-id', ano, ...c })),
  salvarFolhaExtra: vi.fn(async (id: string, c: object) => ({ id, ano: 2027, ...c })),
  apagarFolhaExtra: vi.fn(async () => {}),
}));
vi.mock('@/lib/calendario/api', () => api);
const gerar = vi.hoisted(() => ({ gerarPdfDoCalendario: vi.fn(async () => ({ blob: new Blob(['%PDF']), paginas: 1, paginasDeTexto: 0, celulasCheias: [] })) }));
vi.mock('@/lib/calendario/pdf/gerar', () => gerar);

import { CartaoDasFolhasExtras, EditorDaFolhaExtra } from './FolhasExtras';

const ano = { ano: 2027, tema: 'T', percursos: [], textos: {}, meses_revisados: [], capa_url: null, status: 'aprovado', observacao: null, enviado_em: null, enviado_por: null,
  aprovado_em: null, aprovado_por: null, pdf_url: null, impresso_em: '2026-11-30T15:00:00Z', atualizado_em: '', atualizado_por: null } as AnoDoCalendario;
const folha: FolhaExtra = { id: 'f1', ano: 2027, titulo: 'Festa da Família', depois_do_mes: 3, unidades: ['DIC'], texto: '**Quando:** sábado', pauta: true, criado_por: 'dic@x', criado_por_nome: 'Gestão DIC', criado_em: '2027-03-03T10:00:00Z' };

beforeEach(() => { Object.values(api).forEach(f => f.mockClear()); gerar.gerarPdfDoCalendario.mockClear(); Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }); });

describe('o editor', () => {
  it('a folha nova já vem da unidade de quem cria; salva com o lugar escolhido', async () => {
    const onSalva = vi.fn();
    render(<EditorDaFolhaExtra ano={ano} itens={[]} folha={null} podeMexer unidadePadrao="DIC" onSalva={onSalva} onApagada={() => {}} onPrevia={() => {}} />);
    expect(screen.getByRole('button', { name: 'DIC' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '  Roteiro  ' } });
    fireEvent.change(screen.getByLabelText('Fica no fichário'), { target: { value: 'fim' } });
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: '- convite' } });
    fireEvent.click(screen.getByRole('button', { name: /criar a folha/i }));
    await waitFor(() => expect(api.criarFolhaExtra).toHaveBeenCalledWith(2027, { titulo: 'Roteiro', depois_do_mes: null, unidades: ['DIC'], texto: '- convite', pauta: true }));
    expect(onSalva).toHaveBeenCalled();
  });
  it('sem título não salva', () => {
    render(<EditorDaFolhaExtra ano={ano} itens={[]} folha={null} podeMexer unidadePadrao={null} onSalva={() => {}} onApagada={() => {}} onPrevia={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /criar a folha/i }));
    expect(api.criarFolhaExtra).not.toHaveBeenCalled();
  });
  it('a folha de outra pessoa: só ver e baixar', () => {
    render(<EditorDaFolhaExtra ano={ano} itens={[]} folha={folha} podeMexer={false} unidadePadrao="Nilópolis" onSalva={() => {}} onApagada={() => {}} onPrevia={() => {}} />);
    expect(screen.getByLabelText('Título')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apagar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Só quem criou/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /baixar só esta folha/i })).toBeEnabled();
  });
  it('"Ver a folha" mostra a folha como está agora, antes de salvar', () => {
    const onPrevia = vi.fn();
    render(<EditorDaFolhaExtra ano={ano} itens={[]} folha={folha} podeMexer unidadePadrao="DIC" onSalva={() => {}} onApagada={() => {}} onPrevia={onPrevia} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo título' } });
    expect(screen.getByRole('button', { name: /baixar só esta folha/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /ver a folha/i }));
    expect(onPrevia).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1', titulo: 'Novo título' }));
  });
});

describe('o cartão do início', () => {
  it('lista na ordem do fichário e baixa só uma folha, sem as outras partes', async () => {
    const onAbrir = vi.fn();
    render(<CartaoDasFolhasExtras ano={ano} itens={[]} folhas={[{ ...folha, id: 'f2', titulo: 'No fim', depois_do_mes: null }, folha]} podeCriar podeMexer={f => f.id === 'f1'} onAbrir={onAbrir} />);
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual([expect.stringContaining('Festa da Família'), expect.stringContaining('No fim')]);
    expect(screen.getAllByRole('button', { name: 'Ver' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /nova folha extra/i }));
    expect(onAbrir).toHaveBeenCalledWith('nova');
    fireEvent.click(screen.getAllByRole('button', { name: /só esta folha/i })[0]);
    await waitFor(() => expect(gerar.gerarPdfDoCalendario).toHaveBeenCalled());
    expect((gerar.gerarPdfDoCalendario.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>])[2]).toMatchObject({ previa: false, partes: { capa: false, textos: false, meses: [], anotacoes: false, fim: false }, extras: [expect.objectContaining({ id: 'f1' })] });
  });
});

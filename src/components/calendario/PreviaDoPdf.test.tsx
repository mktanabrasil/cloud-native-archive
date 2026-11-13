import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnoDoCalendario } from '@/lib/calendario/regras';

const gerado = vi.hoisted(() => ({ cheias: [] as string[], opcoes: null as unknown }));
vi.mock('@/lib/calendario/pdf/gerar', () => ({
  gerarPdfDoCalendario: vi.fn(async (_a: unknown, _i: unknown, opcoes: unknown) => {
    gerado.opcoes = opcoes;
    return { blob: { arrayBuffer: async () => new ArrayBuffer(4) }, paginas: 3, paginasDeTexto: 1, celulasCheias: gerado.cheias };
  }),
}));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: async () => ({ getViewport: () => ({ width: 842, height: 595 }), render: () => ({ promise: Promise.resolve() }) }),
    }),
  }),
}));

vi.mock('@/lib/calendario/api', () => ({ linkDoArquivo: vi.fn(async () => 'https://capa') }));

import { PreviaDoPdf } from './PreviaDoPdf';

const ano: AnoDoCalendario = {
  ano: 2027, tema: '', percursos: [], textos: {}, meses_revisados: [], capa_url: null, status: 'preenchimento', observacao: null,
  enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null,
};

describe('a prévia do PDF (13/11/2026)', () => {
  beforeEach(() => {
    gerado.cheias = []; gerado.opcoes = null;
    // O jsdom não desenha; um contexto de mentira basta, já que o pdf.js também é simulado.
    HTMLCanvasElement.prototype.getContext = (() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('a coordenadora vê as páginas, com a marca de prévia, e não tem como baixar', async () => {
    render(<PreviaDoPdf ano={ano} itens={[]} podeBaixar={false} aberta onFechar={() => {}} />);
    expect(screen.getByText(/Montando a prévia/)).toBeInTheDocument();
    expect(await screen.findByText(/3 páginas, montadas com o que está preenchido agora/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Página \d$/)).toHaveLength(3);
    expect(gerado.opcoes).toEqual({ previa: true, capaUrl: null });
    expect(screen.queryByRole('button', { name: /baixar a prévia/i })).not.toBeInTheDocument();
  });

  it('o marketing baixa; e o dia que não coube na grade aparece no aviso', async () => {
    gerado.cheias = ['2027-03-14', '2027-04-02'];
    render(<PreviaDoPdf ano={ano} itens={[]} podeBaixar aberta onFechar={() => {}} />);
    expect(await screen.findByRole('button', { name: /baixar a prévia/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Não couberam inteiros na grade: 14/03, 02/04');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PreviaDoSite } from './PreviaDoSite';

const BASE = 'https://api.teste/transparencia';
const doc = (nome: string, chave: string) => ({ nome, tipo: 'pdf', tamanho: 2_600_000, atualizado_em: '2024-01-22T11:40:00Z', chave, endereco: `${BASE}/arquivo/${chave}/${encodeURIComponent(nome)}` });
const UNIDADES = [
  { slug: 'ana-jardim-nilopolis', nome: 'Ana Jardim Nilópolis', grupo: 'social', finalizada: false, documentos: 733, pastas: 137, atualizado_em: '2026-11-24T16:44:00Z' },
  { slug: 'cei-pierre', nome: 'CEI Bem Querer Professor Pierre Weil', grupo: 'educacao', finalizada: false, documentos: 455, pastas: 93, atualizado_em: '2026-11-24T16:38:00Z' },
  { slug: 'bem-querer-midori', nome: 'Bem Querer Midori Hamamoto', grupo: 'educacao', finalizada: true, documentos: 311, pastas: 84, atualizado_em: '2026-11-24T16:38:00Z' },
];
const NILOPOLIS = { atualizado_em: '2026-11-24T16:44:00Z', documentos: [], pastas: [
  { nome: '2 Estatuto', pastas: [], documentos: [doc('ESTATUTO 1987.pdf', 'AAAAAAAAAAAAAAAA'), doc('ESTATUTO 2024.pdf', 'BBBBBBBBBBBBBBBB')] },
  { nome: '8 Regimentos', pastas: [], documentos: [] },
] };
const BUSCA = { q: 'balanço 2024', total: 2, resultados: [
  { ...doc('BALANÇO 2024.pdf', 'CCCCCCCCCCCCCCCC'), caminho: ['3 Balanços'], unidade: { slug: 'ana-jardim-nilopolis', nome: 'Ana Jardim Nilópolis' } },
  { ...doc('Balanço 2024.pdf', 'DDDDDDDDDDDDDDDD'), caminho: ['3 Balanços'], unidade: { slug: 'cei-pierre', nome: 'CEI Bem Querer Professor Pierre Weil' } },
] };

const fetchFalso = vi.fn();
beforeEach(() => {
  fetchFalso.mockReset();
  fetchFalso.mockImplementation(async (url: string) => {
    const u = new URL(url);
    const corpo = u.pathname.endsWith('/transparencia') ? { unidades: UNIDADES }
      : u.pathname.includes('/unidade/ana-jardim-nilopolis') ? NILOPOLIS
      : u.pathname.endsWith('/busca') ? BUSCA : null;
    return new Response(JSON.stringify(corpo ?? { error: 'nada' }), { status: corpo ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fetchFalso);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Como o site mostra (prévia no painel)', () => {
  it('lista as unidades por grupo e abre a primeira com as pastas', async () => {
    render(<PreviaDoSite aberta onOpenChange={() => {}} base={BASE} />);
    expect(await screen.findByText('Dados reais da API · 3 unidades · 1.499 documentos')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Unidades' });
    expect(within(nav).getByText('Social')).toBeInTheDocument();
    expect(within(nav).getByText('finalizada')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ana Jardim Nilópolis' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /2 Estatuto/ }));
    const docs = screen.getAllByTestId('documento-da-previa');
    expect(docs[0]).toHaveTextContent('ESTATUTO 1987.pdf');
    expect(within(docs[0]).getByRole('link', { name: /Abrir/ })).toHaveAttribute('href', `${BASE}/arquivo/AAAAAAAAAAAAAAAA/ESTATUTO%201987.pdf`);
    expect(within(docs[0]).getByRole('link', { name: /Baixar/ })).toHaveAttribute('href', `${BASE}/arquivo/AAAAAAAAAAAAAAAA/ESTATUTO%201987.pdf?baixar=1`);
    fireEvent.click(screen.getByRole('button', { name: /8 Regimentos/ }));
    expect(screen.getByText('Pasta vazia.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /texto técnico/ })).toHaveAttribute('href', BASE);
  });

  it('a busca procura em todas as unidades e mostra unidade e caminho', async () => {
    render(<PreviaDoSite aberta onOpenChange={() => {}} base={BASE} />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Procurar documento' }), { target: { value: 'balanço 2024' } });
    const r = await screen.findAllByTestId('resultado-da-busca', {}, { timeout: 2000 });
    expect(r).toHaveLength(2);
    expect(r[1]).toHaveTextContent('CEI Bem Querer Professor Pierre Weil › 3 Balanços');
    expect(screen.getByText('2 documentos')).toBeInTheDocument();
    expect(String(fetchFalso.mock.calls.at(-1)?.[0])).toBe(`${BASE}/busca?q=balan%C3%A7o%202024&limite=50`);
    fireEvent.click(screen.getByRole('button', { name: 'Nesta unidade' }));
    await waitFor(() => expect(String(fetchFalso.mock.calls.at(-1)?.[0])).toContain('&unidade=ana-jardim-nilopolis'), { timeout: 2000 });
  });

  it('sem resultado e com a API fora, avisa', async () => {
    fetchFalso.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'Não foi possível carregar agora.' }), { status: 503 }));
    render(<PreviaDoSite aberta onOpenChange={() => {}} base={BASE} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ler a API agora');
  });

  it('fechada, não chama a API', () => {
    render(<PreviaDoSite aberta={false} onOpenChange={() => {}} base={BASE} />);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

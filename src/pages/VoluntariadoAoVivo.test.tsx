import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/** O painel ao vivo da gestão (21/10/2026). */

const banco = vi.hoisted(() => ({
  leituras: [] as Array<Record<string, unknown> | Error>,
  lidas: 0,
  cfg: { codigo_acompanhamento: 'abc123', meta: null as number | null },
  metas: [] as Array<number | null>,
  trocas: 0,
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/voluntariado/aoVivo', async () => {
  const real = await vi.importActual<typeof import('@/lib/voluntariado/aoVivo')>('@/lib/voluntariado/aoVivo');
  return {
    ...real,
    lerAcompanhamento: async () => { const r = banco.leituras[Math.min(banco.lidas, banco.leituras.length - 1)]; banco.lidas++; if (r instanceof Error) throw r; return r; },
    lerConfig: async () => banco.cfg,
    definirMeta: async (m: number | null) => { banco.metas.push(m); },
    trocarCodigo: async () => { banco.trocas++; return 'novo999'; },
  };
});

const { default: AoVivo } = await import('./VoluntariadoAoVivoPage');
const { AoVivoDaGestao } = await import('@/components/voluntariado/AoVivoDaGestao');
const { calcularPainel, COR_DA_UNIDADE, diaDe } = await import('@/lib/voluntariado/aoVivo');

const AGORA = new Date('2026-10-28T15:00:00-03:00').getTime();
const I = (nome: string, unidade: string, area: 'social' | 'educacao', o1: string, o2: string | null, quando: string) =>
  ({ nome, unidade_id: unidade, unidade_nome: unidade, area, opcao1: o1, opcao2: o2, created_at: new Date(quando).toISOString() });
const BASE = [
  I('Leonardo Garbo', 'CEI Bem Querer Prof. Pierre Weil', 'educacao', 'cozinha', 'montagem', '2026-10-21T09:00:00-03:00'),
  I('Paulo Martins', 'Grupo de Oração Esperança', 'educacao', 'projecao', null, '2026-10-21T10:00:00-03:00'),
  I('Marcos Souza', 'ANA DIC', 'social', 'cozinha', 'seguranca', '2026-10-27T09:00:00-03:00'),
  I('Ana Paula', 'ANA DIC', 'social', 'recreacao_kids', null, '2026-10-28T14:59:00-03:00'),
];
const dados = (inscricoes = BASE, meta: number | null = null) => ({ meta, agora: new Date(AGORA).toISOString(), inscricoes });

beforeEach(() => { banco.leituras = [dados()]; banco.lidas = 0; banco.cfg = { codigo_acompanhamento: 'abc123', meta: null }; banco.metas = []; banco.trocas = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('contas', () => {
  const p = calcularPainel(dados(BASE, 10), AGORA);

  it('números do topo', () => {
    expect(p.total).toBe(4);
    expect(p.hoje).toBe(1);
    expect(p.unidades).toEqual({ comInscritos: 3, total: 15 });
    expect(p.areas.total).toBe(16); // Som fora do formulário e ninguém o escolheu
    expect(p.areas.cobertas).toBe(3);
    expect(p.comSegunda).toBe(2);
    expect(p.meta).toBe(10);
    expect(p.faltamDias).toBe(19);
  });

  it('por dia: do primeiro dia até 15/11, com hoje marcado e o futuro vazio', () => {
    expect(p.porDia[0]).toMatchObject({ dia: '2026-10-21', n: 2 });
    expect(p.porDia.find((d) => d.hoje)).toMatchObject({ rotulo: 'hoje', n: 1 });
    expect(p.porDia.at(-1)).toMatchObject({ dia: '2026-11-15', futuro: true, n: 0 });
    expect(p.mediaPorDia).toBe(0.3); // 2 inscrições nos últimos 7 dias (22 a 28/10)
  });

  it('por área (1ª e 2ª), vazias e matriz só com quem tem gente', () => {
    expect(p.porArea[0]).toMatchObject({ chave: 'cozinha', primeira: 2, segunda: 0 });
    expect(p.porArea.find((a) => a.chave === 'montagem')).toMatchObject({ primeira: 0, segunda: 1 });
    expect(p.vazias).toContain('Montagem / Desmontagem');
    expect(p.matriz.colunas.map((c) => c.chave)).toEqual(['cozinha', 'projecao', 'recreacao_kids']);
    expect(p.matriz.linhas.find((l) => l.nome === 'ANA DIC')!.valores).toEqual([1, 0, 1]);
  });

  it('últimas: a mais nova primeiro, com as áreas', () => {
    expect(p.ultimas[0]).toMatchObject({ nome: 'Ana Paula', areas: 'Recreação' });
    expect(p.ultimas[1].areas).toBe('Cozinha › Segurança');
    expect(JSON.stringify(p)).not.toMatch(/whatsapp|protocolo/i);
  });

  it('as cores das unidades são as mesmas da planilha', () => {
    const fn = readFileSync('supabase/functions/voluntariado-planilha/index.ts', 'utf8');
    const daFuncao = Object.fromEntries([...fn.matchAll(/'([^']+)': '(#[0-9A-F]{6})'/g)].map((m) => [m[1], m[2]]));
    expect(COR_DA_UNIDADE).toEqual(daFuncao);
  });

  it('dia no fuso de Brasília', () => {
    expect(diaDe('2026-10-29T01:30:00Z')).toBe('2026-10-28');
  });
});

const abrir = (codigo = 'abc123') => render(
  <MemoryRouter initialEntries={[`/voluntariado/acompanhar/${codigo}`]}>
    <Routes><Route path="/voluntariado/acompanhar/:codigo" element={<AoVivo />} /></Routes>
  </MemoryRouter>,
);

describe('a página', () => {
  it('código errado: "Este link não vale mais"', async () => {
    banco.leituras = [new Error('codigo_invalido')];
    abrir('errado');
    expect(await screen.findByText('Este link não vale mais')).toBeInTheDocument();
  });

  it('mostra os números, troca de bloco pelas abas e pelas setas', async () => {
    abrir();
    expect(await screen.findByTestId('kpi-Inscritos')).toHaveTextContent('4');
    expect(screen.getByTestId('trilho').style.transform).toBe('translateX(-0%)');
    fireEvent.click(screen.getByRole('button', { name: 'Por área' }));
    expect(screen.getByTestId('trilho').style.transform).toBe('translateX(-200%)');
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByTestId('trilho').style.transform).toBe('translateX(-300%)');
    expect(screen.getAllByTestId('unidade')).toHaveLength(15);
    expect(screen.queryByTestId('meta')).toBeNull();
  });

  it('troca sozinho a cada 10 s e, na leitura de 30 s, avisa quem chegou', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    banco.leituras = [dados(), dados([...BASE, I('Bruna Teixeira', 'ANA Jardim Santana', 'social', 'decoracao', null, '2026-10-28T15:00:10-03:00')], 120)];
    abrir();
    await screen.findByTestId('kpi-Inscritos');
    await act(async () => { vi.advanceTimersByTime(10_500); });
    expect(screen.getByTestId('trilho').style.transform).toBe('translateX(-100%)');
    await act(async () => { vi.advanceTimersByTime(20_000); });
    await waitFor(() => expect(screen.getByTestId('aviso')).toHaveTextContent('Nova inscrição: Bruna Teixeira · ANA Jardim Santana'));
    expect(screen.getByTestId('kpi-Inscritos')).toHaveTextContent('5');
    expect(screen.getByTestId('meta')).toHaveTextContent('Rumo à meta de 120 voluntários');
  });
});

describe('no painel do Marketing', () => {
  it('copia o link, salva a meta e troca o link com confirmação', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escrever } });
    render(<AoVivoDaGestao />);
    fireEvent.click(await screen.findByRole('button', { name: /Copiar link/ }));
    await waitFor(() => expect(escrever).toHaveBeenCalledWith('https://app.anabrasil.org/voluntariado/acompanhar/abc123'));
    fireEvent.change(screen.getByLabelText('Meta de voluntários'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(banco.metas).toEqual([120]));
    fireEvent.click(screen.getByRole('button', { name: /Trocar o link/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trocar o link' }));
    await waitFor(() => expect(banco.trocas).toBe(1));
    expect(screen.getByRole('link', { name: /Abrir/ })).toHaveAttribute('href', 'https://app.anabrasil.org/voluntariado/acompanhar/novo999');
  });
});

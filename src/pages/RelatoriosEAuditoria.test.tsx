import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/** Passo 6 do roteiro (20/10/2026): telas de Relatórios e Auditoria, e o que fica registrado. */

const banco = vi.hoisted(() => ({
  rh: true,
  acessos: [] as Array<[string, Record<string, unknown>]>,
  conferidos: [] as string[],
  alertas: [] as Array<Record<string, unknown>>,
  baixados: [] as string[],
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'p1', email: 'viviane@anabrasil.org', user_metadata: {} }, isAuthenticated: true, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: banco.rh, isAdmin: false, loading: false, userName: 'Viviane' }) }));
vi.mock('@/lib/enquetes/planilha', () => ({ baixarArquivo: (_: string, nome: string) => { banco.baixados.push(nome); } }));
vi.mock('@/lib/vagas/perfil', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/perfil')>('@/lib/vagas/perfil');
  return { ...real, linkDoCurriculo: async () => 'https://arquivos/cv.pdf' };
});
vi.mock('@/lib/vagas/auditoria', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/auditoria')>('@/lib/vagas/auditoria');
  return {
    ...real,
    registrarAcesso: async (acao: string, alvo: Record<string, unknown>) => { banco.acessos.push([acao, alvo]); },
    listarAuditoria: async () => [
      { id: 3, em: '2026-10-16T22:20:00Z', quem: 'p2', quem_nome: 'Roberta', papel: 'rh', acao: 'curriculo.aberto', candidatura_id: 'c1', protocolo: 'P1', vaga_id: 'v1', vaga_titulo: 'Educador Social', detalhe: null },
      { id: 2, em: '2026-10-16T22:12:00Z', quem: 'p2', quem_nome: 'Roberta', papel: 'rh', acao: 'curriculo.aberto', candidatura_id: 'c2', protocolo: 'P2', vaga_id: 'v1', vaga_titulo: 'Educador Social', detalhe: null },
      { id: 1, em: '2026-10-15T10:00:00Z', quem: 'rh1', quem_nome: 'Carla', papel: 'rh', acao: 'planilha.baixada', candidatura_id: null, protocolo: null, vaga_id: 'v2', vaga_titulo: 'Auxiliar Administrativo', detalhe: '36 linhas' },
    ],
    alertasDaAuditoria: async () => banco.alertas,
    conferirAlerta: async (a: { quem: string }) => { banco.conferidos.push(a.quem); banco.alertas = banco.alertas.map((x) => ({ ...x, conferido: true })); },
  };
});
vi.mock('@/lib/vagas/relatorios', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/relatorios')>('@/lib/vagas/relatorios');
  return {
    ...real,
    montarRelatorio: async () => ({
      candidaturas: 236, candidaturasAntes: 200, primeiraOlhada: 2.4, primeiraOlhadaAntes: 4.1, ateResultado: 19, ateResultadoAntes: 16, aprovados: 11, vagasFechadas: 14,
      funil: { recebidas: 236, analise: 171, entrevista: 64, aprovadas: 11, retiradas: 14 },
      tempos: [{ rotulo: 'Recebida → aberta', dias: 2.4 }, { rotulo: 'Análise', dias: 5 }, { rotulo: 'Entrevista', dias: 9 }, { rotulo: 'Convite → resposta', dias: 0.8 }],
      semanas: [{ inicio: '2026-10-06T00:00:00Z', n: 20 }, { inicio: '2026-10-13T00:00:00Z', n: 30 }],
      origem: [{ rotulo: 'Instagram', n: 97, pct: 41 }],
      porVaga: [{ vaga: { id: 'v1', slug: 'educador', titulo: 'Educador Social de Música', codigo: 'SOC-2026-031', area: 'social' }, candidaturas: 48, emAberto: 21, primeiraOlhada: 1.5, ateResultado: null, aprovados: 0, responsavel: 'Viviane', situacao: 'no_prazo' }],
    }),
  };
});
vi.mock('@/lib/vagas/rh', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/rh')>('@/lib/vagas/rh');
  const { paraVaga } = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  const { paraCandidatura } = await vi.importActual<typeof import('@/lib/vagas/candidatura')>('@/lib/vagas/candidatura');
  const c = { ...paraCandidatura({ id: 'c1', protocolo: '2026-000418', vaga_id: 'v1', etapa: 'analise', resultado: null, perfil: { nome: 'Leonardo Garbo' }, requisitos: [], respostas: [], created_at: '2026-10-16T12:00:00Z', curriculo_caminho: 'u1/cv.pdf', curriculo_nome: 'cv.pdf' }), aberta_em: '2026-10-17T12:00:00Z' };
  return {
    ...real,
    buscarVagaDoRh: async () => paraVaga({ id: 'v1', slug: 'educador', titulo: 'Educador Social de Música', codigo: 'SOC-2026-031', area: 'social', status: 'publicada', responsavel_id: 'p1' }),
    candidatosDaVaga: async () => [c],
    umaCandidatura: async () => c,
    abrirCandidatura: async () => {},
    historico: async () => [],
    lerObservacoes: async () => '',
    ultimaMudanca: async () => new Map(),
  };
});

const { RelatoriosDoRh } = await import('@/components/vagas/RelatoriosDoRh');
const { AuditoriaDasVagas } = await import('@/components/vagas/AuditoriaDasVagas');
const { default: Lista } = await import('./CandidatosDaVagaPage');
const { default: Ficha } = await import('./FichaDoCandidatoPage');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/relatorios" element={<RelatoriosDoRh />} />
      <Route path="/auditoria" element={<AuditoriaDasVagas />} />
      <Route path="/vagas/:slug/candidatos" element={<Lista />} />
      <Route path="/vagas/:slug/candidatos/:id" element={<Ficha />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  banco.rh = true; banco.acessos = []; banco.conferidos = []; banco.baixados = [];
  banco.alertas = [{ quem: 'p2', quem_nome: 'Roberta', hora: '2026-10-16T22:00:00Z', quantidade: 40, media_por_dia: 6, vagas: 'Monitor de Transporte', conferido: false }];
});

describe('Relatórios', () => {
  it('números com comparação, funil, tempos e a tabela por vaga', async () => {
    abrir('/relatorios');
    expect(await screen.findByTestId('kpi-Candidaturas')).toHaveTextContent('236');
    expect(screen.getByTestId('kpi-Candidaturas')).toHaveTextContent('▲ 18% vs. período anterior');
    expect(screen.getByTestId('kpi-1ª olhada do RH')).toHaveTextContent('mediana · era 4,1 d');
    expect(screen.getByRole('region', { name: 'Funil' })).toHaveTextContent('Entrevista64');
    expect(screen.getByRole('region', { name: 'Tempo em cada etapa' })).toHaveTextContent('9 d');
    expect(screen.getByTestId('linha-vaga')).toHaveTextContent('Viviane');
    fireEvent.click(screen.getByRole('button', { name: /Planilha/ }));
    expect(banco.baixados).toEqual(['relatorio-vagas.csv']);
  });
});

describe('Auditoria', () => {
  it('aviso de fora do comum, com "Marcar como conferido"', async () => {
    abrir('/auditoria');
    const alerta = await screen.findByTestId('alerta');
    expect(alerta).toHaveTextContent('Roberta abriu 40 fichas ou currículos em 1 hora');
    expect(alerta).toHaveTextContent('Costuma abrir 6 por dia');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como conferido' }));
    await waitFor(() => expect(banco.conferidos).toEqual(['p2']));
    await waitFor(() => expect(screen.queryByTestId('alerta')).toBeNull());
  });

  it('junta as aberturas seguidas e marca a planilha como dado pessoal', async () => {
    abrir('/auditoria');
    const linhas = await screen.findAllByTestId('registro');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Abriu o currículo ×2');
    expect(linhas[1]).toHaveTextContent('Baixou a planilha de candidatos (36 linhas)dados pessoais');
    fireEvent.change(screen.getByLabelText('Buscar por pessoa, vaga ou protocolo'), { target: { value: 'carla' } });
    expect(screen.getAllByTestId('registro')).toHaveLength(1);
  });
});

describe('o que fica registrado', () => {
  it('abrir a ficha e o currículo', async () => {
    abrir('/vagas/educador/candidatos/c1');
    await waitFor(() => expect(banco.acessos).toContainEqual(['ficha.aberta', { candidatura: 'c1' }]));
    fireEvent.click(await screen.findByRole('tab', { name: 'Currículo' }));
    await waitFor(() => expect(banco.acessos).toContainEqual(['curriculo.aberto', { candidatura: 'c1' }]));
  });

  it('a planilha de candidatos é só do RH, e baixar fica registrado', async () => {
    abrir('/vagas/educador/candidatos');
    fireEvent.click(await screen.findByRole('button', { name: /Baixar planilha/ }));
    expect(banco.baixados).toEqual(['candidatos-educador.csv']);
    expect(banco.acessos).toContainEqual(['planilha.baixada', { vaga: 'v1', detalhe: '1 linha' }]);
  });

  it('o responsável (não RH) não vê a planilha', async () => {
    banco.rh = false;
    abrir('/vagas/educador/candidatos');
    expect(await screen.findByRole('heading', { name: 'Educador Social de Música' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Baixar planilha/ })).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const banco = vi.hoisted(() => ({
  lista: [] as Array<Record<string, unknown>>,
  movidos: [] as Array<[string, string, string | null]>,
  avisar: true,
  obs: [] as string[],
  rh: true,
  responsavel: null as string | null,
  processos: [] as unknown[],
  definidos: [] as Array<[string, string | null, string | null]>,
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'rh1', email: 'carla@anabrasil.org', user_metadata: {} }, isAuthenticated: true, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: banco.rh, loading: false, userName: 'Carla' }) }));
vi.mock('@/lib/vagas/perfil', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/perfil')>('@/lib/vagas/perfil');
  return { ...real, linkDoCurriculo: async () => 'https://arquivos/cv.pdf' };
});
vi.mock('@/lib/vagas/rh', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/rh')>('@/lib/vagas/rh');
  const { paraVaga } = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  const { paraCandidatura } = await vi.importActual<typeof import('@/lib/vagas/candidatura')>('@/lib/vagas/candidatura');
  const conv = (l: Record<string, unknown>) => ({ ...paraCandidatura(l), aberta_em: (l.aberta_em as string) ?? null });
  return {
    ...real,
    buscarVagaDoRh: async () => paraVaga({ id: 'v1', slug: 'educador', titulo: 'Educador Social de Música', codigo: 'SOC-2026-031', area: 'social', status: 'publicada', responsavel_id: banco.responsavel }),
    listarProcessos: async () => banco.processos,
    equipe: async () => [{ user_id: 'p1', nome: 'Viviane Mattioli', email: 'adm@anabrasil.org', unidade: 'Administração' }, { user_id: 'p2', nome: 'Marcela Zaccarias', email: 'financeiro@anabrasil.org', unidade: null }],
    definirResponsavel: async (v: { id: string }, resp: string | null, prazo: string | null) => { banco.definidos.push([v.id, resp, prazo]); return { avisou: !!resp, falhouAviso: false }; },
    candidatosDaVaga: async () => banco.lista.map(conv),
    umaCandidatura: async (id: string) => { const l = banco.lista.find((x) => x.id === id); return l ? conv(l) : null; },
    abrirCandidatura: async () => {},
    ultimaMudanca: async () => new Map([['c2', '2026-01-01T00:00:00Z']]),
    montarPainel: async () => ({ vagasAbertas: 39, porArea: { social: 23, educacao: 15, administracao: 1 }, candidaturas: 5, paraTriar: 2, emEntrevista: 1, aprovados: 0, porColuna: { recebida: 2, analise: 1, entrevista: 1, aprovado: 0, nao_selecionado: 0, retiradas: 1 }, atencao: [{ vaga: { id: 'v1', slug: 'educador', titulo: 'Educador Social de Música' }, tipo: 'novos', quantidade: 2, detalhe: '2 novos' }] }),
    historico: async () => [{ acao: 'enviada', de: null, para: 'recebida', por: 'candidato', em: '2026-10-09T12:00:00Z' }],
    lerObservacoes: async () => '',
    salvarObservacoes: async (_: string, t: string) => { banco.obs.push(t); },
    moverCandidatura: async (id: string, etapa: string, resultado: string | null) => {
      banco.movidos.push([id, etapa, resultado]);
      const l = banco.lista.find((x) => x.id === id)!; l.etapa = etapa; l.resultado = resultado;
      return { avisou: banco.avisar, falhouAviso: false };
    },
  };
});

const { default: Lista } = await import('./CandidatosDaVagaPage');
const { default: Ficha } = await import('./FichaDoCandidatoPage');
const { proximosPassos, textoDoMovimento, csvDosCandidatos } = await import('@/lib/vagas/rh');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas/:slug/candidatos" element={<Lista />} />
      <Route path="/vagas/:slug/candidatos/:id" element={<Ficha />} />
    </Routes>
  </MemoryRouter>,
);

const C = (o: Record<string, unknown>) => ({
  id: 'c1', protocolo: '2026-000418', vaga_id: 'v1', etapa: 'recebida', resultado: null, aberta_em: null, retirada_em: null,
  created_at: new Date().toISOString(), origem: 'Instagram', curriculo_caminho: 'u1/c.pdf', curriculo_nome: 'cv.pdf',
  perfil: { nome: 'Leonardo Garbo Rodrigues', cidade: 'Campinas/SP', bairro: 'Vila Costa e Silva', escolaridade: 'superior', email: 'leo@x.com', whatsapp: '(19) 99355-8242', disponibilidade: ['manha'], experiencias: [{ funcao: 'Educador', onde: 'Instituto', inicio: '2023-03', fim: null, atual: true }] },
  requisitos: [{ texto: 'Ensino Médio completo', atende: true }, { texto: 'Disponibilidade à tarde', atende: false }],
  respostas: [{ pergunta_id: 'p1', texto: 'Conte uma oficina', tipo: 'texto_longo', resposta: 'Percussão com latas' }],
  ...o,
});

beforeEach(() => {
  banco.lista = [C({}), C({ id: 'c2', protocolo: '2026-000400', etapa: 'analise', aberta_em: '2026-10-08', perfil: { nome: 'Ana Paula Ribeiro', cidade: 'Campinas/SP', escolaridade: 'medio', experiencias: [] } }), C({ id: 'c3', protocolo: '2026-000390', retirada_em: '2026-10-08', perfil: { nome: 'Bruno Tavares' } })];
  banco.movidos = []; banco.obs = []; banco.avisar = true; banco.rh = true; banco.responsavel = null; banco.processos = []; banco.definidos = [];
});

describe('candidatos da vaga', () => {
  it('lista, conta por etapa, filtra e busca', async () => {
    abrir('/vagas/educador/candidatos');
    fireEvent.click(await screen.findByRole('button', { name: 'Lista' }));
    expect(await screen.findAllByTestId('candidato')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Todas\s*2/ })).toBeInTheDocument();
    expect(screen.getByText('novo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Análise\s*1/ }));
    expect(screen.getAllByTestId('candidato')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Retiradas\s*1/ }));
    expect(screen.getByText('Bruno Tavares')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));
    fireEvent.change(screen.getByLabelText('Buscar por nome ou cidade'), { target: { value: 'ana paula' } });
    expect(screen.getAllByTestId('candidato')).toHaveLength(1);
  });

  it('quem não é RH não vê', async () => {
    banco.rh = false;
    abrir('/vagas/educador/candidatos');
    expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  });
});

describe('ficha', () => {
  it('mostra o que foi enviado e move: Análise, Entrevista, Aprovar', async () => {
    abrir('/vagas/educador/candidatos/c1');
    expect(await screen.findByRole('heading', { name: 'Leonardo Garbo Rodrigues' })).toBeInTheDocument();
    expect(screen.getByText('Percussão com latas')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    // O currículo abre dentro da ficha, na aba própria (19/10/2026).
    fireEvent.click(screen.getByRole('tab', { name: 'Currículo' }));
    expect(await screen.findByTitle('Currículo: cv.pdf')).toHaveAttribute('src', 'https://arquivos/cv.pdf');
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(screen.getByTestId('historico')).toHaveTextContent('Enviada pelo candidato');

    fireEvent.click(screen.getByRole('button', { name: /Mover para Análise/ }));
    await screen.findByRole('button', { name: /Mover para Entrevista/ });
    fireEvent.click(screen.getByRole('button', { name: /Mover para Entrevista/ }));
    await screen.findByRole('button', { name: /Aprovar/ });
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Etapa: Aprovado' })).toBeInTheDocument());
    expect(banco.movidos).toEqual([['c1', 'analise', null], ['c1', 'entrevista', null], ['c1', 'resultado', 'aprovado']]);
  });

  it('não seguir e observações salvas sozinhas', async () => {
    abrir('/vagas/educador/candidatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: /Não seguir/ }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Etapa: Não selecionado' })).toBeInTheDocument());
    expect(banco.movidos).toEqual([['c1', 'resultado', 'nao_selecionado']]);
    fireEvent.change(screen.getByLabelText('Observações do RH'), { target: { value: 'ligar quinta' } });
    await waitFor(() => expect(banco.obs).toEqual(['ligar quinta']), { timeout: 2000 });
  });

  it('retirada não tem botões de mover', async () => {
    abrir('/vagas/educador/candidatos/c3');
    expect(await screen.findByText(/retirou a candidatura/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mover para/ })).toBeNull();
  });
});

describe('regras do painel', () => {
  it('próximos passos de cada etapa', () => {
    expect(proximosPassos({ etapa: 'recebida', resultado: null, retirada_em: null })).toMatchObject({ avancar: { etapa: 'analise' }, voltar: null, podeRecusar: true });
    expect(proximosPassos({ etapa: 'entrevista', resultado: null, retirada_em: null })).toMatchObject({ avancar: { etapa: 'resultado', resultado: 'aprovado' }, voltar: { etapa: 'analise' } });
    expect(proximosPassos({ etapa: 'resultado', resultado: 'nao_selecionado', retirada_em: null })).toMatchObject({ avancar: null, voltar: { etapa: 'entrevista' }, podeRecusar: false });
    expect(proximosPassos({ etapa: 'analise', resultado: null, retirada_em: '2026-10-09' })).toEqual({ avancar: null, voltar: null, podeRecusar: false });
  });

  it('histórico e planilha', () => {
    expect(textoDoMovimento({ acao: 'etapa', de: 'entrevista', para: 'resultado:aprovado', por: 'Carla', em: '' })).toBe('Entrevista → Aprovado · Carla');
    expect(textoDoMovimento({ acao: 'aberta', de: null, para: null, por: 'Carla', em: '' })).toBe('Aberta por Carla');
    const linhas = csvDosCandidatos([{ ...C({}), aberta_em: null } as never]).replace('﻿', '').trim().split('\r\n');
    expect(linhas[0]).toMatch(/^Protocolo;Enviada;Nome;WhatsApp;E-mail;Cidade;Bairro;Formação;Experiências;Requisitos marcados;Currículo;Etapa;Retirada$/);
    expect(linhas[1]).toMatch(/2026-000418;.*;Leonardo Garbo Rodrigues;\(19\) 99355-8242;leo@x\.com;Campinas\/SP;Vila Costa e Silva;Superior completo;1;1 de 2;sim;Recebida;não$/);
  });
});

describe('quadro em colunas (19/10/2026)', () => {
  beforeEach(() => { try { localStorage.removeItem('vagas-rh-vista'); } catch { /* */ } });

  it('abre no quadro, sem as retiradas, com selos novo e parado', async () => {
    abrir('/vagas/educador/candidatos');
    const quadro = await screen.findByTestId('quadro');
    expect(within(within(quadro).getByRole('region', { name: 'Recebida' })).getByText('Leonardo Garbo Rodrigues')).toBeInTheDocument();
    expect(within(within(quadro).getByRole('region', { name: 'Análise' })).getByText('Ana Paula Ribeiro')).toBeInTheDocument();
    expect(within(quadro).queryByText('Bruno Tavares')).toBeNull();
    expect(within(quadro).getByText('novo')).toBeInTheDocument();
    expect(within(quadro).getByText('parado')).toBeInTheDocument();
  });

  it('arrastar para Análise move direto; para Não selecionado pede confirmação', async () => {
    abrir('/vagas/educador/candidatos');
    const quadro = await screen.findByTestId('quadro');
    const dados = { getData: () => 'c1', setData: () => {} };
    fireEvent.drop(within(quadro).getByRole('region', { name: 'Análise' }), { dataTransfer: dados });
    await waitFor(() => expect(banco.movidos).toEqual([['c1', 'analise', null]]));
    fireEvent.drop(within(await screen.findByTestId('quadro')).getByRole('region', { name: 'Não selecionado' }), { dataTransfer: { getData: () => 'c2', setData: () => {} } });
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Marcar Ana Paula Ribeiro como não selecionado?');
    expect(banco.movidos).toHaveLength(1);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Marcar e avisar' }));
    await waitFor(() => expect(banco.movidos).toEqual([['c1', 'analise', null], ['c2', 'resultado', 'nao_selecionado']]));
  });

  it('?ver=novos mostra só quem ninguém abriu', async () => {
    abrir('/vagas/educador/candidatos?ver=novos');
    expect(await screen.findByText(/Mostrando só os novos/)).toBeInTheDocument();
    expect(screen.getAllByTestId('cartao')).toHaveLength(1);
  });
});

describe('Painel do RH', () => {
  it('números e o que pede atenção, com link para a vaga filtrada', async () => {
    const { PainelDoRh } = await import('@/components/vagas/PainelDoRh');
    render(<MemoryRouter><PainelDoRh /></MemoryRouter>);
    expect(await screen.findByTestId('kpi-Para triar')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-Vagas abertas')).toHaveTextContent('39');
    expect(screen.getByRole('link', { name: /Educador Social de Música/ })).toHaveAttribute('href', '/vagas/educador/candidatos?ver=novos');
  });
});

describe('processos e responsáveis (19/10/2026)', () => {
  const PROC = (o: Record<string, unknown>) => ({ porColuna: { recebida: 1, analise: 1, entrevista: 0, aprovado: 0, nao_selecionado: 0 }, novos: 1, parados: 0, abertoHa: 24, situacao: 'sem_responsavel', ...o });

  it('o responsável (não RH) entra na vaga dele, sem fechar o resultado', async () => {
    banco.rh = false; banco.responsavel = 'rh1';
    abrir('/vagas/educador/candidatos');
    const quadro = await screen.findByTestId('quadro');
    expect(within(quadro).getAllByText('Só o RH move para cá.')).toHaveLength(2);
    fireEvent.drop(within(quadro).getByRole('region', { name: 'Aprovado' }), { dataTransfer: { getData: () => 'c1', setData: () => {} } });
    expect(banco.movidos).toEqual([]);
  });

  it('na ficha, o responsável vai até Entrevista e não vê Aprovar nem Não seguir', async () => {
    banco.rh = false; banco.responsavel = 'rh1';
    banco.lista[0].etapa = 'entrevista';
    abrir('/vagas/educador/candidatos/c1');
    expect(await screen.findByRole('heading', { name: 'Leonardo Garbo Rodrigues' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aprovar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Não seguir/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Voltar para Análise/ })).toBeInTheDocument();
  });

  it('Processos: sem responsável no topo; definir escolhe a pessoa e o prazo', async () => {
    const { paraVaga } = await import('@/lib/vagas/api');
    banco.processos = [
      PROC({ vaga: paraVaga({ id: 'v2', slug: 'porteiro', titulo: 'Porteiro', area: 'educacao', status: 'publicada', codigo: 'EDU-2026-015', responsavel_id: 'p2' }), situacao: 'no_prazo' }),
      PROC({ vaga: paraVaga({ id: 'v1', slug: 'aux', titulo: 'Auxiliar Administrativo', area: 'administracao', status: 'publicada', codigo: 'ADM-2026-001' }) }),
    ];
    const { ProcessosDoRh } = await import('@/components/vagas/ProcessosDoRh');
    render(<MemoryRouter><ProcessosDoRh /></MemoryRouter>);
    const linhas = await screen.findAllByTestId('processo');
    expect(within(linhas[0]).getByText('Auxiliar Administrativo')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Marcela Zaccarias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sem responsável\s*1/ })).toBeInTheDocument();
    fireEvent.click(within(linhas[0]).getByRole('button', { name: 'Definir' }));
    fireEvent.click(await screen.findByRole('option', { name: /Viviane Mattioli/ }));
    fireEvent.change(screen.getByLabelText(/Prazo do processo/), { target: { value: '2026-11-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e avisar' }));
    await waitFor(() => expect(banco.definidos).toEqual([['v1', 'p1', '2026-11-15']]));
  });

  it('Meus processos mostra só os do responsável', async () => {
    const { paraVaga } = await import('@/lib/vagas/api');
    banco.processos = [PROC({ vaga: paraVaga({ id: 'v1', slug: 'aux', titulo: 'Auxiliar Administrativo', area: 'administracao', status: 'publicada', codigo: 'ADM-2026-001', responsavel_id: 'rh1', prazo_processo: '2026-11-15' }) }), PROC({ vaga: paraVaga({ id: 'v2', slug: 'x', titulo: 'Outra', area: 'social', status: 'publicada', codigo: 'X', responsavel_id: 'outra' }) })];
    const { MeusProcessos } = await import('@/components/vagas/MeusProcessos');
    render(<MemoryRouter><MeusProcessos /></MemoryRouter>);
    const cartoes = await screen.findAllByTestId('meu-processo');
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0]).toHaveTextContent('prazo 15/11');
    expect(within(cartoes[0]).getByRole('link', { name: 'Abrir quadro' })).toHaveAttribute('href', '/vagas/aux/candidatos');
  });
});

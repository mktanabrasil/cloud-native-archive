import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const banco = vi.hoisted(() => ({
  perfil: {} as Record<string, unknown>,
  exps: [] as Array<Record<string, unknown>>,
  vaga: null as null | Record<string, unknown>,
  perguntas: [] as Array<Record<string, unknown>>,
  ativa: null as null | Record<string, unknown>,
  enviadas: [] as Array<Record<string, unknown>>,
  lista: [] as Array<Record<string, unknown>>,
  retiradas: [] as Array<[string, string | null]>,
  erroAoEnviar: null as null | Error,
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo' } }, isAuthenticated: true, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/vagas/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  return {
    ...real,
    buscarVaga: async () => (banco.vaga ? real.paraVaga({ ...banco.vaga }) : null),
    listarPerguntas: async () => banco.perguntas,
  };
});
vi.mock('@/lib/vagas/perfil', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/perfil')>('@/lib/vagas/perfil');
  return { ...real, carregarPerfil: async () => ({ perfil: real.paraPerfil({ ...banco.perfil }), experiencias: banco.exps.map((e) => ({ descricao: '', ...e })) }) };
});
vi.mock('@/lib/vagas/candidatura', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/candidatura')>('@/lib/vagas/candidatura');
  return {
    ...real,
    candidaturaAtiva: async () => banco.ativa,
    enviarCandidatura: async (e: Record<string, unknown>) => {
      if (banco.erroAoEnviar) throw banco.erroAoEnviar;
      banco.enviadas.push(e);
      return { id: 'c1', protocolo: '2026-000418', vaga_id: 'v1', etapa: 'recebida', perfil: {}, requisitos: [], respostas: [], origem: null, curriculo_caminho: null, curriculo_nome: null, retirada_em: null, created_at: '2026-10-06T17:41:00Z' };
    },
    minhasCandidaturas: async () => banco.lista,
    retirarCandidatura: async (id: string, motivo: string | null) => { banco.retiradas.push([id, motivo]); },
  };
});

const { default: Candidatura } = await import('./CandidaturaPage');
const { default: Detalhe } = await import('./CandidaturaDetalhePage');
const { default: MinhaArea } = await import('./MinhaAreaCandidatoPage');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas/:slug/candidatar" element={<Candidatura />} />
      <Route path="/vagas/minha-area/:id" element={<Detalhe />} />
      <Route path="/vagas/minha-area" element={<MinhaArea />} />
    </Routes>
  </MemoryRouter>,
);
const continuar = () => fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

const PERFIL_COMPLETO = {
  nome: 'Leonardo Garbo Rodrigues', nascimento: '2003-10-20', whatsapp: '(19) 99355-8242', cidade: 'Campinas/SP',
  escolaridade: 'superior', disponibilidade: ['manha'], curriculo_caminho: 'u1/curriculo-1.pdf', curriculo_nome: 'cv.pdf',
};

beforeEach(() => {
  banco.perfil = { ...PERFIL_COMPLETO };
  banco.exps = [{ id: 'e1', funcao: 'Educador', onde: 'Instituto', inicio: '2023-03', fim: null, atual: true }];
  banco.vaga = { id: 'v1', slug: 'educador-social-de-musica', titulo: 'Educador Social de Música', area: 'social', status: 'publicada', requisitos: ['Ensino Médio completo', 'Experiência com oficinas'] };
  banco.perguntas = [
    { id: 'p1', vaga_id: 'v1', texto: 'Conte uma oficina que você conduziu', tipo: 'texto_longo', opcoes: [], obrigatoria: true, ordem: 0, bloqueada: false },
    { id: 'p2', vaga_id: 'v1', texto: 'Toca algum instrumento?', tipo: 'sim_nao', opcoes: [], obrigatoria: false, ordem: 1, bloqueada: false },
  ];
  banco.ativa = null; banco.enviadas = []; banco.lista = []; banco.retiradas = []; banco.erroAoEnviar = null;
});

describe('candidatura no app', () => {
  it('os 4 passos até o protocolo, com a cópia do perfil, os requisitos e as respostas', async () => {
    abrir('/vagas/educador-social-de-musica/candidatar');
    expect(await screen.findByRole('heading', { name: 'Confira o que vai junto' })).toBeInTheDocument();
    expect(within(screen.getByTestId('resumo-do-perfil')).getByText('Leonardo Garbo Rodrigues')).toBeInTheDocument();
    continuar();

    expect(await screen.findByRole('heading', { name: 'Marque o que você atende' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ensino Médio completo' }));
    continuar();

    expect(await screen.findByRole('heading', { name: 'Perguntas da vaga' })).toBeInTheDocument();
    continuar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Conte uma oficina');
    fireEvent.change(screen.getByLabelText(/Conte uma oficina/), { target: { value: 'Percussão com latas' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Instagram' }));
    continuar();

    expect(await screen.findByRole('heading', { name: 'Tudo certo para enviar?' })).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar candidatura' }));

    expect(await screen.findByRole('heading', { name: 'Candidatura enviada!' })).toBeInTheDocument();
    expect(screen.getByTestId('protocolo')).toHaveTextContent('2026-000418');
    expect(screen.getByRole('link', { name: /Acompanhar/ })).toHaveAttribute('href', '/vagas/minha-area/c1');

    const e = banco.enviadas[0];
    expect(e).toMatchObject({
      userId: 'u1', vagaId: 'v1', origem: 'Instagram',
      requisitos: [{ texto: 'Ensino Médio completo', atende: true }, { texto: 'Experiência com oficinas', atende: false }],
      respostas: [{ pergunta_id: 'p1', texto: 'Conte uma oficina que você conduziu', tipo: 'texto_longo', resposta: 'Percussão com latas' }],
      curriculo: { caminho: 'u1/curriculo-1.pdf', nome: 'cv.pdf' },
    });
    expect((e.perfil as Record<string, unknown>).email).toBe('leo@exemplo.com');
    expect((e.perfil as { experiencias: unknown[] }).experiencias).toHaveLength(1);
    expect(e.perfil).not.toHaveProperty('curriculo_caminho');
  });

  it('perfil incompleto trava e leva ao passo que falta, com volta para a candidatura', async () => {
    banco.perfil = { ...PERFIL_COMPLETO, whatsapp: '', disponibilidade: [] };
    abrir('/vagas/educador-social-de-musica/candidatar');
    expect(await screen.findByRole('heading', { name: 'Falta pouco no seu perfil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Contato/ })).toHaveAttribute('href', '/vagas/meu-perfil?passo=1&volta=%2Fvagas%2Feducador-social-de-musica%2Fcandidatar');
    expect(screen.getByRole('link', { name: /Disponibilidade/ })).toHaveAttribute('href', expect.stringContaining('passo=4'));
  });

  it('já se candidatou: mostra o protocolo e o acompanhamento, sem novo envio', async () => {
    banco.ativa = { id: 'c9', protocolo: '2026-000100', vaga_id: 'v1', etapa: 'analise', perfil: {}, requisitos: [], respostas: [], retirada_em: null, created_at: '2026-10-01T12:00:00Z' };
    abrir('/vagas/educador-social-de-musica/candidatar');
    expect(await screen.findByRole('heading', { name: 'Você já se candidatou a esta vaga.' })).toBeInTheDocument();
    expect(screen.getByText('2026-000100')).toBeInTheDocument();
  });

  it('vaga fechada: avisa e leva às vagas abertas', async () => {
    banco.vaga = null;
    abrir('/vagas/fechou/candidatar');
    expect(await screen.findByRole('heading', { name: 'Esta vaga não está mais aberta.' })).toBeInTheDocument();
  });
});

const CAND = { id: 'c1', protocolo: '2026-000418', vaga_id: 'v1', etapa: 'recebida', perfil: {}, requisitos: [{ texto: 'A', atende: true }, { texto: 'B', atende: false }], respostas: [], origem: null, curriculo_caminho: null, curriculo_nome: 'cv.pdf', retirada_em: null, created_at: '2026-10-06T17:41:00Z', vaga: { titulo: 'Educador Social de Música', slug: 'educador-social-de-musica', area: 'social' } };

describe('acompanhar', () => {
  it('Minha área lista a candidatura com a etapa', async () => {
    banco.lista = [CAND];
    abrir('/vagas/minha-area');
    const item = await screen.findByTestId('candidatura');
    expect(item).toHaveAttribute('href', '/vagas/minha-area/c1');
    expect(within(item).getByText('Educador Social de Música')).toBeInTheDocument();
    expect(within(item).getByRole('img', { name: 'Etapa: Recebida' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Áreas do candidato' })).toBeInTheDocument();
  });

  it('retirar pede confirmação e manda o motivo', async () => {
    banco.lista = [CAND];
    abrir('/vagas/minha-area/c1');
    expect(await screen.findByRole('heading', { name: 'Educador Social de Música' })).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirar candidatura' }));
    const caixa = screen.getByRole('alert');
    fireEvent.click(within(caixa).getByRole('button', { name: 'Consegui outra oportunidade' }));
    fireEvent.click(within(caixa).getByRole('button', { name: 'Retirar candidatura' }));
    expect(await screen.findByText(/Você retirou esta candidatura/)).toBeInTheDocument();
    expect(banco.retiradas).toEqual([['c1', 'Consegui outra oportunidade']]);
  });
});

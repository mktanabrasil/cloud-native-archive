import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/** Passo 5 do roteiro (20/10/2026): mensagens pela ficha, respostas e avisos. */

const banco = vi.hoisted(() => ({
  conta: 'equipe' as 'equipe' | 'candidato',
  msgs: [] as Array<Record<string, unknown>>,
  enviadas: [] as Array<[string, string, string, unknown]>,
  respostas: [] as Array<[string, string, string | undefined]>,
  lidas: [] as string[],
  vistos: 0,
  etapa: 'analise',
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => (banco.conta === 'equipe'
    ? { user: { id: 'rh1', email: 'carla@anabrasil.org', user_metadata: {} }, isAuthenticated: true, loading: false, signOut: vi.fn() }
    : { user: { id: 'u1', email: 'leo@x.com', user_metadata: { conta: 'candidato', name: 'Leonardo' } }, isAuthenticated: true, loading: false, signOut: vi.fn() }),
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: banco.conta === 'equipe', loading: false, userName: 'Carla' }) }));
vi.mock('@/lib/vagas/rh', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/rh')>('@/lib/vagas/rh');
  const { paraVaga } = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  const { paraCandidatura } = await vi.importActual<typeof import('@/lib/vagas/candidatura')>('@/lib/vagas/candidatura');
  return {
    ...real,
    buscarVagaDoRh: async () => paraVaga({ id: 'v1', slug: 'aux', titulo: 'Auxiliar Administrativo', codigo: 'ADM-1', area: 'administracao', status: 'publicada' }),
    umaCandidatura: async () => ({
      ...paraCandidatura({ id: 'c1', protocolo: '2026-000142', vaga_id: 'v1', etapa: banco.etapa, resultado: null, perfil: { nome: 'Leonardo Garbo Rodrigues' }, requisitos: [], respostas: [], created_at: '2026-10-16T12:00:00Z' }),
      aberta_em: '2026-10-17T12:00:00Z',
    }),
    abrirCandidatura: async () => {},
    historico: async () => [],
    lerObservacoes: async () => '',
  };
});
vi.mock('@/lib/vagas/candidatura', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/candidatura')>('@/lib/vagas/candidatura');
  return {
    ...real,
    minhasCandidaturas: async () => [real.paraCandidatura({ id: 'c1', protocolo: '2026-000142', vaga_id: 'v1', etapa: 'entrevista', resultado: null, perfil: {}, requisitos: [], respostas: [], created_at: '2026-10-16T12:00:00Z', vagas: { titulo: 'Auxiliar Administrativo', slug: 'aux' } })],
  };
});
vi.mock('@/lib/vagas/perfil', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/perfil')>('@/lib/vagas/perfil');
  return { ...real, carregarPerfil: async () => { throw new Error('sem perfil no teste'); } };
});
vi.mock('@/lib/vagas/mensagens', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/mensagens')>('@/lib/vagas/mensagens');
  return {
    ...real,
    mensagensDa: async () => banco.msgs,
    minhasMensagens: async () => banco.msgs,
    enviarMensagem: async (c: string, tipo: string, texto: string, e: unknown) => { banco.enviadas.push([c, tipo, texto, e]); return { moveu: tipo === 'convite', falhouEmail: false }; },
    responderMensagem: async (id: string, texto: string, presenca?: string) => { banco.respostas.push([id, texto, presenca]); },
    marcarLidas: async (c: string) => { banco.lidas.push(c); },
    meusAvisos: async () => [
      { candidatura_id: 'c1', tipo: 'convite', texto: 'Convite para entrevista', vaga: 'Auxiliar Administrativo', em: '2026-10-20T12:00:00Z', novo: true },
      { candidatura_id: 'c1', tipo: 'enviada', texto: 'Recebemos sua candidatura · protocolo 2026-000142', vaga: 'Auxiliar Administrativo', em: '2026-10-16T12:00:00Z', novo: false },
    ],
    marcarAvisosVistos: async () => { banco.vistos++; },
  };
});

const { default: Ficha } = await import('./FichaDoCandidatoPage');
const { default: Detalhe } = await import('./CandidaturaDetalhePage');
const { default: Avisos } = await import('./AvisosCandidatoPage');
const { default: MinhaArea } = await import('./MinhaAreaCandidatoPage');
const { textoDoModelo, pendentesDoCandidato } = await import('@/lib/vagas/mensagens');
const { textoDoMovimento } = await import('@/lib/vagas/rh');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas/:slug/candidatos/:id" element={<Ficha />} />
      <Route path="/vagas/minha-area" element={<MinhaArea />} />
      <Route path="/vagas/minha-area/:id" element={<Detalhe />} />
      <Route path="/vagas/avisos" element={<Avisos />} />
    </Routes>
  </MemoryRouter>,
);

const M = (o: Record<string, unknown>) => ({ id: 'm1', candidatura_id: 'c1', autor: 'equipe', tipo: 'recado', texto: 'Olá', entrevista: null, responde_a: null, presenca: null, por: 'Carla', lida_em: null, created_at: '2026-10-20T12:00:00Z', ...o });
const CONVITE = M({ id: 'm1', tipo: 'convite', texto: 'Sua entrevista será dia 24/10.', entrevista: { dia: '2026-10-24', hora: '14:00', formato: 'presencial', local: 'Sede' } });
const PERGUNTA = M({ id: 'm2', tipo: 'pergunta', texto: 'Sábado de manhã?' });

beforeEach(() => {
  banco.conta = 'equipe'; banco.msgs = []; banco.enviadas = []; banco.respostas = []; banco.lidas = []; banco.vistos = 0; banco.etapa = 'analise';
});

describe('regras das mensagens', () => {
  it('o texto do convite acompanha dia, horário e local', () => {
    const t = textoDoModelo('convite', 'Leonardo Garbo', 'Auxiliar Administrativo', { dia: '2026-10-24', hora: '14:00', formato: 'presencial', local: 'Sede' });
    expect(t).toContain('Olá, Leonardo!');
    expect(t).toContain('24/10, às 14:00, em Sede');
    expect(t).toContain('documento com foto');
    expect(textoDoModelo('convite', 'Leo', 'X', { dia: '2026-10-24', hora: '9:00', formato: 'telefone', local: '' })).toContain('por telefone');
  });

  it('só convite sem presença e pergunta sem resposta esperam o candidato', () => {
    const resp = M({ id: 'r1', autor: 'candidato', tipo: 'resposta', responde_a: 'm2' });
    expect(pendentesDoCandidato([CONVITE, PERGUNTA, M({ id: 'm3' })] as never).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(pendentesDoCandidato([{ ...CONVITE, presenca: 'confirmada' }, PERGUNTA, resp] as never)).toEqual([]);
  });

  it('o histórico conta mensagens e respostas', () => {
    expect(textoDoMovimento({ acao: 'mensagem', de: null, para: 'convite', por: 'Carla', em: '' })).toBe('Convite para entrevista enviada · Carla');
    expect(textoDoMovimento({ acao: 'resposta', de: null, para: 'confirmada', por: 'candidato', em: '' })).toBe('Candidato confirmou presença');
    expect(textoDoMovimento({ acao: 'resposta', de: null, para: 'pergunta', por: 'candidato', em: '' })).toBe('Candidato respondeu');
  });
});

describe('ficha: enviar mensagem', () => {
  it('convite só sai com dia e horário, e avisa que move para Entrevista', async () => {
    abrir('/vagas/aux/candidatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensagem/ }));
    const enviar = await screen.findByRole('button', { name: /Enviar e mover para Entrevista/ });
    expect(enviar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: '2026-10-24' } });
    fireEvent.change(screen.getByLabelText('Horário'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Sede' } });
    expect((screen.getByRole('textbox', { name: /Texto/ }) as HTMLTextAreaElement).value).toContain('Auxiliar Administrativo será no dia 24/10, às 14:00, em Sede');
    fireEvent.click(enviar);
    await waitFor(() => expect(banco.enviadas).toHaveLength(1));
    expect(banco.enviadas[0][0]).toBe('c1');
    expect(banco.enviadas[0][1]).toBe('convite');
    expect(banco.enviadas[0][3]).toEqual({ dia: '2026-10-24', hora: '14:00', formato: 'presencial', local: 'Sede' });
  });

  it('pedir informação manda o texto escrito pelo RH', async () => {
    abrir('/vagas/aux/candidatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensagem/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir informação' }));
    const caixa = screen.getByRole('textbox', { name: /Texto/ });
    fireEvent.change(caixa, { target: { value: 'Você pode aos sábados?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Enviar$/ }));
    await waitFor(() => expect(banco.enviadas).toEqual([['c1', 'pergunta', 'Você pode aos sábados?', undefined]]));
  });

  it('depois do resultado não há convite', async () => {
    banco.etapa = 'resultado';
    abrir('/vagas/aux/candidatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensagem/ }));
    await screen.findByRole('button', { name: 'Mensagem livre' });
    expect(screen.queryByRole('button', { name: 'Convite para entrevista' })).toBeNull();
  });

  it('aba Mensagens: conta as respostas não lidas, mostra presença e marca como lidas', async () => {
    banco.msgs = [{ ...CONVITE, presenca: 'confirmada', lida_em: '2026-10-20T13:00:00Z' }, M({ id: 'r1', autor: 'candidato', tipo: 'resposta', texto: 'Confirmo presença.', responde_a: 'm1' })];
    abrir('/vagas/aux/candidatos/c1');
    const aba = await screen.findByRole('tab', { name: /Mensagens/ });
    expect(aba).toHaveTextContent('1');
    fireEvent.click(aba);
    expect(await screen.findByText('Presença confirmada')).toBeInTheDocument();
    expect(screen.getByText('Leonardo respondeu')).toBeInTheDocument();
    await waitFor(() => expect(banco.lidas).toEqual(['c1']));
  });
});

describe('candidato', () => {
  beforeEach(() => { banco.conta = 'candidato'; });

  it('convite no topo: confirmar presença responde e marca as mensagens como lidas', async () => {
    banco.msgs = [CONVITE];
    abrir('/vagas/minha-area/c1');
    fireEvent.click(await screen.findByRole('button', { name: /Confirmo presença/ }));
    await waitFor(() => expect(banco.respostas).toEqual([['m1', '', 'confirmada']]));
    expect(banco.lidas).toEqual(['c1']);
  });

  it('"Não posso nesse horário" pede quando pode antes de avisar', async () => {
    banco.msgs = [CONVITE];
    abrir('/vagas/minha-area/c1');
    fireEvent.click(await screen.findByRole('button', { name: 'Não posso nesse horário' }));
    const avisar = screen.getByRole('button', { name: 'Avisar o RH' });
    expect(avisar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Que dias e horários/), { target: { value: 'terça à tarde' } });
    fireEvent.click(avisar);
    await waitFor(() => expect(banco.respostas).toEqual([['m1', 'terça à tarde', 'nao_pode']]));
  });

  it('pergunta tem campo de resposta; recado não', async () => {
    banco.msgs = [PERGUNTA, M({ id: 'm3', texto: 'Obrigado pela candidatura!' })];
    abrir('/vagas/minha-area/c1');
    fireEvent.change(await screen.findByLabelText('Sua resposta'), { target: { value: 'Posso sim.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await waitFor(() => expect(banco.respostas).toEqual([['m2', 'Posso sim.', undefined]]));
    expect(screen.getByText('Obrigado pela candidatura!')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Sua resposta')).toHaveLength(1);
  });

  it('Minha área: selo do convite e sino com o que é novo', async () => {
    banco.msgs = [CONVITE];
    abrir('/vagas/minha-area');
    expect(await screen.findByText('Convite para entrevista')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Avisos, 1 novo' })).toHaveAttribute('href', '/vagas/avisos');
  });

  it('Avisos: lista do mais novo ao mais antigo e marca como visto', async () => {
    abrir('/vagas/avisos');
    const links = await screen.findAllByRole('link', { name: /Auxiliar Administrativo/ });
    expect(links[0]).toHaveTextContent('Convite para entrevista');
    expect(links[0]).toHaveAttribute('href', '/vagas/minha-area/c1');
    await waitFor(() => expect(banco.vistos).toBe(1));
  });
});

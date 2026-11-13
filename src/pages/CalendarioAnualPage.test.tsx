import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * /calendario (14/11/2026): cada um vê o que é seu. Sem sessão, a entrada; a
 * conta do calendário, o preenchimento (se o marketing liberou); o marketing,
 * o preenchimento e quem tem acesso; o resto da equipe, o calendário de
 * eventos no hub.
 */
const estado = vi.hoisted(() => ({
  auth: { isAuthenticated: false, loading: false, user: null as unknown, signOut: vi.fn() },
  papel: { isMarketing: false, loading: false, soCalendario: false },
  acesso: null as unknown,
  vistos: new Set<string>(),
  marcados: [] as string[],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
// O tutorial (13/11/2026): o "já vi" por conta, simulado.
vi.mock('@/hooks/useTutoriaisVistos', () => ({ useTutoriaisVistos: () => ({ carregado: true, jaViu: (r: string) => estado.vistos.has(r), marcarVisto: (r: string) => { estado.marcados.push(r); }, esquecer: () => {} }) }));
vi.mock('@/components/ThemeToggle', () => ({ TemaFlutuante: () => null }));
vi.mock('@/components/news/InstitutionalFooterBar', () => ({ default: () => null }));
vi.mock('@/lib/calendario/api', () => ({
  ANO_DO_CALENDARIO: 2027,
  meuAcesso: async () => estado.acesso,
  lerAno: async () => ({ ano: 2027, tema: '', percursos: [], textos: {}, meses_revisados: [], capa_url: null, status: 'preenchimento', observacao: null, enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null }),
  lerItens: async () => [],
  salvarAno: vi.fn(), listarAcessos: async () => [],
}));

const { default: CalendarioAnualPage } = await import('./CalendarioAnualPage');
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };
const abrir = (url = '/calendario') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/calendario" element={<CalendarioAnualPage />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  estado.auth = { isAuthenticated: false, loading: false, user: null, signOut: vi.fn() };
  estado.papel = { isMarketing: false, loading: false, soCalendario: false };
  estado.acesso = null;
  estado.vistos = new Set(['calendario-inicio', 'calendario-mes']);
  estado.marcados = [];
});

describe('quem chega em /calendario', () => {
  it('sem sessão: a entrada, com primeiro acesso', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Calendário Anual' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Primeiro acesso' })).toBeInTheDocument();
  });

  it('conta do calendário sem liberação: o aviso, e nada do calendário', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'coord@ana.org', user_metadata: { conta: 'calendario', name: 'Coord' } } };
    abrir();
    expect(await screen.findByText('Seu acesso ainda não foi liberado')).toBeInTheDocument();
  });

  it('conta do calendário liberada: o preenchimento, sem a lista de acessos', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'coord@ana.org', user_metadata: { conta: 'calendario', name: 'Coord' } } };
    estado.acesso = { email: 'coord@ana.org', nome: 'Coord', ativo: true };
    abrir();
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /coordenadoras com acesso/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /app/i })).not.toBeInTheDocument();
  });

  it('o marketing: o preenchimento e quem tem acesso', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'mkt@anabrasil.org', user_metadata: {} } };
    estado.papel = { isMarketing: true, loading: false, soCalendario: false };
    abrir();
    expect(await screen.findByRole('button', { name: /coordenadoras com acesso/i })).toBeInTheDocument();
  });

  it('a gestora liberada na lista (13/11/2026): o preenchimento; com só o calendário, sem o atalho para o app', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'dic@anabrasil.org', user_metadata: { name: 'Gestão DIC' } } };
    estado.acesso = { email: 'dic@anabrasil.org', nome: 'Gestão DIC', ativo: true, so_calendario: true };
    estado.papel = { isMarketing: false, loading: false, soCalendario: true };
    abrir();
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /app/i })).not.toBeInTheDocument();
  });

  it('a gestora liberada, já solta do só o calendário: o preenchimento e o atalho para o app', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'dic@anabrasil.org', user_metadata: { name: 'Gestão DIC' } } };
    estado.acesso = { email: 'dic@anabrasil.org', nome: 'Gestão DIC', ativo: true, so_calendario: false };
    abrir();
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /app/i })).toBeInTheDocument();
  });

  it('o resto da equipe: o calendário de eventos, no hub (com o que veio na URL)', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'dic@anabrasil.org', user_metadata: {} } };
    abrir('/calendario?conflitos=true');
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/?tela=calendario&conflitos=true'));
  });
});

describe('o tutorial do calendário (13/11/2026)', () => {
  const coordenadora = () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'coord@ana.org', user_metadata: { conta: 'calendario', name: 'Coord' } } };
    estado.acesso = { email: 'coord@ana.org', nome: 'Coord', ativo: true, so_calendario: true };
  };

  it('abre sozinho no primeiro acesso e marca como visto ao terminar', async () => {
    coordenadora();
    estado.vistos = new Set();
    abrir();
    const dialogo = await screen.findByRole('dialog', { name: 'Tutorial do Calendário Anual' });
    expect(dialogo).toHaveTextContent('Aqui vocês montam o Calendário Anual');
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    expect(estado.marcados).toEqual(['calendario-inicio']);
  });

  it('depois de visto, não abre sozinho; volta pelo botão', async () => {
    coordenadora();
    abrir();
    await screen.findByRole('heading', { name: 'Calendário Anual 2027' });
    expect(screen.queryByRole('dialog', { name: 'Tutorial do Calendário Anual' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver o tutorial/i }));
    expect(screen.getByRole('dialog', { name: 'Tutorial do Calendário Anual' })).toBeInTheDocument();
  });

  it('no mês a mês, o roteiro do mês', async () => {
    coordenadora();
    estado.vistos = new Set(['calendario-inicio']);
    abrir('/calendario?parte=mes&m=2');
    expect(await screen.findByRole('dialog', { name: 'Tutorial do Calendário Anual' })).toHaveTextContent('O tema do mês');
  });
});

describe('os textos do projeto (13/11/2026)', () => {
  const coordenadora = () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'coord@ana.org', user_metadata: { conta: 'calendario', name: 'Coord' } } };
    estado.acesso = { email: 'coord@ana.org', nome: 'Coord', ativo: true };
  };

  it('o início leva aos textos, que vêm de 2026 agrupados pela página do PDF', async () => {
    coordenadora();
    abrir();
    await screen.findByRole('heading', { name: 'Calendário Anual 2027' });
    expect(screen.getByText('Vieram de 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('heading', { name: '4. Textos do projeto' }).parentElement!.querySelector('button')!);
    expect(await screen.findByRole('heading', { name: 'Textos do projeto · 2027' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Página 2 do PDF' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Página 10 do PDF' })).toBeInTheDocument();
    expect((screen.getByLabelText('SERVIÇO DE CONVIVÊNCIA E FORTALECIMENTO DE VÍNCULOS - SCFV') as HTMLTextAreaElement).value).toMatch(/^Trata-se de um serviço/);
    expect(screen.getByRole('button', { name: 'Tudo salvo' })).toBeDisabled();
  });

  it('grava só o que mudou; voltar ao texto de 2026 tira a seção do que vai para o banco', async () => {
    coordenadora();
    const { salvarAno } = await import('@/lib/calendario/api');
    vi.mocked(salvarAno).mockImplementation(async (_ano, c) => ({ ...(await (await import('@/lib/calendario/api')).lerAno(2027)), ...c }) as never);
    abrir('/calendario?parte=textos');
    const campo = await screen.findByLabelText('METODOLOGIA');
    fireEvent.change(campo, { target: { value: 'Texto novo da metodologia.' } });
    expect(screen.getByText('Editado')).toBeInTheDocument();
    const avaliacao = screen.getByLabelText('AVALIAÇÃO');
    const original = (avaliacao as HTMLTextAreaElement).value;
    fireEvent.change(avaliacao, { target: { value: original + ' Mais.' } });
    fireEvent.change(avaliacao, { target: { value: original } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar os textos' }));
    await waitFor(() => expect(salvarAno).toHaveBeenCalledWith(2027, { textos: { metodologia: 'Texto novo da metodologia.' } }));
    expect(await screen.findByRole('button', { name: 'Tudo salvo' })).toBeDisabled();
  });
});

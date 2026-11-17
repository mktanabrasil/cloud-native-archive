import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * /social/calendario (14/11/2026): cada um vê o que é seu. Desde 17/11/2026
 * o calendário é uma página do setor Social: sem sessão, o login do app; o
 * marketing e a gestão do Social, o preenchimento dentro do app; o resto da
 * equipe, o calendário de eventos no hub; a conta antiga só do calendário, um
 * aviso.
 */
const estado = vi.hoisted(() => ({
  auth: { isAuthenticated: false, loading: false, user: null as unknown, signOut: vi.fn() },
  papel: { isMarketing: false, temCalendarioAnual: false, loading: false },
  vistos: new Set<string>(),
  marcados: [] as string[],
  itens: [] as unknown[],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
// O tutorial (13/11/2026): o "já vi" por conta, simulado.
vi.mock('@/hooks/useTutoriaisVistos', () => ({ useTutoriaisVistos: () => ({ carregado: true, jaViu: (r: string) => estado.vistos.has(r), marcarVisto: (r: string) => { estado.marcados.push(r); }, esquecer: () => {} }) }));
vi.mock('@/components/ThemeToggle', () => ({ TemaFlutuante: () => null }));
vi.mock('@/components/news/InstitutionalFooterBar', () => ({ default: () => null }));
// Setores (16/11/2026): a equipe vê o calendário dentro do app; a barra em si tem os testes dela.
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div data-testid="dentro-do-app">{children}</div> }));
vi.mock('@/lib/calendario/api', () => ({
  ANO_DO_CALENDARIO: 2027,
  lerAno: async () => ({ ano: 2027, tema: '', percursos: [], textos: {}, meses_revisados: [], capa_url: null, status: 'preenchimento', observacao: null, enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null }),
  lerItens: async () => estado.itens,
  salvarAno: vi.fn(),
  enviarAoMarketing: vi.fn(), devolverAsCoordenadoras: vi.fn(), aprovarComPdf: vi.fn(), trocarCapa: vi.fn(), linkDoArquivo: vi.fn(async () => 'https://x'),
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
  estado.papel = { isMarketing: false, temCalendarioAnual: false, loading: false };
  estado.vistos = new Set(['calendario-inicio', 'calendario-mes']);
  estado.marcados = [];
  estado.itens = [];
});

/** A gestão de uma unidade do Social (17/11/2026: quem preenche, pela regra do setor). */
function gestora() {
  estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'dic@anabrasil.org', user_metadata: { name: 'Gestão DIC' } } };
  estado.papel = { isMarketing: false, temCalendarioAnual: true, loading: false };
}

describe('quem chega em /calendario', () => {
  it('sem sessão: o login do app, que volta para cá', () => {
    abrir('/calendario?parte=mes');
    expect(screen.getByTestId('onde')).toHaveTextContent('/login?redirect=%2Fcalendario%3Fparte%3Dmes');
  });

  it('conta antiga só do calendário: o aviso, e nada do calendário', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'coord@ana.org', user_metadata: { conta: 'calendario', name: 'Coord' } } };
    abrir();
    expect(await screen.findByText('O Calendário Anual mudou de lugar')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Calendário Anual 2027' })).not.toBeInTheDocument();
  });

  it('o marketing: o preenchimento dentro do app, sem lista de acesso', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'mkt@anabrasil.org', user_metadata: {} } };
    estado.papel = { isMarketing: true, temCalendarioAnual: true, loading: false };
    abrir();
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027' })).toBeInTheDocument();
    expect(screen.getByTestId('dentro-do-app')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /coordenadoras com acesso/i })).not.toBeInTheDocument();
  });

  it('a gestão do Social: o preenchimento dentro do app', async () => {
    gestora();
    abrir();
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027' })).toBeInTheDocument();
    expect(screen.getByTestId('dentro-do-app')).toBeInTheDocument();
  });

  it('o resto da equipe: o calendário de eventos, no hub (com o que veio na URL)', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'educador@anabrasil.org', user_metadata: {} } };
    abrir('/calendario?conflitos=true');
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/social/eventos?tela=calendario&conflitos=true'));
  });
});

describe('o tutorial do calendário (13/11/2026)', () => {
  const coordenadora = gestora;

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
  const coordenadora = gestora;

  it('o início leva aos textos, que vêm de 2026 agrupados pela página do PDF', async () => {
    coordenadora();
    abrir();
    await screen.findByRole('heading', { name: 'Calendário Anual 2027' });
    expect(screen.getByText('Vieram de 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('heading', { name: '4. Textos do projeto' }).parentElement!.querySelector('button')!);
    expect(await screen.findByRole('heading', { name: 'Textos do projeto · 2027' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Página 2 do PDF' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Página 10 do PDF' })).toBeInTheDocument();
    expect((screen.getByLabelText('Texto: SERVIÇO DE CONVIVÊNCIA E FORTALECIMENTO DE VÍNCULOS - SCFV') as HTMLTextAreaElement).value).toMatch(/^Trata-se de um serviço/);
    expect(screen.getByRole('button', { name: 'Tudo salvo' })).toBeDisabled();
  });

  it('grava só o que mudou; voltar ao texto de 2026 tira a seção do que vai para o banco', async () => {
    coordenadora();
    const { salvarAno } = await import('@/lib/calendario/api');
    vi.mocked(salvarAno).mockImplementation(async (_ano, c) => ({ ...(await (await import('@/lib/calendario/api')).lerAno(2027)), ...c }) as never);
    abrir('/calendario?parte=textos');
    const campo = await screen.findByLabelText('Texto: METODOLOGIA');
    fireEvent.change(campo, { target: { value: 'Texto novo da metodologia.' } });
    expect(screen.getByText('Editado')).toBeInTheDocument();
    const avaliacao = screen.getByLabelText('Texto: AVALIAÇÃO');
    const original = (avaliacao as HTMLTextAreaElement).value;
    fireEvent.change(avaliacao, { target: { value: original + ' Mais.' } });
    fireEvent.change(avaliacao, { target: { value: original } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar os textos' }));
    await waitFor(() => expect(salvarAno).toHaveBeenCalledWith(2027, { textos: { metodologia: 'Texto novo da metodologia.' } }));
    expect(await screen.findByRole('button', { name: 'Tudo salvo' })).toBeDisabled();
  });

  // Os títulos também se editam (17/11/2026): vêm preenchidos e só o que mudou é gravado.
  it('o título vem preenchido, edita e é gravado ao lado do texto; voltar ao de 2026 desfaz os dois', async () => {
    coordenadora();
    const { salvarAno } = await import('@/lib/calendario/api');
    vi.mocked(salvarAno).mockClear();
    vi.mocked(salvarAno).mockImplementation(async (_ano, c) => ({ ...(await (await import('@/lib/calendario/api')).lerAno(2027)), ...c }) as never);
    abrir('/calendario?parte=textos');
    await screen.findByLabelText('Texto: JUSTIFICATIVA');
    const titulos = screen.getAllByRole('textbox', { name: 'Título da seção' }) as HTMLInputElement[];
    expect(titulos[0].value).toBe('SERVIÇO DE CONVIVÊNCIA E FORTALECIMENTO DE VÍNCULOS - SCFV');
    const justificativa = titulos.find((t) => t.value === 'JUSTIFICATIVA')!;
    fireEvent.change(justificativa, { target: { value: 'POR QUE ESTE PROJETO' } });
    expect(screen.getByText('Editado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar os textos' }));
    await waitFor(() => expect(salvarAno).toHaveBeenCalledWith(2027, { textos: { 'titulo:justificativa': 'POR QUE ESTE PROJETO' } }));

    fireEvent.click(await screen.findByRole('button', { name: /voltar ao texto de 2026/i }));
    expect(screen.getByLabelText('Texto: JUSTIFICATIVA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar os textos' }));
    await waitFor(() => expect(salvarAno).toHaveBeenLastCalledWith(2027, { textos: {} }));
  });
});

describe('autoria e revisão (13/11/2026)', () => {
  const coordenadora = gestora;

  it('no dia, a atividade mostra quem acrescentou', async () => {
    coordenadora();
    estado.itens = [{ id: 'a', ano: 2027, dia: '2027-03-01', texto: 'Reunião com as famílias', tipo: 'atividade', unidades: [], destaque: true, oculto: false, fonte: null, criado_por_nome: 'Gestão DIC', criado_em: '2026-11-13T15:00:00Z' }];
    abrir('/calendario?parte=mes&m=3');
    expect((await screen.findAllByTestId('autoria-do-item'))[0]).toHaveTextContent('Por Gestão DIC · 13/11');
  });

  it('o marketing abre a revisão; a coordenadora que tenta cai no início', async () => {
    estado.auth = { ...estado.auth, isAuthenticated: true, user: { email: 'mkt@anabrasil.org', user_metadata: { name: 'MKT ANA' } } };
    estado.papel = { isMarketing: true, temCalendarioAnual: true, loading: false };
    const { unmount } = abrir('/calendario?parte=revisao');
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027 · revisão' })).toBeInTheDocument();
    unmount();
    estado.papel = { isMarketing: false, temCalendarioAnual: false, loading: false };
    coordenadora();
    abrir('/calendario?parte=revisao');
    expect(await screen.findByRole('heading', { name: 'Calendário Anual 2027' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /revisão/ })).not.toBeInTheDocument();
  });
});

describe('unidade nova nos textos (13/11/2026)', () => {
  it('o botão acrescenta a ANA IV, em branco; ela é gravada mesmo vazia; a última pode sair', async () => {
    gestora();
    const { salvarAno } = await import('@/lib/calendario/api');
    vi.mocked(salvarAno).mockReset();
    vi.mocked(salvarAno).mockImplementation(async (_ano, c) => ({ ...(await (await import('@/lib/calendario/api')).lerAno(2027)), ...c }) as never);
    abrir('/calendario?parte=textos');
    fireEvent.click(await screen.findByRole('button', { name: 'Acrescentar unidade (ANA IV)' }));
    expect(screen.getByLabelText('Texto: ANA IV')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Acrescentar unidade (ANA V)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acrescentar unidade (ANA V)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a ANA V' }));
    expect(screen.queryByLabelText('Texto: ANA V')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Texto: ANA IV'), { target: { value: 'A unidade nova.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar os textos' }));
    await waitFor(() => expect(salvarAno).toHaveBeenCalledWith(2027, { textos: { 'ana-4': 'A unidade nova.' } }));
  });
});

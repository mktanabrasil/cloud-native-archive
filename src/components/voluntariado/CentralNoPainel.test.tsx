import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** A Central do Voluntário no painel do Marketing (13/11/2026): números, cronograma e avisos. */

const e = vi.hoisted(() => ({
  itens: [] as Array<Record<string, unknown>>,
  avisos: [] as Array<Record<string, unknown>>,
  presencas: [] as Array<Record<string, unknown>>,
  comAvisos: new Set<string>(),
  salvos: [] as Array<[Record<string, unknown>, string | undefined]>,
  apagados: [] as string[],
  criados: [] as Array<Record<string, unknown>>,
  cancelados: [] as string[],
  erros: [] as string[],
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (m: string) => { e.erros.push(m); }, message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/voluntariado/central', async (original) => ({
  ...(await original<typeof import('@/lib/voluntariado/central')>()),
  listarCronograma: async () => e.itens,
  listarAvisos: async () => e.avisos,
  listarPresencas: async () => e.presencas,
  voluntariosComAvisos: async () => e.comAvisos,
  salvarItem: async (i: Record<string, unknown>, id?: string) => { e.salvos.push([i, id]); },
  apagarItem: async (id: string) => { e.apagados.push(id); },
  criarAviso: async (a: Record<string, unknown>) => { e.criados.push(a); },
  apagarAviso: async (id: string) => { e.cancelados.push(id); },
}));

const { CentralNoPainel } = await import('./CentralNoPainel');

const INSC = [
  { id: 'v1', opcao1: 'cozinha', horario: 'manha' },
  { id: 'v2', opcao1: 'inflaveis', horario: 'dia_todo' },
  { id: 'v3', opcao1: 'cozinha', horario: 'tarde' },
] as never[];
const ITEM = { id: 'c1', dia: '2026-12-08', inicio: '07:00', fim: '12:00', titulo: 'Cozinha: café e almoço', tipo: 'atividade', local: 'Cozinha', detalhe: null, areas: ['cozinha'], horarios: ['manha'], avisar_min: 15, aviso_texto: null };

beforeEach(() => {
  e.itens = [ITEM]; e.presencas = [{ voluntario_id: 'v1', momento: 'treinamento', registrado_em: 'x' }];
  e.avisos = [
    { id: 'a1', titulo: 'É amanhã!', texto: 'Natal Feliz.', enviar_em: '2099-12-07T21:00:00Z', areas: [], horarios: [], cronograma_id: null, enviado_em: null, pulado: false, entregues: 0, falhas: 0 },
    { id: 'a2', titulo: 'Cozinha: café e almoço', texto: 'Começa às 7h · Cozinha', enviar_em: '2099-12-08T09:45:00Z', areas: ['cozinha'], horarios: ['manha'], cronograma_id: 'c1', enviado_em: null, pulado: false, entregues: 0, falhas: 0 },
    { id: 'a3', titulo: 'Boas-vindas', texto: 'Oi!', enviar_em: '2026-11-14T12:00:00Z', areas: [], horarios: [], cronograma_id: null, enviado_em: '2026-11-14T12:00:20Z', pulado: false, entregues: 3, falhas: 1 },
    { id: 'a4', titulo: 'Chegada', texto: 'x', enviar_em: '2026-11-14T08:00:00Z', areas: [], horarios: [], cronograma_id: null, enviado_em: '2026-11-14T10:00:00Z', pulado: true, entregues: 0, falhas: 0 },
  ];
  e.comAvisos = new Set(['v1', 'v2']);
  e.salvos = []; e.apagados = []; e.criados = []; e.cancelados = []; e.erros = [];
});

const abrir = () => render(<MemoryRouter><CentralNoPainel inscricoes={INSC} /></MemoryRouter>);

describe('Central no painel', () => {
  it('os números: avisos ligados e a presença de cada dia', async () => {
    abrir();
    await screen.findByTestId('cronograma-do-painel');
    expect(screen.getByTestId('central-avisos')).toHaveTextContent('2');
    expect(screen.getByTestId('central-treinamento')).toHaveTextContent('1 de 3');
    expect(screen.getByTestId('central-evento')).toHaveTextContent('0 de 3');
    expect(screen.getByRole('link', { name: /Presença com leitor/ })).toHaveAttribute('href', '/voluntariado/natalfeliz26/presenca');
  });

  it('a fila e o histórico: só o avulso se cancela; enviados com o total; o atrasado não saiu', async () => {
    abrir();
    const lista = await screen.findByTestId('avisos-do-painel');
    const linhas = within(lista).getAllByRole('listitem');
    expect(linhas[0]).toHaveTextContent('É amanhã!');
    expect(within(linhas[0]).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(linhas[1]).toHaveTextContent('do cronograma');
    expect(within(linhas[1]).queryByRole('button')).toBeNull();
    expect(lista).toHaveTextContent('3 celulares · 1 com falha');
    expect(lista).toHaveTextContent('Não saiu: passou da hora');
    fireEvent.click(within(linhas[0]).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(e.cancelados).toEqual(['a1']));
  });

  it('novo item: dia, horário, para quem e o aviso 15 min antes', async () => {
    abrir();
    await screen.findByTestId('cronograma-do-painel');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/ }));
    const janela = await screen.findByRole('dialog');
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(e.erros).toContain('Preencha o dia, o início e o título.');
    fireEvent.change(within(janela).getByLabelText('Início'), { target: { value: '06:30' } });
    fireEvent.change(within(janela).getByLabelText('Fim (opcional)'), { target: { value: '07:00' } });
    fireEvent.change(within(janela).getByLabelText('Título'), { target: { value: ' Chegada e check-in ' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Check-in' }));
    fireEvent.change(within(janela).getByLabelText('Local (opcional)'), { target: { value: 'Entrada' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Manhã' }));
    fireEvent.click(within(janela).getByRole('button', { name: '30 min antes' }));
    expect(within(janela).getByLabelText('Texto do aviso')).toHaveAttribute('placeholder', expect.stringContaining('Começa às 6h30 · Entrada'));
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(e.salvos).toHaveLength(1));
    expect(e.salvos[0]).toEqual([expect.objectContaining({
      dia: '2026-12-08', inicio: '06:30', fim: '07:00', titulo: 'Chegada e check-in', tipo: 'checkin', local: 'Entrada', areas: [], horarios: ['manha'], avisar_min: 30,
    }), undefined]);
  });

  it('editar: abre com os valores; tirar o aviso; apagar', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cozinha: café e almoço' }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByLabelText('Título')).toHaveValue('Cozinha: café e almoço');
    expect(within(janela).getByRole('button', { name: '15 min antes' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(janela).getByRole('button', { name: 'Cozinha / Servimento' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(janela).getByRole('button', { name: 'Sem aviso' }));
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(e.salvos).toHaveLength(1));
    expect(e.salvos[0][0]).toMatchObject({ avisar_min: null });
    expect(e.salvos[0][1]).toBe('c1');

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cozinha: café e almoço' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Apagar/ }));
    await waitFor(() => expect(e.apagados).toEqual(['c1']));
  });

  it('novo aviso: mostra para quantos vai, pelo filtro; agora ou agendado', async () => {
    abrir();
    await screen.findByTestId('cronograma-do-painel');
    fireEvent.click(screen.getByRole('button', { name: /Novo aviso/ }));
    const janela = await screen.findByRole('dialog');
    await waitFor(() => expect(within(janela).getByTestId('alcance')).toHaveTextContent('Vai para 2 pessoas'));
    fireEvent.click(within(janela).getByRole('button', { name: 'Cozinha / Servimento' }));
    expect(within(janela).getByTestId('alcance')).toHaveTextContent('Vai para 1 pessoa');
    fireEvent.change(within(janela).getByLabelText('Título'), { target: { value: 'Touca' } });
    fireEvent.change(within(janela).getByLabelText('Texto'), { target: { value: 'Traga a touca.' } });
    fireEvent.click(within(within(janela).getByRole('group', { name: 'Quando' })).getByRole('button', { name: 'Agendar' }));
    fireEvent.change(within(janela).getByLabelText('Dia e hora do envio'), { target: { value: '2020-01-01T10:00' } });
    fireEvent.click(within(janela).getAllByRole('button', { name: 'Agendar' }).at(-1)!);
    expect(e.erros).toContain('Escolha um horário no futuro.');
    fireEvent.change(within(janela).getByLabelText('Dia e hora do envio'), { target: { value: '2099-12-07T18:00' } });
    fireEvent.click(within(janela).getAllByRole('button', { name: 'Agendar' }).at(-1)!);
    await waitFor(() => expect(e.criados).toHaveLength(1));
    expect(e.criados[0]).toEqual({ titulo: 'Touca', texto: 'Traga a touca.', enviar_em: '2099-12-07T21:00:00.000Z', areas: ['cozinha'], horarios: [] });
  });

  it('aviso agora: sem hora marcada', async () => {
    abrir();
    await screen.findByTestId('cronograma-do-painel');
    fireEvent.click(screen.getByRole('button', { name: /Novo aviso/ }));
    const janela = await screen.findByRole('dialog');
    fireEvent.change(within(janela).getByLabelText('Título'), { target: { value: 'Chegamos!' } });
    fireEvent.change(within(janela).getByLabelText('Texto'), { target: { value: 'O portão está aberto.' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Enviar agora' }));
    await waitFor(() => expect(e.criados).toEqual([{ titulo: 'Chegamos!', texto: 'O portão está aberto.', enviar_em: null, areas: [], horarios: [] }]));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Vaga } from '@/lib/vagas/modelo';

const espiao = vi.hoisted(() => ({
  vagas: [] as Vaga[],
  criadas: [] as Record<string, unknown>[],
  atualizadas: [] as Array<[string, Record<string, unknown>]>,
  perguntas: [] as Array<[string, unknown[]]>,
  apagadas: [] as string[],
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-rh' } }) }));
vi.mock('@/lib/vagas/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  return {
    ...real,
    listarTodasAsVagas: async () => espiao.vagas,
    listarPerguntas: async (id: string | null) => (id === null ? [{ id: 'b1', vaga_id: null, texto: 'Como ficou sabendo da vaga?', tipo: 'unica', opcoes: ['Site', 'Instagram'], obrigatoria: true, ordem: 0, bloqueada: false }] : []),
    criarVaga: async (d: Record<string, unknown>) => { espiao.criadas.push(d); return real.paraVaga({ ...d, id: String(d.slug) }); },
    atualizarVaga: async (id: string, d: Record<string, unknown>) => { espiao.atualizadas.push([id, d]); const v = espiao.vagas.find(x => x.id === id)!; return real.paraVaga({ ...v, ...d }); },
    mudarStatus: async (id: string, status: string) => { espiao.atualizadas.push([id, { status }]); const v = espiao.vagas.find(x => x.id === id)!; return real.paraVaga({ ...v, status }); },
    salvarPerguntas: async (id: string, p: unknown[]) => { espiao.perguntas.push([id, p]); },
    apagarVaga: async (id: string) => { espiao.apagadas.push(id); },
  };
});

const { paraVaga } = await import('@/lib/vagas/api');
const { GestaoDeVagas } = await import('./GestaoDeVagas');

const vaga = (o: Record<string, unknown>) => paraVaga({ cidade: 'Campinas/SP', requisitos: ['Ensino Médio'], ...o, id: String(o.slug) });

const abrir = () => render(<MemoryRouter><GestaoDeVagas /></MemoryRouter>);
const menuDe = (titulo: string) => {
  const botao = screen.getByRole('button', { name: `Mais ações para ${titulo}` });
  fireEvent.click(botao);
};

beforeEach(() => {
  espiao.criadas = []; espiao.atualizadas = []; espiao.perguntas = []; espiao.apagadas = [];
  espiao.vagas = [
    vaga({ slug: 'educador-social-de-musica', codigo: 'SOC-2026-001', titulo: 'Educador Social de Música', area: 'social', status: 'publicada', publicada_em: '2026-09-20T12:00:00Z', link_externo: 'https://forms.gle/a' }),
    vaga({ slug: 'professor', codigo: 'EDU-2026-001', titulo: 'Professor', area: 'educacao', status: 'rascunho' }),
  ];
});

describe('gestão de vagas', () => {
  it('lista todas, de qualquer status, com contagem por status', async () => {
    abrir();
    expect(await screen.findByText('Educador Social de Música')).toBeInTheDocument();
    expect(screen.getByText('Professor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicada · 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rascunho · 1' }));
    expect(screen.queryByText('Educador Social de Música')).not.toBeInTheDocument();
  });

  it('cria uma vaga passo a passo e publica com código e endereço novos', async () => {
    abrir();
    await screen.findByText('Professor');
    fireEvent.click(screen.getAllByRole('button', { name: /Nova vaga/ })[0]);
    const form = await screen.findByTestId('form-vaga');
    const continuar = () => fireEvent.click(within(form).getByRole('button', { name: /Continuar/ }));

    continuar();
    expect(within(form).getByText('Escreva o título da vaga.')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Título da vaga *'), { target: { value: 'Educador Social de Música' } });
    fireEvent.click(within(form).getByRole('radio', { name: /Social/ }));
    continuar();
    fireEvent.change(within(form).getByLabelText('O que a pessoa vai fazer *'), { target: { value: 'Oficinas de música.' } });
    continuar();
    fireEvent.change(within(form).getByLabelText('Requisitos *'), { target: { value: 'Ensino Médio completo' } });
    fireEvent.keyDown(within(form).getByLabelText('Requisitos *'), { key: 'Enter' });
    continuar();
    fireEvent.change(within(form).getByLabelText('Link do formulário de inscrição'), { target: { value: 'https://forms.gle/novo' } });
    continuar();
    fireEvent.click(within(form).getByRole('button', { name: /Como ficou sabendo da vaga/ }));
    continuar();
    fireEvent.click(within(form).getByRole('button', { name: /^Publicar$/ }));

    await waitFor(() => expect(espiao.criadas).toHaveLength(1));
    expect(espiao.criadas[0]).toMatchObject({ slug: 'educador-social-de-musica-2', codigo: `SOC-${new Date().getFullYear()}-${new Date().getFullYear() === 2026 ? '002' : '001'}`, status: 'publicada', requisitos: ['Ensino Médio completo'], link_externo: 'https://forms.gle/novo' });
    expect(espiao.perguntas[0][1]).toEqual([{ texto: 'Como ficou sabendo da vaga?', tipo: 'unica', opcoes: ['Site', 'Instagram'], obrigatoria: true }]);
  });

  it('termo discriminatório barra publicar, mas não o rascunho', async () => {
    abrir();
    await screen.findByText('Professor');
    fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[1]);
    const form = await screen.findByTestId('form-vaga');
    fireEvent.change(within(form).getByLabelText('Título da vaga *'), { target: { value: 'Professora (feminina)' } });
    fireEvent.click(within(form).getByRole('radio', { name: /Educação/ }));
    for (const [rotulo, valor] of [['O que a pessoa vai fazer *', 'Aulas.']] as const) {
      fireEvent.click(within(form).getByRole('button', { name: /Continuar/ }));
      fireEvent.change(within(form).getByLabelText(rotulo), { target: { value: valor } });
    }
    for (let i = 0; i < 4; i++) fireEvent.click(within(form).getByRole('button', { name: /Continuar/ }));
    expect(within(form).getByTestId('termos-bloqueados')).toHaveTextContent('“feminina” em Título (gênero)');
    expect(within(form).getByRole('button', { name: /^Publicar$/ })).toBeDisabled();
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(espiao.atualizadas).toHaveLength(1));
    expect(espiao.atualizadas[0]).toEqual(['professor', expect.objectContaining({ status: 'rascunho', slug: 'professor', codigo: 'EDU-2026-001' })]);
  });

  it('editando a publicada, avisa que muda na hora', async () => {
    abrir();
    await screen.findByText('Professor');
    fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[0]);
    expect(await screen.findByText(/Esta vaga está publicada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument();
  });

  it('muda o status pelo menu e só apaga rascunho, com confirmação', async () => {
    abrir();
    await screen.findByText('Professor');
    menuDe('Educador Social de Música');
    expect(await screen.findByRole('menuitem', { name: 'Encerrar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Apagar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Encerrar' }));
    await waitFor(() => expect(espiao.atualizadas).toEqual([['educador-social-de-musica', { status: 'encerrada' }]]));

    menuDe('Professor');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Apagar/ }));
    const linha = screen.getByTestId('linha-professor');
    fireEvent.click(within(linha).getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(espiao.apagadas).toEqual(['professor']));
  });

  it('importa as vagas do site: 39 marcadas, as 3 duplicadas de fora, e publica', async () => {
    abrir();
    await screen.findByText('Professor');
    fireEvent.click(screen.getByRole('button', { name: /Importar do site/ }));
    const dlg = await screen.findByTestId('importar-vagas');
    expect(within(dlg).getByText('39 marcadas')).toBeInTheDocument();
    expect(within(dlg).getAllByText(/mesmo Forms de/)).toHaveLength(3);
    expect(within(dlg).getByText(/Saiu "vaga masculina"/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: /Importar e publicar 39/ }));
    await waitFor(() => expect(espiao.criadas).toHaveLength(39));
    expect(espiao.criadas.every(c => c.status === 'publicada')).toBe(true);
    expect(new Set(espiao.criadas.map(c => c.slug)).size).toBe(39);
    expect(await screen.findByText('Auxiliar de Serviços Gerais')).toBeInTheDocument();
  });
});

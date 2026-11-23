import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FeedbackDaCaixa } from '@/lib/feedback/regras';

const api = vi.hoisted(() => ({
  lerCaixaDeFeedback: vi.fn(),
  marcarComoLido: vi.fn(),
  salvarFeedback: vi.fn(),
  avisarQuemMandou: vi.fn(),
  linkDoPrint: vi.fn(),
  FeedbackMudou: class FeedbackMudou extends Error {},
  // usados pelo DarFeedback (importado pelas cores)
  enviarFeedback: vi.fn(), avisarOMarketing: vi.fn(), lerMeusFeedbacks: vi.fn(),
}));
const avisos = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/feedback/api', () => api);
vi.mock('sonner', () => ({ toast: avisos }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'mkt', user_metadata: {} } }) }));

const { CaixaDeFeedback, caminhoDoApp } = await import('./CaixaDeFeedback');

const base: FeedbackDaCaixa = {
  id: 'f1', autor_id: 'u1', autor_nome: 'Gestão Santana', autor_email: 'santana@anabrasil.org', tipo: 'falta',
  texto: 'Ver só a minha unidade', setor: 'Social', pagina: 'Calendário Anual', caminho: '/social/calendario', aparelho: 'celular', navegador: 'Chrome',
  print_path: null, situacao: 'novo', resposta: null, respondido_por: null, respondido_em: null, lido_em: null,
  criado_em: '2026-11-23T13:42:00Z', atualizado_em: '2026-11-23T13:42:00Z',
};
const LISTA: FeedbackDaCaixa[] = [
  base,
  { ...base, id: 'f2', tipo: 'erro', texto: 'A foto não sobe no celular', autor_nome: 'Gestão Nilópolis', print_path: 'u2/p.png', lido_em: '2026-11-23T14:00:00Z' },
  { ...base, id: 'f3', tipo: 'ideia', texto: 'Copiar a semana anterior', setor: 'Educação', pagina: 'Semanário', situacao: 'feito', lido_em: '2026-11-23T14:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.lerCaixaDeFeedback.mockResolvedValue(LISTA.map(f => ({ ...f })));
  api.marcarComoLido.mockResolvedValue(undefined);
  api.salvarFeedback.mockResolvedValue(true);
  api.avisarQuemMandou.mockResolvedValue(true);
  api.linkDoPrint.mockResolvedValue('https://x/print.png');
});

const lista = async () => screen.findByRole('list', { name: 'Feedbacks' });

/** A caixa de feedback no Painel (PR 2, 23/11/2026). */
describe('Caixa de feedback', () => {
  it('lista todos, conta por situação e informa os não lidos', async () => {
    const onNaoLidos = vi.fn();
    render(<CaixaDeFeedback onNaoLidos={onNaoLidos} />);
    expect(within(await lista()).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Todos 3/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Novo 2/ })).toBeInTheDocument();
    await waitFor(() => expect(onNaoLidos).toHaveBeenLastCalledWith(1));
  });

  it('filtra por situação e por setor', async () => {
    render(<CaixaDeFeedback />);
    await lista();
    fireEvent.click(screen.getByRole('button', { name: /^Feito 1/ }));
    expect(within(await lista()).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Todos/ }));
    fireEvent.change(screen.getByLabelText('Filtrar por setor'), { target: { value: 'Social' } });
    expect(within(await lista()).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'elogio' } });
    expect(screen.getByText('Nenhum feedback com esse filtro.')).toBeInTheDocument();
  });

  it('abrir um não lido marca como lido e baixa o número', async () => {
    const onNaoLidos = vi.fn();
    render(<CaixaDeFeedback onNaoLidos={onNaoLidos} />);
    fireEvent.click(within(await lista()).getByText('Ver só a minha unidade'));
    expect(api.marcarComoLido).toHaveBeenCalledWith('f1');
    await waitFor(() => expect(onNaoLidos).toHaveBeenLastCalledWith(0));
    const aberto = screen.getByRole('region', { name: 'Feedback aberto' });
    expect(within(aberto).getByText('santana@anabrasil.org')).toBeInTheDocument();
    expect(within(aberto).getByText('Celular · Chrome')).toBeInTheDocument();
  });

  it('abrir um já lido não marca de novo; o print aparece', async () => {
    render(<CaixaDeFeedback />);
    fireEvent.click(within(await lista()).getByText('A foto não sobe no celular'));
    expect(api.marcarComoLido).not.toHaveBeenCalled();
    expect(await screen.findByRole('img', { name: 'Print anexado ao feedback' })).toHaveAttribute('src', 'https://x/print.png');
    expect(api.linkDoPrint).toHaveBeenCalledWith('u2/p.png');
  });

  it('salvar a situação e a resposta avisa quem mandou e recarrega', async () => {
    render(<CaixaDeFeedback />);
    fireEvent.click(within(await lista()).getByText('Ver só a minha unidade'));
    const aberto = screen.getByRole('region', { name: 'Feedback aberto' });
    const salvar = within(aberto).getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeDisabled();
    fireEvent.click(within(aberto).getByRole('radio', { name: 'Feito' }));
    fireEvent.change(within(aberto).getByRole('textbox'), { target: { value: 'Feito! Já dá para filtrar.' } });
    fireEvent.click(salvar);
    await waitFor(() => expect(api.salvarFeedback).toHaveBeenCalledWith('f1', 'feito', 'Feito! Já dá para filtrar.', '2026-11-23T13:42:00Z'));
    await waitFor(() => expect(api.avisarQuemMandou).toHaveBeenCalledWith('f1'));
    await waitFor(() => expect(api.lerCaixaDeFeedback).toHaveBeenCalledTimes(2));
    expect(avisos.success).toHaveBeenCalledWith('Salvo', expect.objectContaining({ description: expect.stringContaining('recebe um e-mail') }));
  });

  it('sem o "Avisar por e-mail", salva e não manda e-mail', async () => {
    render(<CaixaDeFeedback />);
    fireEvent.click(within(await lista()).getByText('Ver só a minha unidade'));
    const aberto = screen.getByRole('region', { name: 'Feedback aberto' });
    fireEvent.click(within(aberto).getByRole('radio', { name: 'Em análise' }));
    fireEvent.click(within(aberto).getByRole('checkbox'));
    fireEvent.click(within(aberto).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.salvarFeedback).toHaveBeenCalledWith('f1', 'analise', '', '2026-11-23T13:42:00Z'));
    expect(api.avisarQuemMandou).not.toHaveBeenCalled();
  });

  it('erro ao salvar aparece e não avisa ninguém', async () => {
    api.salvarFeedback.mockRejectedValue(new Error('Só o marketing cuida do feedback.'));
    render(<CaixaDeFeedback />);
    fireEvent.click(within(await lista()).getByText('Ver só a minha unidade'));
    const aberto = screen.getByRole('region', { name: 'Feedback aberto' });
    fireEvent.click(within(aberto).getByRole('radio', { name: 'Feito' }));
    fireEvent.click(within(aberto).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith('Não foi possível salvar', { description: 'Só o marketing cuida do feedback.' }));
    expect(api.avisarQuemMandou).not.toHaveBeenCalled();
  });

  it('outra pessoa salvou antes: recarrega a caixa e mantém o que estava escrito', async () => {
    api.salvarFeedback.mockRejectedValue(new api.FeedbackMudou('Alguém mudou este feedback enquanto você escrevia.'));
    render(<CaixaDeFeedback />);
    fireEvent.click(within(await lista()).getByText('Ver só a minha unidade'));
    const aberto = screen.getByRole('region', { name: 'Feedback aberto' });
    fireEvent.click(within(aberto).getByRole('radio', { name: 'Feito' }));
    fireEvent.change(within(aberto).getByRole('textbox'), { target: { value: 'Minha resposta' } });
    fireEvent.click(within(aberto).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.lerCaixaDeFeedback).toHaveBeenCalledTimes(2));
    expect(avisos.error).toHaveBeenCalledWith('Não foi possível salvar', { description: expect.stringContaining('Alguém mudou') });
    expect(api.avisarQuemMandou).not.toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: 'Feedback aberto' })).getByRole('textbox')).toHaveValue('Minha resposta');
  });

  it('atualizar e falhar mantém a caixa na tela', async () => {
    render(<CaixaDeFeedback />);
    await lista();
    api.lerCaixaDeFeedback.mockRejectedValueOnce(new Error('rede'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith('Não consegui atualizar a caixa', { description: 'rede' }));
    expect(within(await lista()).getAllByRole('listitem')).toHaveLength(3);
  });

  it('o "de onde veio" só vira link quando é endereço do app', async () => {
    api.lerCaixaDeFeedback.mockResolvedValue([{ ...base, caminho: 'javascript:alert(1)' }, { ...base, id: 'f9', texto: 'Outro', caminho: '/social/eventos', lido_em: '2026-11-23T14:00:00Z' }]);
    render(<CaixaDeFeedback />);
    fireEvent.click(within(await lista()).getByText('Ver só a minha unidade'));
    expect(screen.queryByRole('link', { name: 'Abrir a página de onde veio' })).not.toBeInTheDocument();
    fireEvent.click(within(await lista()).getByText('Outro'));
    expect(screen.getByRole('link', { name: 'Abrir a página de onde veio' })).toHaveAttribute('href', '/social/eventos');
    expect(caminhoDoApp('//evil.example')).toBe(false);
    expect(caminhoDoApp('https://evil.example')).toBe(false);
    expect(caminhoDoApp('/painel?tab=feedback')).toBe(true);
  });

  it('caixa vazia explica o que vai aparecer', async () => {
    api.lerCaixaDeFeedback.mockResolvedValue([]);
    render(<CaixaDeFeedback />);
    expect(await screen.findByText(/Nenhum feedback ainda/)).toBeInTheDocument();
  });

  it('erro ao ler mostra "Tentar de novo"', async () => {
    api.lerCaixaDeFeedback.mockRejectedValueOnce(new Error('rede'));
    render(<CaixaDeFeedback />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await lista()).toBeInTheDocument();
  });
});

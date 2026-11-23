import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MeuFeedback } from '@/lib/feedback/regras';

const api = vi.hoisted(() => ({
  enviarFeedback: vi.fn(),
  avisarOMarketing: vi.fn(),
  lerMeusFeedbacks: vi.fn(),
}));
vi.mock('@/lib/feedback/api', () => api);
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));

const { DarFeedback } = await import('./DarFeedback');

const MEUS: MeuFeedback[] = [
  { id: 'f2', tipo: 'falta', texto: 'Ver só a minha unidade', setor: 'Social', pagina: 'Calendário Anual', situacao: 'novo', resposta: null, respondido_em: null, criado_em: '2026-11-23T13:42:00Z' },
  { id: 'f1', tipo: 'ideia', texto: 'Nome da unidade no PDF', setor: 'Social', pagina: 'Calendário Anual', situacao: 'feito', resposta: 'Feito! Já sai no próximo PDF.', respondido_em: '2026-11-22T10:00:00Z', criado_em: '2026-11-20T10:00:00Z' },
];

const abrir = (rota = '/social/calendario') => {
  render(<MemoryRouter initialEntries={[rota]}><DarFeedback /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Dar feedback/ }));
  return screen.getByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  api.enviarFeedback.mockResolvedValue('f2');
  api.avisarOMarketing.mockResolvedValue(true);
  api.lerMeusFeedbacks.mockResolvedValue(MEUS);
  URL.createObjectURL = vi.fn(() => 'blob:previa');
  URL.revokeObjectURL = vi.fn();
});

/** O "Dar feedback" (23/11/2026, mockup aprovado). */
describe('Dar feedback', () => {
  it('mostra de onde vai, sem a pessoa escrever', () => {
    const janela = abrir();
    expect(within(janela).getByTestId('onde-do-feedback')).toHaveTextContent('Social › Calendário Anual');
  });

  it('pede o tipo e o texto antes de enviar', async () => {
    const janela = abrir();
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Escolha sobre o que é o feedback.');
    fireEvent.click(within(janela).getByRole('radio', { name: /Sinto falta de algo/ }));
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Escreva o feedback.');
    expect(api.enviarFeedback).not.toHaveBeenCalled();
  });

  it('envia com o setor, a página e o aparelho; avisa o marketing; mostra os seus', async () => {
    const janela = abrir();
    fireEvent.click(within(janela).getByRole('radio', { name: /Sinto falta de algo/ }));
    expect(within(janela).getByRole('radio', { name: /Sinto falta de algo/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(within(janela).getByRole('textbox'), { target: { value: '  Ver só a minha unidade  ' } });
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    expect(await screen.findByText('Recebido, obrigado!')).toBeInTheDocument();
    expect(api.enviarFeedback).toHaveBeenCalledWith('u1', expect.objectContaining({
      tipo: 'falta', texto: 'Ver só a minha unidade', setor: 'Social', pagina: 'Calendário Anual', caminho: '/social/calendario',
      aparelho: expect.stringMatching(/celular|computador/), navegador: expect.any(String),
    }), null);
    expect(api.avisarOMarketing).toHaveBeenCalledWith('f2');
    const lista = await screen.findByRole('list', { name: 'Seus feedbacks' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    expect(within(lista).getByText('Novo')).toBeInTheDocument();
    expect(within(lista).getByText(/Feito! Já sai no próximo PDF./)).toBeInTheDocument();
  });

  it('o e-mail ao marketing falhar não atrapalha quem mandou', async () => {
    api.avisarOMarketing.mockRejectedValue(new Error('smtp'));
    const janela = abrir();
    fireEvent.click(within(janela).getByRole('radio', { name: /Elogio/ }));
    fireEvent.change(within(janela).getByRole('textbox'), { target: { value: 'Gostei do tutorial' } });
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    expect(await screen.findByText('Recebido, obrigado!')).toBeInTheDocument();
  });

  it('o erro do envio aparece e o texto continua lá', async () => {
    api.enviarFeedback.mockRejectedValue(new Error('Só a equipe manda feedback pelo app.'));
    const janela = abrir();
    fireEvent.click(within(janela).getByRole('radio', { name: /Ideia ou melhoria/ }));
    fireEvent.change(within(janela).getByRole('textbox'), { target: { value: 'Uma ideia' } });
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Só a equipe manda feedback pelo app.');
    expect(within(janela).getByRole('textbox')).toHaveValue('Uma ideia');
  });

  it('o print: recusa o que não é imagem aceita; anexa e vai junto', async () => {
    const janela = abrir();
    const input = within(janela).getByLabelText('Escolher o print');
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.heic', { type: 'image/heic' })] } });
    expect(within(janela).getByRole('alert')).toHaveTextContent('PNG, JPG ou WebP');
    const print = new File(['x'], 'tela.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [print] } });
    expect(within(janela).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(janela).getByText('tela.png')).toBeInTheDocument();
    fireEvent.click(within(janela).getByRole('radio', { name: /Algo não funcionou/ }));
    fireEvent.change(within(janela).getByRole('textbox'), { target: { value: 'Travou ao salvar' } });
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    await waitFor(() => expect(api.enviarFeedback).toHaveBeenCalledWith('u1', expect.objectContaining({ tipo: 'erro' }), print));
  });

  it('colar uma imagem anexa o print', () => {
    const janela = abrir();
    const print = new File(['x'], 'colado.png', { type: 'image/png' });
    fireEvent.paste(within(janela).getByRole('textbox'), { clipboardData: { files: [print], types: ['Files'] } });
    expect(within(janela).getByText('colado.png')).toBeInTheDocument();
  });

  it('colar texto do Excel (que traz uma imagem junto) não vira print', () => {
    const janela = abrir();
    const img = new File(['x'], 'celulas.png', { type: 'image/png' });
    fireEvent.paste(within(janela).getByRole('textbox'), { clipboardData: { files: [img], types: ['text/plain', 'text/html', 'Files'] } });
    expect(within(janela).queryByText('celulas.png')).not.toBeInTheDocument();
  });

  it('Cancelar limpa o rascunho; reabrir não traz o erro antigo', async () => {
    let janela = abrir();
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar feedback/ }));
    expect(await within(janela).findByRole('alert')).toBeInTheDocument();
    fireEvent.change(within(janela).getByRole('textbox'), { target: { value: 'rascunho' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Dar feedback/ }));
    janela = screen.getByRole('dialog');
    expect(within(janela).getByRole('textbox')).toHaveValue('');
    expect(within(janela).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Seus feedbacks" abre a lista sem enviar nada', async () => {
    const janela = abrir();
    fireEvent.click(await within(janela).findByRole('button', { name: 'Seus feedbacks (2)' }));
    expect(await screen.findByRole('list', { name: 'Seus feedbacks' })).toBeInTheDocument();
    expect(api.enviarFeedback).not.toHaveBeenCalled();
  });

  it('no celular, o botão é só o ícone (com nome para leitor de tela)', () => {
    render(<MemoryRouter><DarFeedback compacta /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Dar feedback' })).toHaveTextContent('');
  });
});

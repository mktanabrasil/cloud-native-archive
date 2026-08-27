import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessForm } from './AccessForm';
import { pedidoFoiEnviado, marcarPedidoEnviado } from '@/lib/pedidoEnviado';

/**
 * O fluxo de pedir acesso, na parte que roda no cliente.
 *
 * O que estes testes protegem é uma sequência frágil: o `signUp` do Supabase
 * devolve **sessão**, e o roteador reage à sessão. Toda a correção mora na
 * ordem em que as coisas acontecem — e ordem é justamente o que some numa
 * revisão de código e some de novo na próxima refatoração.
 *
 * O que fica de fora, de propósito: o que só existe no servidor — o gatilho
 * que grava `access_requests`, a política de RLS, o e-mail de aprovação. Isso
 * não se exercita em jsdom; ver o relatório do teste ponta a ponta.
 */

const auth = {
  signIn: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

/** Monta o formulário já no modo de solicitação, com os campos preenchidos. */
function pedirAcesso(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: /Solicite acesso/i }));
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria Diretora' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'maria@exemplo.org' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-de-teste' } });
  return container.querySelector('form') as HTMLFormElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  auth.signUp.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue(undefined);
});

describe('pedido de acesso', () => {
  /**
   * O commit que corrigiu isto: a marca era gravada DEPOIS do cadastro, e
   * chegava tarde -- quando o `signUp` resolvia, o roteador já tinha visto a
   * sessão e desviado. Verificar o valor no instante da chamada é o único
   * jeito de a ordem não voltar a inverter sem ninguém perceber.
   */
  it('grava a marca antes de chamar o cadastro, não depois', async () => {
    let marcaDuranteOCadastro: boolean | null = null;
    auth.signUp.mockImplementation(async () => {
      marcaDuranteOCadastro = pedidoFoiEnviado();
      return { error: null };
    });

    const { container } = render(<AccessForm title="Entrar" />);
    fireEvent.submit(pedirAcesso(container));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect(marcaDuranteOCadastro).toBe(true);
  });

  /** Pedir acesso não é entrar: a sessão que o cadastro criou é encerrada. */
  it('encerra a sessão e mostra a tela de espera', async () => {
    const { container } = render(<AccessForm title="Entrar" />);
    fireEvent.submit(pedirAcesso(container));

    await waitFor(() => expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument());
    expect(auth.signOut).toHaveBeenCalled();
    expect(pedidoFoiEnviado()).toBe(true);
  });

  /** Cadastro que falha não pode deixar a marca acesa: a pessoa ficaria presa. */
  it('apaga a marca quando o cadastro falha', async () => {
    auth.signUp.mockResolvedValue({ error: new Error('E-mail já cadastrado') });

    const { container } = render(<AccessForm title="Entrar" />);
    fireEvent.submit(pedirAcesso(container));

    await waitFor(() => expect(screen.getByText('E-mail já cadastrado')).toBeInTheDocument());
    expect(pedidoFoiEnviado()).toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText('Aguardando aprovação')).not.toBeInTheDocument();
  });

  /** O nível pedido chega ao banco junto, em vez de a aprovação adivinhar. */
  it('manda o nível de permissão correspondente ao que foi pedido', async () => {
    const { container } = render(<AccessForm title="Entrar" />);
    fireEvent.submit(pedirAcesso(container));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect(auth.signUp).toHaveBeenCalledWith(
      'maria@exemplo.org',
      'senha-de-teste',
      expect.objectContaining({
        name: 'Maria Diretora',
        requested_role: 'viewer',
        requested_permission_level: 'visualizador',
      }),
    );
  });
});

describe('tela de espera', () => {
  /**
   * O outro commit: entre o `signUp` e o `signOut` o roteador remonta esta
   * tela. Sem ler a marca na montagem, a pessoa caía no formulário de login
   * sem entender o que houve.
   */
  it('sobrevive à remontagem: monta direto na espera se a marca existe', () => {
    marcarPedidoEnviado(true);
    render(<AccessForm title="Entrar" />);

    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
  });

  it('sem a marca, monta no login', () => {
    render(<AccessForm title="Entrar" />);

    expect(screen.queryByText('Aguardando aprovação')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  /** Voltar ao login apaga a marca — senão a espera reapareceria na recarga. */
  it('"Voltar ao Login" apaga a marca', () => {
    marcarPedidoEnviado(true);
    render(<AccessForm title="Entrar" />);

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Login' }));

    expect(pedidoFoiEnviado()).toBe(false);
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });
});

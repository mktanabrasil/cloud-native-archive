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

// O Select do Radix é lento demais no jsdom: aqui ele vira um <select> nativo.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  type P = { children?: React.ReactNode; value?: string; onValueChange?: (v: string) => void; 'aria-label'?: string };
  const SelectTrigger = (_: P) => null;
  const Select = ({ children, value, onValueChange }: P) => {
    const gatilho = React.Children.toArray(children).find((c) => React.isValidElement(c) && c.type === SelectTrigger) as React.ReactElement<P> | undefined;
    return React.createElement('select', { 'aria-label': gatilho?.props['aria-label'], value: value ?? '', onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value) },
      React.createElement('option', { value: '' }, '—'), children);
  };
  const Passa = ({ children }: P) => React.createElement(React.Fragment, null, children);
  return {
    Select, SelectTrigger, SelectValue: () => null, SelectContent: Passa, SelectLabel: () => null,
    SelectGroup: ({ children }: P) => React.createElement('optgroup', null, children),
    SelectItem: ({ children, value }: P) => React.createElement('option', { value }, children),
  };
});

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

/** Escolhe o nível pedido (o primeiro seletor do formulário). */
const pedirComo = (valor: string) => fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: valor } });

describe('pedido como Professora (Semanário, 17/11/2026)', () => {
  it('pede o CEI, só da Educação, e manda o vínculo à parte do papel', async () => {
    const { container } = render(<AccessForm title="Entrar" />);
    const form = pedirAcesso(container);
    pedirComo('professora');
    expect(screen.getByText(/A orientadora pedagógica do seu CEI/)).toBeInTheDocument();
    const cei = screen.getByRole('combobox', { name: 'CEI' });
    const opcoes = [...cei.querySelectorAll('option')].map(o => o.textContent);
    expect(opcoes).toContain('Grupo de Oração Esperança');
    expect(opcoes.some(o => /Jardim Nilópolis/.test(o ?? ''))).toBe(false);
    fireEvent.change(cei, { target: { value: 'Anísio' } });
    fireEvent.submit(form);

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect(auth.signUp).toHaveBeenCalledWith('maria@exemplo.org', 'senha-de-teste', expect.objectContaining({
      requested_role: 'viewer', requested_permission_level: 'visualizador', requested_unit: 'Anísio', requested_bond: 'professora',
    }));
  });

  it('sem o CEI, não manda o pedido', async () => {
    const { container } = render(<AccessForm title="Entrar" />);
    const form = pedirAcesso(container);
    pedirComo('professora');
    fireEvent.submit(form);
    expect(await screen.findByText('Falta a unidade')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('de Gestão (com uma NAVE) para Professora, a unidade se apaga', () => {
    const { container } = render(<AccessForm title="Entrar" />);
    pedirAcesso(container);
    pedirComo('criador');
    fireEvent.change(screen.getByRole('combobox', { name: 'Unidade' }), { target: { value: 'Nilópolis' } });
    pedirComo('professora');
    expect(screen.getByRole('combobox', { name: 'CEI' })).toHaveValue('');
  });

  it('os outros pedidos não levam vínculo', async () => {
    const { container } = render(<AccessForm title="Entrar" />);
    fireEvent.submit(pedirAcesso(container));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect(auth.signUp.mock.calls[0][2]).not.toHaveProperty('requested_bond');
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

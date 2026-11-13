import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const signUp = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signUp: (...a: unknown[]) => signUp(...a), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() } },
}));

import { EntradaDoCalendario } from './EntradaDoCalendario';

function primeiroAcesso() {
  render(<EntradaDoCalendario />);
  fireEvent.click(screen.getByRole('tab', { name: 'Primeiro acesso' }));
  fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Teste Coordenação' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'coordenacao@exemplo.org' } });
  fireEvent.change(screen.getByLabelText('Crie uma senha'), { target: { value: 'senha1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar minha senha' }));
}

describe('primeiro acesso no Calendário Anual', () => {
  beforeEach(() => signUp.mockReset());

  it('conta nova: avisa que o link de confirmação foi enviado', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null }, error: null });
    primeiroAcesso();
    expect(await screen.findByRole('status')).toHaveTextContent('Enviamos um link de confirmação para coordenacao@exemplo.org');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // 13/11/2026: o servidor responde a um e-mail que já tem conta como se tivesse
  // criado, mas com `identities` vazio, e não manda e-mail nenhum.
  it('e-mail que já tem conta: não diz que enviou; volta para Entrar com o e-mail preenchido', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'falso', identities: [] }, session: null }, error: null });
    primeiroAcesso();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse e-mail já tem conta');
    expect(screen.queryByText(/Enviamos um link/)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('E-mail')).toHaveValue('coordenacao@exemplo.org');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });
});

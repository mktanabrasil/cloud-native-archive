import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** O fim do "Esqueci a senha" com o cadeado das senhas (19/11/2026). */
const espiao = vi.hoisted(() => ({
  trancada: false,
  erroDaTroca: null as null | { message: string },
  trocas: [] as string[],
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async (nome: string) => (nome === 'minha_senha_trancada' ? { data: espiao.trancada, error: null } : { data: null, error: { message: 'x' } })),
    auth: {
      updateUser: vi.fn(async ({ password }: { password: string }) => {
        espiao.trocas.push(password);
        return espiao.erroDaTroca ? { data: { user: null }, error: espiao.erroDaTroca } : { data: { user: { user_metadata: {} } }, error: null };
      }),
    },
  },
}));

const { default: ResetPasswordPage } = await import('./ResetPasswordPage');
const abrir = () => render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
const preencher = (s: string) => {
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: s } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: s } });
  fireEvent.click(screen.getByRole('button', { name: /Redefinir Senha/ }));
};

beforeEach(() => { espiao.trancada = false; espiao.erroDaTroca = null; espiao.trocas = []; });

describe('ResetPasswordPage com o cadeado', () => {
  it('conta livre (cadeado desligado, marketing, admin): troca como sempre', async () => {
    abrir();
    preencher('umaSenhaBoa');
    await waitFor(() => expect(espiao.trocas).toEqual(['umaSenhaBoa']));
    expect(await screen.findByText('Senha alterada!')).toBeInTheDocument();
  });

  it('conta trancada: no lugar do formulário, o aviso de que a senha é da administração', async () => {
    espiao.trancada = true;
    abrir();
    expect(await screen.findByText(/definida pela administração/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).toBeNull();
  });

  it('se o banco recusar a troca, mostra o mesmo aviso em vez do erro técnico (a mensagem real do GoTrue)', async () => {
    espiao.erroDaTroca = { message: 'Error during password storage' };
    abrir();
    preencher('outraSenha');
    expect(await screen.findByText(/definida pela administração/)).toBeInTheDocument();
    expect(screen.queryByText('Error during password storage')).toBeNull();
  });

  it('outro erro continua aparecendo como é', async () => {
    espiao.erroDaTroca = { message: 'New password should be different from the old password.' };
    abrir();
    preencher('mesmaSenha');
    expect(await screen.findByText(/should be different/)).toBeInTheDocument();
  });
});

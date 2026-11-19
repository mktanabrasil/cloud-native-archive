import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** "Gerar minha senha", pelo link do e-mail (19/11/2026, PR 3 das senhas). */
const espiao = vi.hoisted(() => ({ codigos: [] as string[], falha: null as null | string }));
vi.mock('@/lib/senhas/email', async (original) => ({
  ...(await original<typeof import('@/lib/senhas/email')>()),
  gerarMinhaSenha: vi.fn(async (t: string) => {
    espiao.codigos.push(t);
    if (espiao.falha) throw new Error(espiao.falha);
    return { senha: 'QmTvahRdK', email: 'professora.ag1a@anabrasil.org' };
  }),
}));
vi.mock('@/hooks/useTituloDaAba', () => ({ useTituloDaAba: () => {} }));

const { default: SenhaNovaPage } = await import('./SenhaNovaPage');
const TOKEN = 'b'.repeat(43);
const abrir = (busca: string) => render(<MemoryRouter initialEntries={[`/senha-nova${busca}`]}><SenhaNovaPage /></MemoryRouter>);

beforeEach(() => { espiao.codigos = []; espiao.falha = null; });

describe('SenhaNovaPage', () => {
  it('abrir a página não gasta o código: a senha só sai no botão', async () => {
    abrir(`?t=${TOKEN}`);
    expect(espiao.codigos).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Gerar minha senha/ }));
    expect(await screen.findByTestId('senha-gerada')).toHaveTextContent('QmTvahRdK');
    expect(espiao.codigos).toEqual([TOKEN]);
    expect(screen.getByText('professora.ag1a@anabrasil.org')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar com esta senha/ })).toBeInTheDocument();
  });

  it('link vencido ou usado: explica e leva à entrada', async () => {
    espiao.falha = 'Este link venceu ou já foi usado. Peça outro em "Esqueceu a senha?", na tela de entrada.';
    abrir(`?t=${TOKEN}`);
    fireEvent.click(screen.getByRole('button', { name: /Gerar minha senha/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('venceu ou já foi usado');
  });

  it('link incompleto: nem mostra o botão', () => {
    abrir('?t=xyz');
    expect(screen.getByRole('alert')).toHaveTextContent('link está incompleto');
    expect(screen.queryByRole('button', { name: /Gerar minha senha/ })).toBeNull();
  });
});

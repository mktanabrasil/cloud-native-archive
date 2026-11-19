import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/** "Gerar nova senha" no Painel (19/11/2026, PR 2 das senhas). */
const espiao = vi.hoisted(() => ({ chamadas: [] as string[], falha: null as null | string, semSessoes: false }));
vi.mock('@/lib/senhas/painel', () => ({
  gerarSenhaDe: vi.fn(async (id: string) => {
    espiao.chamadas.push(id);
    if (espiao.falha) throw new Error(espiao.falha);
    return { senha: 'QmTvahRdK', sessoesEncerradas: !espiao.semSessoes };
  }),
}));

const { GerarSenhaDialog } = await import('./GerarSenhaDialog');
const conta = { id: 'u1', name: 'RH ANA', email: 'rh@anabrasil.org', jaGerada: true };

beforeEach(() => { espiao.chamadas = []; espiao.falha = null; espiao.semSessoes = false; });

describe('GerarSenhaDialog', () => {
  it('confirma antes, gera e mostra a senha uma vez', async () => {
    const gerada = vi.fn();
    render(<GerarSenhaDialog conta={conta} onFechar={() => {}} onGerada={gerada} />);
    expect(screen.getByText(/A senha atual para de funcionar na hora/)).toBeInTheDocument();
    expect(espiao.chamadas).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Gerar a senha/ }));
    expect(await screen.findByTestId('senha-gerada')).toHaveTextContent('QmTvahRdK');
    expect(espiao.chamadas).toEqual(['u1']);
    expect(gerada).toHaveBeenCalled();
    expect(screen.getByText(/única vez que a senha aparece/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Já copiei, fechar/ })).toBeInTheDocument();
  });

  it('se o servidor não conseguiu encerrar as sessões, avisa em vez de dizer que encerrou', async () => {
    espiao.semSessoes = true;
    render(<GerarSenhaDialog conta={conta} onFechar={() => {}} onGerada={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar a senha/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não consegui encerrar as sessões');
    expect(screen.queryByText(/sessões abertas desta conta foram encerradas/)).toBeNull();
  });

  it('erro da função aparece, e dá para tentar de novo', async () => {
    espiao.falha = 'Só o marketing e a administração geral geram senhas.';
    render(<GerarSenhaDialog conta={conta} onFechar={() => {}} onGerada={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar a senha/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Só o marketing');
    espiao.falha = null;
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    await waitFor(() => expect(screen.getByTestId('senha-gerada')).toHaveTextContent('QmTvahRdK'));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * Endereço que não existe, sem login (12/11/2026, mockup aprovado, opção A):
 * em vez da página 404 com o menu do app, a pessoa vai para a porta de
 * entrada, com o aviso "Esse endereço não existe". Quem tem login continua
 * vendo o 404; em embed, nada muda.
 */
const espiao = vi.hoisted(() => ({ autenticado: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: espiao.autenticado, loading: false }) }));
vi.mock('@/hooks/useIsEmbedded', () => ({ useIsEmbedded: () => false }));
vi.mock('@/components/auth/AccessForm', () => ({ AccessForm: ({ title }: { title: string }) => <form aria-label={title} /> }));
vi.mock('@/components/TestModeBanner', () => ({ TestModeTrigger: () => null }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/news/InstitutionalFooterBar', () => ({ InstitutionalFooterBar: () => null }));

const { default: NotFound } = await import('./NotFound');
const { default: HomePage } = await import('./HomePage');

/** Mostra onde o roteador está, e se ainda há estado no histórico. */
function Onde() {
  const l = useLocation();
  return <output data-testid="onde">{`${l.pathname}${l.search}|${l.state ? 'com estado' : 'sem estado'}`}</output>;
}

const abrir = (rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Onde />
    </MemoryRouter>,
  );

beforeEach(() => { espiao.autenticado = false; });

describe('endereço que não existe (12/11/2026)', () => {
  it('sem login, um link público pela metade leva à tela de entrada, com o aviso', () => {
    abrir('/pizza-da-alegria/acompanhar');
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Entre para continuar' })).toBeInTheDocument();
    const aviso = screen.getByTestId('aviso-endereco-inexistente');
    expect(aviso).toHaveTextContent('Esse endereço não existe.');
    expect(aviso).toHaveTextContent('Confira o link que você recebeu.');
    // O endereço vira a raiz, e o estado sai do histórico (um F5 não repete o aviso).
    expect(screen.getByTestId('onde')).toHaveTextContent('/|sem estado');
  });

  it('quem entra direto na raiz vê a tela de entrada sem o aviso', () => {
    abrir('/');
    expect(screen.getByRole('form', { name: 'Entre para continuar' })).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-endereco-inexistente')).not.toBeInTheDocument();
  });

  it('com login, continua a página 404 (para a equipe, ela diz que o link está errado)', () => {
    espiao.autenticado = true;
    abrir('/pizza-da-alegria/acompanhar');
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent('/pizza-da-alegria/acompanhar|sem estado');
  });

  it('em embed, nada muda: continua a página 404', () => {
    abrir('/qualquer-coisa?embed=true');
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-endereco-inexistente')).not.toBeInTheDocument();
  });
});

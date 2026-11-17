import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ROTAS_DO_CANDIDATO } from '@/lib/vagas/conta';

/**
 * A raiz para a conta de candidato (13/11/2026): vai para a área dela, como
 * nas outras rotas da equipe. Antes recebia o hub (Visão Geral, Calendário).
 * Desde 16/11/2026 os Eventos da equipe moram em /social/eventos, e a raiz
 * leva quem está logado até lá.
 */
const estado = vi.hoisted(() => ({ auth: { isAuthenticated: true, user: null as unknown }, limpa: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: false, canCreate: false }) }));
vi.mock('@/hooks/useIsEntryGate', () => ({
  useEntryGateTransition: () => ({ isGate: false, leaving: false, entering: false }),
  useIsCleanView: () => estado.limpa,
}));
vi.mock('@/pages/PublicEventsPage', () => ({ default: () => <p>vitrine</p> }));
vi.mock('@/pages/HomePage', () => ({ default: () => <p>porta</p> }));
vi.mock('@/pages/Dashboard', () => ({ default: () => <p>visão geral</p> }));
vi.mock('@/pages/CalendarPage', () => ({ default: () => <p>calendário</p> }));
vi.mock('@/pages/LixeiraPage', () => ({ default: () => <p>lixeira</p> }));
vi.mock('@/components/EventFormDialog', () => ({ default: () => null }));

const { default: EventsHubPage } = await import('./EventsHubPage');

function Endereco() {
  const l = useLocation();
  return <p data-testid="endereco">{l.pathname + l.search}</p>;
}
const abrir = (url = '/') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/" element={<EventsHubPage />} />
      <Route path="/social/eventos" element={<EventsHubPage />} />
      <Route path={ROTAS_DO_CANDIDATO.minhaArea} element={<p>área do candidato</p>} />
      <Route path="/social/calendario" element={<p>calendário anual</p>} />
      <Route path="/painel" element={<p>painel</p>} />
    </Routes>
    <Endereco />
  </MemoryRouter>,
);
const endereco = () => screen.getByTestId('endereco').textContent;
const equipe = { isAuthenticated: true, user: { id: 'e1', user_metadata: {} } };

afterEach(() => {
  estado.limpa = false;
  window.history.replaceState(null, '', '/');
});

describe('a raiz, por quem chega', () => {
  it('conta de candidato vai para a área dela', () => {
    estado.auth = { isAuthenticated: true, user: { id: 'c1', user_metadata: { conta: 'candidato' } } };
    abrir();
    expect(screen.getByText('área do candidato')).toBeInTheDocument();
    expect(screen.queryByText('Visão Geral')).not.toBeInTheDocument();
  });

  it('conta do Calendário Anual vai para /social/calendario (14/11/2026)', () => {
    estado.auth = { isAuthenticated: true, user: { id: 'k1', user_metadata: { conta: 'calendario' } } };
    abrir();
    expect(screen.getByText('calendário anual')).toBeInTheDocument();
  });

  // A raiz com sessão é a página inicial desde 17/11/2026 (ver RaizPage.test).
  it('em /social/eventos, a equipe recebe o hub', () => {
    estado.auth = equipe;
    abrir('/social/eventos');
    expect(endereco()).toBe('/social/eventos');
    expect(screen.getByText('Visão Geral')).toBeInTheDocument();
  });

  it('a volta do Google fica na raiz e segue para o Painel', () => {
    estado.auth = equipe;
    window.history.replaceState(null, '', '/?code=abc&state=agenda:x');
    abrir('/?code=abc&state=agenda:x');
    expect(endereco()).toBe('/painel?tab=agenda&code=abc&state=agenda%3Ax');
  });

  it('em embed, quem está logado continua na raiz, como antes', () => {
    estado.auth = equipe;
    estado.limpa = true;
    abrir('/?embed=true');
    expect(endereco()).toBe('/?embed=true');
  });

  it('sem sessão e fora da porta (embed), a vitrine', () => {
    estado.auth = { isAuthenticated: false, user: null };
    estado.limpa = true;
    abrir('/?embed=true');
    expect(screen.getByText('vitrine')).toBeInTheDocument();
  });

  it('sem sessão, /social/eventos volta para a raiz', () => {
    estado.auth = { isAuthenticated: false, user: null };
    abrir('/social/eventos');
    expect(endereco()).toBe('/');
  });

  // O F5 em /social/eventos (17/11/2026): enquanto a sessão carrega, quem
  // está logado parece sem sessão. A página espera em vez de mandar à raiz.
  it('com a sessão ainda carregando, /social/eventos fica onde está', () => {
    estado.auth = { isAuthenticated: false, user: null, loading: true } as typeof estado.auth;
    abrir('/social/eventos?tela=visao-geral');
    expect(endereco()).toBe('/social/eventos?tela=visao-geral');
  });
});

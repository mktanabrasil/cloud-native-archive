import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ROTAS_DO_CANDIDATO } from '@/lib/vagas/conta';

/**
 * A raiz para a conta de candidato (13/11/2026): vai para a área dela, como
 * nas outras rotas da equipe. Antes recebia o hub (Visão Geral, Calendário).
 */
const estado = vi.hoisted(() => ({ auth: { isAuthenticated: true, user: null as unknown } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: false, canCreate: false }) }));
vi.mock('@/hooks/useIsEntryGate', () => ({ useEntryGateTransition: () => ({ isGate: false, leaving: false, entering: false }) }));
vi.mock('@/pages/PublicEventsPage', () => ({ default: () => <p>vitrine</p> }));
vi.mock('@/pages/HomePage', () => ({ default: () => <p>porta</p> }));
vi.mock('@/pages/Dashboard', () => ({ default: () => <p>visão geral</p> }));
vi.mock('@/pages/CalendarPage', () => ({ default: () => <p>calendário</p> }));
vi.mock('@/pages/LixeiraPage', () => ({ default: () => <p>lixeira</p> }));
vi.mock('@/components/EventFormDialog', () => ({ default: () => null }));

const { default: EventsHubPage } = await import('./EventsHubPage');
const abrir = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<EventsHubPage />} />
      <Route path={ROTAS_DO_CANDIDATO.minhaArea} element={<p>área do candidato</p>} />
      <Route path="/calendario" element={<p>calendário anual</p>} />
    </Routes>
  </MemoryRouter>,
);

describe('a raiz, por quem chega', () => {
  it('conta de candidato vai para a área dela', () => {
    estado.auth = { isAuthenticated: true, user: { id: 'c1', user_metadata: { conta: 'candidato' } } };
    abrir();
    expect(screen.getByText('área do candidato')).toBeInTheDocument();
    expect(screen.queryByText('Visão Geral')).not.toBeInTheDocument();
  });

  it('conta do Calendário Anual vai para /calendario (14/11/2026)', () => {
    estado.auth = { isAuthenticated: true, user: { id: 'k1', user_metadata: { conta: 'calendario' } } };
    abrir();
    expect(screen.getByText('calendário anual')).toBeInTheDocument();
  });

  it('a equipe recebe o hub', () => {
    estado.auth = { isAuthenticated: true, user: { id: 'e1', user_metadata: {} } };
    abrir();
    expect(screen.getByText('Visão Geral')).toBeInTheDocument();
  });

  it('sem sessão e fora da porta (embed), a vitrine', () => {
    estado.auth = { isAuthenticated: false, user: null };
    abrir();
    expect(screen.getByText('vitrine')).toBeInTheDocument();
  });
});

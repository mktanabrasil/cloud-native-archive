import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * "Só o calendário" (13/11/2026): a gestora liberada no Calendário Anual com
 * o interruptor ligado não entra em página nenhuma da equipe; o app a manda
 * para /calendario, e nada da página aparece antes de o papel carregar.
 */
const estado = vi.hoisted(() => ({ papel: { soCalendario: false, loading: false } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, signOut: vi.fn(), user: { email: 'dic@anabrasil.org', user_metadata: {} } }) }));
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: false, isManager: true, userName: 'Gestão DIC', unit: 'DIC', canViewAuditoria: false, isMarketing: false, canAccessJournal: true, isRh: false, ...estado.papel }),
}));
vi.mock('@/hooks/useBetaPreference', () => ({ useBetaPreference: () => ({ eligible: false, rawEnabled: false, toggleBeta: vi.fn() }) }));
vi.mock('@/hooks/useIsEmbedded', () => ({ useIsEmbedded: () => false }));
vi.mock('@/hooks/useIsEntryGate', () => ({ useEntryGateTransition: () => ({ isGate: false, entering: false }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useSouResponsavel', () => ({ useSouResponsavel: () => false }));
vi.mock('@/hooks/useAvisosDaEquipe', () => ({ useAvisosDaEquipe: () => 0 }));
vi.mock('@/components/ImpersonationBanner', () => ({ default: () => null }));

const { default: AppLayout } = await import('./AppLayout');
const abrir = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route element={<AppLayout />}><Route path="*" element={<p>página da equipe</p>} /></Route>
      <Route path="/calendario" element={<p>calendário anual</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { estado.papel = { soCalendario: false, loading: false }; });

describe('só o calendário', () => {
  it.each(['/', '/eventos', '/mercado-solidario', '/jornal-institucional', '/usuarios'])('ligado: %s manda para /calendario', (rota) => {
    estado.papel = { soCalendario: true, loading: false };
    abrir(rota);
    expect(screen.getByText('calendário anual')).toBeInTheDocument();
    expect(screen.queryByText('página da equipe')).not.toBeInTheDocument();
  });

  it('enquanto o papel carrega, a página não aparece', () => {
    estado.papel = { soCalendario: false, loading: true };
    abrir('/');
    expect(screen.queryByText('página da equipe')).not.toBeInTheDocument();
  });

  it('desligado: a gestora vê o app como sempre', () => {
    abrir('/');
    expect(screen.getByText('página da equipe')).toBeInTheDocument();
  });
});

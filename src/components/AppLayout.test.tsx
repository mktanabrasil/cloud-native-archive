import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './AppLayout';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, signOut: vi.fn(), user: { email: 'mkt@anabrasil.org', user_metadata: {} } }),
}));
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({
    isAdmin: true, isManager: true, userName: 'Leonardo', unit: 'Administração', canViewAuditoria: true,
    isMarketing: true, canAccessJournal: true, isRh: true, loading: false,
  }),
}));
vi.mock('@/hooks/useBetaPreference', () => ({ useBetaPreference: () => ({ eligible: false, rawEnabled: false, toggleBeta: vi.fn() }) }));
vi.mock('@/hooks/useIsEmbedded', () => ({ useIsEmbedded: () => false }));
vi.mock('@/hooks/useIsEntryGate', () => ({ useEntryGateTransition: () => ({ isGate: false, entering: false }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/hooks/useSouResponsavel', () => ({ useSouResponsavel: () => false }));
vi.mock('@/hooks/useAvisosDaEquipe', () => ({ useAvisosDaEquipe: () => 0 }));
vi.mock('@/components/ImpersonationBanner', () => ({ default: () => null }));

const abrir = (rota = '/') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<p>conteúdo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

/**
 * A doca do celular (27/10/2026): "Mais" abre a própria doca para cima, no
 * mesmo vidro, com todas as áreas — em vez de uma folha separada.
 */
describe('a doca do celular', () => {
  it('mostra quatro áreas e "Mais"; o "Mais" abre a doca com todas as áreas', () => {
    abrir('/');
    const doca = screen.getByRole('navigation', { name: 'Navegação' });
    const mais = within(doca).getByRole('button', { name: /Mais/ });
    expect(mais).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('doca-todas')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(mais);
    expect(within(doca).getByRole('button', { name: /Fechar/ })).toHaveAttribute('aria-expanded', 'true');
    const todas = document.getElementById('doca-todas')!;
    expect(todas).toHaveAttribute('aria-hidden', 'false');
    const nomes = within(todas).getAllByRole('link').map(l => l.textContent);
    expect(nomes).toEqual(['Eventos', 'Jornal Institucional', 'Mercado Solidário', 'Vagas', 'Marketing', 'Painel']);
  });

  it('fecha com Esc, com o toque fora e ao escolher uma área', () => {
    abrir('/');
    const doca = screen.getByRole('navigation', { name: 'Navegação' });
    fireEvent.click(within(doca).getByRole('button', { name: /Mais/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(doca).getByRole('button', { name: /Mais/ })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(within(doca).getByRole('button', { name: /Mais/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o menu' }));
    expect(within(doca).getByRole('button', { name: /Mais/ })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(within(doca).getByRole('button', { name: /Mais/ }));
    fireEvent.click(within(document.getElementById('doca-todas')!).getByRole('link', { name: 'Painel' }));
    expect(within(doca).getByRole('button', { name: /Mais/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('a área atual nunca fica escondida no "Mais"', () => {
    abrir('/mercado-solidario');
    const doca = screen.getByRole('navigation', { name: 'Navegação' });
    const linha = [...doca.querySelectorAll(':scope > div.grid:last-child > a')].map(a => a.textContent);
    expect(linha).toContain('Mercado');
  });
});

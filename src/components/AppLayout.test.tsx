import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const estado = vi.hoisted(() => ({
  papel: {} as Record<string, unknown>,
  celular: true,
}));
const MARKETING = {
  isAdmin: true, isManager: true, userName: 'Comunicação', unit: 'Administração', canViewAuditoria: true,
  isMarketing: true, canAccessJournal: true, isRh: true, soCalendario: false, temCalendarioAnual: false, loading: false,
};
// A gestão de uma unidade do Social, liberada no Calendário Anual (e já solta do "só o calendário").
const GESTORA_DO_SOCIAL = {
  isAdmin: false, isManager: true, userName: 'Gestão', unit: 'DIC', canViewAuditoria: false,
  isMarketing: false, canAccessJournal: false, isRh: false, soCalendario: false, temCalendarioAnual: true, loading: false,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, signOut: vi.fn(), user: { email: 'equipe@anabrasil.org', user_metadata: {} } }),
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
vi.mock('@/hooks/useBetaPreference', () => ({ useBetaPreference: () => ({ eligible: false, rawEnabled: false, toggleBeta: vi.fn() }) }));
vi.mock('@/hooks/useIsEmbedded', () => ({ useIsEmbedded: () => false }));
vi.mock('@/hooks/useIsEntryGate', () => ({ useEntryGateTransition: () => ({ isGate: false, entering: false }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => estado.celular }));
vi.mock('@/hooks/useSouResponsavel', () => ({ useSouResponsavel: () => false }));
vi.mock('@/hooks/useAvisosDaEquipe', () => ({ useAvisosDaEquipe: () => 0 }));
vi.mock('@/components/ImpersonationBanner', () => ({ default: () => null }));
// O menu da foto aberto de vez: o Radix aberto trava o jsdom com a página inteira em volta.
vi.mock('@/components/ui/dropdown-menu', () => {
  const Passa = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Passa, DropdownMenuTrigger: Passa, DropdownMenuLabel: Passa, DropdownMenuSeparator: () => null,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="menu-da-conta">{children}</div>,
    DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

const { default: AppLayout } = await import('./AppLayout');

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
const doca = () => screen.getByRole('navigation', { name: 'Navegação' });
const nomes = (el: HTMLElement) => within(el).getAllByRole('link').map(l => l.textContent);
const aberto = (el: HTMLElement) => within(el).getAllByRole('link').filter(l => l.getAttribute('aria-current') === 'page').map(l => l.textContent);

beforeEach(() => {
  estado.papel = { ...MARKETING };
  estado.celular = true;
});

/**
 * Setores (16/11/2026): o menu de cima são os setores — Social, Educação,
 * Vagas, Marketing e Painel — e as páginas de cada um ficam na faixa logo
 * abaixo da barra. As páginas não mudaram de endereço.
 */
describe('a doca do celular, por setores', () => {
  it('o marketing vê os cinco setores, sem "Mais"', () => {
    abrir('/');
    expect(nomes(doca())).toEqual(['Social', 'Educação', 'Vagas', 'Marketing', 'Painel']);
    expect(within(doca()).queryByRole('button', { name: /Mais/ })).not.toBeInTheDocument();
  });

  it.each([
    ['/', 'Social'],
    ['/eventos', 'Social'],
    ['/calendario', 'Social'],
    ['/jornal-institucional', 'Educação'],
    ['/marketing?aba=pizza', 'Marketing'],
    ['/mercado-solidario', 'Marketing'],
    ['/pizza-da-alegria/painel', 'Marketing'],
    ['/auditoria', 'Marketing'],
    ['/usuarios', 'Painel'],
  ])('em %s, o setor aberto é %s', (rota, setor) => {
    abrir(rota);
    expect(aberto(doca())).toEqual([setor]);
  });

  it('com um setor só, não há doca', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/');
    expect(screen.queryByRole('navigation', { name: 'Navegação' })).not.toBeInTheDocument();
  });
});

describe('a faixa do setor', () => {
  it('Social: Eventos e Calendário Anual, com a página aberta marcada', () => {
    abrir('/');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Social' });
    expect(nomes(faixa)).toEqual(['Eventos', 'Calendário Anual']);
    expect(aberto(faixa)).toEqual(['Eventos']);
  });

  it('o Calendário Anual aparece aberto em /calendario', () => {
    abrir('/calendario');
    expect(aberto(screen.getByRole('navigation', { name: 'Páginas de Social' }))).toEqual(['Calendário Anual']);
  });

  it('Marketing: o Mercado Solidário e as abas de antes, pela URL', () => {
    abrir('/marketing?aba=voluntariado');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Marketing' });
    expect(nomes(faixa)).toEqual(['Mercado Solidário', 'Pizza da Alegria', 'Voluntariado', 'Enquetes', 'Manual Design', 'Portal Transparência', 'Widgets', 'Auditoria']);
    expect(aberto(faixa)).toEqual(['Voluntariado']);
    expect(within(faixa).getByRole('link', { name: 'Pizza da Alegria' })).toHaveAttribute('href', '/marketing?aba=pizza');
  });

  it('sem aba na URL, o Marketing abre na Auditoria, como antes', () => {
    abrir('/marketing');
    expect(aberto(screen.getByRole('navigation', { name: 'Páginas de Marketing' }))).toEqual(['Auditoria']);
  });

  it('o Mercado Solidário fica marcado na faixa do Marketing', () => {
    abrir('/mercado-solidario');
    expect(aberto(screen.getByRole('navigation', { name: 'Páginas de Marketing' }))).toEqual(['Mercado Solidário']);
  });

  it.each(['/jornal-institucional', '/vagas', '/usuarios'])('%s: setor de uma página só (ou com abas próprias), sem faixa', (rota) => {
    abrir(rota);
    expect(screen.queryByRole('navigation', { name: /^Páginas de/ })).not.toBeInTheDocument();
  });

  it('sem o Calendário Anual liberado, o Social tem uma página só: sem faixa', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL, temCalendarioAnual: false };
    abrir('/');
    expect(screen.queryByRole('navigation', { name: 'Páginas de Social' })).not.toBeInTheDocument();
  });

  it('a gestora liberada no calendário vê as duas páginas do Social', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/');
    expect(nomes(screen.getByRole('navigation', { name: 'Páginas de Social' }))).toEqual(['Eventos', 'Calendário Anual']);
  });

  it('no computador, a faixa mostra o nome do setor', () => {
    estado.celular = false;
    abrir('/');
    expect(screen.getByRole('navigation', { name: 'Páginas de Social' })).toHaveTextContent(/^Social/);
  });
});

describe('o menu da foto', () => {
  const menu = () => screen.getByTestId('menu-da-conta');

  it('quem não é do marketing (a gestão de unidade inclusive) chega ao próprio perfil por ele', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/');
    expect(within(menu()).getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('href', '/usuarios');
  });

  it('o marketing continua vendo "Painel"', () => {
    abrir('/');
    expect(within(menu()).getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/usuarios');
  });
});

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const estado = vi.hoisted(() => ({
  papel: {} as Record<string, unknown>,
  celular: true,
  avisos: 0,
  responsavel: false,
  conta: {} as Record<string, unknown>,
}));
const MARKETING = {
  isAdmin: true, isManager: true, userName: 'Comunicação', unit: 'Administração', canViewAuditoria: true,
  isMarketing: true, canAccessJournal: true, isRh: true, temCalendarioAnual: false, loading: false,
};
// A gestão de uma unidade do Social, liberada no Calendário Anual (e já solta do "só o calendário").
const GESTORA_DO_SOCIAL = {
  isAdmin: false, isManager: true, userName: 'Gestão', unit: 'DIC', canViewAuditoria: false,
  isMarketing: false, canAccessJournal: false, isRh: false, temCalendarioAnual: true, loading: false,
};
// A direção de um CEI: a gestão da Educação vê só a Educação (16/11/2026).
const DIRECAO_DE_CEI = {
  isAdmin: false, isManager: true, userName: 'Direção', unit: 'Anísio', canViewAuditoria: false,
  isMarketing: false, canAccessJournal: true, isRh: false, soEducacao: true, temCalendarioAnual: false, loading: false,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, signOut: vi.fn(), user: { id: 'u1', email: 'equipe@anabrasil.org', user_metadata: estado.conta } }),
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
vi.mock('@/hooks/useBetaPreference', () => ({ useBetaPreference: () => ({ eligible: false, rawEnabled: false, toggleBeta: vi.fn() }) }));
vi.mock('@/hooks/useIsEmbedded', () => ({ useIsEmbedded: () => false }));
vi.mock('@/hooks/useIsEntryGate', () => ({ useEntryGateTransition: () => ({ isGate: false, entering: false }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => estado.celular }));
vi.mock('@/hooks/useSouResponsavel', () => ({ useSouResponsavel: () => estado.responsavel }));
vi.mock('@/hooks/useApoiadores', () => ({ useApoiadores: () => ({ vejo: false, carregado: true }) }));
vi.mock('@/hooks/useVoluntariado', async () => { const { useUserRole } = await import('@/hooks/useUserRole'); return { useVoluntariado: () => ({ vejo: !!useUserRole().temVoluntariado, carregado: true }) }; });
vi.mock('@/hooks/useAvisosDaEquipe', () => ({ useAvisosDaEquipe: () => estado.avisos }));
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
const { useEsconderFaixaDoSetor } = await import('@/hooks/useFaixaDoSetor');

/** Faz o que o editor do Jornal faz ao abrir: pede a faixa do setor fora. */
function EditorDeMentira() {
  useEsconderFaixaDoSetor();
  return <p>editor</p>;
}

/** Mostra o endereço em que a página parou (para ver redirecionamentos). */
function Endereco() {
  return <p data-testid="endereco">{useLocation().pathname}</p>;
}

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
  estado.conta = {};
});

/**
 * Setores (16/11/2026): o menu de cima são os setores — Social, Educação,
 * Vagas, Marketing e Painel — e as páginas de cada um ficam na faixa logo
 * abaixo da barra. Desde 16/11/2026 os endereços também são por setor
 * (/social/…, /educacao/…, /marketing/…, /painel).
 */
describe('a doca do celular, por setores', () => {
  it('o marketing vê os cinco setores, sem "Mais"', () => {
    abrir('/social/eventos');
    expect(nomes(doca())).toEqual(['Social', 'Educação', 'Administração', 'Marketing', 'Painel']);
    expect(within(doca()).queryByRole('button', { name: /Mais/ })).not.toBeInTheDocument();
  });

  it.each([
    ['/social/eventos', 'Social'],
    ['/eventos', 'Social'],
    ['/social/calendario', 'Social'],
    ['/educacao/jornal', 'Educação'],
    ['/marketing/pizza', 'Marketing'],
    ['/marketing/mercado-solidario', 'Marketing'],
    ['/pizza-da-alegria/painel', 'Marketing'],
    ['/marketing/auditoria', 'Marketing'],
    ['/painel', 'Painel'],
  ])('em %s, o setor aberto é %s', (rota, setor) => {
    abrir(rota);
    expect(aberto(doca())).toEqual([setor]);
  });

  it('com um setor só, não há doca', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/social/eventos');
    expect(screen.queryByRole('navigation', { name: 'Navegação' })).not.toBeInTheDocument();
  });
});

describe('a faixa do setor', () => {
  it('Social: Eventos e Calendário Anual, com a página aberta marcada', () => {
    abrir('/social/eventos');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Social' });
    expect(nomes(faixa)).toEqual(['Eventos', 'Calendário Anual']);
    expect(aberto(faixa)).toEqual(['Eventos']);
  });

  it('o Calendário Anual aparece aberto em /social/calendario', () => {
    abrir('/social/calendario');
    expect(aberto(screen.getByRole('navigation', { name: 'Páginas de Social' }))).toEqual(['Calendário Anual']);
  });

  it('Marketing: o Mercado Solidário e as abas, cada uma no seu endereço', () => {
    abrir('/marketing/voluntariado');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Marketing' });
    expect(nomes(faixa)).toEqual(['Notícias', 'Mercado Solidário', 'Pizza da Alegria', 'Voluntariado', 'Lembretes', 'Enquetes', 'Manual Design', 'Portal Transparência', 'Widgets', 'Auditoria']);
    expect(aberto(faixa)).toEqual(['Voluntariado']);
    expect(within(faixa).getByRole('link', { name: 'Pizza da Alegria' })).toHaveAttribute('href', '/marketing/pizza');
  });

  it('sem aba na URL, o Marketing abre na Auditoria, como antes', () => {
    abrir('/marketing');
    expect(aberto(screen.getByRole('navigation', { name: 'Páginas de Marketing' }))).toEqual(['Auditoria']);
  });

  it('o Mercado Solidário fica marcado na faixa do Marketing', () => {
    abrir('/marketing/mercado-solidario');
    expect(aberto(screen.getByRole('navigation', { name: 'Páginas de Marketing' }))).toEqual(['Mercado Solidário']);
  });

  it('/vagas: fora dos setores, sem faixa', () => {
    abrir('/vagas');
    expect(screen.queryByRole('navigation', { name: /^Páginas de/ })).not.toBeInTheDocument();
  });

  it('/painel: a faixa só com o nome do setor e o "Dar feedback" (23/11/2026)', () => {
    estado.celular = false;
    abrir('/painel');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Painel' });
    expect(faixa).toHaveTextContent(/^Painel/);
    expect(within(faixa).queryAllByRole('link')).toHaveLength(0);
    expect(within(faixa).getByRole('button', { name: 'Dar feedback' })).toBeInTheDocument();
  });

  it('o "Dar feedback" fica na faixa de cada setor, no celular só o ícone', () => {
    abrir('/social/calendario');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Social' });
    expect(within(faixa).getByRole('button', { name: 'Dar feedback' })).toHaveTextContent('');
  });

  it('conta de candidato não vê o "Dar feedback"', () => {
    estado.conta = { conta: 'candidato' };
    abrir('/social/calendario');
    // A conta de candidato vê o app como visitante: nem a faixa nem o botão.
    expect(screen.queryByRole('button', { name: 'Dar feedback' })).not.toBeInTheDocument();
  });

  it.each([
    ['/educacao/jornal', 'Jornal Institucional'],
    ['/educacao/jornais-das-unidades', 'Jornais das unidades'],
  ])('Educação, em %s: o Jornal e o feed, com %s aberto', (rota, aberta) => {
    abrir(rota);
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Educação' });
    expect(nomes(faixa)).toEqual(['Jornal Institucional', 'Jornais das unidades']);
    expect(aberto(faixa)).toEqual([aberta]);
    expect(aberto(doca())).toEqual(['Educação']);
  });

  it('some enquanto o editor (tela cheia) está aberto', () => {
    render(
      <MemoryRouter initialEntries={['/educacao/jornal']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="*" element={<EditorDeMentira />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('navigation', { name: 'Páginas de Educação' })).not.toBeInTheDocument();
  });

  it('sem o Calendário Anual liberado, o Social tem uma página só: a faixa traz só o nome e o "Dar feedback"', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL, temCalendarioAnual: false };
    abrir('/social/eventos');
    const faixa = screen.getByRole('navigation', { name: 'Páginas de Social' });
    expect(faixa).toHaveTextContent(/^Social/);
    expect(within(faixa).queryAllByRole('link')).toHaveLength(0);
    expect(within(faixa).getByRole('button', { name: 'Dar feedback' })).toBeInTheDocument();
  });

  it('com uma página só, a conta de candidato não vê faixa nenhuma', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL, temCalendarioAnual: false };
    estado.conta = { conta: 'candidato' };
    abrir('/social/eventos');
    expect(screen.queryByRole('navigation', { name: 'Páginas de Social' })).not.toBeInTheDocument();
  });

  it('a gestora liberada no calendário vê as duas páginas do Social', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/social/eventos');
    expect(nomes(screen.getByRole('navigation', { name: 'Páginas de Social' }))).toEqual(['Eventos', 'Calendário Anual']);
  });

  it('no computador, a faixa mostra o nome do setor', () => {
    estado.celular = false;
    abrir('/social/eventos');
    expect(screen.getByRole('navigation', { name: 'Páginas de Social' })).toHaveTextContent(/^Social/);
  });
});

/** Setores, PR 2 (16/11/2026): cada gestão vê o próprio setor. */
describe('quem vê o quê', () => {
  const barra = () => screen.getByRole('navigation', { name: 'Setores' });
  const ondeEstou = () => screen.getByTestId('endereco').textContent;
  const abrirComEndereco = (rota: string) =>
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="*" element={<Endereco />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

  it('a gestão do Social vê só o Social (sem a Educação)', () => {
    estado.celular = false;
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/social/eventos');
    expect(nomes(barra())).toEqual(['Social']);
  });

  it('a direção de um CEI vê só a Educação (sem o Social)', () => {
    estado.celular = false;
    estado.papel = { ...DIRECAO_DE_CEI };
    abrir('/educacao/jornal');
    expect(nomes(barra())).toEqual(['Educação']);
  });

  it('no celular, a direção de um CEI tem um setor só: sem doca', () => {
    estado.papel = { ...DIRECAO_DE_CEI };
    abrir('/educacao/jornal');
    expect(screen.queryByRole('navigation', { name: 'Navegação' })).not.toBeInTheDocument();
  });

  it('a direção de um CEI fica na página inicial (17/11/2026: com os jornais)', () => {
    estado.papel = { ...DIRECAO_DE_CEI };
    abrirComEndereco('/');
    expect(ondeEstou()).toBe('/');
  });

  it('as Programações continuam abrindo para ela pelo endereço', () => {
    estado.papel = { ...DIRECAO_DE_CEI };
    abrirComEndereco('/eventos');
    expect(ondeEstou()).toBe('/eventos');
  });

  it('para a gestão do Social, os Eventos continuam abrindo', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrirComEndereco('/social/eventos');
    expect(ondeEstou()).toBe('/social/eventos');
  });

  it('a direção de um CEI que abre os Eventos da equipe vai para o Jornal', () => {
    estado.papel = { ...DIRECAO_DE_CEI };
    abrirComEndereco('/social/eventos');
    expect(ondeEstou()).toBe('/educacao/jornal');
  });
});

/** Com sessão, o miolo espera o papel: ninguém vê uma página que não é dela nem por um instante. */
describe('enquanto o papel carrega', () => {
  it('a página não aparece', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL, loading: true };
    abrir('/social/eventos');
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });
});

describe('o menu da foto', () => {
  const menu = () => screen.getByTestId('menu-da-conta');

  it('quem não é do marketing (a gestão de unidade inclusive) chega ao próprio perfil por ele', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir('/social/eventos');
    expect(within(menu()).getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('href', '/painel');
  });

  it('o marketing continua vendo "Painel"', () => {
    abrir('/social/eventos');
    expect(within(menu()).getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/painel');
  });
});

describe('o setor Administração (18/11/2026)', () => {
  beforeEach(() => { estado.avisos = 0; estado.responsavel = false; });

  it('leva ao RH e carrega o selo de avisos das vagas', () => {
    estado.papel = MARKETING;
    estado.celular = true;
    estado.avisos = 3;
    abrir('/social/eventos');
    const adm = within(screen.getByRole('navigation', { name: 'Navegação' })).getByRole('link', { name: /Administração/ });
    expect(adm).toHaveAttribute('href', '/administracao/rh');
    expect(adm).toHaveTextContent('Administração');
    expect(within(adm).getByLabelText('3 para ver')).toBeInTheDocument();
  });

  it('o responsável por um processo, sem ser RH, também vê a Administração', () => {
    estado.papel = GESTORA_DO_SOCIAL;
    estado.celular = true;
    estado.responsavel = true;
    abrir('/social/eventos');
    expect(within(screen.getByRole('navigation', { name: 'Navegação' })).getByRole('link', { name: /Administração/ })).toHaveAttribute('href', '/administracao/rh');
  });
});

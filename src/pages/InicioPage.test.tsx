import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * A página inicial (17/11/2026): saudação, busca (páginas, eventos e
 * jornais) e os próximos eventos — ou os jornais finalizados, para a gestão
 * da Educação, que não vê o Social.
 */
const estado = vi.hoisted(() => ({
  papel: {} as Record<string, unknown>,
  eventos: [] as unknown[],
  jornais: [] as unknown[],
}));
const MARKETING = {
  userName: 'Comunicação ANA', isMarketing: true, canAccessJournal: true, soEducacao: false, isRh: true, temCalendarioAnual: false,
  isAdmin: true, isManager: true, canViewAuditoria: true, loading: false,
};
const GESTORA_DO_SOCIAL = {
  userName: 'Gestão DIC', isMarketing: false, canAccessJournal: false, soEducacao: false, isRh: false, temCalendarioAnual: true,
  isAdmin: false, isManager: true, canViewAuditoria: false, loading: false,
};
const DIRECAO_DE_CEI = {
  userName: 'Direção Anísio', isMarketing: false, canAccessJournal: true, soEducacao: true, isRh: false, temCalendarioAnual: false,
  isAdmin: false, isManager: true, canViewAuditoria: false, loading: false,
};

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1' } }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
vi.mock('@/hooks/useSouResponsavel', () => ({ useSouResponsavel: () => false }));
vi.mock('@/contexts/AppContext', () => ({ useApp: () => ({ loading: false }) }));
vi.mock('@/hooks/useFilteredEvents', () => ({ useFilteredEvents: (publico: boolean) => (publico ? [] : estado.eventos) }));
vi.mock('@/integrations/supabase/client', () => {
  const cadeia: Record<string, unknown> = {};
  cadeia.select = () => cadeia;
  cadeia.is = () => cadeia;
  cadeia.order = () => Promise.resolve({ data: estado.jornais, error: null });
  return { supabase: { from: () => cadeia } };
});

const { default: InicioPage } = await import('./InicioPage');

function Endereco() {
  const l = useLocation();
  return <p data-testid="endereco">{l.pathname + l.search}</p>;
}
const abrir = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="*" element={<Endereco />} />
      </Routes>
    </MemoryRouter>,
  );
const busca = () => screen.getByRole('combobox', { name: 'Procurar no app' });
const digitar = (texto: string) => fireEvent.change(busca(), { target: { value: texto } });
const opcoes = () => screen.getAllByRole('option').map((o) => o.querySelector('.min-w-0 b')?.textContent);
const endereco = () => screen.getByTestId('endereco').textContent;

const daqui = (dias: number, hora = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};
const evento = (id: string, title: string, dias: number, extra: Record<string, unknown> = {}) => ({
  id, title, unit: 'DIC', location: '', start_datetime: daqui(dias), end_datetime: daqui(dias, 11), status: 'confirmado', visibility: 'publico', slug: null, ...extra,
});

beforeEach(() => {
  estado.papel = { ...MARKETING };
  estado.eventos = [
    evento('e1', 'Karatê no Santana', 5, { unit: 'Santana', slug: 'karate-no-santana' }),
    evento('e2', 'Natal Feliz 2026', 21, { unit: 'Administração', visibility: 'interno' }),
    evento('e3', 'Reunião com as famílias', 9),
    evento('e4', 'Espetáculo de Natal', 26),
    evento('e0', 'Festa que já foi', -10),
  ];
  estado.jornais = [
    { id: 'j1', name: 'Jornal Calmon — Novembro 2026', unit_id: 'cei-calmon', status: 'finalizado', reference_month: 'Novembro 2026', updated_at: '2026-11-14' },
    { id: 'j2', name: 'Jornal Anísio — Novembro 2026', unit_id: 'cei-anisio-spinola', status: 'rascunho', reference_month: 'Novembro 2026', updated_at: '2026-11-15' },
  ];
});

describe('a página inicial', () => {
  it('cumprimenta pelo primeiro nome', () => {
    abrir();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^(Bom dia|Boa tarde|Boa noite), Comunicação$/);
  });

  it('o marketing vê os cinco setores e os três próximos eventos, do mais perto ao mais longe', () => {
    abrir();
    expect(within(screen.getByRole('navigation', { name: 'Setores' })).getAllByRole('link').map((l) => l.textContent)).toEqual(['Social', 'Educação', 'Administração', 'Marketing', 'Painel']);
    const lista = screen.getByRole('heading', { name: 'Próximos eventos' }).parentElement!;
    expect(within(lista).getAllByRole('listitem').map((li) => li.querySelector('.min-w-0 b')?.textContent)).toEqual(['Karatê no Santana', 'Reunião com as famílias', 'Natal Feliz 2026']);
    expect(within(lista).getByRole('link', { name: /Karatê no Santana/ })).toHaveAttribute('href', '/social/eventos?slug=karate-no-santana');
  });

  it('a busca acha a página e o Enter abre', () => {
    abrir();
    digitar('pizza');
    expect(opcoes()).toEqual(['Pizza da Alegria']);
    fireEvent.keyDown(busca(), { key: 'Enter' });
    expect(endereco()).toBe('/marketing/pizza');
  });

  it('páginas, eventos e jornais, em grupos; as setas escolhem', () => {
    abrir();
    digitar('natal');
    expect(opcoes()).toEqual(['Voluntariado', 'Natal Feliz 2026', 'Espetáculo de Natal']);
    fireEvent.keyDown(busca(), { key: 'ArrowDown' });
    fireEvent.keyDown(busca(), { key: 'Enter' });
    expect(endereco()).toBe('/social/eventos?slug=e2');
  });

  it('jornais abrem no Jornal Institucional, na unidade deles', () => {
    abrir();
    digitar('calmon');
    return screen.findByRole('option', { name: /Jornal Calmon/ }).then((o) => {
      fireEvent.click(o);
      expect(endereco()).toBe('/educacao/jornal?unidade=cei-calmon&abrir=j1');
    });
  });

  it('o "/" leva à busca', () => {
    abrir();
    fireEvent.keyDown(window, { key: '/' });
    expect(busca()).toHaveFocus();
  });

  it('com uma letra só não abre a lista; sem resultado, diz', () => {
    abrir();
    digitar('z');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    digitar('zzz');
    expect(screen.getByText('Nada encontrado para “zzz”.')).toBeInTheDocument();
  });
});

describe('cada um vê o que é seu', () => {
  it('a gestão do Social: sem botões de setor, sem jornal nem Marketing na busca', () => {
    estado.papel = { ...GESTORA_DO_SOCIAL };
    abrir();
    expect(screen.queryByRole('navigation', { name: 'Setores' })).not.toBeInTheDocument();
    expect(busca()).toHaveAttribute('placeholder', 'Procurar evento ou página…');
    digitar('pizza');
    expect(screen.getByText('Nada encontrado para “pizza”.')).toBeInTheDocument();
    digitar('calendario anual');
    expect(opcoes()).toEqual(['Calendário Anual']);
  });

  it('a direção de um CEI vê os jornais finalizados no lugar dos eventos, e a busca não traz eventos', async () => {
    estado.papel = { ...DIRECAO_DE_CEI };
    abrir();
    expect(screen.queryByRole('heading', { name: 'Próximos eventos' })).not.toBeInTheDocument();
    const lista = (await screen.findByRole('heading', { name: 'Jornais finalizados' })).parentElement!;
    expect(await within(lista).findByRole('link', { name: /Jornal Calmon/ })).toHaveAttribute('href', '/educacao/jornais-das-unidades?ler=j1');
    expect(within(lista).queryByRole('link', { name: /Jornal Anísio/ })).not.toBeInTheDocument();
    expect(busca()).toHaveAttribute('placeholder', 'Procurar jornal ou página…');
    digitar('natal');
    expect(screen.getByText('Nada encontrado para “natal”.')).toBeInTheDocument();
  });
});

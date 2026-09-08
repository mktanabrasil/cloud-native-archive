import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppEvent } from '@/types';

/**
 * A página pública de eventos.
 *
 * Ela é uma só para o visitante e para a equipe; o que muda é o que aparece
 * por cima. Estes testes fixam o que cada modo mostra, o que o clique faz e
 * a divisão entre Próximos e Já aconteceram.
 */

const espiao = vi.hoisted(() => ({
  eventos: [] as unknown[],
  editar: vi.fn(),
  autenticado: true,
  detalhe: null as unknown,
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    events: espiao.eventos,
    updateEvent: vi.fn(),
    setSelectedEvent: espiao.editar,
    selectedEvent: null,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: espiao.autenticado }),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: true, canEdit: true, viewRestrictions: null, permissionLevel: 'admin_geral' }),
}));

vi.mock('@/hooks/useViewConfigs', () => ({
  useViewConfigs: () => ({ configs: null }),
}));

/* O detalhe vira um marcador: o que importa aqui é se abriu, e com quais botões. */
vi.mock('@/components/EventDetailDialog', () => ({
  EventDetailDialog: (props: { open: boolean; event: AppEvent | null; onEditar?: unknown; comoVisitante?: boolean }) =>
    props.open && props.event ? (
      <div data-testid="detalhe" data-editar={props.onEditar ? 'sim' : 'nao'} data-visitante={props.comoVisitante ? 'sim' : 'nao'}>
        detalhe de {props.event.title}
      </div>
    ) : null,
}));
vi.mock('@/components/EventFormDialog', () => ({ default: () => null }));
vi.mock('@/components/BannerMissingDialog', () => ({ BannerMissingDialog: () => null }));

const { default: PublicEventsPage } = await import('./PublicEventsPage');

const evento = (over: Partial<AppEvent>): AppEvent =>
  ({
    id: 'e1',
    title: 'Evento',
    description: '',
    unit: 'DIC',
    event_type: 'reunião',
    start_datetime: '2026-10-01T13:00:00.000Z',
    end_datetime: '2026-10-01T15:00:00.000Z',
    location: 'Sede',
    status: 'confirmado',
    visibility: 'publico',
    has_conflict: false,
    created_by: 'alguem',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    notes: '',
    marketing_request: false,
    partner_involved: false,
    partner_type: '',
    partner_name: '',
    partners: [],
    has_unit_collaboration: false,
    collaborating_units: [],
    external_collaborators: [],
    attachments: [],
    ...over,
  }) as AppEvent;

const ativo = evento({ id: 'ativo-1', title: 'Festa da Primavera' });
const naLixeira = evento({
  id: 'lixo-1',
  title: 'Reunião cancelada',
  visibility: 'interno',
  status: 'pendente',
  deleted_at: '2026-08-20T12:00:00.000Z',
});

const montar = (url = '/eventos') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PublicEventsPage />
    </MemoryRouter>,
  );

/**
 * Só a grade: o herói (h2) também escreve o título do evento, e para o admin
 * ele mostra até os passados, com selo. O card usa h3.
 */
const noCard = (titulo: string) => screen.queryAllByRole('heading', { level: 3, name: titulo }).length;

beforeEach(() => {
  espiao.eventos = [ativo, naLixeira];
  espiao.autenticado = true;
  espiao.editar.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 8, 8, 15) });
});
afterEach(() => vi.useRealTimers());

describe('a grade lê da vitrine', () => {
  it('mostra o ativo e não o que está na lixeira', () => {
    montar();

    expect(noCard('Festa da Primavera')).toBe(1);
    expect(noCard('Reunião cancelada')).toBe(0);
  });

  it('a lixeira e as pílulas não moram mais aqui', () => {
    montar();

    expect(screen.queryByRole('button', { name: /ver lixeira/i })).toBeNull();
    expect(screen.queryByText(/confirmados:/i)).toBeNull();
    expect(screen.queryByText(/eventos:/i)).toBeNull();
  });
});

describe('o campo de busca', () => {
  it('não fixa a cor de fundo, para acompanhar o tema', () => {
    montar();

    const busca = screen.getByPlaceholderText(/buscar por/i);

    expect(busca.className).not.toMatch(/bg-white/);
    expect(busca.className).toMatch(/bg-card/);
  });
});

describe('modo equipe', () => {
  it('avisa o modo e mostra os botões da equipe no card', () => {
    montar();

    expect(screen.getByText('equipe', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar evento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adicionar ao banner|remover do banner/i })).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });

  it('o clique no card abre o detalhe, com editar dentro, e não o formulário', () => {
    montar();

    fireEvent.click(screen.getByRole('heading', { level: 3, name: 'Festa da Primavera' }));

    const detalhe = screen.getByTestId('detalhe');
    expect(detalhe).toHaveTextContent('detalhe de Festa da Primavera');
    expect(detalhe.dataset.editar).toBe('sim');
    expect(detalhe.dataset.visitante).toBe('nao');
    expect(espiao.editar).not.toHaveBeenCalled();
  });

  it('o lápis edita direto', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /editar evento/i }));

    expect(espiao.editar).toHaveBeenCalledWith(expect.objectContaining({ id: 'ativo-1' }));
    expect(screen.queryByTestId('detalhe')).toBeNull();
  });

  it('o link com slug abre o detalhe, não a edição', () => {
    montar('/eventos?slug=ativo-1');

    expect(screen.getByTestId('detalhe')).toHaveTextContent('Festa da Primavera');
    expect(espiao.editar).not.toHaveBeenCalled();
  });
});

describe('ver como visitante', () => {
  it('o interruptor esconde tudo que é da equipe', () => {
    montar();

    fireEvent.click(screen.getByRole('switch', { name: /ver como visitante/i }));

    expect(screen.getByText('visitante', { selector: 'b' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar evento/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /adicionar ao banner|remover do banner/i })).toBeNull();
    expect(screen.queryByText('Confirmado')).toBeNull();
    expect(noCard('Festa da Primavera')).toBe(1);
  });

  it('o detalhe abre sem editar e como visitante', () => {
    montar('/eventos?como=visitante');

    fireEvent.click(screen.getByRole('heading', { level: 3, name: 'Festa da Primavera' }));

    const detalhe = screen.getByTestId('detalhe');
    expect(detalhe.dataset.editar).toBe('nao');
    expect(detalhe.dataset.visitante).toBe('sim');
  });

  it('o visitante anônimo não vê a faixa nem o interruptor', () => {
    espiao.autenticado = false;
    montar();

    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('equipe', { selector: 'b' })).toBeNull();
    expect(screen.queryByRole('button', { name: /editar evento/i })).toBeNull();
  });
});

/**
 * "Próximos" e "Já aconteceram".
 *
 * A grade mostrava tudo por data crescente: em setembro, um evento de março
 * abria a página. Agora quem terminou antes de hoje começar vai para a
 * segunda aba. Hoje, nestes testes, é 8 de setembro de 2026.
 */
describe('as abas Próximos e Já aconteceram', () => {
  const passado = evento({
    id: 'passado-1',
    title: 'Festa de Páscoa',
    start_datetime: new Date(2026, 2, 28, 14).toISOString(),
    end_datetime: new Date(2026, 2, 28, 17).toISOString(),
  });
  const futuro = evento({
    id: 'futuro-1',
    title: 'Hope Day 2026',
    start_datetime: new Date(2026, 9, 10, 8).toISOString(),
    end_datetime: new Date(2026, 9, 10, 16).toISOString(),
  });

  it('abre em Próximos e deixa o passado para a outra aba', () => {
    espiao.eventos = [passado, futuro];
    montar();

    expect(noCard('Hope Day 2026')).toBeGreaterThan(0);
    expect(noCard('Festa de Páscoa')).toBe(0);
    expect(screen.getByRole('tab', { name: /próximos/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('mostra o passado ao trocar de aba, com o selo Encerrado', () => {
    espiao.eventos = [passado, futuro];
    montar();

    fireEvent.click(screen.getByRole('tab', { name: /já aconteceram/i }));

    expect(noCard('Festa de Páscoa')).toBeGreaterThan(0);
    expect(noCard('Hope Day 2026')).toBe(0);
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
  });

  it('quando só há passados, já abre em Já aconteceram', () => {
    espiao.eventos = [passado];
    montar();

    expect(screen.getByRole('tab', { name: /já aconteceram/i })).toHaveAttribute('aria-selected', 'true');
    expect(noCard('Festa de Páscoa')).toBeGreaterThan(0);
  });

  it('evento de hoje continua em Próximos mesmo depois de acabar', () => {
    espiao.eventos = [
      evento({ id: 'hoje', title: 'Reunião da manhã', start_datetime: new Date(2026, 8, 8, 9).toISOString(), end_datetime: new Date(2026, 8, 8, 11).toISOString() }),
    ];
    montar();

    expect(screen.getByRole('tab', { name: /próximos/i })).toHaveAttribute('aria-selected', 'true');
    expect(noCard('Reunião da manhã')).toBeGreaterThan(0);
  });

  it('a busca que só acha na outra aba avisa, em vez de trocar sozinha', () => {
    espiao.eventos = [passado, futuro];
    montar();

    fireEvent.change(screen.getByPlaceholderText(/buscar por/i), { target: { value: 'páscoa' } });

    expect(noCard('Festa de Páscoa')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /1 resultado em já aconteceram/i }));
    expect(noCard('Festa de Páscoa')).toBeGreaterThan(0);
  });
});

describe('o título no card', () => {
  it('quebra a linha em vez de escrever o marcador', () => {
    espiao.eventos = [evento({ id: 'quebra', title: 'HOPE DAY<br>2026' })];
    montar();

    expect(screen.queryByText(/<br>/)).toBeNull();
    const card = screen.getByRole('heading', { level: 3, name: 'HOPE DAY 2026' });
    expect(card.querySelector('br')).not.toBeNull();
  });
});

/**
 * Sem evento nenhum, a página muda de figura: sem busca a ajustar, um painel
 * que diz o que está acontecendo e convida a conhecer a ANA.
 */
describe('a vitrine vazia', () => {
  it('troca a busca e o "nenhum evento encontrado" pelo painel', () => {
    espiao.eventos = [naLixeira];
    montar();

    expect(screen.getByRole('heading', { name: /a próxima programação está sendo montada/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /conhecer a ana/i })).toHaveAttribute('href', 'https://anabrasil.org');
    expect(screen.queryByPlaceholderText(/buscar por/i)).toBeNull();
    expect(screen.queryByText(/nenhum evento encontrado/i)).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('a equipe ganha "Criar programação"; como visitante e anônimo, não', () => {
    espiao.eventos = [];
    const { unmount } = montar();
    expect(screen.getByRole('button', { name: /criar programação/i })).toBeInTheDocument();
    unmount();

    const comoVisitante = montar('/eventos?como=visitante');
    expect(screen.queryByRole('button', { name: /criar programação/i })).toBeNull();
    comoVisitante.unmount();

    espiao.autenticado = false;
    montar();
    expect(screen.queryByRole('button', { name: /criar programação/i })).toBeNull();
  });

  it('com eventos, a busca sem resultado continua como antes', () => {
    montar();

    fireEvent.change(screen.getByPlaceholderText(/buscar por/i), { target: { value: 'churrasco' } });

    expect(screen.getByText(/nenhum evento encontrado/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /a próxima programação/i })).toBeNull();
  });
});

describe('o convite do Instagram', () => {
  it('aponta para o perfil da ANA', () => {
    espiao.eventos = [];
    montar();

    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute('href', 'https://www.instagram.com/anabrasilorg');
  });
});

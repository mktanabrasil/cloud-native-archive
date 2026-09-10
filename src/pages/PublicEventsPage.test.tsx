import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
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

/**
 * Carrossel e card acessíveis.
 *
 * O carrossel girava sozinho para todo mundo e o card só abria com o mouse.
 */
describe('o card pelo teclado', () => {
  it('Enter e Espaço abrem o detalhe, como o clique', () => {
    montar();
    const card = screen.getByRole('button', { name: /ver detalhes de festa da primavera/i });

    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(screen.getByTestId('detalhe')).toBeInTheDocument();
  });

  it('Enter no lápis edita, e não abre o detalhe junto', () => {
    montar();

    const lapis = screen.getByRole('button', { name: /editar evento/i });
    fireEvent.keyDown(lapis, { key: 'Enter' });

    expect(screen.queryByTestId('detalhe')).toBeNull();
  });
});

describe('o carrossel', () => {
  const noBanner = (id: string, title: string, dia: number) =>
    evento({
      id,
      title,
      show_in_banner: true,
      banner_image_desktop: `https://exemplo/${id}.jpg`,
      start_datetime: new Date(2026, 9, dia, 10).toISOString(),
      end_datetime: new Date(2026, 9, dia, 12).toISOString(),
    });
  const slides = [noBanner('s1', 'Slide Um', 10), noBanner('s2', 'Slide Dois', 11), noBanner('s3', 'Slide Três', 12), noBanner('s4', 'Slide Quatro', 13), noBanner('s5', 'Slide Cinco', 14)];
  const slideAtual = () => screen.getByRole('region', { name: /eventos em destaque/i }).querySelector('[aria-hidden="false"]')!;

  beforeEach(() => {
    espiao.eventos = slides;
    espiao.autenticado = false;
  });

  it('gira sozinho depois do tempo do slide', () => {
    montar();
    expect(slideAtual()).toHaveTextContent('Slide Um');

    act(() => { vi.advanceTimersByTime(5100); });

    expect(slideAtual()).toHaveTextContent('Slide Dois');
  });

  it('para com o mouse em cima e volta a girar quando ele sai', () => {
    montar();
    const regiao = screen.getByRole('region', { name: /eventos em destaque/i });

    fireEvent.mouseEnter(regiao);
    act(() => { vi.advanceTimersByTime(12000); });
    expect(slideAtual()).toHaveTextContent('Slide Um');

    fireEvent.mouseLeave(regiao);
    act(() => { vi.advanceTimersByTime(5100); });
    expect(slideAtual()).toHaveTextContent('Slide Dois');
  });

  it('para com o foco dentro, para quem navega por teclado', () => {
    montar();

    fireEvent.focus(screen.getByRole('button', { name: /próximo slide/i }));
    act(() => { vi.advanceTimersByTime(12000); });

    expect(slideAtual()).toHaveTextContent('Slide Um');
  });

  it('não gira para quem pediu menos movimento; as setas continuam', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduced-motion') })) as typeof window.matchMedia;
    try {
      montar();
      act(() => { vi.advanceTimersByTime(12000); });
      expect(slideAtual()).toHaveTextContent('Slide Um');

      fireEvent.click(screen.getByRole('button', { name: /próximo slide/i }));
      expect(slideAtual()).toHaveTextContent('Slide Dois');
    } finally {
      window.matchMedia = original;
    }
  });

  it('só o slide atual e os vizinhos carregam imagem', () => {
    montar();
    const regiao = screen.getByRole('region', { name: /eventos em destaque/i });
    const fontes = [...regiao.querySelectorAll('img')].map(i => i.getAttribute('src'));

    // atual (s1), próximo (s2) e anterior (s5, porque o carrossel dá a volta)
    expect(fontes.some(f => f?.includes('s1'))).toBe(true);
    expect(fontes.some(f => f?.includes('s2'))).toBe(true);
    expect(fontes.some(f => f?.includes('s5'))).toBe(true);
    expect(fontes.some(f => f?.includes('s3'))).toBe(false);
    expect(fontes.some(f => f?.includes('s4'))).toBe(false);
  });

  it('os slides fora de vista ficam escondidos do leitor de tela', () => {
    montar();
    const regiao = screen.getByRole('region', { name: /eventos em destaque/i });

    expect(regiao.querySelectorAll('[aria-hidden="true"]').length).toBe(4);
    expect(regiao.querySelectorAll('[aria-hidden="false"]').length).toBe(1);
  });
});

describe('evento de vários dias', () => {
  it('o card mostra quando termina', () => {
    espiao.eventos = [
      evento({ id: 'retiro', title: 'Retiro de Líderes', start_datetime: new Date(2026, 9, 10, 8).toISOString(), end_datetime: new Date(2026, 9, 12, 16).toISOString() }),
    ];
    montar();

    expect(screen.getByText('10 a 12 de outubro de 2026')).toBeInTheDocument();
    expect(screen.getByText('Começa às 08:00, termina às 16:00')).toBeInTheDocument();
  });

  it('evento de um dia continua como sempre foi', () => {
    espiao.eventos = [
      evento({ id: 'dia', title: 'Festa', start_datetime: new Date(2026, 9, 10, 8).toISOString(), end_datetime: new Date(2026, 9, 10, 16).toISOString() }),
    ];
    montar();

    expect(screen.getByText('10 de outubro de 2026')).toBeInTheDocument();
    expect(screen.getByText('08:00 às 16:00')).toBeInTheDocument();
  });
});

describe('link de evento que saiu da vitrine', () => {
  it('avisa em vez de abrir a página como se nada tivesse acontecido', () => {
    montar('/eventos?slug=nao-existe');

    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Este evento não está mais disponível');
    expect(aviso).toHaveTextContent('pendente, interno ou na lixeira'); // linha da equipe
    expect(screen.queryByTestId('detalhe')).toBeNull();
  });

  it('o visitante não vê a linha da equipe', () => {
    espiao.autenticado = false;
    montar('/eventos?slug=nao-existe');

    expect(screen.getByRole('status')).not.toHaveTextContent('lixeira');
  });

  it('fechar o aviso tira o slug da URL e o aviso some', () => {
    montar('/eventos?slug=nao-existe');

    fireEvent.click(screen.getByRole('button', { name: /fechar aviso/i }));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('slug válido abre o detalhe, sem aviso', () => {
    montar('/eventos?slug=ativo-1');

    expect(screen.getByTestId('detalhe')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('a imagem do card', () => {
  // Anônimo: sem herói de equipe, a única imagem na tela é a do card.
  beforeEach(() => { espiao.autenticado = false; });

  it('usa o banner 21:9 como última reserva', () => {
    espiao.eventos = [evento({ id: 'so-banner', title: 'Só Banner', banner_image_desktop: 'https://exemplo/banner.jpg' })];
    montar();

    const img = screen.getByRole('img', { name: 'Só Banner' });
    expect(img).toHaveAttribute('src', 'https://exemplo/banner.jpg');
  });

  it('prefere a capa 16:9 quando ela existe', () => {
    espiao.eventos = [evento({ id: 'capa', title: 'Com Capa', banner_url_desktop: 'https://exemplo/capa.jpg', banner_image_desktop: 'https://exemplo/banner.jpg' })];
    montar();

    expect(screen.getByRole('img', { name: 'Com Capa' })).toHaveAttribute('src', 'https://exemplo/capa.jpg');
  });
});

describe('o rodapé', () => {
  it('para o visitante, convida a conhecer a ANA', () => {
    espiao.autenticado = false;
    montar();

    const rodape = screen.getByRole('contentinfo');
    expect(rodape).toHaveTextContent('Construindo oportunidades para transformar vidas e inspirar voos mais altos.');
    expect(rodape).toHaveTextContent(/© \d{4} ANA Brasil/);
    expect(screen.getByRole('link', { name: /anabrasil\.org/i })).toHaveAttribute('href', 'https://anabrasil.org');
    expect(screen.getByRole('link', { name: /@anabrasilorg/i })).toHaveAttribute('href', 'https://www.instagram.com/anabrasilorg');
    expect(screen.getByRole('img', { name: 'ANA Brasil' })).toBeInTheDocument();
  });

  it('a equipe não o vê; com "Ver como visitante" ligado, vê', () => {
    const equipe = montar();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    equipe.unmount();

    montar('/eventos?como=visitante');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

/**
 * O herói usa a mesma régua de "já passou" da grade: pelo término. Hoje, nestes
 * testes, é 8 de setembro de 2026, 15h.
 */
describe('o herói e a régua de "já passou"', () => {
  const emCartaz = (id: string, title: string, ini: Date, fim: Date, extra: Partial<AppEvent> = {}) =>
    evento({ id, title, show_in_banner: true, banner_image_desktop: `https://exemplo/${id}.jpg`, start_datetime: ini.toISOString(), end_datetime: fim.toISOString(), ...extra });
  const retiroEmAndamento = emCartaz('retiro', 'Retiro em Andamento', new Date(2026, 8, 6, 8), new Date(2026, 8, 10, 12));
  const jaPassou = emCartaz('passou', 'Festa que Passou', new Date(2026, 8, 1, 8), new Date(2026, 8, 1, 12));
  const futuro = emCartaz('futuro', 'Hope Day', new Date(2026, 9, 10, 8), new Date(2026, 9, 10, 16));
  const regiao = () => screen.getByRole('region', { name: /eventos em destaque/i });

  it('para o visitante, um evento de vários dias em andamento continua no herói', () => {
    espiao.autenticado = false;
    espiao.eventos = [retiroEmAndamento, jaPassou, futuro];
    montar();

    expect(regiao()).toHaveTextContent('Retiro em Andamento');
    expect(regiao()).toHaveTextContent('Hope Day');
    expect(regiao()).not.toHaveTextContent('Festa que Passou');
  });

  it('para o admin em modo equipe, o passado fica no fim e ganha o selo "Já aconteceu"', () => {
    espiao.eventos = [jaPassou, futuro];
    montar();

    const slides = [...regiao().querySelectorAll('[aria-hidden]')];
    expect(slides[0]).toHaveTextContent('Hope Day');
    expect(slides[1]).toHaveTextContent('Festa que Passou');
    expect(slides[1]).toHaveTextContent('Já aconteceu');
    expect(slides[0]).not.toHaveTextContent('Já aconteceu');
  });

  it('o evento em andamento não recebe o selo, nem no modo equipe', () => {
    espiao.eventos = [retiroEmAndamento];
    montar();

    expect(regiao()).not.toHaveTextContent('Já aconteceu');
  });
});

/**
 * Abrir o detalhe substitui a entrada do histórico em vez de empilhar (e o
 * fechar também): voltar no navegador não reabre detalhes já fechados.
 */
describe('o histórico do navegador', () => {
  /** Uma sonda ao lado da página: que ação de navegação aconteceu, e com que URL. */
  const Sonda = () => {
    const acao = useNavigationType();
    const { search } = useLocation();
    return <span data-testid="sonda" data-acao={acao} data-busca={search} />;
  };

  it('abrir o detalhe substitui a entrada, não empilha', () => {
    render(
      <MemoryRouter initialEntries={['/eventos']}>
        <PublicEventsPage />
        <Sonda />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('heading', { level: 3, name: 'Festa da Primavera' }));

    const sonda = screen.getByTestId('sonda');
    expect(sonda.dataset.busca).toContain('slug=ativo-1');
    expect(sonda.dataset.acao).toBe('REPLACE');
  });
});

/**
 * Embutida no site institucional (?embed=true), a página não repete o rodapé
 * do WordPress nem convida a "conhecer a ANA" dentro do site da ANA.
 */
describe('embutida no site', () => {
  beforeEach(() => { espiao.autenticado = false; });

  it('sem rodapé', () => {
    montar('/eventos?embed=true');
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it('a vitrine vazia fica sem os convites, mas com o texto', () => {
    espiao.eventos = [];
    montar('/eventos?embed=true');

    expect(screen.getByRole('heading', { name: /a próxima programação está sendo montada/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /conhecer a ana/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /instagram/i })).toBeNull();
  });

  it('fora do embed, rodapé e convites continuam', () => {
    espiao.eventos = [];
    montar();

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /conhecer a ana/i })).toBeInTheDocument();
  });
});

/**
 * Miudezas de acessibilidade: um h1 antes de qualquer h2, a busca com nome, e
 * abas que se comportam como abas.
 */
describe('acessibilidade', () => {
  it('tem um único h1, e ele vem antes de qualquer h2', () => {
    montar();

    const titulos = [...document.querySelectorAll('h1, h2')];
    expect(titulos.filter(t => t.tagName === 'H1')).toHaveLength(1);
    expect(titulos[0].tagName).toBe('H1');
    expect(titulos[0]).toHaveTextContent('Programação de Eventos');
  });

  it('a busca tem nome, não só placeholder', () => {
    montar();
    expect(screen.getByRole('searchbox', { name: /buscar eventos/i })).toBeInTheDocument();
  });

  it('as abas apontam para o painel e andam com as setas', () => {
    const passado = evento({ id: 'p', title: 'Passado', start_datetime: new Date(2026, 2, 1, 8).toISOString(), end_datetime: new Date(2026, 2, 1, 10).toISOString() });
    espiao.eventos = [ativo, passado];
    montar();

    const proximos = screen.getByRole('tab', { name: /próximos/i });
    const passados = screen.getByRole('tab', { name: /já aconteceram/i });
    expect(proximos).toHaveAttribute('aria-controls', 'painel-da-aba');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'aba-proximos');
    expect(passados).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(proximos, { key: 'ArrowRight' });

    expect(passados).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'aba-passados');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/** A Central do Voluntário (13/11/2026): entrada pelo WhatsApp, as cinco abas e os avisos (no meio da barra desde 12/11/2026), e o gestor. */

const banco = vi.hoisted(() => ({
  dados: null as null | Record<string, unknown>,
  lidos: [] as string[],
  falha: null as null | 'nao' | 'rede',
  suporte: 'ok' as 'ok' | 'iphone_instalar' | 'sem_suporte',
  ligado: false,
  ligacoes: [] as string[],
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/ThemeToggle', () => ({ TemaFlutuante: () => null }));
vi.mock('@/lib/voluntariado/central', async (original) => {
  const real = await original<typeof import('@/lib/voluntariado/central')>();
  return {
    ...real,
    lerCentral: async (w: string) => {
      banco.lidos.push(w);
      if (banco.falha === 'nao' || w !== '19990001111') throw new real.NaoEncontrado();
      if (banco.falha === 'rede') throw new Error('rede');
      return structuredClone(banco.dados);
    },
    suporteDeAvisos: () => banco.suporte,
    avisosLigadosAqui: async () => banco.ligado,
    ligarAvisos: async (w: string) => { banco.ligacoes.push(w); banco.ligado = true; return 'ligado'; },
    desligarAvisos: async () => { banco.ligado = false; },
  };
});

const { default: Central } = await import('./VoluntariadoCentralPage');

const DADOS = () => ({
  perfil: 'voluntario',
  voluntario: { protocolo: 'VL-7KQ2M', nome: 'Maria Souza Lima', vinculo: 'funcionario', unidade_nome: 'GOE', igreja: null, horario: 'manha', opcao1: 'cozinha', opcao2: 'inflaveis', inscrito_em: '2026-11-05T15:00:00Z' },
  presencas: {},
  cronograma: [
    { id: 'c1', dia: '2026-12-08', inicio: '06:30', fim: '07:00', titulo: 'Chegada e check-in', tipo: 'checkin', local: 'Entrada', detalhe: null, areas: [], horarios: [] },
    { id: 'c2', dia: '2026-12-08', inicio: '07:00', fim: '12:00', titulo: 'Cozinha: café e almoço', tipo: 'atividade', local: 'Cozinha', detalhe: 'Touca e avental na entrada.', areas: ['cozinha'], horarios: ['manha'] },
    { id: 'c3', dia: '2026-12-08', inicio: '12:00', fim: null, titulo: 'Infláveis: troca de turno', tipo: 'transicao', local: null, detalhe: null, areas: ['inflaveis'], horarios: [] },
    { id: 'c4', dia: '2026-11-28', inicio: '09:00', fim: '12:00', titulo: 'Treinamento geral', tipo: 'evento', local: 'Auditório', detalhe: null, areas: [], horarios: [] },
  ],
  avisos: [{ id: 'a2', titulo: 'É amanhã!', texto: 'Natal Feliz no Recanto Maanaim.', enviado_em: '2026-12-07T21:00:00Z' }],
  celulares: 0,
});

function Onde() { const l = useLocation(); return <span data-testid="onde">{l.pathname}{l.search}</span>; }
const montar = (url = '/voluntariado/natalfeliz26/central') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/voluntariado/natalfeliz26/central" element={<><Central /><Onde /></>} />
      <Route path="/voluntariado/natalfeliz26/central/:aba" element={<><Central /><Onde /></>} />
      <Route path="/voluntariado/natalfeliz26" element={<span>formulário</span>} />
    </Routes>
  </MemoryRouter>,
);
const CHAVE = 'ana.central-do-voluntario.whatsapp';

beforeEach(() => {
  banco.dados = DADOS(); banco.lidos = []; banco.falha = null; banco.suporte = 'ok'; banco.ligado = false; banco.ligacoes = [];
  localStorage.clear();
  window.scrollTo = vi.fn() as never;
});
afterEach(() => { vi.useRealTimers(); });

describe('entrada', () => {
  it('sem número: pede o WhatsApp; número errado avisa; o certo guarda e abre o Início', async () => {
    montar();
    expect(screen.getByRole('heading', { name: 'Central do Voluntário' })).toBeInTheDocument();
    const campo = screen.getByLabelText('WhatsApp');
    fireEvent.change(campo, { target: { value: '1999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Digite o WhatsApp com o DDD.');

    fireEvent.change(campo, { target: { value: '19990002222' } });
    expect(campo).toHaveValue('(19) 99000-2222');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não achamos uma inscrição com esse WhatsApp');
    expect(localStorage.getItem(CHAVE)).toBeNull();

    fireEvent.change(campo, { target: { value: '(19) 99000-1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE)).toBe('19990001111');
  });

  it('com o número guardado, abre direto, sem pedir de novo', async () => {
    localStorage.setItem(CHAVE, '19990001111');
    montar();
    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
    expect(screen.queryByLabelText('WhatsApp')).toBeNull();
    expect(banco.lidos).toEqual(['19990001111']);
  });

  it('a inscrição foi apagada: esquece o número e volta para a entrada', async () => {
    localStorage.setItem(CHAVE, '19990001111');
    banco.falha = 'nao';
    montar();
    expect(await screen.findByLabelText('WhatsApp')).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('sem internet na primeira vez: tenta de novo', async () => {
    localStorage.setItem(CHAVE, '19990001111');
    banco.falha = 'rede';
    montar();
    expect(await screen.findByText('Não deu para abrir a Central.')).toBeInTheDocument();
    banco.falha = null;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
  });
});

describe('abas', () => {
  beforeEach(() => { localStorage.setItem(CHAVE, '19990001111'); });

  it('Início: o caminho com o treinamento como próximo, e a doca leva a cada aba', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T15:00:00Z'));
    montar();
    await screen.findByText('Olá, Maria');
    // O topo escuro do mockup: a saudação, o título do Natal Feliz e as pílulas do dia (cores do app, 12/11/2026).
    expect(screen.getByRole('heading', { level: 1, name: 'Natal Feliz 2026' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Ter, 08/12');
    expect(screen.getByRole('banner')).toHaveTextContent('Manhã · 7h às 12h');
    expect(screen.getByTestId('passo-inscricao')).toHaveAttribute('data-estado', 'feito');
    expect(screen.getByTestId('passo-treinamento')).toHaveAttribute('data-estado', 'agora');
    expect(screen.getByTestId('passo-treinamento')).toHaveTextContent('Sáb, 28/11 · Recanto Maanaim · horário a confirmar');
    expect(screen.getByTestId('passo-evento')).toHaveTextContent('Ter, 08/12 · Manhã · 7h às 12h');
    const doca = screen.getByRole('navigation', { name: 'Central do Voluntário' });
    expect(within(doca).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    // Sem o QR da credencial (12/11/2026): no meio da barra, os Avisos.
    expect(within(doca).queryByRole('link', { name: 'Credencial' })).toBeNull();
    fireEvent.click(within(doca).getByRole('link', { name: 'Avisos (novos)' }));
    expect(screen.getByTestId('onde')).toHaveTextContent('/voluntariado/natalfeliz26/central/avisos');
    expect(screen.getByRole('heading', { level: 1, name: 'Avisos' })).toBeInTheDocument();
  });

  it('Cronograma no dia do evento: abre em hoje, linha do "agora", "Minha área" e o selo "Para você"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-08T12:40:00Z')); // 9h40 em Brasília
    montar('/voluntariado/natalfeliz26/central/cronograma');
    const lista = await screen.findByTestId('cronograma');
    const itens = within(lista).getAllByTestId('item-do-cronograma');
    expect(itens.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Chegada e check-in'), expect.stringContaining('Cozinha: café e almoço'), expect.stringContaining('Infláveis: troca de turno'),
    ]);
    expect(itens[1]).toHaveTextContent('Para você');
    expect(itens[1]).toHaveTextContent('Touca e avental na entrada.');
    expect(itens[0]).toHaveTextContent('Check-in');
    // A linha do agora (9h40) fica entre a cozinha (7h) e a troca de turno (12h).
    const filhos = [...lista.querySelectorAll('[data-testid="item-do-cronograma"], [data-testid="linha-do-agora"]')].map((e) => e.getAttribute('data-testid'));
    expect(filhos).toEqual(['item-do-cronograma', 'item-do-cronograma', 'linha-do-agora', 'item-do-cronograma']);
    fireEvent.click(screen.getByRole('button', { name: 'Minha área' }));
    expect(within(screen.getByTestId('cronograma')).getAllByTestId('item-do-cronograma')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Sáb, 28\/11/ }));
    expect(within(screen.getByTestId('cronograma')).getAllByTestId('item-do-cronograma')[0]).toHaveTextContent('Treinamento geral');
    expect(screen.queryByTestId('linha-do-agora')).toBeNull();
  });

  it('no dia do evento, o Início mostra o que está acontecendo para a pessoa', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-08T12:40:00Z'));
    montar();
    const agora = await screen.findByTestId('agora-e-proximo');
    expect(agora).toHaveTextContent('Cozinha: café e almoço');
    expect(agora).toHaveTextContent('até 12h · Cozinha');
  });

  it('Cronograma vazio: está sendo montado', async () => {
    banco.dados = { ...DADOS(), cronograma: [] };
    montar('/voluntariado/natalfeliz26/central/cronograma');
    expect(await screen.findByTestId('cronograma-vazio')).toHaveTextContent('está sendo montado');
  });

  it('a presença registrada aparece no caminho, sem QR na tela', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-28T15:00:00Z'));
    banco.dados = { ...DADOS(), presencas: { treinamento: '2026-11-28T12:12:00Z' } };
    montar();
    expect(await screen.findByTestId('passo-treinamento')).toHaveTextContent('Presença registrada às 9h12');
    expect(screen.getByTestId('passo-treinamento')).toHaveAttribute('data-estado', 'feito');
    expect(screen.queryByTestId('qr-da-credencial')).toBeNull();
  });

  it('a credencial antiga (/central/credencial) volta para o Início', async () => {
    montar('/voluntariado/natalfeliz26/central/credencial');
    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent(/central$/);
  });

  it('Local: o Maps e a planta em breve', async () => {
    montar('/voluntariado/natalfeliz26/central/local');
    expect(await screen.findByRole('link', { name: /Abrir no Google Maps/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(screen.getByTestId('planta-em-breve')).toBeInTheDocument();
  });

  it('Perfil: WhatsApp mascarado, as duas opções; sair esquece o número', async () => {
    montar('/voluntariado/natalfeliz26/central/perfil');
    const dados = await screen.findByTestId('dados-da-inscricao');
    expect(dados).toHaveTextContent('(19) 9••••-1111');
    expect(dados).toHaveTextContent('Funcionário(a) ANA · GOE');
    expect(dados).toHaveTextContent('Cozinha / Servimento');
    expect(dados).toHaveTextContent('Brinquedos infláveis');
    expect(dados).not.toHaveTextContent('19990001111');
    fireEvent.click(screen.getByRole('button', { name: /Sair deste celular/ }));
    expect(await screen.findByLabelText('WhatsApp')).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(screen.getByTestId('onde')).toHaveTextContent(/central$/);
  });

  it('aba que não existe volta para o Início', async () => {
    montar('/voluntariado/natalfeliz26/central/qualquer');
    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent(/central$/);
  });
});

describe('avisos (no meio da barra, 12/11/2026)', () => {
  beforeEach(() => { localStorage.setItem(CHAVE, '19990001111'); });

  it('aviso novo: ponto no botão do meio; abrir a aba mostra a lista, marca o novo e apaga o ponto', async () => {
    montar();
    await screen.findByText('Olá, Maria');
    expect(screen.getByTestId('ponto-de-aviso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Avisos (novos)' }));
    const lista = await screen.findByTestId('lista-de-avisos');
    expect(lista).toHaveTextContent('É amanhã!');
    expect(lista).toHaveTextContent('Natal Feliz no Recanto Maanaim.');
    expect(within(lista).getByText('É amanhã!').closest('li')).toHaveAttribute('data-novo', 'true');
    expect(screen.queryByTestId('ponto-de-aviso')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Início' }));
    await screen.findByText('Olá, Maria');
    expect(screen.queryByTestId('ponto-de-aviso')).toBeNull();
    expect(screen.getByRole('link', { name: 'Avisos' })).toBeInTheDocument();
  });

  it('o toque na notificação (?aviso=) abre a aba Avisos com o aviso em destaque', async () => {
    montar('/voluntariado/natalfeliz26/central?aviso=a2');
    const lista = await screen.findByTestId('lista-de-avisos');
    expect(within(lista).getByText('É amanhã!').closest('li')).toHaveClass('ring-2');
    expect(screen.getByTestId('onde')).toHaveTextContent('/voluntariado/natalfeliz26/central/avisos?aviso=a2');
  });

  it('sem avisos ainda', async () => {
    banco.dados = { ...DADOS(), avisos: [] };
    montar('/voluntariado/natalfeliz26/central/avisos');
    expect(await screen.findByTestId('sem-avisos')).toHaveTextContent('Nenhum aviso ainda');
    expect(screen.queryByTestId('ponto-de-aviso')).toBeNull();
  });

  it('Ativar liga os avisos com o número da pessoa', async () => {
    montar();
    const cartao = await screen.findByTestId('ligar-avisos');
    fireEvent.click(within(cartao).getByRole('button', { name: 'Ativar' }));
    expect(await screen.findByTestId('avisos-ligados')).toBeInTheDocument();
    expect(banco.ligacoes).toEqual(['19990001111']);
  });

  it('no iPhone fora da Tela de Início, o passo a passo', async () => {
    banco.suporte = 'iphone_instalar';
    montar();
    const cartao = await screen.findByTestId('avisos-iphone');
    expect(cartao).toHaveTextContent('Adicionar à Tela de Início');
    expect(cartao).toHaveTextContent('Central ANA');
  });
});

describe('gestor (12/11/2026)', () => {
  const GESTOR = () => ({
    ...DADOS(), perfil: 'gestor',
    voluntario: { protocolo: null, nome: 'Paula Gestora', vinculo: 'gestao', unidade_nome: null, igreja: null, horario: null, opcao1: null, opcao2: null, inscrito_em: '2026-11-12T18:00:00Z' },
  });
  beforeEach(() => { localStorage.setItem(CHAVE, '19990001111'); banco.dados = GESTOR(); });

  it('Início: selo de gestão, as datas no lugar do caminho e o cronograma no atalho', async () => {
    montar();
    expect(await screen.findByText('Olá, Paula')).toBeInTheDocument();
    expect(screen.getAllByText('Gestão')[0]).toBeInTheDocument();
    expect(screen.queryByTestId('caminho')).toBeNull();
    expect(screen.getByTestId('datas')).toHaveTextContent('Treinamento dos voluntários');
    expect(screen.getByRole('banner')).not.toHaveTextContent('Manhã');
    expect(screen.getByRole('link', { name: /Cronograma Todas as áreas/ })).toBeInTheDocument();
  });

  it('Cronograma: tudo, sem "Minha área" e sem o selo "Para você"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-08T12:40:00Z'));
    montar('/voluntariado/natalfeliz26/central/cronograma');
    const lista = await screen.findByTestId('cronograma');
    expect(within(lista).getAllByTestId('item-do-cronograma')).toHaveLength(3);
    expect(lista).not.toHaveTextContent('Para você');
    expect(screen.queryByRole('button', { name: 'Minha área' })).toBeNull();
  });

  it('Perfil: o acesso de gestão, sem dados de inscrição', async () => {
    montar('/voluntariado/natalfeliz26/central/perfil');
    const dados = await screen.findByTestId('dados-da-inscricao');
    expect(dados).toHaveTextContent('Gestão: o cronograma inteiro e todos os avisos');
    expect(dados).not.toHaveTextContent('Inscrição');
    expect(screen.queryByText(/Precisa mudar algo/)).toBeNull();
  });
});

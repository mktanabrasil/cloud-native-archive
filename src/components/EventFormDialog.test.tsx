import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AppEvent } from '@/types';

/**
 * Quem pode mandar um evento para o site.
 *
 * "Onde este evento deve aparecer?" não tinha guarda nenhuma: qualquer pessoa
 * que abrisse o formulário podia marcar público. E o bloco de compartilhamento
 * estava atrás de `isAdmin`, que deixa a comunicação de fora. Os dois passaram
 * a usar `isMarketing` — "admin geral ou comunicação".
 */

const espiao = vi.hoisted(() => ({
  papel: { userName: 'Quem preenche', unit: 'DIC', isAdmin: false, isMarketing: false },
  addEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => espiao.papel }));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    addEvent: espiao.addEvent,
    updateEvent: espiao.updateEvent,
    detectConflicts: () => [],
    setSelectedEvent: vi.fn(),
    events: [] as AppEvent[],
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('./FileUpload', () => ({ FileUpload: () => null }));
vi.mock('./EventDetailDialog', () => ({ EventDetailDialog: () => null }));
vi.mock('./BannerMissingDialog', () => ({ BannerMissingDialog: () => null }));

const { default: EventFormDialog } = await import('./EventFormDialog');

const fechou = vi.fn();

const abrir = () => render(<EventFormDialog open onOpenChange={fechou} />);

const temVisibilidade = () => !!screen.queryByText('Onde este evento deve aparecer?');
const temCompartilhamento = () => !!screen.queryByText(/Configurações de Compartilhamento/i);

beforeEach(() => {
  espiao.papel = { userName: 'Quem preenche', unit: 'DIC', isAdmin: false, isMarketing: false };
  espiao.addEvent.mockClear();
  espiao.addEvent.mockResolvedValue(undefined);
  espiao.updateEvent.mockClear();
  espiao.updateEvent.mockResolvedValue(undefined);
  fechou.mockClear();
});

/** Um evento já gravado, válido, para abrir em modo de edição. */
const eventoGravado = (): AppEvent => ({
  id: 'ev-1',
  title: 'Festa Encerramento mês férias',
  description: '',
  unit: 'DIC',
  event_type: 'evento institucional',
  start_datetime: '2025-07-31T11:00:00.000Z',
  end_datetime: '2025-07-31T15:00:00.000Z',
  location: 'Pátio',
  status: 'confirmado',
  visibility: 'interno',
  has_conflict: false,
  created_by: 'MKT ANA',
  created_at: '2026-05-21T12:00:00.000Z',
  updated_at: '2026-05-21T12:00:00.000Z',
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
  target_audience: 'Os atendidos',
  support_team: 'Funcionários',
  food_logistics: 'Nenhum',
  equipment_needed: 'Nenhum',
});

/** Deixa o formulário válido: título, datas, local e os quatro de logística. */
function preencher() {
  const escrever = (rotulo: RegExp, valor: string) =>
    fireEvent.change(screen.getByPlaceholderText(rotulo), { target: { value: valor } });

  escrever(/nome do evento/i, 'Festa da Primavera');
  const datas = document.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(datas[0], { target: { value: '2026-10-10T14:00' } });
  fireEvent.change(datas[1], { target: { value: '2026-10-10T18:00' } });
  escrever(/local do evento/i, 'Quadra');

  for (const nome of ['Os atendidos', 'Funcionários', 'Lanche', 'Som']) {
    fireEvent.click(screen.getByRole("switch", { name: nome }));
  }
}

describe('publicar no site', () => {
  it('a gestão de unidade não vê nenhum dos dois blocos', () => {
    abrir();

    expect(temVisibilidade()).toBe(false);
    expect(temCompartilhamento()).toBe(false);
  });

  it('a comunicação vê os dois, mesmo sem ser admin', () => {
    // Era este o caso quebrado: `isAdmin` escondia o compartilhamento de quem
    // cuida da comunicação.
    espiao.papel = { ...espiao.papel, isAdmin: false, isMarketing: true };
    abrir();

    expect(temVisibilidade()).toBe(true);
    expect(temCompartilhamento()).toBe(true);
  });

  it('o admin geral vê os dois', () => {
    espiao.papel = { ...espiao.papel, isAdmin: true, isMarketing: true };
    abrir();

    expect(temVisibilidade()).toBe(true);
    expect(temCompartilhamento()).toBe(true);
  });
});

describe('Tipo e Status', () => {
  it.each([
    ['Tipo', 'reunião'],
    ['Status', 'pendente'],
  ])('%s mostra o escolhido com a mesma letra da lista', (_campo, valor) => {
    // A lista tinha `capitalize` e o gatilho não: escolhido, "Evento
    // Institucional" virava "evento institucional". O mesmo no Status.
    abrir();

    const gatilho = screen.getByText(valor).closest('button');

    expect(gatilho?.className).toMatch(/capitalize/);
  });
});

describe('as pendências', () => {
  it('resume no topo e conta no botão quando o formulário está vazio', () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    abrir();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    expect(screen.getByText(/faltam \d+ campos para criar a programação/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar programação \(\d+ pendências\)/i })).toBeInTheDocument();
    expect(espiao.addEvent).not.toHaveBeenCalled();
  });
});

describe('o que acontece quando o banco recusa', () => {
  it('não fecha o formulário, e o preenchimento continua lá', async () => {
    // Antes: `addEvent` era disparado sem await e o diálogo fechava na linha
    // seguinte. Dava erro no banco, ela via um toast e perdia tudo.
    espiao.papel = { ...espiao.papel, isMarketing: true };
    espiao.addEvent.mockRejectedValue(new Error('sem conexão'));
    abrir();
    preencher();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalled());
    expect(fechou).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Festa da Primavera')).toBeInTheDocument();
  });

  it('deixa tentar de novo depois da falha', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    espiao.addEvent.mockRejectedValueOnce(new Error('sem conexão')).mockResolvedValue(undefined);
    abrir();
    preencher();

    const botao = () => screen.getByRole('button', { name: /criar programação|salvando/i });
    fireEvent.click(botao());
    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(botao()).not.toBeDisabled());

    fireEvent.click(botao());

    await waitFor(() => expect(fechou).toHaveBeenCalledWith(false));
    expect(espiao.addEvent).toHaveBeenCalledTimes(2);
  });
});

describe('quando dá certo', () => {
  it('fecha só depois de o banco confirmar', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    let confirmar: () => void = () => {};
    espiao.addEvent.mockImplementation(() => new Promise<void>(r => { confirmar = () => r(); }));
    abrir();
    preencher();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    // gravação em curso: o diálogo segue aberto e o botão travado
    await waitFor(() => expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled());
    expect(fechou).not.toHaveBeenCalled();

    confirmar();

    await waitFor(() => expect(fechou).toHaveBeenCalledWith(false));
  });

  it('dois cliques seguidos criam um evento só', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    espiao.addEvent.mockImplementation(() => new Promise<void>(r => setTimeout(r, 40)));
    abrir();
    preencher();

    const botao = screen.getByRole('button', { name: /criar programação/i });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() => expect(fechou).toHaveBeenCalled());
    expect(espiao.addEvent).toHaveBeenCalledTimes(1);
  });
});

describe('a gestora envia para aprovação', () => {
  // `isMarketing: false` é o padrão do espião: gestora de unidade.

  it('o botão diz o que acontece, e o evento nasce pendente e interno', async () => {
    abrir();
    preencher();

    expect(screen.getByText(/vai para a administração geral/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /enviar para aprovação/i }));

    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalled());
    const enviado = espiao.addEvent.mock.calls[0][0] as AppEvent;
    expect(enviado.status).toBe('pendente');
    expect(enviado.visibility).toBe('interno');
    expect(enviado.submitted_at).toBeTruthy();
    expect(enviado.unit).toBe('DIC');
  });

  it('não consegue mandar como confirmado, mesmo que o estado tente', async () => {
    abrir();
    preencher();
    // não há opção "confirmado" no select dela; se houvesse, o banco negaria
    expect(screen.queryByRole('option', { name: 'confirmado' })).not.toBeInTheDocument();
    expect(screen.getByText(/a administração geral confirma ao aprovar/i)).toBeInTheDocument();
  });

  it('um evento já confirmado abre travado para ela', () => {
    const evento = { ...eventoGravado(), status: 'confirmado' as const };
    render(<EventFormDialog open onOpenChange={fechou} event={evento} />);

    expect(screen.getByText(/já confirmado pela administração geral/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });

  it('mostra a observação quando a administração devolveu', () => {
    const evento = { ...eventoGravado(), status: 'pendente' as const, review_note: 'Falta o horário de término real.', reviewed_by: 'MKT ANA' };
    render(<EventFormDialog open onOpenChange={fechou} event={evento} />);

    expect(screen.getByText(/devolvido pela administração \(MKT ANA\)/i)).toBeInTheDocument();
    expect(screen.getByText(/falta o horário de término real/i)).toBeInTheDocument();
  });

  it('a comunicação continua criando direto', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    abrir();
    preencher();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalled());
    expect((espiao.addEvent.mock.calls[0][0] as AppEvent).submitted_at).toBeNull();
  });
});

describe('o admin revisa um pedido', () => {
  const pedido = (): AppEvent => ({
    ...eventoGravado(),
    status: 'pendente',
    unit: 'Santana',
    created_by: 'Vitória De Faria',
    submitted_at: '2026-03-19T13:00:00.000Z',
    review_note: 'Falta o horário.',
    reviewed_by: 'MKT ANA',
  });
  const abrirRevisao = () => {
    espiao.papel = { ...espiao.papel, userName: 'MKT ANA', isAdmin: true, isMarketing: true };
    render(<EventFormDialog open onOpenChange={fechou} event={pedido()} revisao />);
  };

  it('a tela diz de quem é o pedido e oferece os dois caminhos', () => {
    abrirRevisao();

    expect(screen.getByText('Revisar programação')).toBeInTheDocument();
    expect(screen.getByText(/Pendente · Santana · Vitória De Faria/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar e confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devolver com observação/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar alterações/i })).not.toBeInTheDocument();
  });

  it('aprovar confirma, assina e apaga a observação antiga', async () => {
    abrirRevisao();

    fireEvent.click(screen.getByRole('button', { name: /aprovar e confirmar/i }));

    await waitFor(() => expect(espiao.updateEvent).toHaveBeenCalled());
    const salvo = espiao.updateEvent.mock.calls[0][0] as AppEvent;
    expect(salvo.status).toBe('confirmado');
    expect(salvo.reviewed_by).toBe('MKT ANA');
    expect(salvo.reviewed_at).toBeTruthy();
    expect(salvo.review_note).toBeNull();
    expect(salvo.submitted_at).toBe('2026-03-19T13:00:00.000Z');
    await waitFor(() => expect(fechou).toHaveBeenCalledWith(false));
  });

  it('devolver exige a observação e mantém pendente', async () => {
    abrirRevisao();

    fireEvent.click(screen.getByRole('button', { name: /devolver com observação/i }));
    const confirmar = () => screen.getByRole('button', { name: 'Devolver' });
    expect(confirmar()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/observação da devolução/i), { target: { value: '  Confirme o término real.  ' } });
    expect(confirmar()).not.toBeDisabled();
    fireEvent.click(confirmar());

    await waitFor(() => expect(espiao.updateEvent).toHaveBeenCalled());
    const salvo = espiao.updateEvent.mock.calls[0][0] as AppEvent;
    expect(salvo.status).toBe('pendente');
    expect(salvo.visibility).toBe('interno');
    expect(salvo.review_note).toBe('Confirme o término real.');
    expect(salvo.reviewed_by).toBe('MKT ANA');
  });

  it('sem a prop, o mesmo evento abre como edição comum', () => {
    espiao.papel = { ...espiao.papel, isAdmin: true, isMarketing: true };
    render(<EventFormDialog open onOpenChange={fechou} event={pedido()} />);

    expect(screen.getByText('Editar Evento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
  });
});

describe('quando o slug colide com um evento que ela não vê', () => {
  const colisao = () => Object.assign(new Error('duplicate key value violates unique constraint "events_slug_key"'), { code: '23505' });

  it('avança o sufixo e tenta de novo, sem incomodar', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    espiao.addEvent.mockRejectedValueOnce(colisao()).mockResolvedValue(undefined);
    abrir();
    preencher();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    await waitFor(() => expect(fechou).toHaveBeenCalledWith(false));
    expect(espiao.addEvent).toHaveBeenCalledTimes(2);
    expect(espiao.addEvent.mock.calls[0][0].slug).toBe('festa-da-primavera');
    expect(espiao.addEvent.mock.calls[1][0].slug).toBe('festa-da-primavera-2');
  });

  it('desiste depois de três ajustes e deixa o último sufixo no campo', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    espiao.addEvent.mockRejectedValue(colisao());
    abrir();
    preencher();

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalledTimes(4));
    expect(fechou).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((screen.getByPlaceholderText('meu-evento-especial') as HTMLInputElement).value).toBe('festa-da-primavera-4'),
    );
  });
});

describe('o link mostrado', () => {
  it('é o endereço que abre de verdade, não anabrasil.com', () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    abrir();
    preencher();

    expect(document.body.textContent).not.toMatch(/anabrasil\.com\/eventos/);
    expect(screen.getAllByText(/\/eventos\?slug=/).length).toBeGreaterThan(0);
  });
});

describe('editar sem mexer nas datas', () => {
  it('salva a mesma data que abriu', async () => {
    // Antes: o campo abria em UTC (`toISOString().slice(0,16)`) e salvava em
    // hora local. Em Brasília, cada "Salvar Alterações" adiantava 3 horas.
    // Como a comunicação: o evento de exemplo é confirmado, e a gestora
    // abre um confirmado travado (é outro teste).
    espiao.papel = { ...espiao.papel, isMarketing: true };
    const evento = eventoGravado();
    render(<EventFormDialog open onOpenChange={fechou} event={evento} />);

    fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(espiao.updateEvent).toHaveBeenCalled());
    const salvo = espiao.updateEvent.mock.calls[0][0] as AppEvent;
    expect(salvo.start_datetime).toBe(evento.start_datetime);
    expect(salvo.end_datetime).toBe(evento.end_datetime);
  });

  it('mostra no campo a hora local do evento', () => {
    const evento = eventoGravado();
    render(<EventFormDialog open onOpenChange={fechou} event={evento} />);

    const inicio = new Date(evento.start_datetime);
    const hh = String(inicio.getHours()).padStart(2, '0');
    const campo = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;

    expect(campo.value).toMatch(new RegExp(`T${hh}:00$`));
    expect(screen.getByText(/horários no fuso deste computador/i)).toBeInTheDocument();
  });
});

describe('o slug vazio', () => {
  it('vai como null, e não como texto vazio', async () => {
    // `events_slug_key` é única e já existe uma linha com slug `''`. Uma segunda
    // quebrava com "duplicate key value violates unique constraint" — mensagem
    // que não diz nada a quem só queria salvar um evento. `null` nunca colide.
    espiao.papel = { ...espiao.papel, isMarketing: true };
    abrir();
    preencher();
    // apaga o slug que o título gerou, como faria quem não quer link próprio
    const campoSlug = screen.getByPlaceholderText('meu-evento-especial');
    fireEvent.change(campoSlug, { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalled());
    expect(espiao.addEvent.mock.calls[0][0].slug).toBeNull();
  });

  it('manda o slug escrito, sem espaço em volta', async () => {
    espiao.papel = { ...espiao.papel, isMarketing: true };
    abrir();
    preencher();
    fireEvent.change(screen.getByPlaceholderText('meu-evento-especial'), {
      target: { value: '  festa-da-primavera  ' },
    });

    fireEvent.click(screen.getByRole('button', { name: /criar programação/i }));

    await waitFor(() => expect(espiao.addEvent).toHaveBeenCalled());
    expect(espiao.addEvent.mock.calls[0][0].slug).toBe('festa-da-primavera');
  });
});

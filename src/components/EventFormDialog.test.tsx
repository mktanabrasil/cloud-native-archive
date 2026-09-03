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
}));

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => espiao.papel }));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    addEvent: espiao.addEvent,
    updateEvent: vi.fn(),
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
  fechou.mockClear();
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

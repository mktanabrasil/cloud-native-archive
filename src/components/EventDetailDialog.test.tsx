import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AppEvent } from '@/types';

/**
 * O detalhe público do evento.
 *
 * O herói já mostrava o título com a quebra que a pessoa escreve como `<br>`;
 * o detalhe e a mensagem do WhatsApp mostravam o marcador escrito. E havia um
 * botão "Instagram" que não fazia nada.
 */
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/contexts/TestViewContext', () => ({ useTestView: () => ({ activePersona: null }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { EventDetailDialog } = await import('./EventDetailDialog');

const evento = {
  id: 'e1',
  slug: 'hope-day',
  title: 'HOPE DAY<br>2026',
  description: 'Um dia de esperança.',
  unit: 'Santana',
  event_type: 'evento institucional',
  start_datetime: '2026-10-10T11:00:00.000Z',
  end_datetime: '2026-10-10T19:00:00.000Z',
  location: 'Unidade Santana',
  status: 'confirmado',
  visibility: 'publico',
  has_conflict: false,
  created_by: 'x',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  notes: '',
  marketing_request: false,
  partner_involved: false,
  partners: [],
  has_unit_collaboration: false,
  collaborating_units: [],
  external_collaborators: [],
  attachments: [],
} as unknown as AppEvent;

const montar = () => render(<EventDetailDialog open onOpenChange={() => {}} event={evento} />);

afterEach(() => vi.restoreAllMocks());

describe('o título no detalhe', () => {
  it('quebra a linha em vez de escrever o marcador', () => {
    montar();

    expect(screen.queryByText(/<br>/)).toBeNull();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.querySelector('br')).not.toBeNull();
    expect(h2.textContent).toBe('HOPE DAY2026');
  });

  it('a mensagem do WhatsApp leva o título como texto corrido', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    montar();

    fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

    const url = decodeURIComponent(abrir.mock.calls[0][0] as string);
    // título, data com horário, local e link, um por linha
    // o horário depende do fuso da máquina de teste; a data e a ordem das linhas, não
    expect(url).toContain(['HOPE DAY 2026', '10 de outubro de 2026 · '].join('\n'));
    // o link é a última linha (no jsdom vem com a origem local, não com https://app…)
    expect(url).toMatch(/\nUnidade Santana\n\S*eventos\?slug=hope-day$/);
    expect(url).not.toContain('<br>');
  });
});

describe('compartilhar', () => {
  it('não tem mais o botão Instagram, que não fazia nada', () => {
    montar();

    expect(screen.queryByRole('button', { name: /instagram/i })).toBeNull();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument();
  });
});

describe('evento de vários dias no detalhe', () => {
  it('mostra o período e o começa/termina', () => {
    render(
      <EventDetailDialog
        open
        onOpenChange={() => {}}
        event={{ ...evento, start_datetime: new Date(2026, 9, 10, 8).toISOString(), end_datetime: new Date(2026, 9, 12, 16).toISOString() }}
      />,
    );

    expect(screen.getByText('10 a 12 de outubro')).toBeInTheDocument();
    expect(screen.getByText('Começa às 08:00 · termina às 16:00')).toBeInTheDocument();
  });
});

describe('copiar link', () => {
  it('quando a área de transferência aceita, avisa que copiou e não mostra o campo', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montar();

    fireEvent.click(screen.getByRole('button', { name: /copiar link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('hope-day')));
    expect(screen.queryByRole('textbox', { name: /link do evento para copiar/i })).toBeNull();
  });

  it('quando ela recusa, não diz "copiado": mostra o link num campo para copiar à mão', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { toast } = await import('sonner');
    montar();

    fireEvent.click(screen.getByRole('button', { name: /copiar link/i }));

    const campo = await screen.findByRole('textbox', { name: /link do evento para copiar/i });
    expect((campo as HTMLInputElement).value).toContain('hope-day');
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('sem área de transferência nenhuma (contexto inseguro), idem', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    montar();

    fireEvent.click(screen.getByRole('button', { name: /copiar link/i }));

    expect(await screen.findByRole('textbox', { name: /link do evento para copiar/i })).toBeInTheDocument();
  });
});

describe('evento que já passou', () => {
  it('o detalhe mostra o selo Encerrado ao lado da unidade', () => {
    render(
      <EventDetailDialog
        open
        onOpenChange={() => {}}
        event={{ ...evento, start_datetime: '2025-03-28T14:00:00.000Z', end_datetime: '2025-03-28T17:00:00.000Z' }}
      />,
    );

    expect(screen.getByText('Encerrado')).toBeInTheDocument();
  });

  it('evento futuro não tem o selo', () => {
    montar();
    expect(screen.queryByText('Encerrado')).toBeNull();
  });
});

describe('links na descrição', () => {
  it('um endereço colado na descrição vira link em nova aba', () => {
    render(
      <EventDetailDialog
        open
        onOpenChange={() => {}}
        event={{ ...evento, description: 'Inscrições em https://forms.gle/hope-day até sexta.' }}
      />,
    );

    const link = screen.getByRole('link', { name: 'https://forms.gle/hope-day' });
    expect(link).toHaveAttribute('href', 'https://forms.gle/hope-day');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

/**
 * O diálogo abria sem nome (o DialogTitle era importado e não usado) e com
 * dois X: o próprio, sem rótulo, e o padrão do componente, em inglês.
 */
describe('acessibilidade do diálogo', () => {
  it('o título do evento é o nome do diálogo', () => {
    montar();
    expect(screen.getByRole('dialog', { name: /HOPE DAY/ })).toBeInTheDocument();
  });

  it('há um só botão de fechar, em português', () => {
    montar();
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

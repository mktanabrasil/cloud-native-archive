import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

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
    expect(url).toContain('Confira este evento: HOPE DAY 2026');
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

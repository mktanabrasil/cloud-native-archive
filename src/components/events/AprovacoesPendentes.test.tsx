import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AppEvent } from '@/types';
import { AprovacoesPendentes, pedidosPendentes } from './AprovacoesPendentes';

const base = (extra: Partial<AppEvent>): AppEvent => ({
  id: extra.id || 'x',
  title: 'Evento',
  description: '',
  unit: 'DIC',
  event_type: 'reunião',
  start_datetime: '2026-03-21T11:30:00.000Z',
  end_datetime: '2026-03-21T14:00:00.000Z',
  location: 'Pátio',
  status: 'pendente',
  visibility: 'interno',
  has_conflict: false,
  created_by: 'Vitória De Faria',
  created_at: '2026-03-01T12:00:00.000Z',
  updated_at: '2026-03-01T12:00:00.000Z',
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
  ...extra,
});

describe('pedidosPendentes', () => {
  it('só o que a unidade enviou e ainda está pendente, do mais antigo ao mais novo', () => {
    const lista = pedidosPendentes([
      base({ id: 'novo', title: 'Novo', submitted_at: '2026-03-02T10:00:00Z' }),
      base({ id: 'rascunho-admin', title: 'Rascunho', submitted_at: null }),
      base({ id: 'confirmado', title: 'Já foi', status: 'confirmado', submitted_at: '2026-03-01T10:00:00Z' }),
      base({ id: 'lixeira', title: 'Apagado', submitted_at: '2026-03-01T10:00:00Z', deleted_at: '2026-03-03T10:00:00Z' }),
      base({ id: 'antigo', title: 'Antigo', submitted_at: '2026-03-01T10:00:00Z' }),
    ]);

    expect(lista.map(e => e.id)).toEqual(['antigo', 'novo']);
  });
});

describe('AprovacoesPendentes', () => {
  it('não aparece quando não há pedido', () => {
    const { container } = render(<AprovacoesPendentes eventos={[base({ submitted_at: null })]} onRevisar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('conta, nomeia quem enviou e leva para revisar', () => {
    const onRevisar = vi.fn();
    const pedido = base({ id: 'p1', title: 'Encontro de Famílias', unit: 'Santana', submitted_at: new Date(Date.now() - 2 * 3600e3).toISOString() });
    render(<AprovacoesPendentes eventos={[pedido]} onRevisar={onRevisar} />);

    expect(screen.getByText('1 aguardando aprovação')).toBeInTheDocument();
    expect(screen.getByText(/Santana · .* · enviado por Vitória De Faria há/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(onRevisar).toHaveBeenCalledWith(pedido);
  });
});

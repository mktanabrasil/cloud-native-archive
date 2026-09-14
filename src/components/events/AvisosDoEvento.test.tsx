import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * O aviso por e-mail no painel de detalhe: enviado, falhou (com Reenviar) ou
 * nada, quando o evento nunca gerou aviso.
 */
const espiao = vi.hoisted(() => ({
  avisos: [] as unknown[],
  invocacoes: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: espiao.avisos, error: null }) }) }) }),
    }),
    functions: { invoke: (nome: string, opts: unknown) => { espiao.invocacoes.push([nome, opts]); return Promise.resolve({ data: {}, error: null }); } },
  },
}));

const { AvisosDoEvento } = await import('./AvisosDoEvento');

beforeEach(() => { espiao.avisos = []; espiao.invocacoes = []; });

describe('AvisosDoEvento', () => {
  it('enviado: conta os endereços e lista quem recebeu', async () => {
    espiao.avisos = [{ id: 'a1', event_id: 'e1', tipo: 'confirmado', status: 'enviado', destinatarios: ['mkt@anabrasil.org', 'maria@ana.org'], erro: null, tentativas: 1, criado_em: '2026-09-10T19:12:00Z', enviado_em: '2026-09-10T19:17:00Z' }];
    render(<AvisosDoEvento eventId="e1" />);

    const caixa = await screen.findByTestId('aviso-do-evento');
    expect(caixa).toHaveTextContent('Aviso enviado a 2 endereços');
    expect(caixa).toHaveTextContent('Evento confirmado · mkt@anabrasil.org · maria@ana.org');
  });

  it('falhou: mostra o erro e Reenviar chama a função com o id do aviso', async () => {
    espiao.avisos = [{ id: 'a2', event_id: 'e1', tipo: 'cancelado', status: 'falhou', destinatarios: [], erro: 'SMTP recusou a conexão', tentativas: 1, criado_em: '2026-09-15T12:40:00Z', enviado_em: null }];
    render(<AvisosDoEvento eventId="e1" />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Falhou o envio do aviso');
    expect(alerta).toHaveTextContent('SMTP recusou a conexão');

    fireEvent.click(screen.getByRole('button', { name: /reenviar/i }));
    await waitFor(() => expect(espiao.invocacoes).toEqual([['eventos-aviso', { body: { aviso_id: 'a2' } }]]));
  });

  it('sem aviso nenhum, não ocupa espaço', async () => {
    const { container } = render(<AvisosDoEvento eventId="e1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

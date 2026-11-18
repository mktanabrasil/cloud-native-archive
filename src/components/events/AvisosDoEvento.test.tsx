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

describe('AvisosDoEvento: a equipe do dia (18/11/2026)', () => {
  it('o aviso da equipe não toma o lugar do aviso do evento; aparece numa linha própria', async () => {
    espiao.avisos = [
      { id: 'q1', event_id: 'e1', tipo: 'equipe_rh', status: 'enviado', destinatarios: ['rh@ana.org'], erro: null, tentativas: 1, criado_em: '2026-11-18T19:12:00Z', enviado_em: '2026-11-18T19:13:00Z' },
      { id: 'q2', event_id: 'e1', tipo: 'equipe_voluntariado', status: 'falhou', destinatarios: [], erro: 'SMTP caiu', tentativas: 1, criado_em: '2026-11-18T19:12:00Z', enviado_em: null },
      { id: 'a1', event_id: 'e1', tipo: 'confirmado', status: 'enviado', destinatarios: ['mkt@anabrasil.org'], erro: null, tentativas: 1, criado_em: '2026-11-18T19:11:00Z', enviado_em: '2026-11-18T19:12:00Z' },
    ];
    render(<AvisosDoEvento eventId="e1" />);
    expect(await screen.findByTestId('aviso-do-evento')).toHaveTextContent('Evento confirmado · mkt@anabrasil.org');
    const equipe = screen.getByTestId('avisos-da-equipe');
    expect(equipe).toHaveTextContent('Equipe do dia enviada ao RH');
    expect(equipe).toHaveTextContent('Falhou o e-mail da equipe para o Voluntariado');
    fireEvent.click(screen.getByRole('button', { name: /Reenviar/ }));
    await waitFor(() => expect(espiao.invocacoes).toContainEqual(['eventos-aviso', { body: { aviso_id: 'q2' } }]));
  });

  it('um "a lista não mudou" depois de uma falha não esconde a falha nem o Reenviar', async () => {
    espiao.avisos = [
      { id: 'q9', event_id: 'e1', tipo: 'equipe_rh', status: 'ignorado', destinatarios: [], erro: 'a lista não mudou', tentativas: 1, criado_em: '2026-11-18T20:00:00Z', enviado_em: null },
      { id: 'q8', event_id: 'e1', tipo: 'equipe_rh', status: 'falhou', destinatarios: [], erro: 'SMTP caiu', tentativas: 1, criado_em: '2026-11-18T19:00:00Z', enviado_em: null },
    ];
    render(<AvisosDoEvento eventId="e1" />);
    expect(await screen.findByTestId('avisos-da-equipe')).toHaveTextContent('Falhou o e-mail da equipe para o RH');
  });

  it('o aviso da equipe ignorado (lista vazia no Painel) não aparece', async () => {
    espiao.avisos = [{ id: 'q1', event_id: 'e1', tipo: 'equipe_rh', status: 'ignorado', destinatarios: [], erro: 'a lista do RH no Painel está vazia', tentativas: 1, criado_em: '2026-11-18T19:12:00Z', enviado_em: null }];
    render(<AvisosDoEvento eventId="e1" />);
    await waitFor(() => expect(screen.queryByTestId('avisos-da-equipe')).toBeNull());
    expect(screen.queryByTestId('aviso-do-evento')).toBeNull();
  });
});

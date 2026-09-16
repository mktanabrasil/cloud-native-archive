import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * O card "Agenda do Google" do Painel nos estados da conexão (mockup de
 * 16/09/2026): não conectado (robô valendo), conectado, conexão perdida,
 * e a escolha da agenda com a confirmação de troca.
 */
const espiao = vi.hoisted(() => ({
  estado: {} as Record<string, unknown>,
  agendas: [] as unknown[],
  chamadas: [] as Record<string, unknown>[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }),
    functions: {
      invoke: (_n: string, opts: { body: Record<string, unknown> }) => {
        espiao.chamadas.push(opts.body);
        if (opts.body.estado) return Promise.resolve({ data: espiao.estado, error: null });
        if (opts.body.listar_agendas) return Promise.resolve({ data: { google_email: 'eventos@anabrasil.org', agendas: espiao.agendas }, error: null });
        return Promise.resolve({ data: {}, error: null });
      },
    },
  },
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    events: [
      { status: 'confirmado', deleted_at: undefined, google_event_id: 'g1' },
      { status: 'confirmado', deleted_at: undefined, google_event_id: 'g2' },
      { status: 'pendente', deleted_at: undefined, google_event_id: undefined },
    ],
    refetchEvents: () => Promise.resolve(),
  }),
}));

const { AgendaDoGoogle } = await import('./AgendaDoGoogle');

const base = { so_equipe: true, chave_configurada: true, oauth_configurado: true, agendas: [{ chave: 'equipe', calendar_id: 'r@group.calendar.google.com', nome: 'ANA · Eventos', compartilhada_com: [] }] };
const conexao = { google_email: 'eventos@anabrasil.org', calendar_id: 'ev@group.calendar.google.com', calendar_nome: 'Eventos ANA Brasil', conectado_por: 'mkt@anabrasil.org', conectado_em: '2026-09-16T11:10:00Z', erro: null };

const montar = () => render(<MemoryRouter initialEntries={['/usuarios?tab=agenda']}><AgendaDoGoogle /></MemoryRouter>);

beforeEach(() => { espiao.chamadas = []; espiao.agendas = []; });

describe('AgendaDoGoogle', () => {
  it('não conectado com o robô valendo: diz para onde os eventos vão e oferece Conectar', async () => {
    espiao.estado = { ...base, modo: 'robo', conexao: null };
    montar();
    const bloco = await screen.findByTestId('conexao-google');
    expect(bloco).toHaveTextContent('Google Agenda não conectado');
    expect(bloco).toHaveTextContent('a agenda do robô');
    expect(screen.getByRole('button', { name: /Conectar Google Agenda/ })).toBeEnabled();
    expect(screen.getByTestId('modo-pre-lancamento')).toHaveTextContent('AVISOS_SO_EQUIPE');
  });

  it('conectado: mostra a conta, a agenda, quem conectou, e Trocar/Desconectar', async () => {
    espiao.estado = { ...base, modo: 'conexao', agendas: [], conexao };
    montar();
    const bloco = await screen.findByTestId('conexao-google');
    expect(bloco).toHaveTextContent('Conectado como eventos@anabrasil.org');
    expect(bloco).toHaveTextContent('Gravando em Eventos ANA Brasil');
    expect(bloco).toHaveTextContent('mkt@anabrasil.org');
    expect(screen.getByRole('button', { name: 'Trocar agenda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Desconectar/ })).toBeInTheDocument();
    expect(screen.getByTestId('modo-pre-lancamento')).toHaveTextContent('compartilhamento de "Eventos ANA Brasil"');
  });

  it('conexão perdida: alerta com o motivo e Reconectar', async () => {
    espiao.estado = { ...base, modo: 'conexao', agendas: [], conexao: { ...conexao, erro: 'o Google desconectou a conta: reconecte no Painel' } };
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('O Google desconectou eventos@anabrasil.org');
    expect(alerta).toHaveTextContent('nada se perde');
    expect(screen.getByRole('button', { name: 'Reconectar' })).toBeInTheDocument();
  });

  it('escolher a agenda: lista com a recomendada marcada; confirmar chama escolher_agenda', async () => {
    espiao.estado = { ...base, modo: 'robo', conexao: { ...conexao, calendar_id: null, calendar_nome: null } };
    espiao.agendas = [
      { id: 'p', nome: 'eventos@anabrasil.org', cor: '#7fdfc6', primaria: true, papel: 'owner' },
      { id: 'ev', nome: 'Eventos ANA Brasil', cor: '#039be5', primaria: false, papel: 'owner' },
    ];
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Escolher a agenda/ }));
    const recomendada = await screen.findByRole('radio', { name: /Eventos ANA Brasil/ });
    expect(recomendada).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Usar esta agenda' }));
    expect(await screen.findByText(/Mover os 2 eventos para "Eventos ANA Brasil"\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mover e apagar a antiga' }));

    await waitFor(() => expect(espiao.chamadas.some(c => JSON.stringify(c.escolher_agenda) === JSON.stringify({ calendar_id: 'ev', nome: 'Eventos ANA Brasil' }))).toBe(true));
  });
});

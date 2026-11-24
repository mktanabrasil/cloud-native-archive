import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { EstadoDoLembrete } from '@/lib/lembretes/api';

const api = vi.hoisted(() => ({
  estadoDoLembrete: vi.fn(), ligarLembrete: vi.fn(), salvarTextoDoLembrete: vi.fn(), enviarLembrete: vi.fn(),
}));
const avisos = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/lembretes/api', () => api);
vi.mock('sonner', () => ({ toast: avisos }));

const { LembretesDoWhatsApp } = await import('./LembretesDoWhatsApp');

const ESTADO: EstadoDoLembrete = {
  configurado: true, ligado: false, grupo: 'ANABRASIL PUBLICAÇÕES', proximo: '2026-11-30', enviadoHoje: false,
  mensagem: '⚠️ *LEMBRETE*\n\nEnviem os registros.', modelo: '📅 *Data:*', envios: [
    { criado_em: '2026-11-24T13:00:00Z', destino: 'grupo', origem: 'agendado', situacao: 'enviado', cor: 'azul', com_como_enviar: true, detalhe: null },
    { criado_em: '2026-11-21T13:00:00Z', destino: 'grupo', origem: 'agendado', situacao: 'falhou', cor: 'areia', com_como_enviar: false, detalhe: 'WhatsApp da MKT desconectado' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Terça, 24/11/2026, 9h em Brasília.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
  api.estadoDoLembrete.mockResolvedValue({ ...ESTADO });
  api.ligarLembrete.mockResolvedValue({ ligado: true });
  api.salvarTextoDoLembrete.mockResolvedValue({ ok: true });
  api.enviarLembrete.mockResolvedValue({ ok: true });
});

afterEach(() => { vi.useRealTimers(); });

/** Marketing › Lembretes (24/11/2026). */
describe('Lembretes no WhatsApp', () => {
  it('mostra a prévia com a arte, a mensagem em negrito e o modelo; os dias e os últimos envios', async () => {
    render(<LembretesDoWhatsApp />);
    const previa = await screen.findByTestId('previa-do-lembrete');
    expect(within(previa).getAllByRole('img').length).toBeGreaterThan(0);
    expect(within(previa).getByText('LEMBRETE').tagName).toBe('B');
    expect(within(previa).getByText('Data:')).toBeInTheDocument();
    expect(screen.getByLabelText('Dias e horário')).toHaveTextContent('10:00SegTerQuaQuiSexSábDom');
    const envios = screen.getAllByTestId('envio-do-lembrete');
    expect(envios[0]).toHaveTextContent('Azul + Como enviar');
    expect(envios[1]).toHaveTextContent('WhatsApp da MKT desconectado');
    expect(screen.getByText(/Desligado: nada vai sozinho/)).toBeInTheDocument();
  });

  it('liga o envio automático', async () => {
    render(<LembretesDoWhatsApp />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Envio automático' }));
    await waitFor(() => expect(api.ligarLembrete).toHaveBeenCalledWith(true));
    expect(avisos.success).toHaveBeenCalledWith('Envio automático ligado');
  });

  it('teste vai sem confirmar; o grupo pede confirmação', async () => {
    render(<LembretesDoWhatsApp />);
    fireEvent.click(await screen.findByRole('button', { name: /Mandar teste para mim/ }));
    await waitFor(() => expect(api.enviarLembrete).toHaveBeenCalledWith('teste', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
    fireEvent.click(screen.getByRole('button', { name: /Enviar ao grupo agora/ }));
    expect(api.enviarLembrete).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar ao grupo' }));
    await waitFor(() => expect(api.enviarLembrete).toHaveBeenLastCalledWith('grupo', '2026-11-24'));
  });

  it('ao grupo, nunca no fim de semana nem duas vezes no mesmo dia', async () => {
    api.estadoDoLembrete.mockResolvedValue({ ...ESTADO, enviadoHoje: true });
    const { unmount } = render(<LembretesDoWhatsApp />);
    expect(await screen.findByText('O grupo já recebeu o lembrete de hoje.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar ao grupo agora/ })).toBeDisabled();
    unmount();
    vi.setSystemTime(new Date('2026-11-28T12:00:00Z')); // sábado
    api.estadoDoLembrete.mockResolvedValue({ ...ESTADO });
    render(<LembretesDoWhatsApp />);
    expect(await screen.findByText(/No fim de semana não vai lembrete ao grupo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar ao grupo agora/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Mandar teste para mim/ })).toBeEnabled();
  });

  it('edita a mensagem com a prévia ao lado e salva', async () => {
    render(<LembretesDoWhatsApp />);
    fireEvent.click(await screen.findByRole('button', { name: /Editar a mensagem/ }));
    const editor = screen.getByRole('region', { name: 'Editar a mensagem' });
    const [mensagem] = within(editor).getAllByRole('textbox');
    fireEvent.change(mensagem, { target: { value: '*Novo* texto' } });
    expect(within(screen.getByTestId('previa-do-lembrete')).getByText('Novo').tagName).toBe('B');
    // Com texto por salvar, nada sai (o envio usaria o texto salvo).
    expect(screen.getByRole('button', { name: /Mandar teste para mim/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Enviar ao grupo agora/ })).toBeDisabled();
    fireEvent.click(within(editor).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.salvarTextoDoLembrete).toHaveBeenCalledWith('*Novo* texto', '📅 *Data:*'));
  });

  it('sem a conexão do WhatsApp, avisa e não deixa enviar', async () => {
    api.estadoDoLembrete.mockResolvedValue({ ...ESTADO, configurado: false });
    render(<LembretesDoWhatsApp />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ainda não está configurada');
    expect(screen.getByRole('button', { name: /Enviar ao grupo agora/ })).toBeDisabled();
  });
});

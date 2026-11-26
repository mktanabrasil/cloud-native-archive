import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EstadoDaOuvidoria } from '@/lib/ouvidoria/api';

const api = vi.hoisted(() => ({ estadoDaOuvidoria: vi.fn(), reenviarOuvidoria: vi.fn() }));
const avisos = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/ouvidoria/api', () => api);
vi.mock('sonner', () => ({ toast: avisos }));

const { OuvidoriaNoSite, situacao } = await import('./OuvidoriaNoSite');

const BASE: EstadoDaOuvidoria = {
  endereco: 'https://supabase.anabrasil.org/functions/v1/ouvidoria', para: 'ouvidoria@anabrasil.org', copia: ['adm@anabrasil.org'],
  mes: 12, ultima: { protocolo: 'OUV-2026-0042', criado_em: '2026-11-26T12:14:00Z' }, ultimo_envio: '2026-11-26T12:14:05Z', pendentes: [],
};
const PENDENTE: EstadoDaOuvidoria = {
  ...BASE, pendentes: [{ protocolo: 'OUV-2026-0043', tipo: 'reclamacao', criado_em: '2026-11-26T13:02:00Z', tentativas: 2, ultimo_erro: '535 autenticação recusada', proxima_tentativa: '2026-11-26T13:20:00Z' }],
};

beforeEach(() => { vi.clearAllMocks(); });

/** Administração › Ouvidoria (26/11/2026). */
describe('Ouvidoria no site', () => {
  it('situação: no ar com o último envio; sem mensagens; pendentes', () => {
    expect(situacao(BASE).tom).toBe('ok');
    expect(situacao({ ...BASE, ultimo_envio: null, ultima: null, mes: 0 }).texto).toBe('No ar · nenhuma mensagem ainda');
    expect(situacao(PENDENTE)).toEqual({ tom: 'alerta', texto: '1 e-mail não saiu · tentando de novo' });
    expect(situacao({ ...PENDENTE, pendentes: [...PENDENTE.pendentes, PENDENTE.pendentes[0]] }).texto).toBe('2 e-mails não saíram · tentando de novo');
  });

  it('mostra o endereço da API, para onde vai, as contagens e o anonimato; copia o endereço', async () => {
    api.estadoDaOuvidoria.mockResolvedValue(BASE);
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    render(<OuvidoriaNoSite />);
    expect(await screen.findByText(BASE.endereco)).toBeInTheDocument();
    expect(screen.getByText('ouvidoria@anabrasil.org · cópia para adm@anabrasil.org')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('OUV-2026-0042')).toBeInTheDocument();
    expect(screen.getByText(/guardamos só o tipo, a mensagem e a hora/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No ar · último envio');
    expect(screen.queryByRole('button', { name: /Reenviar agora/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(escrever).toHaveBeenCalledWith(BASE.endereco));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('e-mail que não saiu: mostra o protocolo e o motivo; "Reenviar agora" tenta e atualiza', async () => {
    api.estadoDaOuvidoria.mockResolvedValue(PENDENTE);
    api.reenviarOuvidoria.mockResolvedValue({ ...BASE, enviados: 1 });
    render(<OuvidoriaNoSite />);
    expect(await screen.findByText('OUV-2026-0043')).toBeInTheDocument();
    expect(screen.getByText(/535 autenticação recusada/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 e-mail não saiu');
    fireEvent.click(screen.getByRole('button', { name: /Reenviar agora/ }));
    await waitFor(() => expect(avisos.success).toHaveBeenCalledWith('E-mail enviado para a ouvidoria.'));
    expect(screen.queryByText('OUV-2026-0043')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No ar');
  });

  it('reenviar que ainda falha avisa; erro ao abrir mostra "Tentar de novo"', async () => {
    api.estadoDaOuvidoria.mockResolvedValueOnce(PENDENTE);
    api.reenviarOuvidoria.mockResolvedValue({ ...PENDENTE, enviados: 0 });
    const r = render(<OuvidoriaNoSite />);
    fireEvent.click(await screen.findByRole('button', { name: /Reenviar agora/ }));
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith('1 ainda não saiu. O app segue tentando a cada 5 minutos.'));
    r.unmount();
    api.estadoDaOuvidoria.mockRejectedValueOnce(new Error('Só a administração e o marketing.')).mockResolvedValueOnce(BASE);
    render(<OuvidoriaNoSite />);
    expect(await screen.findByText(/Só a administração e o marketing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText(BASE.endereco)).toBeInTheDocument();
  });

  it('nunca mostra o conteúdo das mensagens (a API nem manda)', async () => {
    api.estadoDaOuvidoria.mockResolvedValue(PENDENTE);
    render(<OuvidoriaNoSite />);
    await screen.findByText('OUV-2026-0043');
    expect(screen.getByText(/As mensagens não aparecem aqui/)).toBeInTheDocument();
  });
});

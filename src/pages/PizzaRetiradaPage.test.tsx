import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const e = vi.hoisted(() => ({
  logado: true,
  papel: { isMarketing: true, bondType: null as string | null, isActive: true, loading: false },
  lista: [] as Array<Record<string, unknown>>,
  registros: [] as string[],
  desfeitos: [] as string[],
  copias: 0,
  resposta: null as unknown,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: e.logado, loading: false, user: null }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => e.papel }));
vi.mock('@/lib/pizza/api', () => ({
  listarConfirmacoes: async () => e.lista,
  pedirCopiaParaODrive: () => { e.copias++; },
}));
vi.mock('@/lib/pizza/retirada', async (original) => ({
  ...(await original<typeof import('@/lib/pizza/retirada')>()),
  registrarRetirada: async (n: string) => { e.registros.push(n); return e.resposta; },
  desfazerRetirada: async (n: string) => { e.desfeitos.push(n); },
}));

const { default: Retirada } = await import('./PizzaRetiradaPage');

const PEDIDO = { numero: 'PZ-7KQ2M', nome: 'Maria Souza', unidade_nome: 'ANA DIC', sabores: { marguerita: 1, calabresa: 2 }, quantidade: 3, retirada_em: '2026-12-17T17:41:00Z', retirada_por: 'mkt@anabrasil.org' };
const C = (o: Record<string, unknown>) => ({ id: String(Math.random()), numero: 'PZ-7KQ2M', nome: 'Maria Souza', unidade_id: 'ana-dic', unidade_nome: 'ANA DIC', area: 'social', sabores: { marguerita: 1, calabresa: 2 }, quantidade: 3, total: 165, forma: 'mercado_pago', comprovante_caminho: null, comprovante_nome: null, retirada: false, retirada_em: null, created_at: '2026-11-10T16:00:00Z', ...o });

beforeEach(() => {
  e.logado = true;
  e.papel = { isMarketing: true, bondType: null, isActive: true, loading: false };
  e.lista = [C({}), C({ numero: 'PZ-4HN9R', nome: 'João Lima', unidade_nome: 'Escritório (ADM)', sabores: { frango: 2 }, quantidade: 2 })];
  e.registros = []; e.desfeitos = []; e.copias = 0;
  e.resposta = { status: 'registrada', pedido: PEDIDO };
});

const abrir = (url = '/pizza-da-alegria/retirada') => render(<MemoryRouter initialEntries={[url]}><Retirada /></MemoryRouter>);
const bipar = (texto: string) => {
  const campo = screen.getByRole('textbox', { name: 'Número do pedido ou nome' });
  fireEvent.change(campo, { target: { value: texto } });
  fireEvent.submit(campo.closest('form')!);
};

describe('retirada com leitor', () => {
  it('o leitor digita o endereço do QR Code: dá baixa e mostra o que entregar', async () => {
    abrir();
    expect(await screen.findByTestId('contador')).toHaveTextContent('0 de 2');
    bipar('https://app.anabrasil.org/pizza-da-alegria/retirada?n=PZ-7KQ2M');
    const r = await screen.findByTestId('resultado');
    expect(e.registros).toEqual(['PZ-7KQ2M']);
    expect(r).toHaveAttribute('data-estado', 'registrada');
    expect(r).toHaveTextContent('Retirada registrada');
    expect(r).toHaveTextContent('Entregar: 1 Marguerita, 2 Calabresa fatiada');
    expect(within(screen.getByTestId('recentes')).getByText('PZ-7KQ2M')).toBeInTheDocument();
    // O campo esvazia para o próximo bipe.
    expect(screen.getByRole('textbox', { name: 'Número do pedido ou nome' })).toHaveValue('');
  });

  it('já retirado: avisa quando e quem, e não entrega de novo', async () => {
    e.resposta = { status: 'ja_retirada', pedido: PEDIDO };
    abrir();
    await screen.findByTestId('contador');
    bipar('PZ-7KQ2M');
    const r = await screen.findByTestId('resultado');
    expect(r).toHaveAttribute('data-estado', 'ja_retirada');
    expect(r).toHaveTextContent('registrado por mkt@anabrasil.org');
    expect(r).toHaveTextContent('Não entregue de novo.');
  });

  it('a mesma pessoa tem mais pedidos: "Registrar todos" dá baixa em tudo e soma o que entregar', async () => {
    e.resposta = { status: 'registrada', pedido: PEDIDO, outros: [{ numero: 'PZ-4HN9R', sabores: { frango: 2 }, quantidade: 2 }] };
    abrir();
    await screen.findByTestId('contador');
    bipar('PZ-7KQ2M');
    const outros = await screen.findByTestId('outros-pedidos');
    expect(outros).toHaveTextContent('Maria tem mais 1 pedido a retirar');
    expect(outros).toHaveTextContent('PZ-4HN9R · 2 Frango');
    e.resposta = { status: 'registrada', pedido: { ...PEDIDO, numero: 'PZ-4HN9R', sabores: { frango: 2 }, quantidade: 2 }, outros: [] };
    fireEvent.click(within(outros).getByRole('button', { name: 'Registrar todos' }));
    await vi.waitFor(() => expect(e.registros).toEqual(['PZ-7KQ2M', 'PZ-4HN9R']));
    const r = await screen.findByTestId('resultado');
    await vi.waitFor(() => expect(r).toHaveTextContent('PZ-7KQ2M + PZ-4HN9R'));
    expect(r).toHaveTextContent('Entregar: 1 Marguerita, 2 Frango, 2 Calabresa fatiada');
    expect(screen.queryByTestId('outros-pedidos')).toBeNull();
    expect(within(screen.getByTestId('recentes')).getByText('PZ-4HN9R')).toBeInTheDocument();
  });

  it('código que não é da Pizza', async () => {
    e.resposta = { status: 'nao_encontrado' };
    abrir();
    await screen.findByTestId('contador');
    bipar('PZ-ZZZZZ');
    expect(await screen.findByText('Pedido não encontrado')).toBeInTheDocument();
  });

  it('sem QR Code: procura pelo nome, sem acento, e registra pelo botão', async () => {
    abrir();
    await screen.findByTestId('contador');
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do pedido ou nome' }), { target: { value: 'joao' } });
    const achados = await screen.findByTestId('achados');
    fireEvent.click(within(achados).getByRole('button', { name: 'Registrar retirada' }));
    await screen.findByTestId('resultado');
    expect(e.registros).toEqual(['PZ-4HN9R']);
  });

  it('desfazer tira a baixa feita no pedido errado', async () => {
    abrir();
    await screen.findByTestId('contador');
    bipar('PZ-7KQ2M');
    fireEvent.click(within(await screen.findByTestId('recentes')).getByRole('button', { name: 'Desfazer' }));
    await vi.waitFor(() => expect(e.desfeitos).toEqual(['PZ-7KQ2M']));
    await vi.waitFor(() => expect(screen.queryByTestId('recentes')).toBeNull());
  });

  it('pela câmera do celular (?n=): mostra o pedido e só dá baixa no toque', async () => {
    abrir('/pizza-da-alegria/retirada?n=PZ-7KQ2M');
    const cartao = await screen.findByTestId('do-link');
    expect(await within(cartao).findByText(/Maria Souza/)).toBeInTheDocument();
    expect(e.registros).toEqual([]);
    fireEvent.click(within(cartao).getByRole('button', { name: 'Confirmar retirada' }));
    await screen.findByTestId('resultado');
    expect(e.registros).toEqual(['PZ-7KQ2M']);
  });

  it('sem login pede para entrar; gestora sem acesso não entra', () => {
    e.logado = false;
    const { unmount } = abrir('/pizza-da-alegria/retirada?n=PZ-7KQ2M');
    expect(screen.getByText(/entre com a sua conta da equipe/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    unmount();
    e.logado = true;
    e.papel = { isMarketing: false, bondType: 'gestao_social', isActive: true, loading: false };
    abrir();
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  });
});

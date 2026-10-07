import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const banco = vi.hoisted(() => ({
  enviados: [] as Array<Record<string, unknown>>,
  lista: [] as Array<Record<string, unknown>>,
  retiradas: [] as Array<[string, boolean]>,
  copias: 0,
  drive: [] as Array<Record<string, unknown>>,
  papel: { isMarketing: true, bondType: null as string | null, isActive: true, loading: false },
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => banco.papel }));
vi.mock('@/lib/pizza/api', () => ({
  enviarConfirmacao: async (d: Record<string, unknown>) => { banco.enviados.push(d); return 'PZ-0137'; },
  listarConfirmacoes: async () => banco.lista,
  marcarRetirada: async (id: string, v: boolean) => { banco.retiradas.push([id, v]); },
  linkDoComprovante: async () => 'https://x',
  pedirCopiaParaODrive: () => { banco.copias++; },
  chamarDrive: async (c: Record<string, unknown>) => { banco.drive.push(c); return c.estado ? { oauth_configurado: true, pode_conectar: banco.papel.isMarketing, conexao: null, pendentes: 2, com_erro: 0 } : { url: 'https://accounts.google.com/x' }; },
}));

const { default: Confirmacao } = await import('./PizzaConfirmacaoPage');
const { PainelDaPizza } = await import('@/components/pizza/PainelDaPizza');

beforeEach(() => {
  banco.enviados = []; banco.lista = []; banco.retiradas = []; banco.copias = 0; banco.drive = [];
  banco.papel = { isMarketing: true, bondType: null, isActive: true, loading: false };
});

const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar confirmação' }));

describe('formulário de confirmação', () => {
  it('nome, unidade, sabores, forma e comprovante até o número', async () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Quem é você/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'maria aparecida souza' } });
    fireEvent.change(screen.getByLabelText('Unidade em que você trabalha'), { target: { value: 'cei-anisio-spinola' } });
    expect(screen.getByTestId('retirada')).toHaveTextContent('Na sua unidade: CEI Bem Querer Prof. Anísio Spínola');

    fireEvent.click(screen.getByRole('button', { name: 'Mais Marguerita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Calabresa fatiada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Calabresa fatiada' }));
    expect(screen.getByTestId('total').textContent?.replace(/\s/g, ' ')).toBe('R$ 150,00');

    fireEvent.click(screen.getByRole('radio', { name: 'Pix' }));
    enviar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Anexe o comprovante');

    fireEvent.change(screen.getByTestId('arquivo'), { target: { files: [new File(['x'], 'comprovante.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByText('comprovante.jpg')).toBeInTheDocument();
    enviar();

    expect(await screen.findByRole('heading', { name: 'Confirmação enviada' })).toBeInTheDocument();
    expect(screen.getByTestId('numero')).toHaveTextContent('PZ-0137');
    expect(banco.copias).toBe(1); // pede a cópia para o Drive logo depois do envio
    expect(banco.enviados[0]).toMatchObject({ nome: 'maria aparecida souza', unidadeId: 'cei-anisio-spinola', forma: 'pix', quantidades: { marguerita: 1, calabresa: 2 } });
  });

  it('no dinheiro o comprovante é opcional', async () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'João Silva' } });
    fireEvent.change(screen.getByLabelText('Unidade em que você trabalha'), { target: { value: 'ana-dic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mais Muçarela' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Dinheiro' }));
    expect(screen.getByRole('heading', { name: /Comprovante \(opcional\)/ })).toBeInTheDocument();
    enviar();
    expect(await screen.findByRole('heading', { name: 'Confirmação enviada' })).toBeInTheDocument();
    expect(banco.enviados[0]).toMatchObject({ forma: 'dinheiro', comprovante: null });
  });

  it('o formulário não fala em pagar: só confirmar', () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    expect(screen.queryByText(/chave pix/i)).toBeNull();
    expect(screen.queryByText(/enviar pagamento/i)).toBeNull();
    expect(screen.getByText('Confirmar pagamento')).toBeInTheDocument();
  });
});

const CONF = (o: Record<string, unknown>) => ({ id: 'c', numero: 'PZ-0001', nome: 'Maria', unidade_id: 'ana-dic', unidade_nome: 'ANA DIC', area: 'social', sabores: { lombo: 1 }, quantidade: 1, total: 50, forma: 'pix', comprovante_caminho: 'envios/a.jpg', comprovante_nome: 'a.jpg', retirada: false, created_at: '2026-10-07T17:00:00Z', ...o });

describe('painel', () => {
  it('mostra o Drive: comunicação conecta; ADM só vê', async () => {
    render(<MemoryRouter><PainelDaPizza /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Conectar Google Drive/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('drive')).getByText(/Ainda não conectado/)).toBeInTheDocument();
  });

  it('soma, filtra por unidade e marca a retirada', async () => {
    banco.lista = [
      CONF({ id: '1', numero: 'PZ-0002', sabores: { calabresa: 2 }, quantidade: 2, total: 100 }),
      CONF({ id: '2', numero: 'PZ-0001', unidade_id: 'cei-anisio-spinola', unidade_nome: 'CEI Anísio', area: 'educacao', forma: 'dinheiro', comprovante_caminho: null }),
    ];
    render(<MemoryRouter><PainelDaPizza /></MemoryRouter>);
    expect(await screen.findAllByTestId('confirmacao')).toHaveLength(2);
    expect(screen.getByTestId('kpi-Pizzas')).toHaveTextContent('3');
    expect(screen.getByText('sem anexo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ANA DIC' }));
    expect(screen.getAllByTestId('confirmacao')).toHaveLength(1);
    expect(screen.getByTestId('kpi-Pizzas')).toHaveTextContent('2');

    fireEvent.click(within(screen.getByTestId('confirmacao')).getByRole('checkbox', { name: 'Retirada PZ-0002' }));
    expect(banco.retiradas).toEqual([['1', true]]);
  });

  it('o ADM (financeiro) entra; a gestora não', async () => {
    banco.papel = { isMarketing: false, bondType: 'financeiro', isActive: true, loading: false };
    const { unmount } = render(<MemoryRouter><PainelDaPizza /></MemoryRouter>);
    expect(await screen.findByText(/Nenhuma confirmação ainda/)).toBeInTheDocument();
    unmount();
    banco.papel = { isMarketing: false, bondType: 'gestao_social', isActive: true, loading: false };
    render(<MemoryRouter><PainelDaPizza /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const banco = vi.hoisted(() => ({
  enviados: [] as Array<Record<string, unknown>>,
  lista: [] as Array<Record<string, unknown>>,
  retiradas: [] as Array<[string, boolean]>,
  copias: 0,
  drive: [] as Array<Record<string, unknown>>,
  online: [] as Array<Record<string, unknown>>,
  deNovo: [] as string[],
  situacao: null as Record<string, unknown> | null,
  comprovantes: [] as Array<Record<string, unknown>>,
  meus: [] as Array<[string, string]>,
  respostaMeus: { pagos: [], pendentes: [] } as { pagos: Array<Record<string, unknown>>; pendentes: Array<Record<string, unknown>> },
  papel: { isMarketing: true, bondType: null as string | null, isActive: true, loading: false },
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => banco.papel }));
vi.mock('@/lib/pizza/comprovante', () => ({ salvarComprovante: async (d: Record<string, unknown>) => { banco.comprovantes.push(d); return 'baixado'; } }));
vi.mock('@/lib/pizza/api', () => ({
  enviarConfirmacao: async (d: Record<string, unknown>) => { banco.enviados.push(d); return 'PZ-0137'; },
  listarConfirmacoes: async () => banco.lista,
  marcarRetirada: async (id: string, v: boolean) => { banco.retiradas.push([id, v]); },
  linkDoComprovante: async () => 'https://x',
  pedirCopiaParaODrive: () => { banco.copias++; },
  pagarOnline: async (d: Record<string, unknown>) => { banco.online.push(d); return { pedido: 'p1', link: 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD1' }; },
  pagarDeNovo: async (p: string) => { banco.deNovo.push(p); return { pedido: p, link: 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD2' }; },
  situacaoDoPedido: async () => banco.situacao,
  meusPedidos: async (n: string, t: string) => { banco.meus.push([n, t]); return banco.respostaMeus; },
  linkDaPlanilha: async () => { banco.drive.push({ planilha: true }); return 'https://docs.google.com/spreadsheets/d/PLAN1/edit'; },
  chamarDrive: async (c: Record<string, unknown>) => { banco.drive.push(c); return c.estado ? { oauth_configurado: true, pode_conectar: banco.papel.isMarketing, conexao: null, pendentes: 2, com_erro: 0 } : { url: 'https://accounts.google.com/x' }; },
}));

const { default: Confirmacao } = await import('./PizzaConfirmacaoPage');
const { PainelDaPizza } = await import('@/components/pizza/PainelDaPizza');

beforeEach(() => {
  banco.enviados = []; banco.lista = []; banco.retiradas = []; banco.copias = 0; banco.drive = []; banco.online = []; banco.deNovo = []; banco.situacao = null; banco.comprovantes = []; banco.meus = []; banco.respostaMeus = { pagos: [], pendentes: [] };
  banco.papel = { isMarketing: true, bondType: null, isActive: true, loading: false };
  // Sem depender do .env.local de quem roda: nestes testes, o pagamento online começa desligado.
  vi.stubEnv('VITE_PIZZA_PAGAR_ONLINE', 'nao');
});

const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar confirmação' }));

describe('formulário de confirmação', () => {
  it('nome, unidade, sabores, forma e comprovante até o número', async () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Quem é você/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'maria aparecida souza' } });
    fireEvent.change(screen.getByLabelText('Unidade em que você trabalha'), { target: { value: 'cei-anisio-spinola' } });
    expect(screen.getByTestId('retirada')).toHaveTextContent('Na Integração dos FuncionáriosQuinta, 17/12/2026 · Apresente o comprovante no dia da retirada.');

    fireEvent.click(screen.getByRole('button', { name: 'Mais Marguerita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Calabresa fatiada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Calabresa fatiada' }));
    expect(screen.getByTestId('total').textContent?.replace(/\s/g, ' ')).toBe('R$ 165,00');

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

describe('pagamento online (Mercado Pago)', () => {
  const PEDIDO = '0b9f3a2e-6f43-4c1e-9d55-2a7f8c1b0d11';
  const assign = vi.fn();
  const original = window.location;
  beforeEach(() => {
    vi.stubEnv('VITE_PIZZA_PAGAR_ONLINE', 'sim');
    assign.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, origin: 'https://app.anabrasil.org', assign } });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('ligado sem nada no .env, como no site publicado', () => {
    vi.stubEnv('VITE_PIZZA_PAGAR_ONLINE', '');
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    expect(screen.getByTestId('como-pagar')).toBeTruthy();
  });

  it('desligado, a página fica como antes', () => {
    vi.stubEnv('VITE_PIZZA_PAGAR_ONLINE', 'nao');
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    expect(screen.queryByTestId('como-pagar')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Mercado Pago' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Pix' })).toBeInTheDocument();
  });

  const pedir = () => {
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'maria souza' } });
    fireEvent.change(screen.getByLabelText(/^WhatsApp com DDD/), { target: { value: '19998765432' } });
    fireEvent.change(screen.getByLabelText('Unidade em que você trabalha'), { target: { value: 'ana-dic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mais Lombo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Marguerita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Marguerita' }));
  };

  it('o botão diz só "Pagar" e o valor; o Mercado Pago fica na linha de baixo', () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    pedir();
    expect(screen.getByRole('button', { name: /^Pagar R\$\s165,00$/ })).toBeInTheDocument();
    expect(screen.getByTestId('processado')).toHaveTextContent('Pagamento seguro, processado pelo Mercado Pago');
    expect(screen.queryByRole('button', { name: /pelo Mercado Pago/ })).toBeNull();
  });

  it('o popup mostra o pedido; "Corrigir o pedido" e o Esc fecham sem pagar', () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    pedir();
    fireEvent.click(screen.getByRole('button', { name: /^Pagar R\$/ }));
    const popup = screen.getByRole('dialog', { name: 'Confira o seu pedido' });
    expect(popup).toHaveTextContent('maria souza');
    expect(popup).toHaveTextContent('ANA DIC');
    expect(popup).toHaveTextContent('Quinta, 17/12/2026, na Integração dos Funcionários');
    expect(within(popup).getByTestId('itens-do-pedido').textContent?.replace(/\s/g, ' ')).toBe('2 × MargueritaR$ 110,001 × LomboR$ 55,00Total · 3 pizzasR$ 165,00');
    fireEvent.click(within(popup).getByRole('button', { name: 'Corrigir o pedido' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Pagar R\$/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(banco.online).toHaveLength(0);
  });

  it('ligado, só se paga pelo Mercado Pago: sem pagar na unidade e sem comprovante', async () => {
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    expect(screen.getByTestId('como-pagar')).toHaveTextContent('Pix ou cartão');
    expect(screen.queryByText(/na unidade\?/i)).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Forma de pagamento' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Comprovante/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'maria souza' } });
    fireEvent.change(screen.getByLabelText('Unidade em que você trabalha'), { target: { value: 'ana-dic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mais Lombo' }));
    // Sem WhatsApp não passa (10/11/2026).
    fireEvent.click(screen.getByRole('button', { name: /^Pagar R\$\s55,00$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva o seu WhatsApp com DDD.');
    const whats = screen.getByLabelText(/^WhatsApp com DDD/);
    fireEvent.change(whats, { target: { value: '19998765432' } });
    expect(whats).toHaveValue('(19) 99876-5432');
    fireEvent.click(screen.getByRole('button', { name: /^Pagar R\$\s55,00$/ }));
    expect(banco.online).toHaveLength(0); // ainda não: primeiro o popup
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Confirmar e pagar R\$\s55,00/ }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD1'));
    expect(banco.online[0]).toMatchObject({ nome: 'maria souza', telefone: '(19) 99876-5432', unidadeId: 'ana-dic', quantidades: { lombo: 1 } });
    expect(banco.enviados).toHaveLength(0);
  });

  it('nome e WhatsApp de quem já pediu abrem "Seus pedidos": QR Code, comprovante e pagar o que ficou', async () => {
    banco.respostaMeus = {
      pagos: [{ numero: 'PZ-7KQ2M', nome: 'Maria Souza', unidade_nome: 'ANA DIC', sabores: { frango: 1 }, quantidade: 1, total: 55, mp_forma: 'bank_transfer', mp_bandeira: 'pix', codigo: 'PAY01X', pago_em: '2026-11-10T17:32:00Z', retirada: false }],
      pendentes: [{ pedido: PEDIDO, sabores: { lombo: 2 }, quantidade: 2, total: 110, status: 'cancelado', criado_em: '2026-11-12T12:00:00Z' }],
    };
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria Souza' } });
    fireEvent.change(screen.getByLabelText(/^WhatsApp com DDD/), { target: { value: '19998765432' } });
    const janela = await screen.findByTestId('seus-pedidos', {}, { timeout: 3000 });
    expect(banco.meus).toEqual([['Maria Souza', '(19) 99876-5432']]);
    expect(within(janela).getByText('Você já tem pedidos, Maria')).toBeInTheDocument();
    expect(within(janela).getByTestId('pedido-pago')).toHaveTextContent('1 Frango · R$ 55,00');
    expect(within(janela).getByTestId('pedido-sem-pagar')).toHaveTextContent('Pagamento não concluído');
    // O comprovante de novo, já com o QR Code
    fireEvent.click(within(janela).getByRole('button', { name: 'Ver QR Code e baixar comprovante' }));
    expect(within(janela).getByTestId('qr-na-tela')).toBeInTheDocument();
    fireEvent.click(within(janela).getByRole('button', { name: /Baixar comprovante/ }));
    await vi.waitFor(() => expect(banco.comprovantes[0]).toMatchObject({ numero: 'PZ-7KQ2M', forma: 'Pix', codigo: 'PAY01X', total: 55 }));
    fireEvent.click(within(janela).getByRole('button', { name: 'Voltar aos meus pedidos' }));
    // Pagar o pedido que ficou sem pagar
    fireEvent.click(within(janela).getByRole('button', { name: 'Pagar este pedido' }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD2'));
    expect(banco.deNovo).toEqual([PEDIDO]);
  });

  it('"Fazer outro pedido" fecha e não abre de novo para a mesma pessoa; sem pedidos, nada aparece', async () => {
    banco.respostaMeus = { pagos: [{ numero: 'PZ-7KQ2M', nome: 'Maria Souza', unidade_nome: 'ANA DIC', sabores: { frango: 1 }, quantidade: 1, total: 55, mp_forma: 'bank_transfer', mp_bandeira: 'pix', codigo: 'PAY01X', pago_em: '2026-11-10T17:32:00Z', retirada: false }], pendentes: [] };
    render(<MemoryRouter><Confirmacao /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria Souza' } });
    fireEvent.change(screen.getByLabelText(/^WhatsApp com DDD/), { target: { value: '19998765432' } });
    fireEvent.click(within(await screen.findByTestId('seus-pedidos', {}, { timeout: 3000 })).getByRole('button', { name: 'Fazer outro pedido' }));
    expect(screen.queryByTestId('seus-pedidos')).toBeNull();
    // O formulário segue preenchido
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Maria Souza');
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria Souza ' } });
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByTestId('seus-pedidos')).toBeNull();
    expect(banco.meus).toHaveLength(1);
  });

  it('a volta aprovada mostra o número, o pagamento e baixa o comprovante', async () => {
    banco.situacao = {
      pedido: PEDIDO, status: 'aprovado', numero: 'PZ-K7M2Q', nome: 'Maria Souza', unidade: 'ANA DIC', unidade_id: 'ana-dic', sabores: { lombo: 2 }, quantidade: 2, total: 110, detalhe: 'accredited',
      pagamento: { codigo: 'PAY01ABC', forma: 'credit_card', bandeira: 'visa', aprovado_em: '2026-11-10T17:32:00Z' },
    };
    render(<MemoryRouter initialEntries={[`/pizza-da-alegria?pedido=${PEDIDO}`]}><Confirmacao /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Pagamento confirmado' })).toBeInTheDocument();
    expect(screen.getByTestId('numero')).toHaveTextContent('PZ-K7M2Q');
    expect(screen.getByTestId('resumo')).toHaveTextContent('Cartão de crédito Visa · 10/11/2026, 14:32');
    expect(screen.queryByText(/Tire um print/)).toBeNull();
    expect(screen.getByTestId('resumo')).toHaveTextContent('Quinta, 17/12/2026, na Integração dos Funcionários');
    expect(screen.getByTestId('aviso-retirada')).toHaveTextContent('Apresente o comprovante no dia da retirada.');
    expect(banco.copias).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Baixar comprovante/ }));
    await vi.waitFor(() => expect(banco.comprovantes).toHaveLength(1));
    expect(banco.comprovantes[0]).toMatchObject({
      numero: 'PZ-K7M2Q', nome: 'Maria Souza', unidade: 'ANA DIC', itens: [{ sabor: 'Lombo', qtd: 2 }], preco: 55, total: 110,
      forma: 'Cartão de crédito Visa', pagoEm: '10/11/2026, 14:32', codigo: 'PAY01ABC', retirada: 'quinta, 17/12/2026',
    });
  });

  it('a volta recusada oferece tentar de novo', async () => {
    banco.situacao = { pedido: PEDIDO, status: 'recusado', numero: null, unidade: 'ANA DIC', unidade_id: 'ana-dic', sabores: { lombo: 1 }, quantidade: 1, total: 55, detalhe: 'rejected_by_issuer' };
    render(<MemoryRouter initialEntries={[`/pizza-da-alegria?pedido=${PEDIDO}`]}><Confirmacao /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Tentar de novo/ }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD2'));
    expect(banco.deNovo).toEqual([PEDIDO]);
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
    // A planilha do Drive acompanha a retirada.
    await vi.waitFor(() => expect(banco.copias).toBe(1));
  });

  it('"Abrir planilha" abre a planilha do Drive numa aba nova (não baixa mais arquivo)', async () => {
    const aba = { location: { href: '' }, close: vi.fn() };
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
    render(<MemoryRouter><PainelDaPizza /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Baixar planilha/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir planilha/ }));
    expect(abrir).toHaveBeenCalledWith('', '_blank');
    await vi.waitFor(() => expect(aba.location.href).toBe('https://docs.google.com/spreadsheets/d/PLAN1/edit'));
    expect(banco.drive).toContainEqual({ planilha: true });
    abrir.mockRestore();
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

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const { conferirPendentes } = await import('./api');
type Situacao = Parameters<typeof conferirPendentes>[1] extends ((p: string) => Promise<infer S>) | undefined ? S : never;

/** Pagou, mas o pedido ficou "sem pagar" no banco (26/11/2026). */
describe('Seus pedidos confere os pedidos sem pagar', () => {
  const pendente = (pedido: string) => ({ pedido, sabores: { frango: 2 }, quantidade: 2, total: 110, status: 'pendente', criado_em: '2026-11-25T12:00:00Z' });
  const situacao = (pedido: string, o: Partial<Situacao>): Situacao => ({
    pedido, status: 'pendente', detalhe: null, numero: null, nome: 'Ana Paula', pagamento: null,
    unidade_id: 'goe', unidade: 'Grupo de Oração Esperança', sabores: { frango: 2 }, quantidade: 2, total: 110, ...o,
  });

  it('o que o Mercado Pago aprovou vai para os pagos, com o número, e sai dos sem pagar', async () => {
    const ler = vi.fn(async (p: string) => (p === 'a'
      ? situacao('a', { status: 'aprovado', numero: 'PZ-7KQ2M', pagamento: { codigo: '123', forma: 'bank_transfer', bandeira: 'pix', aprovado_em: '2026-11-25T12:03:00Z' } })
      : situacao(p, {})));
    const r = await conferirPendentes({ pagos: [], pendentes: [pendente('a'), pendente('b')] }, ler);
    expect(ler).toHaveBeenCalledTimes(2);
    expect(r.pagos).toEqual([expect.objectContaining({ numero: 'PZ-7KQ2M', nome: 'Ana Paula', unidade_nome: 'Grupo de Oração Esperança', total: 110, mp_bandeira: 'pix', codigo: '123', pago_em: '2026-11-25T12:03:00Z', retirada: false })]);
    expect(r.pendentes.map((p) => p.pedido)).toEqual(['b']);
  });

  it('sem resposta da situação, o pedido fica como estava', async () => {
    const r = await conferirPendentes({ pagos: [], pendentes: [pendente('a')] }, async () => { throw new Error('rede'); });
    expect(r.pendentes).toHaveLength(1);
    expect(r.pagos).toHaveLength(0);
  });

  it('sem pedidos sem pagar, não chama a situação', async () => {
    const ler = vi.fn();
    await conferirPendentes({ pagos: [], pendentes: [] }, ler);
    expect(ler).not.toHaveBeenCalled();
  });
});

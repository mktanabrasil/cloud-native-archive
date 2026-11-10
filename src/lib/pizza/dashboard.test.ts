import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const { calcular, filtrar, grupoDoPagamento, pagamentoPorExtenso, ranking } = await import('./dashboard');
import type { PedidoDoDashboard } from './dashboard';

const P = (o: Partial<PedidoDoDashboard>): PedidoDoDashboard => ({
  nome: 'Maria', unidade_id: 'ana-dic', unidade_nome: 'ANA DIC', area: 'social', sabores: { frango: 1 }, quantidade: 1, total: 55,
  forma: 'mercado_pago', mp_forma: 'bank_transfer', mp_bandeira: 'pix', retirada: false, retirada_em: null, created_at: '2026-11-10T16:13:00Z', ...o,
});

describe('dashboard da Pizza', () => {
  it('agrupa o pagamento em Pix, Na unidade e Cartão', () => {
    expect(grupoDoPagamento(P({}))).toBe('pix');
    expect(grupoDoPagamento(P({ mp_forma: 'credit_card', mp_bandeira: 'visa' }))).toBe('cartao');
    expect(grupoDoPagamento(P({ mp_forma: 'debit_card', mp_bandeira: 'debelo' }))).toBe('cartao');
    expect(grupoDoPagamento(P({ forma: 'pix', mp_forma: null, mp_bandeira: null }))).toBe('unidade');
    expect(pagamentoPorExtenso(P({ forma: 'dinheiro', mp_forma: null, mp_bandeira: null }))).toBe('Na unidade · Dinheiro');
    expect(pagamentoPorExtenso(P({ mp_forma: 'credit_card', mp_bandeira: 'visa' }))).toBe('Cartão de crédito Visa');
  });

  it('soma pedidos, pizzas, valor e retiradas; um ponto por dia, com os dias vazios em zero', () => {
    const c = calcular([
      P({ created_at: '2026-11-10T16:00:00Z', quantidade: 2, total: 110, sabores: { calabresa: 2 }, retirada: true }),
      // 23h em Brasília ainda é dia 12, embora já seja 13 em UTC.
      P({ created_at: '2026-11-13T02:00:00Z', unidade_id: 'cei-x', unidade_nome: 'CEI X', area: 'educacao', forma: 'dinheiro', mp_forma: null, mp_bandeira: null }),
    ], '2026-11-14T15:00:00Z');
    expect([c.pedidos, c.pizzas, c.valor, c.retirados]).toEqual([2, 3, 165, 1]);
    expect(c.porDia.map((d) => `${d.rotulo}:${d.pizzas}`)).toEqual(['10/11:2', '11/11:0', '12/11:1', '13/11:0', '14/11:0']);
    expect(c.porUnidade[0]).toMatchObject({ id: 'ana-dic', pizzas: 2, valor: 110 });
    expect(c.porSabor[0]).toMatchObject({ sabor: 'calabresa', pizzas: 2 });
    expect(c.porGrupo).toEqual([{ grupo: 'pix', rotulo: 'Pix', pizzas: 2 }, { grupo: 'unidade', rotulo: 'Na unidade', pizzas: 1 }, { grupo: 'cartao', rotulo: 'Cartão', pizzas: 0 }]);
    expect(c.porArea.map((a) => a.pizzas)).toEqual([2, 1]);
  });

  it('o gráfico por dia para em 30/11, mesmo vendo depois', () => {
    const c = calcular([P({ created_at: '2026-11-29T15:00:00Z' })], '2026-12-17T15:00:00Z');
    expect(c.porDia.map((d) => d.rotulo)).toEqual(['29/11', '30/11']);
  });

  it('filtra por área e unidade; o ranking junta o que passa de 8 em "Outras"', () => {
    const ps = [P({}), P({ unidade_id: 'cei-x', area: 'educacao' })];
    expect(filtrar(ps, { area: 'educacao', unidade: null })).toHaveLength(1);
    expect(filtrar(ps, { area: null, unidade: 'ana-dic' })).toHaveLength(1);
    const u = Array.from({ length: 11 }, (_, i) => ({ id: `u${i}`, nome: `U${i}`, pizzas: 20 - i, valor: (20 - i) * 55 }));
    const r = ranking(u);
    expect(r).toHaveLength(9);
    expect(r[8]).toMatchObject({ id: 'outras', nome: 'Outras 3 unidades', pizzas: 12 + 11 + 10 });
    expect(ranking(u.slice(0, 9))).toHaveLength(9);
  });
});

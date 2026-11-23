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

  it('o gráfico por dia para em 05/12, mesmo vendo depois', () => {
    const c = calcular([P({ created_at: '2026-12-04T15:00:00Z' })], '2026-12-17T15:00:00Z');
    expect(c.porDia.map((d) => d.rotulo)).toEqual(['04/12', '05/12']);
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

/** As pessoas que mais compraram (23/11/2026): a mesma conta do ranking do grupo. */
describe('pessoas que mais compraram', async () => {
  const { porPessoa } = await import('./dashboard');
  const { calcularRanking } = await import('../../../supabase/functions/pizza-ranking/ranking');

  it('junta pelo WhatsApp (o campo pessoa), mesmo com o nome escrito diferente', () => {
    const l = porPessoa([
      P({ pessoa: 1, nome: 'Roberto Alves', quantidade: 2, total: 110 }),
      P({ pessoa: 1, nome: 'Roberto A.', quantidade: 3, total: 165, created_at: '2026-11-11T10:00:00Z' }),
      P({ pessoa: 2, nome: 'Roberto Alves', quantidade: 1, total: 55 }),
    ]);
    expect(l.map((p) => `${p.posicao}. ${p.nome}:${p.pizzas}:${p.valor}:${p.pedidos}`)).toEqual(['1. Roberto Alves:5:275:2', '2. Roberto Alves:1:55:1']);
  });

  it('sem WhatsApp, junta pelo nome sem acento na mesma unidade', () => {
    const l = porPessoa([
      P({ nome: 'João Lima', quantidade: 2, total: 110 }),
      P({ nome: 'joao  lima', quantidade: 1, total: 55 }),
      P({ nome: 'João Lima', unidade_id: 'cei-x', unidade_nome: 'CEI X', quantidade: 1 }),
    ]);
    expect(l.map((p) => `${p.nome}|${p.unidade}:${p.pizzas}:${p.valor}`)).toEqual(['João Lima|ANA DIC:3:165', 'João Lima|CEI X:1:55']);
  });

  it('no empate, fica à frente quem chegou primeiro ao número; posições 1, 2, 3', () => {
    const l = porPessoa([
      P({ nome: 'Bruna', unidade_id: 'b', quantidade: 2, created_at: '2026-11-12T12:00:00Z' }),
      P({ nome: 'Ana', unidade_id: 'a', quantidade: 1, created_at: '2026-11-10T12:00:00Z' }),
      P({ nome: 'Ana', unidade_id: 'a', quantidade: 1, created_at: '2026-11-11T12:00:00Z' }),
    ]);
    expect(l.map((p) => `${p.posicao}. ${p.nome}`)).toEqual(['1. Ana', '2. Bruna']);
  });

  it('a ordem é a mesma do ranking que vai ao grupo', () => {
    const pedidos = Array.from({ length: 30 }, (_, i) => P({
      pessoa: i % 4 === 0 ? null : (i % 7) + 1, nome: ['Ana', 'Bia', 'Caio', 'Duda', 'Eva', 'Fábio', 'Gil'][i % 7], unidade_id: `u${i % 3}`,
      quantidade: (i % 5) + 1, created_at: `2026-11-${String(10 + (i % 12)).padStart(2, '0')}T1${i % 10}:00:00Z`,
    }));
    const doGrupo = calcularRanking(pedidos.map((p) => ({ ...p, telefone: p.pessoa != null ? `p${p.pessoa}` : null }))).pessoas.map((c) => `${c.nome}:${c.pizzas}`);
    expect(porPessoa(pedidos).map((p) => `${p.nome}:${p.pizzas}`)).toEqual(doGrupo);
  });

  it('entra nas contas do dashboard e respeita o filtro', () => {
    const pedidos = [P({ nome: 'Ana', quantidade: 2 }), P({ nome: 'Caio', unidade_id: 'cei-x', unidade_nome: 'CEI X', area: 'educacao', quantidade: 5 })];
    expect(calcular(pedidos, '2026-11-14T15:00:00Z').porPessoa.map((p) => p.nome)).toEqual(['Caio', 'Ana']);
    expect(calcular(filtrar(pedidos, { area: 'social', unidade: null }), '2026-11-14T15:00:00Z').porPessoa.map((p) => p.nome)).toEqual(['Ana']);
  });
});

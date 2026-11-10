import { supabase } from '@/integrations/supabase/client';
import { ROTULO_DA_AREA, SABORES, formaDoMercadoPago, rotuloDaForma, type Area } from './modelo';

/**
 * O dashboard da Pizza da Alegria (10/11/2026, mockup aprovado:
 * https://claude.ai/artifact/41wgaj3mM5yXTcrXmwSMwB). Duas portas para os
 * mesmos gráficos: a equipe do painel, com login, e a gestão, por um link com
 * código secreto (sem o número do pedido). Os dados vêm de
 * dados_do_dashboard_da_pizza; as contas são feitas aqui, na página.
 */

export interface PedidoDoDashboard {
  /** Só para a equipe do painel: o link da gestão não traz o número. */
  numero?: string;
  nome: string;
  unidade_id: string;
  unidade_nome: string;
  area: Area;
  sabores: Record<string, number>;
  quantidade: number;
  total: number;
  forma: string;
  mp_forma: string | null;
  mp_bandeira: string | null;
  retirada: boolean;
  retirada_em: string | null;
  created_at: string;
}

export interface DadosDoDashboard { agora: string; pedidos: PedidoDoDashboard[] }

/** Sem código: a equipe logada. Com código: o link da gestão. */
export async function lerDashboard(codigo?: string): Promise<DadosDoDashboard> {
  const { data, error } = await supabase.rpc('dados_do_dashboard_da_pizza', codigo ? { p_codigo: codigo } : {});
  if (error) throw error;
  const d = data as unknown as DadosDoDashboard;
  return { agora: d.agora, pedidos: (d.pedidos ?? []).map((p) => ({ ...p, total: Number(p.total), quantidade: Number(p.quantidade) })) };
}

export const caminhoDaGestao = (codigo: string) => `/pizza-da-alegria/acompanhar/${codigo}`;
export const linkDaGestao = (codigo: string) => `https://app.anabrasil.org${caminhoDaGestao(codigo)}`;

/** O código do link da gestão (a equipe do painel lê). */
export async function codigoDaGestao(): Promise<string> {
  const { data, error } = await supabase.from('pizza_config').select('codigo_acompanhamento').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('falta rodar a migração do dashboard');
  return data.codigo_acompanhamento;
}

/** Troca o código: o link antigo para de abrir (só a comunicação). */
export async function trocarCodigoDaGestao(): Promise<string> {
  const { data, error } = await supabase.rpc('trocar_codigo_da_pizza');
  if (error) throw error;
  return data as string;
}

// --- Contas ---------------------------------------------------------------------------------

/** Como pagaram, em três grupos. A ordem é a das cores validadas (teal, vermelho, azul). */
export type Grupo = 'pix' | 'unidade' | 'cartao';
export const GRUPOS: Array<[Grupo, string]> = [['pix', 'Pix'], ['unidade', 'Na unidade'], ['cartao', 'Cartão']];

export function grupoDoPagamento(p: Pick<PedidoDoDashboard, 'forma' | 'mp_forma' | 'mp_bandeira'>): Grupo {
  if (p.forma !== 'mercado_pago') return 'unidade';
  return p.mp_forma === 'bank_transfer' || p.mp_bandeira === 'pix' ? 'pix' : 'cartao';
}

/** "Pix", "Cartão de crédito Visa", "Na unidade · Dinheiro". */
export const pagamentoPorExtenso = (p: Pick<PedidoDoDashboard, 'forma' | 'mp_forma' | 'mp_bandeira'>) =>
  p.forma === 'mercado_pago' ? formaDoMercadoPago(p.mp_forma, p.mp_bandeira) : `Na unidade · ${rotuloDaForma(p.forma)}`;

export interface Filtros { area: Area | null; unidade: string | null }

export const filtrar = (pedidos: PedidoDoDashboard[], f: Filtros) =>
  pedidos.filter((p) => (!f.area || p.area === f.area) && (!f.unidade || p.unidade_id === f.unidade));

/** "2026-11-10" no fuso de Brasília. */
export const diaDe = (iso: string | number) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
/** O último dia de pedidos (30/11/2026). */
export const ULTIMO_DIA = '2026-11-30';

export interface Dia { dia: string; rotulo: string; pizzas: number; valor: number }
export interface Contas {
  pedidos: number;
  pizzas: number;
  valor: number;
  retirados: number;
  porDia: Dia[];
  porUnidade: Array<{ id: string; nome: string; pizzas: number; valor: number }>;
  porSabor: Array<{ sabor: string; rotulo: string; pizzas: number }>;
  porGrupo: Array<{ grupo: Grupo; rotulo: string; pizzas: number }>;
  porArea: Array<{ area: Area; rotulo: string; pizzas: number }>;
}

export function calcular(pedidos: PedidoDoDashboard[], agora: string): Contas {
  const pizzas = pedidos.reduce((a, p) => a + p.quantidade, 0);
  const valor = pedidos.reduce((a, p) => a + p.total, 0);

  // Um ponto por dia, do primeiro pedido até hoje (ou até 30/11), com os dias sem pedido em zero.
  const porDia: Dia[] = [];
  if (pedidos.length) {
    const soma = new Map<string, { pizzas: number; valor: number }>();
    pedidos.forEach((p) => { const d = diaDe(p.created_at); const s = soma.get(d) ?? { pizzas: 0, valor: 0 }; s.pizzas += p.quantidade; s.valor += p.total; soma.set(d, s); });
    const primeiro = [...soma.keys()].sort()[0];
    const hoje = diaDe(agora);
    const ultimo = [hoje < ULTIMO_DIA ? hoje : ULTIMO_DIA, ...soma.keys()].sort().pop()!;
    for (let t = Date.parse(`${primeiro}T12:00:00Z`); ; t += 864e5) {
      const d = new Date(t).toISOString().slice(0, 10);
      if (d > ultimo) break;
      const s = soma.get(d) ?? { pizzas: 0, valor: 0 };
      porDia.push({ dia: d, rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`, ...s });
    }
  }

  const unidades = new Map<string, { id: string; nome: string; pizzas: number; valor: number }>();
  pedidos.forEach((p) => { const u = unidades.get(p.unidade_id) ?? { id: p.unidade_id, nome: p.unidade_nome, pizzas: 0, valor: 0 }; u.pizzas += p.quantidade; u.valor += p.total; unidades.set(p.unidade_id, u); });

  return {
    pedidos: pedidos.length,
    pizzas,
    valor,
    retirados: pedidos.filter((p) => p.retirada).length,
    porDia,
    porUnidade: [...unidades.values()].sort((a, b) => b.pizzas - a.pizzas || a.nome.localeCompare(b.nome)),
    porSabor: SABORES.map(([k, r]) => ({ sabor: k as string, rotulo: r as string, pizzas: pedidos.reduce((a, p) => a + Number(p.sabores?.[k] ?? 0), 0) }))
      .sort((a, b) => b.pizzas - a.pizzas),
    porGrupo: GRUPOS.map(([g, r]) => ({ grupo: g, rotulo: r, pizzas: pedidos.filter((p) => grupoDoPagamento(p) === g).reduce((a, p) => a + p.quantidade, 0) })),
    porArea: (['social', 'educacao'] as Area[]).map((a) => ({ area: a, rotulo: ROTULO_DA_AREA[a], pizzas: pedidos.filter((p) => p.area === a).reduce((s, p) => s + p.quantidade, 0) })),
  };
}

/** As unidades do ranking: as 8 primeiras e, se houver mais, "Outras N unidades". */
export function ranking(porUnidade: Contas['porUnidade'], quantas = 8) {
  if (porUnidade.length <= quantas + 1) return porUnidade;
  const resto = porUnidade.slice(quantas);
  return [...porUnidade.slice(0, quantas), {
    id: 'outras', nome: `Outras ${resto.length} unidades`,
    pizzas: resto.reduce((a, u) => a + u.pizzas, 0), valor: resto.reduce((a, u) => a + u.valor, 0),
  }];
}

/**
 * Administração › Financeiro: compras e cotações dos eventos (19/11/2026,
 * PR 1 do Financeiro). Do formulário de eventos saem só as compras da ANA:
 * alimentação com fornecedor "ANA" e transporte de fora (ou veículo de
 * apoio). Equipamentos e impressos ficam de fora (decisão de 19/11: a ANA já
 * tem o material). Aqui só as contas, sem rede: o teste alcança.
 */
export type Situacao = 'a_cotar' | 'cotado' | 'comprado';
export type Tipo = 'alimentacao' | 'transporte';

export interface MarcaDoItem {
  chave: string;
  situacao: Situacao;
  valor: number | null;
  fornecedor: string | null;
  assinatura: string | null;
  atualizado_em: string | null;
  atualizado_por_nome: string | null;
}

export interface EventoDoFinanceiro {
  id: string;
  title: string;
  unit: string;
  location: string | null;
  start_datetime: string;
  end_datetime: string | null;
  status: string;
  food_items: Array<{ item?: string; outro?: boolean; cardapio?: string; alimentos?: Array<{ nome?: string; quantidade?: string; fornecedor?: string; quem?: string }> }>;
  transport_passengers: number | null;
  transport_external_support: boolean;
  transport_extra_equipment: boolean;
  transport_vehicle: string | null;
  transport_support_vehicle: string | null;
  itens: MarcaDoItem[];
}

export interface ItemDoFinanceiro {
  chave: string;
  tipo: Tipo;
  /** "Almoço" / "Transporte de fora". */
  grupo: string;
  /** "Marmitex" / "Ônibus ou van fretados". */
  nome: string;
  quantidade: string;
  detalhe: string | null;
  /** O pedido como está agora (quantidade, passageiros): muda → "o pedido mudou". */
  assinatura: string;
  situacao: Situacao;
  valor: number | null;
  fornecedor: string | null;
  marcadoEm: string | null;
  marcadoPor: string | null;
  /** Marcado como cotado/comprado, mas a unidade mudou o pedido depois. */
  mudou: boolean;
  /** O pedido como estava quando foi marcado (null sem marca). */
  assinaturaMarcada: string | null;
}

const chaveDoTexto = (t: string) =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';

/** Os itens do Financeiro de um evento, já com a situação marcada. */
export function itensDoEvento(e: EventoDoFinanceiro): ItemDoFinanceiro[] {
  const marcas = new Map((e.itens ?? []).map(m => [m.chave, m]));
  const brutos: Omit<ItemDoFinanceiro, 'situacao' | 'valor' | 'fornecedor' | 'marcadoEm' | 'marcadoPor' | 'mudou' | 'assinaturaMarcada'>[] = [];
  const vistas = new Set<string>();

  for (const refeicao of Array.isArray(e.food_items) ? e.food_items : []) {
    const grupo = (refeicao?.item ?? '').trim() || 'Alimentação';
    for (const a of Array.isArray(refeicao?.alimentos) ? refeicao.alimentos : []) {
      if (a?.fornecedor !== 'ANA' || !(a.nome ?? '').trim()) continue;
      let chave = `alimento:${chaveDoTexto(grupo)}:${chaveDoTexto(a.nome!)}`;
      for (let n = 2; vistas.has(chave); n++) chave = `alimento:${chaveDoTexto(grupo)}:${chaveDoTexto(a.nome!)}-${n}`;
      vistas.add(chave);
      const quantidade = (a.quantidade ?? '').trim();
      brutos.push({ chave, tipo: 'alimentacao', grupo, nome: a.nome!.trim(), quantidade, detalhe: (refeicao.cardapio ?? '').trim() || null, assinatura: `${a.nome!.trim()}|${quantidade}` });
    }
  }

  const passageiros = e.transport_passengers ?? 0;
  if (e.transport_external_support) {
    brutos.push({
      chave: 'transporte:apoio-de-fora', tipo: 'transporte', grupo: 'Transporte de fora', nome: 'Ônibus ou van fretados',
      quantidade: passageiros ? `${passageiros} passageiros` : '', detalhe: 'A frota da ANA (VAN + Kombi, 25 lugares) não basta', assinatura: `${passageiros}`,
    });
  }
  if (e.transport_extra_equipment) {
    brutos.push({
      chave: 'transporte:veiculo-de-apoio', tipo: 'transporte', grupo: 'Transporte de fora', nome: 'Veículo de apoio',
      quantidade: '', detalhe: 'Leva equipamentos ou materiais volumosos', assinatura: e.transport_support_vehicle ?? '',
    });
  }

  return brutos.map(b => {
    const m = marcas.get(b.chave);
    const situacao: Situacao = m?.situacao ?? 'a_cotar';
    return {
      ...b, situacao, valor: m?.valor ?? null, fornecedor: m?.fornecedor ?? null,
      marcadoEm: m?.atualizado_em ?? null, marcadoPor: m?.atualizado_por_nome ?? null,
      mudou: !!m && situacao !== 'a_cotar' && (m.assinatura ?? '') !== b.assinatura,
      assinaturaMarcada: m?.assinatura ?? null,
    };
  });
}

/**
 * Marcas (cotado/comprado) que não acham mais o item: a unidade renomeou o
 * alimento ou a refeição, trocou o fornecedor ou tirou o item do pedido. Não
 * somem em silêncio: o card avisa, com o nome que o item tinha.
 */
export function marcasSoltas(e: EventoDoFinanceiro): Array<MarcaDoItem & { nome: string }> {
  const chaves = new Set(itensDoEvento(e).map(i => i.chave));
  return (e.itens ?? [])
    .filter(m => m.situacao !== 'a_cotar' && !chaves.has(m.chave))
    .map(m => ({ ...m, nome: m.chave.startsWith('transporte:') ? (m.chave === 'transporte:apoio-de-fora' ? 'Ônibus ou van fretados' : 'Veículo de apoio') : ((m.assinatura ?? '').split('|')[0] || m.chave) }));
}

/** Os números do topo do mês. Item que "mudou" conta como a cotar. */
export function numerosDoMes(eventos: readonly EventoDoFinanceiro[]) {
  let aCotar = 0, cotados = 0, comprados = 0, total = 0;
  for (const e of eventos) for (const i of itensDoEvento(e)) {
    if (i.situacao === 'a_cotar' || i.mudou) aCotar++;
    else if (i.situacao === 'cotado') cotados++;
    else comprados++;
    if (i.valor != null && !i.mudou) total += Number(i.valor);
  }
  return { eventos: eventos.length, aCotar, cotados, comprados, total };
}

export interface LinhaDoMes extends ItemDoFinanceiro { eventoId: string; evento: string; unidade: string; data: string; pendente: boolean }

/** Tudo do mês, por tipo (alimentação, depois transporte), na ordem das datas. */
export function listaDoMes(eventos: readonly EventoDoFinanceiro[]): LinhaDoMes[] {
  const linhas: LinhaDoMes[] = [];
  for (const e of [...eventos].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))) {
    for (const i of itensDoEvento(e)) linhas.push({ ...i, eventoId: e.id, evento: e.title, unidade: e.unit, data: e.start_datetime, pendente: e.status === 'pendente' });
  }
  const ordem: Record<Tipo, number> = { alimentacao: 0, transporte: 1 };
  return linhas.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.data.localeCompare(b.data));
}

export const ROTULO_DA_SITUACAO: Record<Situacao, string> = { a_cotar: 'A cotar', cotado: 'Cotado', comprado: 'Comprado' };
export const reais = (v: number | null) => (v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

/** "R$ 1.800,00" / "1800" / "1.800" / "1.800,5" → 1800 / 1800 / 1800 / 1800.5; vazio → null; inválido → undefined. */
export function lerValor(texto: string): number | null | undefined {
  const t = texto.replace(/R\$\s?/i, '').trim();
  if (!t) return null;
  // Sem vírgula, "1.800" e "12.000" são milhar (o jeito brasileiro), não decimal.
  const milhar = !t.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(t);
  const n = Number(t.includes(',') || milhar ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

const FUSO = 'America/Sao_Paulo';
const dataCurta = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(new Date(iso));

/** A lista de um evento, para mandar ao fornecedor ou colar numa planilha. */
export function textoDoEvento(e: EventoDoFinanceiro): string {
  const itens = itensDoEvento(e);
  return [`${e.title} · ${dataCurta(e.start_datetime)} · ${e.unit}${e.location ? ` · ${e.location}` : ''}`,
    ...itens.map(i => `- ${i.grupo}: ${i.nome}${i.quantidade ? ` · ${i.quantidade}` : ''} (${ROTULO_DA_SITUACAO[i.situacao]}${i.valor != null ? ` · ${reais(i.valor)}` : ''}${i.fornecedor ? ` · ${i.fornecedor}` : ''})`)].join('\n');
}

/** O mês, uma linha por item, separado por tabulação (cola direto na planilha). */
export function textoDoMes(eventos: readonly EventoDoFinanceiro[]): string {
  const cab = ['Tipo', 'Item', 'Quantidade', 'Evento', 'Unidade', 'Data', 'Situação', 'Valor', 'Fornecedor'].join('\t');
  return [cab, ...listaDoMes(eventos).map(l => [l.grupo, l.nome, l.quantidade, l.evento, l.unidade, dataCurta(l.data), ROTULO_DA_SITUACAO[l.situacao], l.valor != null ? reais(l.valor) : '', l.fornecedor ?? ''].join('\t'))].join('\n');
}

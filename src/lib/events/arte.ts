import type { MarketingItem, TipoDeArte } from '@/types';

/**
 * O pedido de arte ou material impresso ao marketing (22/09/2026, mockup
 * aprovado).
 *
 * Até então ligar "Arte ou material impresso" abria um campo de texto solto
 * ("post para o Instagram, cartaz…") e uma descrição. O marketing recebia
 * "cartaz" e voltava perguntando: quantos, que texto vai, que arte é. Agora
 * o pedido tem duas escolhas claras — **Arte para o WhatsApp** (imagem para
 * os grupos das famílias) e **Cartaz A4** (impresso e plastificado, para a
 * unidade) — mais a **legenda** da mensagem, **o que precisa estar na arte**
 * e, com cartaz, **quantos**.
 *
 * Por baixo continua `marketing_items` (JSON): um item por escolha, com os
 * tipos `arte_whatsapp` e `cartaz_a4`. Legenda e conteúdo valem para o pedido
 * inteiro e viajam em cada item (lidos do primeiro). O tipo antigo
 * `demanda_grafica` segue legível como "Arte (pedido antigo)".
 */

export const TIPOS_DE_ARTE: TipoDeArte[] = ['arte_whatsapp', 'cartaz_a4'];

export const ROTULO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'Arte para o WhatsApp',
  cartaz_a4: 'Cartaz A4',
};

export const DESCRICAO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'imagem para mandar nos grupos das famílias',
  cartaz_a4: 'impresso e plastificado, para a unidade',
};

export const LIMITE_LEGENDA = 1000;
export const LIMITE_CONTEUDO = 1000;

export interface PedidoDeArte {
  whatsapp: boolean;
  cartaz: boolean;
  /** Quantos cartazes, quando `cartaz`. */
  quantidade: number | null;
  legenda: string;
  conteudo: string;
}

export const PEDIDO_VAZIO: PedidoDeArte = { whatsapp: false, cartaz: false, quantidade: null, legenda: '', conteudo: '' };

const ehArte = (i: MarketingItem): boolean => (TIPOS_DE_ARTE as string[]).includes(i.type);

/** Os itens do modelo antigo, para continuarem visíveis. */
export const itensAntigosDeArte = (itens: MarketingItem[] | null | undefined): MarketingItem[] =>
  (itens ?? []).filter(i => i.type === 'demanda_grafica');

/** O evento tem algum pedido de arte, novo ou antigo? */
export const temArte = (itens: MarketingItem[] | null | undefined): boolean =>
  (itens ?? []).some(i => ehArte(i) || i.type === 'demanda_grafica');

/** O pedido, lido dos itens. Sem item de arte, o pedido vazio. */
export function lerPedidoDeArte(itens: MarketingItem[] | null | undefined): PedidoDeArte {
  const deArte = (itens ?? []).filter(ehArte);
  if (deArte.length === 0) return PEDIDO_VAZIO;
  const cartaz = deArte.find(i => i.type === 'cartaz_a4');
  const primeiro = deArte[0];
  return {
    whatsapp: deArte.some(i => i.type === 'arte_whatsapp'),
    cartaz: !!cartaz,
    quantidade: cartaz?.quantidade ?? null,
    legenda: primeiro.legenda ?? '',
    conteudo: primeiro.conteudo ?? '',
  };
}

/**
 * Os itens com o pedido gravado: um por escolha, com legenda e conteúdo em
 * cada um. Os demais itens (cobertura, pedidos antigos) ficam como estão.
 * Pedido sem escolha nenhuma não deixa item.
 */
export function comPedidoDeArte(itens: MarketingItem[] | null | undefined, pedido: PedidoDeArte): MarketingItem[] {
  const outros = (itens ?? []).filter(i => !ehArte(i));
  const comum = { legenda: pedido.legenda, conteudo: pedido.conteudo, description: '' };
  const novos: MarketingItem[] = [];
  if (pedido.whatsapp) novos.push({ type: 'arte_whatsapp', item: ROTULO_DA_ARTE.arte_whatsapp, ...comum });
  if (pedido.cartaz) novos.push({ type: 'cartaz_a4', item: ROTULO_DA_ARTE.cartaz_a4, ...comum, quantidade: pedido.quantidade ?? undefined });
  return [...outros, ...novos];
}

/** Pronto para gravar: aparado e no limite; sem escolha, sem item. */
export function limparPedidoDeArte(itens: MarketingItem[] | null | undefined): MarketingItem[] {
  const pedido = lerPedidoDeArte(itens);
  if (!pedido.whatsapp && !pedido.cartaz) return (itens ?? []).filter(i => !ehArte(i));
  return comPedidoDeArte(itens, {
    ...pedido,
    // A legenda é do WhatsApp: sem ele, ela ficava escondida no formulário
    // mas gravada no cartaz, e o detalhe mostrava "Copiar legenda".
    legenda: pedido.whatsapp ? pedido.legenda.trim().slice(0, LIMITE_LEGENDA) : '',
    conteudo: pedido.conteudo.trim().slice(0, LIMITE_CONTEUDO),
    quantidade: pedido.cartaz && pedido.quantidade && pedido.quantidade > 0 ? Math.floor(pedido.quantidade) : null,
  });
}

/**
 * O que falta no pedido, para a validação. `aberto` é o interruptor "Arte ou
 * material impresso" ligado: com ele ligado e nada marcado, o pedido não diz
 * nada ao marketing.
 */
export function errosDoPedidoDeArte(pedido: PedidoDeArte, aberto: boolean): string | undefined {
  if (!aberto) return undefined;
  if (!pedido.whatsapp && !pedido.cartaz) return 'Marque o que precisa: arte para o WhatsApp, cartaz A4 — ou desligue esta opção';
  if (!pedido.conteudo.trim()) return 'Diga o que precisa estar na arte: título, data, endereço, logos…';
  if (pedido.whatsapp && !pedido.legenda.trim()) return 'Escreva a legenda que vai junto da arte no WhatsApp';
  if (pedido.cartaz && (!pedido.quantidade || pedido.quantidade < 1)) return 'Diga quantos cartazes';
  return undefined;
}

/** "Arte para o WhatsApp" · "Cartaz A4 · 6" — as pílulas do detalhe. */
export function pilulasDoPedido(pedido: PedidoDeArte): string[] {
  const p: string[] = [];
  if (pedido.whatsapp) p.push(ROTULO_DA_ARTE.arte_whatsapp);
  if (pedido.cartaz) p.push(pedido.quantidade ? `${ROTULO_DA_ARTE.cartaz_a4} · ${pedido.quantidade}` : ROTULO_DA_ARTE.cartaz_a4);
  return p;
}

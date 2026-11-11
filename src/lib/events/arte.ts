import type { MarketingItem, TipoDeArte } from '@/types';

/**
 * O pedido de arte ao marketing.
 *
 * 22/09/2026 (mockup aprovado): o interruptor "Arte ou material impresso"
 * passou a ter duas escolhas claras — **Arte para o WhatsApp** e **Cartaz A4**
 * — mais a **legenda** da mensagem, **o que precisa estar na arte** e, com
 * cartaz, **quantos**.
 *
 * 11/11/2026 (pedido dele): o interruptor virou **"Rede social"**, e a escolha
 * é do formato — **WhatsApp** e/ou **Story do Instagram**. O cartaz A4 saiu do
 * pedido novo; os pedidos antigos de cartaz continuam legíveis (e editáveis
 * só para desmarcar), para o marketing não perder o que já foi pedido.
 *
 * Por baixo continua `marketing_items` (JSON): um item por escolha, com os
 * tipos `arte_whatsapp`, `story_instagram` e (antigo) `cartaz_a4`. Legenda e
 * conteúdo valem para o pedido inteiro e viajam em cada item (lidos do
 * primeiro). O tipo mais antigo `demanda_grafica` segue legível como
 * "Arte (pedido antigo)".
 */

/** As escolhas do pedido novo, na ordem dos cartões. */
export const TIPOS_DE_ARTE: TipoDeArte[] = ['arte_whatsapp', 'story_instagram'];
/** Todos os tipos que contam como pedido de arte, inclusive o antigo. */
const TODOS_OS_TIPOS: TipoDeArte[] = ['arte_whatsapp', 'story_instagram', 'cartaz_a4'];

/** Como o marketing lê (detalhe, resumo, checklist). */
export const ROTULO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'Arte para o WhatsApp',
  story_instagram: 'Story do Instagram',
  cartaz_a4: 'Cartaz A4',
};

/** Como a unidade escolhe no formulário: o formato. */
export const FORMATO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'WhatsApp',
  story_instagram: 'Story do Instagram',
  cartaz_a4: 'Cartaz A4',
};

export const DESCRICAO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'imagem para os grupos das famílias',
  story_instagram: 'vertical, para o story',
  cartaz_a4: 'pedido antigo · impresso e plastificado',
};

export const LIMITE_LEGENDA = 1000;
export const LIMITE_CONTEUDO = 1000;

export interface PedidoDeArte {
  whatsapp: boolean;
  story: boolean;
  /** Só pedido antigo: não há mais como marcar. */
  cartaz: boolean;
  /** Quantos cartazes, quando `cartaz`. */
  quantidade: number | null;
  legenda: string;
  conteudo: string;
}

export const PEDIDO_VAZIO: PedidoDeArte = { whatsapp: false, story: false, cartaz: false, quantidade: null, legenda: '', conteudo: '' };

const ehArte = (i: MarketingItem): boolean => (TODOS_OS_TIPOS as string[]).includes(i.type);
const algumaEscolha = (p: PedidoDeArte) => p.whatsapp || p.story || p.cartaz;

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
    story: deArte.some(i => i.type === 'story_instagram'),
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
  if (pedido.story) novos.push({ type: 'story_instagram', item: ROTULO_DA_ARTE.story_instagram, ...comum });
  if (pedido.cartaz) novos.push({ type: 'cartaz_a4', item: ROTULO_DA_ARTE.cartaz_a4, ...comum, quantidade: pedido.quantidade ?? undefined });
  return [...outros, ...novos];
}

/** Pronto para gravar: aparado e no limite; sem escolha, sem item. */
export function limparPedidoDeArte(itens: MarketingItem[] | null | undefined): MarketingItem[] {
  const pedido = lerPedidoDeArte(itens);
  if (!algumaEscolha(pedido)) return (itens ?? []).filter(i => !ehArte(i));
  return comPedidoDeArte(itens, {
    ...pedido,
    // A legenda é do WhatsApp: sem ele, ela ficava escondida no formulário
    // mas gravada nos outros itens, e o detalhe mostrava "Copiar legenda".
    legenda: pedido.whatsapp ? pedido.legenda.trim().slice(0, LIMITE_LEGENDA) : '',
    conteudo: pedido.conteudo.trim().slice(0, LIMITE_CONTEUDO),
    quantidade: pedido.cartaz && pedido.quantidade && pedido.quantidade > 0 ? Math.floor(pedido.quantidade) : null,
  });
}

/**
 * O que falta no pedido, para a validação. `aberto` é o interruptor "Rede
 * social" ligado: com ele ligado e nada marcado, o pedido não diz nada ao
 * marketing.
 */
export function errosDoPedidoDeArte(pedido: PedidoDeArte, aberto: boolean): string | undefined {
  if (!aberto) return undefined;
  if (!algumaEscolha(pedido)) return 'Marque o formato: WhatsApp, story do Instagram — ou desligue esta opção';
  if (!pedido.conteudo.trim()) return 'Diga o que precisa estar na arte: título, data, endereço, logos…';
  if (pedido.whatsapp && !pedido.legenda.trim()) return 'Escreva a legenda que vai junto da arte no WhatsApp';
  if (pedido.cartaz && (!pedido.quantidade || pedido.quantidade < 1)) return 'Diga quantos cartazes';
  return undefined;
}

/** "Arte para o WhatsApp" · "Story do Instagram" · "Cartaz A4 · 6" — as pílulas do detalhe. */
export function pilulasDoPedido(pedido: PedidoDeArte): string[] {
  const p: string[] = [];
  if (pedido.whatsapp) p.push(ROTULO_DA_ARTE.arte_whatsapp);
  if (pedido.story) p.push(ROTULO_DA_ARTE.story_instagram);
  if (pedido.cartaz) p.push(pedido.quantidade ? `${ROTULO_DA_ARTE.cartaz_a4} · ${pedido.quantidade}` : ROTULO_DA_ARTE.cartaz_a4);
  return p;
}

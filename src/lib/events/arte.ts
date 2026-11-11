import type { MarketingItem, TipoDeArte } from '@/types';

/**
 * O pedido de arte ao marketing.
 *
 * 22/09/2026 (mockup aprovado): o interruptor "Arte ou material impresso"
 * passou a ter duas escolhas claras — **Arte para o WhatsApp** e **Cartaz A4**
 * — mais a **legenda** da mensagem, **o que precisa estar na arte** e, com
 * cartaz, **quantos**.
 *
 * 11/11/2026 (pedido dele): o interruptor virou "Rede social", com WhatsApp
 * e/ou Story do Instagram, e o cartaz saiu. No mesmo dia ele achou "Rede
 * social" vago (mockup aprovado): o interruptor é **"Arte / impressa"**, com
 * dois grupos que dá para marcar juntos — **arte para rede social** (WhatsApp,
 * Story do Instagram) e **impressa** (**A4 plastificado**, com quantas cópias).
 *
 * Por baixo continua `marketing_items` (JSON): um item por escolha, com os
 * tipos `arte_whatsapp`, `story_instagram` e `cartaz_a4` (o A4 plastificado;
 * os pedidos antigos de "Cartaz A4" são o mesmo tipo e aparecem assim). Legenda e
 * conteúdo valem para o pedido inteiro e viajam em cada item (lidos do
 * primeiro). O tipo mais antigo `demanda_grafica` segue legível como
 * "Arte (pedido antigo)".
 */

/** Arte para rede social, na ordem dos cartões. */
export const TIPOS_DE_REDE_SOCIAL: TipoDeArte[] = ['arte_whatsapp', 'story_instagram'];
/** Impressa. */
export const TIPOS_IMPRESSOS: TipoDeArte[] = ['cartaz_a4'];
/** Todos os tipos do pedido, na ordem dos cartões. */
export const TIPOS_DE_ARTE: TipoDeArte[] = [...TIPOS_DE_REDE_SOCIAL, ...TIPOS_IMPRESSOS];
const TODOS_OS_TIPOS = TIPOS_DE_ARTE;

/** Como o marketing lê (detalhe, resumo, checklist). */
export const ROTULO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'Arte para o WhatsApp',
  story_instagram: 'Story do Instagram',
  cartaz_a4: 'A4 plastificado',
};

/** Como a unidade escolhe no formulário: o formato. */
export const FORMATO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'WhatsApp',
  story_instagram: 'Story do Instagram',
  cartaz_a4: 'A4 plastificado',
};

export const DESCRICAO_DA_ARTE: Record<TipoDeArte, string> = {
  arte_whatsapp: 'imagem para os grupos das famílias',
  story_instagram: 'vertical, para o story',
  cartaz_a4: 'impresso e plastificado, para a unidade',
};

export const LIMITE_LEGENDA = 1000;
export const LIMITE_CONTEUDO = 1000;

export interface PedidoDeArte {
  whatsapp: boolean;
  story: boolean;
  /** A4 plastificado (tipo `cartaz_a4`). */
  cartaz: boolean;
  /** Quantas cópias do A4, quando `cartaz`. */
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
 * O que falta no pedido, para a validação. `aberto` é o interruptor "Arte /
 * impressa" ligado: com ele ligado e nada marcado, o pedido não diz nada ao
 * marketing.
 */
export function errosDoPedidoDeArte(pedido: PedidoDeArte, aberto: boolean): string | undefined {
  if (!aberto) return undefined;
  if (!algumaEscolha(pedido)) return 'Marque o que precisa: WhatsApp, story do Instagram, A4 plastificado — ou desligue esta opção';
  if (!pedido.conteudo.trim()) return 'Diga o que precisa estar na arte: título, data, endereço, logos…';
  if (pedido.whatsapp && !pedido.legenda.trim()) return 'Escreva a legenda que vai junto da arte no WhatsApp';
  if (pedido.cartaz && (!pedido.quantidade || pedido.quantidade < 1)) return 'Diga quantas cópias do A4 plastificado';
  return undefined;
}

/** "Arte para o WhatsApp" · "Story do Instagram" · "A4 plastificado · 6" — as pílulas do detalhe. */
export function pilulasDoPedido(pedido: PedidoDeArte): string[] {
  const p: string[] = [];
  if (pedido.whatsapp) p.push(ROTULO_DA_ARTE.arte_whatsapp);
  if (pedido.story) p.push(ROTULO_DA_ARTE.story_instagram);
  if (pedido.cartaz) p.push(pedido.quantidade ? `${ROTULO_DA_ARTE.cartaz_a4} · ${pedido.quantidade}` : ROTULO_DA_ARTE.cartaz_a4);
  return p;
}

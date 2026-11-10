import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Pizza da Alegria (09/11/2026): pagamento online pelo Mercado Pago,
 * Checkout Pro com a API de Orders (a de Preferences está sendo descontinuada).
 * Aplicação no painel do Mercado Pago: "ANA Brasil Campanhas".
 *
 * Fluxo:
 *  1. A página pública chama { acao: 'criar', ... }. O banco reserva o pedido
 *     (`pizza_reservar_online`, que calcula o preço), e aqui se cria a order
 *     no Mercado Pago (POST /v1/orders). A página manda a pessoa para o
 *     `checkout_url`.
 *  2. A pessoa paga (Pix ou cartão) e volta para /pizza-da-alegria?pedido=<id>.
 *  3. O Mercado Pago avisa esta função (?webhook=1, evento "Order"). Ela lê a
 *     order na API (nunca confia no corpo do aviso) e, se processada, chama
 *     `pizza_aprovar_online`, que cria a confirmação PZ-XXXXX.
 *  4. A página de volta chama { acao: 'situacao', pedido } até ficar aprovado.
 *     Se o aviso atrasar, a situação também lê a order no Mercado Pago.
 *
 * Segredos (Coolify, no serviço do Supabase, como os SMTP_* dos avisos):
 *  - MP_ACCESS_TOKEN: Access Token da aplicação (o de teste até liberar).
 *  - MP_WEBHOOK_SECRET: assinatura secreta dos webhooks (painel do Mercado Pago).
 *  - SITE_URL (opcional): https://app.anabrasil.org.
 *
 * O aviso é configurado no painel (Webhooks → evento "Order (Mercado Pago)"),
 * para https://supabase.anabrasil.org/functions/v1/pizza-pagamento?webhook=1.
 * O Mercado Pago não manda o login do Supabase: o servidor próprio não exige
 * JWT nas funções (conferido em 09/11/2026), e o config.toml marca
 * verify_jwt = false para o caso de a função ir para o Supabase em nuvem.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MP = 'https://api.mercadopago.com';
const ROTA = '/pizza-da-alegria';
/** O Mercado Pago só aceita letras, números, "-" e "_" no external_reference (dois-pontos dá 400). */
const PREFIXO = 'pizza_';
/** Fim das confirmações: 30/11/2026, 23:59:59 em Brasília. */
const PRAZO = '2026-11-30T23:59:59.000-03:00';
/** Quanto tempo a order (e o QR do Pix) vale. Depois, "Tentar de novo" cria outra. */
const VALIDADE = 'PT2H';
const SABORES: Record<string, string> = { marguerita: 'Marguerita', frango: 'Frango', calabresa: 'Calabresa fatiada', mucarela: 'Muçarela', lombo: 'Lombo', napolitana: 'Napolitana' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
type Admin = any;
// deno-lint-ignore no-explicit-any
type Order = any;

class ErroDoPedido extends Error { constructor(public status: number, msg: string) { super(msg); } }
class ErroDoMercadoPago extends Error { constructor(public status: number, msg: string) { super(msg); } }

function token(): string {
  const t = Deno.env.get('MP_ACCESS_TOKEN');
  if (!t) throw new ErroDoPedido(503, 'pagamento_online_indisponivel');
  return t;
}

async function mp(metodo: string, caminho: string, corpo?: unknown, idempotencia?: string) {
  const r = await fetch(`${MP}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencia ? { 'X-Idempotency-Key': idempotencia } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroDoMercadoPago(r.status, `Mercado Pago ${r.status}: ${j?.message || JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/** Para onde a pessoa volta: o site, ou o localhost de quem está testando. */
function origemDeVolta(pedida: unknown): string {
  const site = (Deno.env.get('SITE_URL') || 'https://app.anabrasil.org').replace(/\/$/, '');
  if (typeof pedida !== 'string') return site;
  try {
    const u = new URL(pedida);
    if (u.origin === site) return site;
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return u.origin;
  } catch { /* cai no site */ }
  return site;
}

const resumo = (s: Record<string, number>) =>
  Object.entries(s).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${SABORES[k] ?? k}`).join(' · ');

const dinheiro = (n: number) => n.toFixed(2);

// --- Order (Checkout Pro) ---------------------------------------------------------------

async function criarOrder(admin: Admin, pedido: { id: string; quantidade: number; total: number; sabores: Record<string, number> }, origem: string) {
  const volta = `${origem}${ROTA}?pedido=${pedido.id}`;
  const total = dinheiro(Number(pedido.total));
  const order = await mp('POST', '/v1/orders', {
    type: 'online',
    processing_mode: 'manual',
    // O webhook é um só por aplicação: o prefixo diz de que campanha é a order.
    external_reference: `${PREFIXO}${pedido.id}`,
    total_amount: total,
    description: 'Pizza da Alegria · ANA Brasil',
    expiration_time: VALIDADE,
    items: [{
      external_code: 'pizza-da-alegria',
      title: `Pizza da Alegria · ${pedido.quantidade} ${pedido.quantidade === 1 ? 'pizza' : 'pizzas'}`,
      description: resumo(pedido.sabores).slice(0, 250),
      category_id: 'food',
      // Uma linha com o total: o preço vem do banco e a soma fecha sem arredondar.
      quantity: 1,
      unit_price: total,
    }],
    config: {
      online: {
        success_url: volta, pending_url: volta, failure_url: volta,
        // O Mercado Pago só volta sozinho para endereços https.
        ...(volta.startsWith('https://') ? { auto_return: 'approved' } : {}),
      },
      // Boleto demora dias e a campanha fecha em 30/11: fica Pix, cartão e saldo.
      // Sem max_installments: com 1, a revisão do cartão no checkout de teste não
      // montava as parcelas e o botão Pagar ficava desativado (10/11/2026).
      payment_method: { not_allowed_types: ['ticket'] },
      statement_descriptor: 'ANA BRASIL',
    },
  }, crypto.randomUUID());

  await admin.from('pizza_pedidos_online').update({ mp_order_id: order.id, status: 'pendente', mp_status: order.status }).eq('id', pedido.id);
  return order.checkout_url as string;
}

// --- Order → pedido ----------------------------------------------------------------------

const STATUS: Record<string, string> = { failed: 'recusado', canceled: 'cancelado', refunded: 'estornado' };

/** Aplica uma order lida da API do Mercado Pago ao pedido. Devolve o número, se aprovado. */
async function aplicarOrder(admin: Admin, o: Order): Promise<string | null> {
  const referencia = String(o?.external_reference ?? '');
  const pedidoId = referencia.startsWith(PREFIXO) ? referencia.slice(PREFIXO.length) : '';
  if (!UUID.test(pedidoId)) return null; // order de outra campanha ou de outra coisa na mesma conta
  const pagamento = o.transactions?.payments?.[0];
  const pagamentoId = String(pagamento?.id ?? o.id);
  if (o.status === 'processed' && o.status_detail === 'accredited') {
    const pago = Number(o.total_paid_amount ?? o.total_amount);
    const { data, error } = await admin.rpc('pizza_aprovar_online', { p_pedido: pedidoId, p_pagamento_id: pagamentoId, p_valor: pago });
    if (error) throw new Error(`aprovar ${pedidoId}: ${error.message}`);
    return String(data);
  }
  const { data: atual } = await admin.from('pizza_pedidos_online').select('status').eq('id', pedidoId).maybeSingle();
  if (!atual) return null;
  const novo = STATUS[o.status];
  // Aprovado só muda para estornado; o resto não desfaz uma aprovação.
  const status = atual.status === 'aprovado' ? (novo === 'estornado' ? 'estornado' : 'aprovado') : (novo ?? 'pendente');
  await admin.from('pizza_pedidos_online').update({
    status, mp_pagamento_id: pagamentoId, mp_status: o.status, mp_status_detalhe: o.status_detail ?? null,
  }).eq('id', pedidoId);
  if (status === 'estornado') console.warn(`[pizza-pagamento] pedido ${pedidoId} estornado no Mercado Pago`);
  return null;
}

/** Confere a assinatura do aviso (x-signature). Sem segredo configurado, não confere. */
async function assinaturaOk(req: Request, dataId: string): Promise<boolean> {
  const segredo = Deno.env.get('MP_WEBHOOK_SECRET');
  const cabecalho = req.headers.get('x-signature');
  if (!segredo || !cabecalho) return true; // a order é relida na API de qualquer jeito
  const partes = Object.fromEntries(cabecalho.split(',').map((x) => x.trim().split('=') as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const requestId = req.headers.get('x-request-id');
  const manifesto = `id:${id};${requestId ? `request-id:${requestId};` : ''}ts:${partes.ts};`;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifesto)));
  const hex = Array.from(assinatura, (b) => b.toString(16).padStart(2, '0')).join('');
  return hex === partes.v1;
}

async function webhook(req: Request, admin: Admin, url: URL): Promise<Response> {
  // deno-lint-ignore no-explicit-any
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* aviso só com a query */ }
  const tipo = url.searchParams.get('type') ?? corpo?.type;
  const dataId = String(url.searchParams.get('data.id') ?? corpo?.data?.id ?? '');
  if (tipo !== 'order' || !/^[A-Z0-9]+$/i.test(dataId)) return json({ ok: true, ignorado: true });
  if (!(await assinaturaOk(req, dataId))) {
    console.warn('[pizza-pagamento] assinatura inválida no aviso', dataId);
    return json({ error: 'assinatura' }, 401);
  }
  try {
    await aplicarOrder(admin, await mp('GET', `/v1/orders/${dataId}`));
    return json({ ok: true });
  } catch (e) {
    // Order que não existe (o "Simular notificação" do painel manda um id inventado): nada a fazer.
    if (e instanceof ErroDoMercadoPago && e.status === 404) return json({ ok: true, ignorado: true });
    console.error('[pizza-pagamento] aviso', dataId, e);
    return json({ error: 'falhou' }, 500); // o Mercado Pago tenta de novo
  }
}

// --- Ações da página ----------------------------------------------------------------------

async function criar(admin: Admin, c: Record<string, unknown>) {
  const { data, error } = await admin.rpc('pizza_reservar_online', {
    p_nome: c.nome, p_unidade_id: c.unidadeId, p_unidade_nome: c.unidadeNome, p_area: c.area, p_sabores: c.sabores,
  });
  if (error) throw new ErroDoPedido(400, error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  const { data: pedido } = await admin.from('pizza_pedidos_online').select('id, quantidade, total, sabores').eq('id', linha.id).single();
  const link = await criarOrder(admin, pedido, origemDeVolta(c.origem));
  return { pedido: pedido.id, link };
}

/** Pagar de novo um pedido recusado, cancelado (expirou) ou abandonado. */
async function pagarDeNovo(admin: Admin, c: Record<string, unknown>) {
  const pedidoId = String(c.pedido ?? '');
  if (!UUID.test(pedidoId)) throw new ErroDoPedido(400, 'pedido_invalido');
  const { data: pedido } = await admin.from('pizza_pedidos_online').select('id, quantidade, total, sabores, status').eq('id', pedidoId).maybeSingle();
  if (!pedido) throw new ErroDoPedido(404, 'pedido_nao_encontrado');
  if (pedido.status === 'aprovado' || pedido.status === 'estornado') throw new ErroDoPedido(409, 'ja_pago');
  if (Date.now() >= Date.parse(PRAZO)) throw new ErroDoPedido(400, 'prazo_encerrado');
  return { pedido: pedido.id, link: await criarOrder(admin, pedido, origemDeVolta(c.origem)) };
}

async function situacao(admin: Admin, c: Record<string, unknown>) {
  const pedidoId = String(c.pedido ?? '');
  if (!UUID.test(pedidoId)) throw new ErroDoPedido(400, 'pedido_invalido');
  const ler = () => admin.from('pizza_pedidos_online')
    .select('id, unidade_id, unidade_nome, sabores, quantidade, total, status, mp_order_id, mp_status_detalhe, confirmacao:pizza_confirmacoes(numero)')
    .eq('id', pedidoId).maybeSingle();
  let { data: pedido } = await ler();
  if (!pedido) throw new ErroDoPedido(404, 'pedido_nao_encontrado');

  // O aviso pode atrasar: lê a order no Mercado Pago.
  if (pedido.status === 'pendente' && pedido.mp_order_id) {
    try {
      await aplicarOrder(admin, await mp('GET', `/v1/orders/${pedido.mp_order_id}`));
      ({ data: pedido } = await ler());
    } catch (e) { console.error('[pizza-pagamento] situação', pedidoId, e); }
  }

  return {
    pedido: pedido.id,
    status: pedido.status,
    detalhe: pedido.mp_status_detalhe,
    numero: pedido.confirmacao?.numero ?? null,
    unidade_id: pedido.unidade_id,
    unidade: pedido.unidade_nome,
    sabores: pedido.sabores,
    quantidade: pedido.quantidade,
    total: Number(pedido.total),
  };
}

// --- Entrada ---------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);

  if (url.searchParams.has('webhook')) return webhook(req, admin, url);

  // deno-lint-ignore no-explicit-any
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  try {
    if (corpo.acao === 'criar') return json(await criar(admin, corpo));
    if (corpo.acao === 'pagar') return json(await pagarDeNovo(admin, corpo));
    if (corpo.acao === 'situacao') return json(await situacao(admin, corpo));
    return json({ error: 'acao_desconhecida' }, 400);
  } catch (e) {
    if (e instanceof ErroDoPedido) return json({ error: e.message }, e.status);
    console.error('[pizza-pagamento]', e);
    return json({ error: 'falha_no_pagamento' }, 502);
  }
});

import { supabase } from '@/integrations/supabase/client';
import { comMaiusculas } from '@/lib/vagas/maiusculas';
import { areaDaUnidade, unidadeDaPizza, type Forma, type Quantidades } from './modelo';

/** Uma confirmação, como o painel lê. */
export interface Confirmacao {
  id: string;
  numero: string;
  nome: string;
  unidade_id: string;
  unidade_nome: string;
  area: 'educacao' | 'social';
  sabores: Record<string, number>;
  quantidade: number;
  total: number;
  forma: Forma;
  comprovante_caminho: string | null;
  comprovante_nome: string | null;
  retirada: boolean;
  /** WhatsApp, só dígitos (10/11/2026; os pedidos de antes não têm). */
  telefone?: string | null;
  /** Quando deu baixa (para a busca por nome da tela de retirada). */
  retirada_em?: string | null;
  created_at: string;
}

const extensao = (f: File) => (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (f.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase();

/**
 * Envia a confirmação: primeiro o comprovante (balde privado; quem envia só
 * sobe), depois a função do banco, que confere tudo e devolve o número.
 */
export async function enviarConfirmacao(d: { nome: string; unidadeId: string; quantidades: Quantidades; forma: Forma; comprovante: File | null }): Promise<string> {
  const unidade = unidadeDaPizza(d.unidadeId);
  if (!unidade) throw new Error('unidade_invalida');
  let caminho: string | null = null;
  if (d.comprovante) {
    caminho = `envios/${crypto.randomUUID()}.${extensao(d.comprovante)}`;
    const { error } = await supabase.storage.from('pizza-comprovantes').upload(caminho, d.comprovante, { contentType: d.comprovante.type || undefined, upsert: false });
    if (error) throw error;
  }
  const sabores = Object.fromEntries(Object.entries(d.quantidades).filter(([, n]) => (n ?? 0) > 0));
  const { data, error } = await supabase.rpc('confirmar_pizza', {
    p_nome: comMaiusculas(d.nome, { pessoa: true }),
    p_unidade_id: unidade.id,
    p_unidade_nome: unidade.name,
    p_area: areaDaUnidade(unidade),
    p_sabores: sabores,
    p_forma: d.forma,
    p_comprovante: caminho ?? undefined,
    p_comprovante_nome: d.comprovante?.name.slice(0, 200),
  });
  if (error) throw error;
  return String(data);
}

// --- Pagamento online (Mercado Pago, 09/11/2026) ---------------------------------------------

/** Chama a função `pizza-pagamento` e devolve o erro dela (prazo_encerrado etc.). */
async function chamarPagamento<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('pizza-pagamento', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  return data as T;
}

/** Reserva o pedido e devolve o endereço do Mercado Pago para pagar. */
export async function pagarOnline(d: { nome: string; telefone: string; unidadeId: string; quantidades: Quantidades }): Promise<{ pedido: string; link: string }> {
  const unidade = unidadeDaPizza(d.unidadeId);
  if (!unidade) throw new Error('unidade_invalida');
  return chamarPagamento({
    acao: 'criar',
    nome: comMaiusculas(d.nome, { pessoa: true }),
    telefone: d.telefone.replace(/\D/g, ''),
    unidadeId: unidade.id,
    unidadeNome: unidade.name,
    area: areaDaUnidade(unidade),
    sabores: Object.fromEntries(Object.entries(d.quantidades).filter(([, n]) => (n ?? 0) > 0)),
    origem: window.location.origin,
  });
}

/** "Seus pedidos" (10/11/2026): o que a pessoa já pediu, se nome e WhatsApp baterem. */
export interface PedidoPago {
  numero: string; nome: string; unidade_nome: string; sabores: Record<string, number>; quantidade: number; total: number;
  mp_forma: string | null; mp_bandeira: string | null; codigo: string | null; pago_em: string; retirada: boolean;
}
export interface PedidoSemPagar { pedido: string; sabores: Record<string, number>; quantidade: number; total: number; status: string; criado_em: string }
export interface MeusPedidos { pagos: PedidoPago[]; pendentes: PedidoSemPagar[] }

export async function meusPedidos(nome: string, telefone: string): Promise<MeusPedidos> {
  const { data, error } = await supabase.rpc('meus_pedidos_da_pizza', { p_nome: nome, p_telefone: telefone.replace(/\D/g, '') });
  if (error) throw error;
  const d = (data ?? {}) as unknown as Partial<MeusPedidos>;
  const num = <T extends { total: unknown; quantidade: unknown }>(l: T[] | undefined) => (l ?? []).map((x) => ({ ...x, total: Number(x.total), quantidade: Number(x.quantidade) }));
  return { pagos: num(d.pagos) as PedidoPago[], pendentes: num(d.pendentes) as PedidoSemPagar[] };
}

/** Novo link de pagamento para um pedido recusado ou que expirou. */
export const pagarDeNovo = (pedido: string) =>
  chamarPagamento<{ pedido: string; link: string }>({ acao: 'pagar', pedido, origem: window.location.origin });

export interface SituacaoOnline {
  pedido: string;
  status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'estornado';
  detalhe: string | null;
  numero: string | null;
  /** Para o comprovante (10/11/2026). */
  nome?: string;
  /** Só depois da aprovação: lido da order no Mercado Pago pela função. */
  pagamento?: { codigo: string | null; forma: string | null; bandeira: string | null; aprovado_em: string | null } | null;
  unidade_id: string;
  unidade: string;
  sabores: Record<string, number>;
  quantidade: number;
  total: number;
}

export const situacaoDoPedido = (pedido: string) => chamarPagamento<SituacaoOnline>({ acao: 'situacao', pedido });

export async function listarConfirmacoes(): Promise<Confirmacao[]> {
  const { data, error } = await supabase.from('pizza_confirmacoes')
    .select('id, numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, comprovante_caminho, comprovante_nome, retirada, retirada_em, telefone, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l) => ({ ...l, total: Number(l.total), sabores: (l.sabores ?? {}) as Record<string, number> })) as Confirmacao[];
}

export async function marcarRetirada(id: string, retirada: boolean): Promise<void> {
  const { error } = await supabase.from('pizza_confirmacoes').update({ retirada, retirada_em: retirada ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}

/** Pede a cópia das pendentes para o Drive (parte 2). Sem esperar: o Drive é extra. */
export function pedirCopiaParaODrive(): void {
  void supabase.functions.invoke('pizza-drive', { body: {} }).catch(() => { /* o painel mostra as pendentes */ });
}

export interface EstadoDoDrive {
  oauth_configurado: boolean;
  pode_conectar: boolean;
  conexao: { google_email: string; pasta_link: string; conectado_por: string | null; conectado_em: string; erro: string | null } | null;
  pendentes: number;
  com_erro: number;
  /** A planilha do Google (10/11/2026); null até a primeira escrita. */
  planilha?: { link: string; atualizada_em: string | null; erro: string | null; pendente: boolean } | null;
}

/** O link da planilha "Pizza da Alegria 2026 · Pedidos". Na primeira vez, a função cria a planilha. */
export async function linkDaPlanilha(): Promise<string> {
  const r = await chamarDrive<{ link: string }>({ planilha: true });
  return r.link;
}

/** Chama a função do Drive como a pessoa logada, com a mensagem de erro dela. */
export async function chamarDrive<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('pizza-drive', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/** Endereço temporário (5 min) para abrir o comprovante. */
export async function linkDoComprovante(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from('pizza-comprovantes').createSignedUrl(caminho, 300);
  if (error || !data) throw error ?? new Error('sem endereço');
  return data.signedUrl;
}

// --- Ranking no grupo de WhatsApp (11/11/2026) ----------------------------------------------

/** Um envio do ranking (teste ou grupo), como a função `pizza-ranking` registra. */
export interface EnvioDoRanking {
  criado_em: string;
  destino: 'grupo' | 'teste';
  origem: 'agendado' | 'painel';
  situacao: 'enviado' | 'falhou' | 'pulado';
  detalhe: string | null;
  pizzas: number | null;
}
export interface EstadoDoRanking {
  /** O endereço e o token do Evolution estão na configuração. */
  configurado: boolean;
  /** O envio automático das sextas, 15h. Nasce desligado. */
  ligado: boolean;
  grupo: string;
  /** As sextas do envio (AAAA-MM-DD). */
  datas: string[];
  proximo: string | null;
  /** Só a comunicação envia e liga; o financeiro só vê. */
  podeEnviar: boolean;
  envios: EnvioDoRanking[];
}

async function chamarRanking<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('pizza-ranking', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const estadoDoRanking = () => chamarRanking<EstadoDoRanking>({ acao: 'estado' });

/** A arte (JPEG) e a mensagem, feitas no servidor: as mesmas que vão ao grupo. */
export async function arteDoRanking(): Promise<{ imagem: Blob; mensagem: string }> {
  const r = await chamarRanking<{ imagem: string; mensagem: string }>({ acao: 'arte' });
  const bytes = Uint8Array.from(atob(r.imagem), (c) => c.charCodeAt(0));
  return { imagem: new Blob([bytes], { type: 'image/jpeg' }), mensagem: r.mensagem };
}

/** "teste": a conversa "Mensagens para mim" do WhatsApp da MKT. "grupo": ANABRASIL PUBLICAÇÕES. */
export const enviarRanking = (destino: 'teste' | 'grupo') => chamarRanking<{ ok: true }>({ acao: 'enviar', destino });
export const ligarRanking = (ligado: boolean) => chamarRanking<{ ligado: boolean }>({ acao: 'ligar', ligado });

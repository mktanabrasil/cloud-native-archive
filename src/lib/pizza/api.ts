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
export async function pagarOnline(d: { nome: string; unidadeId: string; quantidades: Quantidades }): Promise<{ pedido: string; link: string }> {
  const unidade = unidadeDaPizza(d.unidadeId);
  if (!unidade) throw new Error('unidade_invalida');
  return chamarPagamento({
    acao: 'criar',
    nome: comMaiusculas(d.nome, { pessoa: true }),
    unidadeId: unidade.id,
    unidadeNome: unidade.name,
    area: areaDaUnidade(unidade),
    sabores: Object.fromEntries(Object.entries(d.quantidades).filter(([, n]) => (n ?? 0) > 0)),
    origem: window.location.origin,
  });
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
    .select('id, numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, comprovante_caminho, comprovante_nome, retirada, retirada_em, created_at')
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

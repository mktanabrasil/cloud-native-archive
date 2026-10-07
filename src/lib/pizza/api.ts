import { supabase } from '@/integrations/supabase/client';
import { comMaiusculas } from '@/lib/vagas/maiusculas';
import { findNewsUnit } from '@/lib/news/units';
import { areaDaUnidade, type Forma, type Quantidades } from './modelo';

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
  created_at: string;
}

const extensao = (f: File) => (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (f.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase();

/**
 * Envia a confirmação: primeiro o comprovante (balde privado; quem envia só
 * sobe), depois a função do banco, que confere tudo e devolve o número.
 */
export async function enviarConfirmacao(d: { nome: string; unidadeId: string; quantidades: Quantidades; forma: Forma; comprovante: File | null }): Promise<string> {
  const unidade = findNewsUnit(d.unidadeId);
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

export async function listarConfirmacoes(): Promise<Confirmacao[]> {
  const { data, error } = await supabase.from('pizza_confirmacoes')
    .select('id, numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, comprovante_caminho, comprovante_nome, retirada, created_at')
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

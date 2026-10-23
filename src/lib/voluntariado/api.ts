import { supabase } from '@/integrations/supabase/client';
import { comMaiusculas } from '@/lib/vagas/maiusculas';
import { findNewsUnit } from '@/lib/news/units';
import { areaDaUnidade } from '@/lib/pizza/modelo';
import { digitosDoWhatsapp, type AreaDeAjuda, type Horario, type Vinculo } from './modelo';

/** Uma inscrição, como o painel lê. */
export interface Inscricao {
  id: string;
  protocolo: string;
  nome: string;
  whatsapp: string;
  vinculo: Vinculo;
  horario: Horario | null;
  /** Só o funcionário tem unidade (23/10/2026). */
  unidade_id: string | null;
  unidade_nome: string | null;
  area: 'educacao' | 'social' | null;
  indicado_por: string | null;
  igreja: string | null;
  opcao1: AreaDeAjuda;
  opcao2: AreaDeAjuda | null;
  created_at: string;
}

export interface NovaInscricao {
  nome: string;
  whatsapp: string;
  horario: Horario;
  vinculo: Vinculo;
  unidadeId: string | null;
  indicadoPor: string | null;
  igreja: string | null;
  opcao1: AreaDeAjuda;
  opcao2: AreaDeAjuda | null;
}

/** Envia a inscrição; o banco confere tudo (inclusive a meta da área) e devolve o protocolo sorteado. */
export async function inscrever(d: NovaInscricao): Promise<string> {
  const unidade = d.vinculo === 'funcionario' ? findNewsUnit(d.unidadeId ?? '') : null;
  if (d.vinculo === 'funcionario' && !unidade) throw new Error('unidade_invalida');
  const { data, error } = await supabase.rpc('inscrever_voluntario', {
    p_nome: comMaiusculas(d.nome, { pessoa: true }),
    p_whatsapp: digitosDoWhatsapp(d.whatsapp),
    p_horario: d.horario,
    p_vinculo: d.vinculo,
    p_opcao1: d.opcao1,
    p_opcao2: d.opcao2 ?? undefined,
    p_unidade_id: unidade?.id,
    p_unidade_nome: unidade?.name,
    p_area: unidade ? areaDaUnidade(unidade) : undefined,
    p_indicado_por: d.vinculo === 'comunidade' && d.indicadoPor?.trim() ? comMaiusculas(d.indicadoPor, { pessoa: true }) : undefined,
    p_igreja: d.vinculo === 'comunidade' && d.igreja?.trim() ? d.igreja.trim() : undefined,
  });
  if (error) throw error;
  return String(data);
}

/** Quais áreas já bateram a meta (o formulário só sabe isso, sem números). */
export async function areasLotadas(): Promise<string[]> {
  const { data, error } = await supabase.rpc('areas_lotadas_do_voluntariado');
  if (error) throw error;
  return (data ?? []) as string[];
}

export async function listarInscricoes(): Promise<Inscricao[]> {
  const { data, error } = await supabase.from('voluntarios_natal')
    .select('id, protocolo, nome, whatsapp, vinculo, horario, unidade_id, unidade_nome, area, indicado_por, igreja, opcao1, opcao2, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Inscricao[];
}

export async function apagarInscricao(id: string): Promise<void> {
  const { error } = await supabase.from('voluntarios_natal').delete().eq('id', id);
  if (error) throw error;
}

// --- As metas por área (23/10/2026) ----------------------------------------------------------

export async function lerMetas(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('voluntariado_metas').select('area, meta');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((m) => [m.area, m.meta]));
}

/** Sem número, a área fica sem limite. */
export async function definirMetaDaArea(area: AreaDeAjuda, meta: number | null): Promise<void> {
  const { error } = await supabase.rpc('definir_meta_da_area', { p_area: area, p_meta: meta });
  if (error) throw error;
}

// --- A planilha do Google que se atualiza sozinha (21/10/2026) -------------------------

/** Pede para escrever as inscrições pendentes na planilha. Sem esperar: a planilha é extra. */
export function enviarParaAPlanilha(): void {
  void supabase.functions.invoke('voluntariado-planilha', { body: {} }).catch(() => { /* o painel mostra as pendentes */ });
}

export interface EstadoDaPlanilha {
  drive_conectado: boolean;
  google_email: string | null;
  planilha: { link: string; criada_por: string | null; criada_em: string; erro: string | null } | null;
  pendentes: number;
}

/** Chama a função como a pessoa logada, com a mensagem de erro dela. */
export async function chamarPlanilha<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('voluntariado-planilha', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

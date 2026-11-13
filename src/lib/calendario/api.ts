import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AnoDoCalendario, ItemDoCalendario, Percurso } from './regras';

/**
 * O Calendário Anual no banco (14/11/2026). As tabelas são novas e ainda não
 * estão nos tipos gerados; por isso o cliente sem tipo aqui, com os tipos à
 * mão em `regras.ts`. Quem decide o que cada um lê e grava é o banco (RLS e
 * os gatilhos de guarda da migração 20261114100000).
 */
const db = supabase as unknown as SupabaseClient;

/** O ano em preenchimento agora. */
export const ANO_DO_CALENDARIO = 2027;

/** `so_calendario`: conta da equipe que, liberada aqui, só enxerga o calendário (13/11/2026). */
export interface AcessoDoCalendario { email: string; nome: string; ativo: boolean; so_calendario: boolean; criado_em: string; criado_por: string | null }

const falhou = (error: { message?: string } | null) => { if (error) throw error; };

export async function lerAno(ano: number): Promise<AnoDoCalendario | null> {
  const { data, error } = await db.from('calendario_anual').select('*').eq('ano', ano).maybeSingle();
  falhou(error);
  return (data as AnoDoCalendario | null) ?? null;
}

export async function lerItens(ano: number): Promise<ItemDoCalendario[]> {
  const { data, error } = await db.from('calendario_itens').select('id, ano, dia, texto, tipo, unidades, destaque, oculto, fonte').eq('ano', ano).order('dia').order('criado_em');
  falhou(error);
  return (data as ItemDoCalendario[]) ?? [];
}

export async function salvarAno(ano: number, campos: Partial<Pick<AnoDoCalendario, 'tema' | 'percursos' | 'meses_revisados'>>): Promise<AnoDoCalendario> {
  const { data, error } = await db.from('calendario_anual').update(campos).eq('ano', ano).select('*').maybeSingle();
  falhou(error);
  // O banco filtra em silêncio quando não pode (fora do preenchimento): zero linhas.
  if (!data) throw Object.assign(new Error('O calendário não está aberto para edição agora.'), { code: '42501' });
  return data as AnoDoCalendario;
}

export async function acrescentarItem(item: { ano: number; dia: string; texto: string; unidades: string[]; destaque: boolean }): Promise<ItemDoCalendario> {
  const { data, error } = await db.from('calendario_itens').insert({ ...item, tipo: 'atividade' }).select('id, ano, dia, texto, tipo, unidades, destaque, oculto, fonte').single();
  falhou(error);
  return data as ItemDoCalendario;
}

export async function editarItem(id: string, campos: Partial<Pick<ItemDoCalendario, 'texto' | 'unidades' | 'destaque' | 'oculto'>>): Promise<ItemDoCalendario> {
  const { data, error } = await db.from('calendario_itens').update(campos).eq('id', id).select('id, ano, dia, texto, tipo, unidades, destaque, oculto, fonte').maybeSingle();
  falhou(error);
  if (!data) throw Object.assign(new Error('Não foi possível alterar este item agora.'), { code: '42501' });
  return data as ItemDoCalendario;
}

export async function apagarItem(id: string): Promise<void> {
  const { data, error } = await db.from('calendario_itens').delete().eq('id', id).select('id');
  falhou(error);
  if (!data?.length) throw Object.assign(new Error('Não foi possível apagar este item agora.'), { code: '42501' });
}

/** O acesso de quem está logado (o banco só devolve a própria linha a quem não é do marketing). */
export async function meuAcesso(email: string): Promise<AcessoDoCalendario | null> {
  const { data, error } = await db.from('calendario_acessos').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
  falhou(error);
  return (data as AcessoDoCalendario | null) ?? null;
}

export async function listarAcessos(): Promise<AcessoDoCalendario[]> {
  const { data, error } = await db.from('calendario_acessos').select('*').order('nome');
  falhou(error);
  return (data as AcessoDoCalendario[]) ?? [];
}

export async function liberarAcesso(email: string, nome: string, por: string | null): Promise<void> {
  const { error } = await db.from('calendario_acessos').upsert({ email: email.trim().toLowerCase(), nome: nome.trim(), ativo: true, criado_por: por }, { onConflict: 'email' });
  falhou(error);
}

export async function definirAcessoAtivo(email: string, ativo: boolean): Promise<void> {
  const { error } = await db.from('calendario_acessos').update({ ativo }).eq('email', email);
  falhou(error);
}

export async function definirSoCalendario(email: string, so: boolean): Promise<void> {
  const { error } = await db.from('calendario_acessos').update({ so_calendario: so }).eq('email', email);
  falhou(error);
}

export async function removerAcesso(email: string): Promise<void> {
  const { error } = await db.from('calendario_acessos').delete().eq('email', email);
  falhou(error);
}

export type { AnoDoCalendario, ItemDoCalendario, Percurso };

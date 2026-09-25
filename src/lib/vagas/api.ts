import { supabase } from '@/integrations/supabase/client';
import type { PerguntaDeVaga, StatusDaVaga, TipoDePergunta, Vaga } from './modelo';

/**
 * O que fala com o banco. O portal público só lê: a política do banco já
 * entrega apenas a vaga publicada e dentro do prazo, então a encerrada some
 * da lista e a página dela recebe "não encontrada" (tela de vaga encerrada).
 */

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(t => t.trim() !== '') : []);

export const paraVaga = (l: Record<string, unknown>): Vaga => ({
  id: String(l.id),
  slug: String(l.slug),
  codigo: String(l.codigo ?? ''),
  titulo: String(l.titulo ?? ''),
  area: (l.area as Vaga['area']) ?? 'social',
  cidade: String(l.cidade ?? ''),
  modalidade: (l.modalidade as Vaga['modalidade']) ?? 'presencial',
  contratacao: (l.contratacao as Vaga['contratacao']) ?? 'clt',
  carga_horaria: String(l.carga_horaria ?? ''),
  descricao: String(l.descricao ?? ''),
  responsabilidades: lista(l.responsabilidades),
  requisitos: lista(l.requisitos),
  diferenciais: lista(l.diferenciais),
  beneficios: lista(l.beneficios),
  complementares: String(l.complementares ?? ''),
  afirmativa_pcd: l.afirmativa_pcd === true,
  aberta_pcd: l.aberta_pcd !== false,
  aprendizagem: l.aprendizagem === true,
  status: (l.status as Vaga['status']) ?? 'rascunho',
  publicada_em: (l.publicada_em as string | null) ?? null,
  encerrada_em: (l.encerrada_em as string | null) ?? null,
  prazo: (l.prazo as string | null) ?? null,
  link_externo: (l.link_externo as string | null) ?? null,
  responsavel_id: (l.responsavel_id as string | null) ?? null,
  versao: Number(l.versao ?? 1),
  created_by: (l.created_by as string | null) ?? null,
  created_at: String(l.created_at ?? ''),
  updated_at: String(l.updated_at ?? ''),
});

/** As vagas da vitrine, as mais novas primeiro. */
export async function listarVagasPublicadas(): Promise<Vaga[]> {
  const { data, error } = await supabase
    .from('vagas')
    .select('*')
    .eq('status', 'publicada')
    .order('publicada_em', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(l => paraVaga(l as Record<string, unknown>));
}

/** Uma vaga pelo endereço. Nulo: não existe ou não está mais aberta. */
export async function buscarVaga(slug: string): Promise<Vaga | null> {
  const { data, error } = await supabase.from('vagas').select('*').eq('slug', slug).eq('status', 'publicada').maybeSingle();
  if (error) throw error;
  return data ? paraVaga(data as Record<string, unknown>) : null;
}

// --- Gestão (RH e admin; o banco recusa os outros) -----------------------------


/** Os campos que o formulário grava. O resto (datas, versão) o banco carimba. */
export type DadosDaVaga = Omit<Vaga, 'id' | 'publicada_em' | 'encerrada_em' | 'responsavel_id' | 'versao' | 'created_by' | 'created_at' | 'updated_at'>;

/** Todas as vagas, de qualquer status, as últimas mexidas primeiro. */
export async function listarTodasAsVagas(): Promise<Vaga[]> {
  const { data, error } = await supabase.from('vagas').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(l => paraVaga(l as Record<string, unknown>));
}

export async function criarVaga(dados: DadosDaVaga, autor: string | null): Promise<Vaga> {
  const { data, error } = await supabase.from('vagas').insert({ ...dados, created_by: autor }).select('*').single();
  if (error) throw error;
  return paraVaga(data as Record<string, unknown>);
}

export async function atualizarVaga(id: string, dados: Partial<DadosDaVaga>): Promise<Vaga> {
  const { data, error } = await supabase.from('vagas').update(dados).eq('id', id).select('*').single();
  if (error) throw error;
  return paraVaga(data as Record<string, unknown>);
}

export const mudarStatus = (id: string, status: StatusDaVaga) => atualizarVaga(id, { status });

export async function apagarVaga(id: string): Promise<void> {
  const { error } = await supabase.from('vagas').delete().eq('id', id);
  if (error) throw error;
}

const paraPergunta = (l: Record<string, unknown>): PerguntaDeVaga => ({
  id: String(l.id),
  vaga_id: (l.vaga_id as string | null) ?? null,
  texto: String(l.texto ?? ''),
  tipo: (l.tipo as TipoDePergunta) ?? 'texto_curto',
  opcoes: lista(l.opcoes),
  obrigatoria: l.obrigatoria === true,
  ordem: Number(l.ordem ?? 0),
  bloqueada: l.bloqueada === true,
});

/** As perguntas da vaga, na ordem; `null` traz o banco de perguntas reaproveitáveis. */
export async function listarPerguntas(vagaId: string | null): Promise<PerguntaDeVaga[]> {
  const q = supabase.from('perguntas_de_vaga').select('*').order('ordem');
  const { data, error } = await (vagaId ? q.eq('vaga_id', vagaId) : q.is('vaga_id', null));
  if (error) throw error;
  return (data ?? []).map(l => paraPergunta(l as Record<string, unknown>));
}

export type NovaPergunta = Pick<PerguntaDeVaga, 'texto' | 'tipo' | 'opcoes' | 'obrigatoria'>;

/** Troca as perguntas da vaga pelas do formulário, na ordem dada. */
export async function salvarPerguntas(vagaId: string, perguntas: NovaPergunta[]): Promise<void> {
  const { error: e1 } = await supabase.from('perguntas_de_vaga').delete().eq('vaga_id', vagaId);
  if (e1) throw e1;
  if (perguntas.length === 0) return;
  const { error: e2 } = await supabase.from('perguntas_de_vaga').insert(perguntas.map((p, ordem) => ({ ...p, vaga_id: vagaId, ordem })));
  if (e2) throw e2;
}

/** Mensagem para o RH a partir do erro do banco. */
export function mensagemDoErro(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/vagas_slug_key|duplicate key.*slug/.test(t)) return 'Já existe uma vaga com esse endereço. Mude um pouco o título.';
  if (/vagas_codigo_key/.test(t)) return 'Outro código igual acabou de ser criado. Tente salvar de novo.';
  if (/row-level security|permission denied/i.test(t)) return 'Sua conta não tem permissão de RH para mexer em vagas.';
  if (/vagas_titulo_check/.test(t)) return 'O título precisa ter entre 3 e 120 caracteres.';
  return 'Não deu para salvar. Confira a internet e tente de novo.';
}

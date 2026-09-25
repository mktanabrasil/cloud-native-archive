import { supabase } from '@/integrations/supabase/client';
import type { Vaga } from './modelo';

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

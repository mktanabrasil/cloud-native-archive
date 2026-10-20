import { supabase } from '@/integrations/supabase/client';
import { comMaiusculas } from '@/lib/vagas/maiusculas';
import { findNewsUnit } from '@/lib/news/units';
import { areaDaUnidade } from '@/lib/pizza/modelo';
import { digitosDoWhatsapp, type AreaDeAjuda } from './modelo';

/** Uma inscrição, como o painel lê. */
export interface Inscricao {
  id: string;
  protocolo: string;
  nome: string;
  whatsapp: string;
  unidade_id: string;
  unidade_nome: string;
  area: 'educacao' | 'social';
  opcao1: AreaDeAjuda;
  opcao2: AreaDeAjuda | null;
  created_at: string;
}

/** Envia a inscrição; o banco confere tudo e devolve o protocolo sorteado. */
export async function inscrever(d: { nome: string; whatsapp: string; unidadeId: string; opcao1: AreaDeAjuda; opcao2: AreaDeAjuda | null }): Promise<string> {
  const unidade = findNewsUnit(d.unidadeId);
  if (!unidade) throw new Error('unidade_invalida');
  const { data, error } = await supabase.rpc('inscrever_voluntario', {
    p_nome: comMaiusculas(d.nome, { pessoa: true }),
    p_whatsapp: digitosDoWhatsapp(d.whatsapp),
    p_unidade_id: unidade.id,
    p_unidade_nome: unidade.name,
    p_area: areaDaUnidade(unidade),
    p_opcao1: d.opcao1,
    p_opcao2: d.opcao2 ?? undefined,
  });
  if (error) throw error;
  return String(data);
}

export async function listarInscricoes(): Promise<Inscricao[]> {
  const { data, error } = await supabase.from('voluntarios_natal')
    .select('id, protocolo, nome, whatsapp, unidade_id, unidade_nome, area, opcao1, opcao2, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Inscricao[];
}

export async function apagarInscricao(id: string): Promise<void> {
  const { error } = await supabase.from('voluntarios_natal').delete().eq('id', id);
  if (error) throw error;
}

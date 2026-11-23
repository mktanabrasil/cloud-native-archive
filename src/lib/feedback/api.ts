import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { extensaoDoPrint, type Aparelho, type MeuFeedback, type TipoDeFeedback } from './regras';

/**
 * O feedback do app (23/11/2026; SQL 20261124090000, função `feedback-aviso`).
 * O app só grava pela função do banco `feedback_enviar`, que preenche o nome
 * e o e-mail pela conta.
 */
const db = supabase as unknown as SupabaseClient;
const BALDE = 'feedback-prints';

export interface NovoFeedback {
  tipo: TipoDeFeedback;
  texto: string;
  setor: string | null;
  pagina: string | null;
  caminho: string;
  aparelho: Aparelho;
  navegador: string;
}

/**
 * Envia: primeiro o print (na pasta da pessoa), depois o feedback. Se o
 * feedback não gravar, o print sai do balde. Devolve o id do feedback.
 */
export async function enviarFeedback(userId: string, f: NovoFeedback, print: File | null): Promise<string> {
  let caminho: string | null = null;
  if (print) {
    caminho = `${userId}/${crypto.randomUUID()}.${extensaoDoPrint(print.type)}`;
    const { error } = await supabase.storage.from(BALDE).upload(caminho, print, { contentType: print.type, upsert: false });
    if (error) throw new Error('O print não subiu. Tente de novo ou envie sem ele.');
  }
  const { data, error } = await db.rpc('feedback_enviar', {
    _tipo: f.tipo, _texto: f.texto, _setor: f.setor, _pagina: f.pagina, _caminho: f.caminho,
    _aparelho: f.aparelho, _navegador: f.navegador, _print: caminho,
  });
  if (error || typeof data !== 'string') {
    if (caminho) void supabase.storage.from(BALDE).remove([caminho]);
    throw new Error(error?.message || 'Não foi possível enviar o feedback.');
  }
  return data;
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Pede o e-mail ao marketing, logo depois de gravar. Se a função falhar
 * (SMTP fora, rede), tenta de novo mais duas vezes; a função só manda uma vez
 * por feedback. Falhar aqui não desfaz o feedback: ele fica gravado.
 */
export async function avisarOMarketing(id: string, pausas = [3000, 10000]): Promise<boolean> {
  for (let tentativa = 0; ; tentativa++) {
    const { data, error } = await supabase.functions.invoke('feedback-aviso', { body: { feedback_id: id } });
    const r = (data ?? {}) as { enviado?: boolean; motivo?: string };
    if (!error) return r.enviado === true || r.motivo === 'já avisado';
    if (tentativa >= pausas.length) return false;
    await esperar(pausas[tentativa]);
  }
}

/** Os feedbacks que a pessoa mandou, os mais novos primeiro. */
export async function lerMeusFeedbacks(userId: string, limite = 20): Promise<MeuFeedback[]> {
  const { data, error } = await db.from('feedbacks')
    .select('id, tipo, texto, setor, pagina, situacao, resposta, respondido_em, criado_em')
    .eq('autor_id', userId)
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as MeuFeedback[];
}

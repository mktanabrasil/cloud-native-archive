import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { extensaoDoPrint, type Aparelho, type FeedbackDaCaixa, type MeuFeedback, type SituacaoDoFeedback, type TipoDeFeedback } from './regras';

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
  return pedirAviso({ feedback_id: id }, pausas);
}

async function pedirAviso(body: Record<string, string>, pausas: number[]): Promise<boolean> {
  for (let tentativa = 0; ; tentativa++) {
    const { data, error } = await supabase.functions.invoke('feedback-aviso', { body });
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

// --- A caixa do marketing, no Painel (PR 2, 23/11/2026) ------------------------------------

/** Todos os feedbacks (a regra do banco só entrega ao marketing), os mais novos primeiro. */
export async function lerCaixaDeFeedback(limite = 500): Promise<FeedbackDaCaixa[]> {
  const { data, error } = await db.from('feedbacks')
    .select('id, autor_id, autor_nome, autor_email, tipo, texto, setor, pagina, caminho, aparelho, navegador, print_path, situacao, resposta, respondido_por, respondido_em, lido_em, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackDaCaixa[];
}

/** Abriu: conta como lido. */
export async function marcarComoLido(id: string): Promise<void> {
  const { error } = await db.rpc('feedback_marcar_lido', { _id: id });
  if (error) throw new Error(error.message);
}

/** O feedback mudou depois que a tela leu (outra pessoa ou outra aba salvou). */
export class FeedbackMudou extends Error {}

/**
 * Salva a situação e a resposta. `versao` é o atualizado_em que a tela leu:
 * se alguém salvou depois, o banco recusa (FeedbackMudou). Devolve se algo mudou.
 */
export async function salvarFeedback(id: string, situacao: SituacaoDoFeedback, resposta: string, versao: string): Promise<boolean> {
  const { data, error } = await db.rpc('feedback_atualizar', { _id: id, _situacao: situacao, _resposta: resposta, _versao: versao });
  if (error?.code === '40001') throw new FeedbackMudou(error.message);
  if (error) throw new Error(error.message);
  return data !== null && data !== undefined;
}

/** O e-mail para quem mandou, depois de salvar uma mudança (com nova tentativa). */
export async function avisarQuemMandou(id: string, pausas = [3000, 10000]): Promise<boolean> {
  return pedirAviso({ feedback_id: id, tipo: 'resposta' }, pausas);
}

/** Endereço temporário (10 min) para ver o print. */
export async function linkDoPrint(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BALDE).createSignedUrl(caminho, 600);
  if (error || !data) throw new Error(error?.message ?? 'sem endereço');
  return data.signedUrl;
}

/** Quantos o marketing ainda não abriu (o número na aba do Painel). */
export async function contarNaoLidos(): Promise<number> {
  const { count, error } = await db.from('feedbacks').select('id', { count: 'exact', head: true }).is('lido_em', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

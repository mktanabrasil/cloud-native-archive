import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { PerguntaDeVaga } from './modelo';
import type { Experiencia, Perfil } from './perfil';

/**
 * A candidatura feita no app (PR 8, decisões de 06/10/2026).
 *
 * Quatro passos: conferir o que vai junto (perfil completo é obrigatório; o
 * currículo, não), marcar os requisitos que atende, responder as perguntas da
 * vaga e enviar. Vai uma CÓPIA do perfil, das experiências e do currículo:
 * o RH vê o que chegou naquele dia, mesmo que o candidato mude depois.
 */

export const ETAPAS = [
  ['recebida', 'Recebida'],
  ['analise', 'Análise'],
  ['entrevista', 'Entrevista'],
  ['resultado', 'Resultado'],
] as const;
export type Etapa = (typeof ETAPAS)[number][0];

export const ORIGENS = ['Instagram', 'Site da ANA', 'Indicação', 'Unidade', 'Outro'] as const;

export type Resposta = string | string[];

export interface RespostaGravada {
  pergunta_id: string;
  texto: string;
  tipo: PerguntaDeVaga['tipo'];
  resposta: Resposta;
}

export interface Candidatura {
  id: string;
  protocolo: string;
  vaga_id: string;
  etapa: Etapa;
  perfil: Record<string, unknown>;
  requisitos: Array<{ texto: string; atende: boolean }>;
  respostas: RespostaGravada[];
  origem: string | null;
  curriculo_caminho: string | null;
  curriculo_nome: string | null;
  retirada_em: string | null;
  created_at: string;
  vaga?: { titulo: string; slug: string; area: string } | null;
}

/** A resposta está preenchida? (Texto não vazio; escolha com pelo menos um item.) */
export const respondida = (r: Resposta | undefined) => (Array.isArray(r) ? r.length > 0 : !!r && r.trim().length > 0);

/** As perguntas obrigatórias que ainda estão sem resposta. */
export const faltamResponder = (perguntas: PerguntaDeVaga[], respostas: Record<string, Resposta>) =>
  perguntas.filter((p) => p.obrigatoria && !respondida(respostas[p.id]));

/** A cópia do perfil que vai junto, sem os campos do arquivo e do controle interno. */
export function copiaDoPerfil(p: Perfil, experiencias: Experiencia[], email: string): Record<string, unknown> {
  const { curriculo_caminho: _c, curriculo_nome: _n, curriculo_tamanho: _t, curriculo_enviado_em: _e, perfil_concluido_em: _p, ...dados } = p;
  return {
    ...dados,
    email,
    experiencias: experiencias.map(({ funcao, onde, inicio, fim, atual, descricao }) => ({ funcao, onde, inicio, fim, atual, descricao })),
  };
}

const paraCandidatura = (l: Record<string, unknown>): Candidatura => ({
  id: String(l.id),
  protocolo: String(l.protocolo),
  vaga_id: String(l.vaga_id),
  etapa: (ETAPAS.some(([k]) => k === l.etapa) ? l.etapa : 'recebida') as Etapa,
  perfil: (l.perfil as Record<string, unknown>) ?? {},
  requisitos: Array.isArray(l.requisitos) ? (l.requisitos as Candidatura['requisitos']) : [],
  respostas: Array.isArray(l.respostas) ? (l.respostas as RespostaGravada[]) : [],
  origem: (l.origem as string | null) ?? null,
  curriculo_caminho: (l.curriculo_caminho as string | null) ?? null,
  curriculo_nome: (l.curriculo_nome as string | null) ?? null,
  retirada_em: (l.retirada_em as string | null) ?? null,
  created_at: String(l.created_at),
  vaga: (l.vagas as Candidatura['vaga']) ?? null,
});

const COLUNAS = 'id, protocolo, vaga_id, etapa, perfil, requisitos, respostas, origem, curriculo_caminho, curriculo_nome, retirada_em, created_at, vagas(titulo, slug, area)';

export async function minhasCandidaturas(userId: string): Promise<Candidatura[]> {
  const { data, error } = await supabase.from('candidaturas').select(COLUNAS).eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l) => paraCandidatura(l as Record<string, unknown>));
}

/** A candidatura ativa desta pessoa para esta vaga, se houver. */
export async function candidaturaAtiva(userId: string, vagaId: string): Promise<Candidatura | null> {
  const { data, error } = await supabase.from('candidaturas').select(COLUNAS).eq('user_id', userId).eq('vaga_id', vagaId).is('retirada_em', null).maybeSingle();
  if (error) throw error;
  return data ? paraCandidatura(data as Record<string, unknown>) : null;
}

export interface Envio {
  userId: string;
  vagaId: string;
  perfil: Record<string, unknown>;
  requisitos: Array<{ texto: string; atende: boolean }>;
  respostas: RespostaGravada[];
  origem: string | null;
  /** O currículo atual do perfil; vai uma cópia dele. */
  curriculo: { caminho: string; nome: string } | null;
}

/**
 * Envia a candidatura. A cópia do currículo vai primeiro; se ela falhar, a
 * candidatura segue sem currículo (ele é opcional) em vez de não sair.
 * Depois pede o e-mail de confirmação, sem esperar: e-mail que atrasa não
 * pode segurar a tela de "enviada".
 */
export async function enviarCandidatura(e: Envio): Promise<Candidatura> {
  let copia: { caminho: string; nome: string } | null = null;
  if (e.curriculo) {
    const ext = e.curriculo.caminho.split('.').pop() || 'pdf';
    const destino = `${e.userId}/candidatura-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('curriculos').copy(e.curriculo.caminho, destino);
    if (!error) copia = { caminho: destino, nome: e.curriculo.nome };
  }
  const { data, error } = await supabase.from('candidaturas').insert({
    // protocolo, etapa e datas: quem decide é o banco (gatilho)
    protocolo: '',
    user_id: e.userId,
    vaga_id: e.vagaId,
    perfil: e.perfil as Json,
    requisitos: e.requisitos as unknown as Json,
    respostas: e.respostas as unknown as Json,
    origem: e.origem,
    curriculo_caminho: copia?.caminho ?? null,
    curriculo_nome: copia?.nome ?? null,
  }).select(COLUNAS).single();
  if (error) {
    if (copia) await supabase.storage.from('curriculos').remove([copia.caminho]);
    throw error;
  }
  const c = paraCandidatura(data as Record<string, unknown>);
  void supabase.functions.invoke('candidatura-confirmacao', { body: { candidatura_id: c.id } }).catch(() => { /* o e-mail é extra */ });
  return c;
}

export async function retirarCandidatura(id: string, motivo: string | null): Promise<void> {
  const { error } = await supabase.rpc('retirar_candidatura', { p_id: id, p_motivo: motivo ?? undefined });
  if (error) throw error;
}

/** Mensagem para o candidato a partir do erro do banco. */
export function mensagemDaCandidatura(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/candidaturas_uma_ativa_por_vaga|duplicate key/.test(t)) return 'Você já se candidatou a esta vaga. Acompanhe pela Minha área.';
  if (/row-level security|violates row-level/i.test(t)) return 'Esta vaga não está mais recebendo candidaturas.';
  return 'Não deu para enviar. Confira a internet e tente de novo.';
}

/** "06/10/2026, 14:41" */
export const dataEHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

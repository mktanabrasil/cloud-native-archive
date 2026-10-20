import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Mensagens e avisos (passo 5 do roteiro, decisões de 20/10/2026). A equipe
 * (RH e o responsável pelo processo) escreve ao candidato com três modelos;
 * o candidato só responde quando o RH pede (pergunta e convite, com
 * "Confirmo presença / Não posso nesse horário"); o e-mail leva o texto
 * inteiro. Tudo passa pelas funções do banco, que conferem quem pode o quê.
 */

export type TipoDaEquipe = 'convite' | 'pergunta' | 'recado';
export type Formato = 'presencial' | 'online' | 'telefone';
export interface Entrevista { dia: string; hora: string; formato: Formato; local: string }

export interface Mensagem {
  id: string;
  candidatura_id: string;
  autor: 'equipe' | 'candidato';
  tipo: TipoDaEquipe | 'resposta';
  texto: string;
  entrevista: Entrevista | null;
  responde_a: string | null;
  presenca: 'confirmada' | 'nao_pode' | null;
  por: string | null;
  lida_em: string | null;
  created_at: string;
}

export const MODELOS: Array<[TipoDaEquipe, string]> = [['convite', 'Convite para entrevista'], ['pergunta', 'Pedir informação'], ['recado', 'Mensagem livre']];
export const FORMATOS: Array<[Formato, string]> = [['presencial', 'Presencial'], ['online', 'On-line'], ['telefone', 'Por telefone']];

export const diaPorExtenso = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '');

/** O texto que já vem escrito em cada modelo (o RH só confere). */
export function textoDoModelo(tipo: TipoDaEquipe, nome: string, vaga: string, e?: Partial<Entrevista>): string {
  const primeiro = nome.split(/\s+/)[0] || nome;
  if (tipo === 'convite') {
    const dia = e?.dia ? new Date(`${e.dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '[dia]';
    const onde = e?.formato === 'online' ? `on-line${e?.local ? ` (${e.local})` : ''}`
      : e?.formato === 'telefone' ? 'por telefone'
        : e?.local ? `em ${e.local}` : 'no local combinado';
    return `Olá, ${primeiro}! Queremos conhecer você melhor. Sua entrevista para ${vaga} será no dia ${dia}, às ${e?.hora || '[horário]'}, ${onde}.${e?.formato === 'presencial' || !e?.formato ? ' Leve um documento com foto.' : ''} Confirme sua presença pelo app.`;
  }
  if (tipo === 'pergunta') return `Olá, ${primeiro}! Para seguir com a sua candidatura para ${vaga}, precisamos saber: `;
  return `Olá, ${primeiro}! `;
}

export async function mensagensDa(candidatura: string): Promise<Mensagem[]> {
  const { data, error } = await supabase.from('candidatura_mensagens')
    .select('id, candidatura_id, autor, tipo, texto, entrevista, responde_a, presenca, por, lida_em, created_at')
    .eq('candidatura_id', candidatura).order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as Mensagem[];
}

/** Todas as mensagens do candidato (o banco só entrega as dele), para os selos da Minha área. */
export async function minhasMensagens(): Promise<Mensagem[]> {
  const { data, error } = await supabase.from('candidatura_mensagens')
    .select('id, candidatura_id, autor, tipo, texto, entrevista, responde_a, presenca, por, lida_em, created_at')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as Mensagem[];
}

/**
 * Envia e pede o e-mail. Devolve se o convite moveu para Entrevista e se o
 * e-mail falhou (a mensagem fica no app mesmo assim).
 */
export async function enviarMensagem(candidatura: string, tipo: TipoDaEquipe, texto: string, entrevista?: Entrevista): Promise<{ moveu: boolean; falhouEmail: boolean }> {
  const { data, error } = await supabase.rpc('enviar_mensagem', { p_candidatura: candidatura, p_tipo: tipo, p_texto: texto, p_entrevista: tipo === 'convite' ? (entrevista as unknown as Json) : undefined });
  if (error) throw error;
  const r = data as { id: string; moveu: boolean };
  const { error: e2 } = await supabase.functions.invoke('candidatura-confirmacao', { body: { mensagem_id: r.id } });
  return { moveu: !!r.moveu, falhouEmail: !!e2 };
}

export async function responderMensagem(mensagem: string, texto: string, presenca?: 'confirmada' | 'nao_pode'): Promise<void> {
  const { error } = await supabase.rpc('responder_mensagem', { p_mensagem: mensagem, p_texto: texto || undefined, p_presenca: presenca });
  if (error) throw error;
}

export async function marcarLidas(candidatura: string): Promise<void> {
  const { error } = await supabase.rpc('marcar_mensagens_lidas', { p_candidatura: candidatura });
  if (error) throw error;
}

/** As mensagens da equipe que ainda esperam o candidato (convite sem presença, pergunta sem resposta). */
export function pendentesDoCandidato(lista: Mensagem[]): Mensagem[] {
  const respondidas = new Set(lista.filter((m) => m.autor === 'candidato' && m.responde_a).map((m) => m.responde_a));
  return lista.filter((m) => m.autor === 'equipe' && (m.tipo === 'convite' ? !m.presenca : m.tipo === 'pergunta' && !respondidas.has(m.id)));
}

/** Respostas de candidatos que a equipe ainda não leu, por candidatura (o banco só entrega as que a pessoa enxerga). */
export async function respostasNaoLidas(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('candidatura_mensagens').select('candidatura_id').eq('autor', 'candidato').is('lida_em', null);
  if (error) throw error;
  const m = new Map<string, number>();
  for (const l of data ?? []) m.set(l.candidatura_id, (m.get(l.candidatura_id) ?? 0) + 1);
  return m;
}

// --- O sino do candidato -----------------------------------------------------------------

export interface Aviso { candidatura_id: string; tipo: string; texto: string; vaga: string; em: string; novo: boolean }

export async function meusAvisos(): Promise<Aviso[]> {
  const { data, error } = await supabase.rpc('meus_avisos');
  if (error) throw error;
  return (data ?? []) as Aviso[];
}

export async function marcarAvisosVistos(): Promise<void> {
  const { error } = await supabase.rpc('marcar_avisos_vistos');
  if (error) throw error;
}

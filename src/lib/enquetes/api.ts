import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { DiaEmDestaque, Enquete, OpcaoDeEnquete, ResultadoDaEnquete } from './modelo';
import { normalizarTelefone } from './telefone';

/**
 * O que fala com o banco. As páginas públicas só usam `buscarEnquete`,
 * `resultado`, `votar` e `meuVoto` (funções do banco, sem login). A aba do
 * Painel usa o resto, com a sessão da equipe.
 */

const paraEnquete = (linha: Record<string, unknown>): Enquete => ({
  id: String(linha.id),
  slug: String(linha.slug),
  pergunta: String(linha.pergunta ?? ''),
  texto: String(linha.texto ?? ''),
  opcoes: (Array.isArray(linha.opcoes) ? linha.opcoes : []) as OpcaoDeEnquete[],
  dias: (Array.isArray(linha.dias) ? linha.dias : []) as DiaEmDestaque[],
  mostrar_resultado: linha.mostrar_resultado !== false,
  identificar: linha.identificar !== false,
  permitir_troca: linha.permitir_troca !== false,
  encerra_em: (linha.encerra_em as string | null) ?? null,
  encerrada_em: (linha.encerrada_em as string | null) ?? null,
  criada_por: String(linha.criada_por ?? ''),
  created_at: String(linha.created_at ?? ''),
  deleted_at: (linha.deleted_at as string | null) ?? null,
});

export async function buscarEnquete(slug: string): Promise<Enquete | null> {
  const { data, error } = await supabase.from('enquetes').select('*').eq('slug', slug).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return data ? paraEnquete(data as Record<string, unknown>) : null;
}

export async function listarEnquetes(): Promise<Enquete[]> {
  const { data, error } = await supabase.from('enquetes').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(l => paraEnquete(l as Record<string, unknown>));
}

export type NovaEnquete = Pick<Enquete, 'slug' | 'pergunta' | 'texto' | 'opcoes' | 'dias' | 'mostrar_resultado' | 'identificar' | 'permitir_troca' | 'encerra_em' | 'criada_por'>;

export async function criarEnquete(n: NovaEnquete, userId: string | null): Promise<Enquete> {
  const { data, error } = await supabase
    .from('enquetes')
    .insert({ ...n, opcoes: n.opcoes as unknown as Json, dias: n.dias as unknown as Json, created_by: userId })
    .select('*')
    .single();
  if (error) throw error;
  return paraEnquete(data as Record<string, unknown>);
}

export async function atualizarEnquete(id: string, mudancas: Partial<NovaEnquete> & { encerrada_em?: string | null; deleted_at?: string | null }): Promise<void> {
  const { opcoes, dias, ...resto } = mudancas;
  const { error } = await supabase
    .from('enquetes')
    .update({
      ...resto,
      ...(opcoes ? { opcoes: opcoes as unknown as Json } : {}),
      ...(dias ? { dias: dias as unknown as Json } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export const encerrarEnquete = (id: string) => atualizarEnquete(id, { encerrada_em: new Date().toISOString() });
export const reabrirEnquete = (id: string) => atualizarEnquete(id, { encerrada_em: null });
export const apagarEnquete = (id: string) => atualizarEnquete(id, { deleted_at: new Date().toISOString() });

export async function resultado(slug: string, acompanhamento = false): Promise<(ResultadoDaEnquete & { oculto: boolean }) | null> {
  const { data, error } = await supabase.rpc('enquete_resultado', { p_slug: slug, p_acompanhamento: acompanhamento });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  const r = data as Record<string, unknown>;
  return {
    total: Number(r.total ?? 0),
    por_opcao: (r.por_opcao as Record<string, number>) ?? {},
    votantes: (Array.isArray(r.votantes) ? r.votantes : []) as ResultadoDaEnquete['votantes'],
    ultimo_voto_em: (r.ultimo_voto_em as string | null) ?? null,
    oculto: r.oculto === true,
  };
}

export type MotivoDoVoto = 'nao_encontrada' | 'encerrada' | 'opcao_invalida' | 'dados_invalidos' | 'pin_incorreto' | 'travado' | 'troca_nao_permitida';
export type RespostaDoVoto = { ok: true; opcao_id: string; trocou: boolean } | { ok: false; motivo: MotivoDoVoto; ate?: string };

export const MENSAGEM_DO_MOTIVO: Record<MotivoDoVoto, string> = {
  nao_encontrada: 'Esta enquete não existe mais.',
  encerrada: 'A enquete encerrou. Seu voto anterior ficou registrado.',
  opcao_invalida: 'Essa opção não existe mais. Recarregue a página.',
  dados_invalidos: 'Confira o nome, o número com DDD e o PIN de 4 dígitos.',
  pin_incorreto: 'PIN não confere com o deste número. Se esqueceu, fale com quem criou a enquete.',
  travado: 'Muitas tentativas. Espere 10 minutos e tente de novo.',
  troca_nao_permitida: 'Esta enquete não permite trocar o voto.',
};

export async function votar(slug: string, opcaoId: string, identidade: { telefone: string; nome: string; pin: string }): Promise<RespostaDoVoto> {
  const { data, error } = await supabase.rpc('votar_enquete', {
    p_slug: slug,
    p_opcao_id: opcaoId,
    p_telefone: identidade.telefone.startsWith('ap:') ? identidade.telefone : normalizarTelefone(identidade.telefone),
    p_nome: identidade.nome,
    p_pin: identidade.pin,
  });
  if (error) throw error;
  return data as unknown as RespostaDoVoto;
}

export async function meuVoto(slug: string, telefone: string, pin: string): Promise<{ ok: true; opcao_id: string; nome: string } | { ok: false }> {
  const { data, error } = await supabase.rpc('meu_voto_na_enquete', {
    p_slug: slug,
    p_telefone: telefone.startsWith('ap:') ? telefone : normalizarTelefone(telefone),
    p_pin: pin,
  });
  if (error) throw error;
  return data as unknown as { ok: true; opcao_id: string; nome: string } | { ok: false };
}

/* ---- O aparelho lembra ------------------------------------------------------
 * Depois de confirmar, o navegador guarda nome, número e PIN desta enquete:
 * na volta pelo mesmo celular, troca com um toque. Conveniência, não fonte
 * de verdade: o banco é quem confere. O localStorage pode não existir. */

export interface Identidade { telefone: string; nome: string; pin: string }

const chave = (slug: string) => `enquete-identidade:${slug}`;
const CHAVE_APARELHO = 'enquete-aparelho';

const guarda = (): Storage | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

export function lerIdentidade(slug: string): Identidade | null {
  try {
    const bruto = guarda()?.getItem(chave(slug));
    if (!bruto) return null;
    const i = JSON.parse(bruto) as Identidade;
    return i && typeof i.telefone === 'string' ? i : null;
  } catch { return null; }
}

export function guardarIdentidade(slug: string, i: Identidade): void {
  try { guarda()?.setItem(chave(slug), JSON.stringify(i)); } catch { /* sem espaço ou bloqueado */ }
}

export function esquecerIdentidade(slug: string): void {
  try { guarda()?.removeItem(chave(slug)); } catch { /* nada */ }
}

/** A chave anônima do aparelho, para enquetes sem identificação. Criada uma vez. */
export function chaveDoAparelho(): string {
  try {
    const g = guarda();
    const atual = g?.getItem(CHAVE_APARELHO);
    if (atual) return atual;
    const nova = `ap:${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    g?.setItem(CHAVE_APARELHO, nova);
    return nova;
  } catch {
    return `ap:${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  }
}

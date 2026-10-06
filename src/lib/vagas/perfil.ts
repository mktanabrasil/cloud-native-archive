import { supabase } from '@/integrations/supabase/client';

/**
 * Perfil e currículo do candidato (PR 7, mockup aprovado em 06/10/2026).
 *
 * O perfil é preenchido uma vez só, em 5 passos curtos: sobre você, contato,
 * formação, experiência e disponibilidade. Sem CPF, RG, endereço completo,
 * idiomas, competências nem pronome (decisão dele). O currículo é um arquivo
 * só, num balde privado (`curriculos/<user_id>/…`); trocar apaga o anterior.
 */

export const ESCOLARIDADES = [
  ['fundamental', 'Fundamental'],
  ['medio_cursando', 'Médio cursando'],
  ['medio', 'Médio completo'],
  ['tecnico', 'Técnico'],
  ['superior_cursando', 'Superior cursando'],
  ['superior', 'Superior completo'],
  ['pos', 'Pós-graduação'],
] as const;
export type Escolaridade = (typeof ESCOLARIDADES)[number][0];

export const TURNOS = [
  ['manha', 'Manhã'],
  ['tarde', 'Tarde'],
  ['noite', 'Noite'],
  ['fim_de_semana', 'Fins de semana'],
] as const;
export type Turno = (typeof TURNOS)[number][0];

export interface Perfil {
  nome: string;
  nome_social: string;
  /** AAAA-MM-DD, ou vazio. */
  nascimento: string;
  whatsapp: string;
  cidade: string;
  bairro: string;
  escolaridade: Escolaridade | '';
  curso: string;
  cursos_livres: string;
  sem_experiencia: boolean;
  disponibilidade: Turno[];
  acessibilidade: string;
  perfil_concluido_em: string | null;
  curriculo_caminho: string | null;
  curriculo_nome: string | null;
  curriculo_tamanho: number | null;
  curriculo_enviado_em: string | null;
}

export interface Experiencia {
  id: string;
  funcao: string;
  onde: string;
  /** AAAA-MM */
  inicio: string;
  fim: string | null;
  atual: boolean;
  descricao: string;
}

export const PERFIL_VAZIO: Perfil = {
  nome: '', nome_social: '', nascimento: '', whatsapp: '', cidade: '', bairro: '',
  escolaridade: '', curso: '', cursos_livres: '', sem_experiencia: false, disponibilidade: [],
  acessibilidade: '', perfil_concluido_em: null,
  curriculo_caminho: null, curriculo_nome: null, curriculo_tamanho: null, curriculo_enviado_em: null,
};

const txt = (v: unknown) => (typeof v === 'string' ? v : '');

export function paraPerfil(l: Record<string, unknown> | null | undefined): Perfil {
  if (!l) return PERFIL_VAZIO;
  const esc = ESCOLARIDADES.some(([k]) => k === l.escolaridade) ? (l.escolaridade as Escolaridade) : '';
  const turnos = Array.isArray(l.disponibilidade) ? (l.disponibilidade as string[]).filter((t): t is Turno => TURNOS.some(([k]) => k === t)) : [];
  return {
    nome: txt(l.nome), nome_social: txt(l.nome_social), nascimento: txt(l.nascimento),
    whatsapp: txt(l.whatsapp), cidade: txt(l.cidade), bairro: txt(l.bairro),
    escolaridade: esc, curso: txt(l.curso), cursos_livres: txt(l.cursos_livres),
    sem_experiencia: l.sem_experiencia === true, disponibilidade: turnos, acessibilidade: txt(l.acessibilidade),
    perfil_concluido_em: (l.perfil_concluido_em as string | null) ?? null,
    curriculo_caminho: (l.curriculo_caminho as string | null) ?? null,
    curriculo_nome: (l.curriculo_nome as string | null) ?? null,
    curriculo_tamanho: typeof l.curriculo_tamanho === 'number' ? l.curriculo_tamanho : null,
    curriculo_enviado_em: (l.curriculo_enviado_em as string | null) ?? null,
  };
}

// --- Os 5 passos e o que falta ----------------------------------------------------

export const PASSOS_DO_PERFIL = ['Sobre você', 'Contato', 'Formação', 'Experiência', 'Disponibilidade'] as const;

/** Só os dígitos do WhatsApp; 10 ou 11 com DDD. */
export const digitos = (t: string) => t.replace(/\D/g, '');
export const whatsappValido = (t: string) => /^\d{10,11}$/.test(digitos(t));

/** (19) 99123-4567 enquanto digita. */
export function mascararWhatsapp(t: string): string {
  const d = digitos(t).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const meio = d.length === 11 ? 7 : 6;
  if (d.length <= meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}

/** Cada passo está completo? (Opcionais não contam.) */
export function passosCompletos(p: Perfil, experiencias: number): boolean[] {
  return [
    p.nome.trim().length > 0 && !!p.nascimento,
    whatsappValido(p.whatsapp) && p.cidade.trim().length > 0,
    p.escolaridade !== '',
    experiencias > 0 || p.sem_experiencia,
    p.disponibilidade.length > 0,
  ];
}

/** 0 a 100, de 20 em 20. */
export const completude = (p: Perfil, experiencias: number) =>
  passosCompletos(p, experiencias).filter(Boolean).length * 20;

/** Os passos que faltam, com o número do passo (0 a 4). */
export const passosQueFaltam = (p: Perfil, experiencias: number) =>
  passosCompletos(p, experiencias).flatMap((ok, i) => (ok ? [] : [{ passo: i, nome: PASSOS_DO_PERFIL[i] }]));

/** "mar/2023 – atual" */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function periodo(e: Pick<Experiencia, 'inicio' | 'fim' | 'atual'>): string {
  const mes = (m: string) => { const [a, n] = m.split('-'); return `${MESES[Number(n) - 1] ?? '?'}/${a}`; };
  return `${mes(e.inicio)} – ${e.atual || !e.fim ? 'atual' : mes(e.fim)}`;
}

// --- Banco ------------------------------------------------------------------------

const COLUNAS = 'nome, nome_social, nascimento, whatsapp, cidade, bairro, escolaridade, curso, cursos_livres, sem_experiencia, disponibilidade, acessibilidade, perfil_concluido_em, curriculo_caminho, curriculo_nome, curriculo_tamanho, curriculo_enviado_em';

export async function carregarPerfil(userId: string): Promise<{ perfil: Perfil; experiencias: Experiencia[] }> {
  const [p, e] = await Promise.all([
    supabase.from('candidatos').select(COLUNAS).eq('user_id', userId).maybeSingle(),
    supabase.from('candidato_experiencias').select('id, funcao, onde, inicio, fim, atual, descricao').eq('user_id', userId).order('inicio', { ascending: false }),
  ]);
  if (p.error) throw p.error;
  if (e.error) throw e.error;
  const experiencias = (e.data ?? []).map((x) => ({ ...x, descricao: x.descricao ?? '' })) as Experiencia[];
  return { perfil: paraPerfil(p.data as Record<string, unknown> | null), experiencias };
}

/** Grava só os campos dados. Texto vazio vira nulo no banco. */
export async function salvarPerfil(userId: string, campos: Partial<Perfil>): Promise<void> {
  const linha: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) linha[k] = typeof v === 'string' && k !== 'nome' ? (v.trim() || null) : v;
  const { error } = await supabase.from('candidatos').update(linha as never).eq('user_id', userId);
  if (error) throw error;
}

export async function salvarExperiencia(userId: string, e: Omit<Experiencia, 'id'> & { id?: string }): Promise<Experiencia> {
  const linha = { user_id: userId, funcao: e.funcao.trim(), onde: e.onde.trim(), inicio: e.inicio, fim: e.atual ? null : e.fim, atual: e.atual, descricao: e.descricao.trim() || null };
  const q = e.id
    ? supabase.from('candidato_experiencias').update(linha).eq('id', e.id)
    : supabase.from('candidato_experiencias').insert(linha);
  const { data, error } = await q.select('id, funcao, onde, inicio, fim, atual, descricao').single();
  if (error) throw error;
  return { ...data, descricao: data.descricao ?? '' } as Experiencia;
}

export async function apagarExperiencia(id: string): Promise<void> {
  const { error } = await supabase.from('candidato_experiencias').delete().eq('id', id);
  if (error) throw error;
}

// --- Currículo --------------------------------------------------------------------

export const CURRICULO_MAX_MB = 10;
const TIPOS: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** A mensagem de recusa, ou null se o arquivo serve. */
export function conferirCurriculo(f: File): string | null {
  const tipo = TIPOS[f.type] ?? (/\.pdf$/i.test(f.name) ? 'pdf' : /\.jpe?g$/i.test(f.name) ? 'jpg' : /\.png$/i.test(f.name) ? 'png' : null);
  if (!tipo) return 'Use PDF, JPG ou PNG. No Word, “Salvar como” PDF.';
  if (f.size > CURRICULO_MAX_MB * 1024 * 1024) return `O arquivo tem ${(f.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB e o limite é ${CURRICULO_MAX_MB} MB.`;
  if (f.size === 0) return 'Este arquivo está vazio.';
  return null;
}

const tipoDoArquivo = (f: File) => (/\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? 'application/pdf' : /\.png$/i.test(f.name) || f.type === 'image/png' ? 'image/png' : 'image/jpeg');

/**
 * Sobe o currículo novo, grava no perfil e só então apaga o anterior: se algo
 * falhar no meio, o candidato nunca fica sem nenhum.
 */
export async function enviarCurriculo(userId: string, f: File, anterior: string | null): Promise<Pick<Perfil, 'curriculo_caminho' | 'curriculo_nome' | 'curriculo_tamanho' | 'curriculo_enviado_em'>> {
  const contentType = tipoDoArquivo(f);
  const caminho = `${userId}/curriculo-${crypto.randomUUID()}.${TIPOS[contentType]}`;
  const { error } = await supabase.storage.from('curriculos').upload(caminho, f, { contentType, upsert: false });
  if (error) throw error;
  const campos = { curriculo_caminho: caminho, curriculo_nome: f.name.slice(0, 200), curriculo_tamanho: f.size, curriculo_enviado_em: new Date().toISOString() };
  await salvarPerfil(userId, campos);
  if (anterior && anterior !== caminho) await supabase.storage.from('curriculos').remove([anterior]);
  return campos;
}

export async function removerCurriculo(userId: string, caminho: string): Promise<void> {
  await salvarPerfil(userId, { curriculo_caminho: null, curriculo_nome: null, curriculo_tamanho: null, curriculo_enviado_em: null });
  await supabase.storage.from('curriculos').remove([caminho]);
}

/** Endereço temporário (5 min) para abrir o próprio currículo. */
export async function linkDoCurriculo(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from('curriculos').createSignedUrl(caminho, 300);
  if (error || !data) throw error ?? new Error('sem endereço');
  return data.signedUrl;
}

export function tamanhoLegivel(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

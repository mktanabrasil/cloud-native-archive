import { supabase } from '@/integrations/supabase/client';
import { paraVaga } from './api';
import { ETAPAS, paraCandidatura, rotuloDaEtapa, type Candidatura, type Etapa, type Resultado } from './candidatura';
import { ESCOLARIDADES } from './perfil';
import type { Vaga } from './modelo';

/**
 * O painel do RH (PR 9, decisões de 09/10/2026): candidatos por vaga, a
 * ficha, mover de etapa, observações internas e histórico. Só RH e admin: o
 * banco recusa os outros (is_rh_or_admin). Mover passa pela função
 * `mover_candidatura`, que confere a regra e grava o histórico; quando ela
 * diz que é para avisar, o e-mail sai pela função `candidatura-confirmacao`.
 */

export interface CandidaturaRh extends Candidatura {
  aberta_em: string | null;
}

const COLUNAS = 'id, protocolo, vaga_id, etapa, resultado, perfil, requisitos, respostas, origem, curriculo_caminho, curriculo_nome, retirada_em, created_at, aberta_em';

const paraRh = (l: Record<string, unknown>): CandidaturaRh => ({ ...paraCandidatura(l), aberta_em: (l.aberta_em as string | null) ?? null });

/** A vaga pelo endereço, em qualquer status (o RH vê também as encerradas). */
export async function buscarVagaDoRh(slug: string): Promise<Vaga | null> {
  const { data, error } = await supabase.from('vagas').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? paraVaga(data as Record<string, unknown>) : null;
}

export async function candidatosDaVaga(vagaId: string): Promise<CandidaturaRh[]> {
  const { data, error } = await supabase.from('candidaturas').select(COLUNAS).eq('vaga_id', vagaId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l) => paraRh(l as Record<string, unknown>));
}

export async function umaCandidatura(id: string): Promise<CandidaturaRh | null> {
  const { data, error } = await supabase.from('candidaturas').select(COLUNAS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? paraRh(data as Record<string, unknown>) : null;
}

/** Quantas por vaga, e quantas ainda ninguém abriu ("novos"). Retiradas não contam. */
export async function contagemPorVaga(): Promise<Map<string, { total: number; novos: number }>> {
  const { data, error } = await supabase.from('candidaturas').select('vaga_id, aberta_em').is('retirada_em', null);
  if (error) throw error;
  const m = new Map<string, { total: number; novos: number }>();
  for (const l of data ?? []) {
    const c = m.get(l.vaga_id) ?? { total: 0, novos: 0 };
    c.total++;
    if (!l.aberta_em) c.novos++;
    m.set(l.vaga_id, c);
  }
  return m;
}

export async function abrirCandidatura(id: string): Promise<void> {
  const { error } = await supabase.rpc('abrir_candidatura', { p_id: id });
  if (error) throw error;
}

/** Os passos possíveis a partir da etapa atual. */
export function proximosPassos(c: Pick<Candidatura, 'etapa' | 'resultado' | 'retirada_em'>): {
  avancar: { etapa: Etapa; resultado: Resultado | null; rotulo: string } | null;
  voltar: { etapa: Etapa; rotulo: string } | null;
  podeRecusar: boolean;
} {
  if (c.retirada_em) return { avancar: null, voltar: null, podeRecusar: false };
  const i = ETAPAS.findIndex(([k]) => k === c.etapa);
  const avancar = c.etapa === 'recebida' ? { etapa: 'analise' as Etapa, resultado: null, rotulo: 'Mover para Análise' }
    : c.etapa === 'analise' ? { etapa: 'entrevista' as Etapa, resultado: null, rotulo: 'Mover para Entrevista' }
      : c.etapa === 'entrevista' ? { etapa: 'resultado' as Etapa, resultado: 'aprovado' as Resultado, rotulo: 'Aprovar' }
        : null;
  const anterior = i > 0 ? ETAPAS[c.etapa === 'resultado' ? 2 : i - 1] : null;
  return {
    avancar,
    voltar: anterior ? { etapa: anterior[0], rotulo: `Voltar para ${anterior[1]}` } : null,
    podeRecusar: !(c.etapa === 'resultado' && c.resultado === 'nao_selecionado'),
  };
}

/**
 * Move e, quando o banco diz que é para avisar, pede o e-mail ao candidato.
 * Devolve se o aviso foi pedido e se saiu (o e-mail não segura a mudança).
 */
export async function moverCandidatura(id: string, etapa: Etapa, resultado: Resultado | null): Promise<{ avisou: boolean; falhouAviso: boolean }> {
  const { data, error } = await supabase.rpc('mover_candidatura', { p_id: id, p_etapa: etapa, p_resultado: resultado ?? undefined });
  if (error) throw error;
  if (!data) return { avisou: false, falhouAviso: false };
  const { error: e2 } = await supabase.functions.invoke('candidatura-confirmacao', { body: { candidatura_id: id, aviso: true } });
  return { avisou: true, falhouAviso: !!e2 };
}

export async function lerObservacoes(id: string): Promise<string> {
  const { data, error } = await supabase.from('candidatura_observacoes').select('texto').eq('candidatura_id', id).maybeSingle();
  if (error) throw error;
  return data?.texto ?? '';
}

export async function salvarObservacoes(id: string, texto: string, por: string): Promise<void> {
  const { error } = await supabase.from('candidatura_observacoes').upsert({ candidatura_id: id, texto: texto.slice(0, 4000), atualizado_por: por, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export interface Movimento { acao: string; de: string | null; para: string | null; por: string | null; em: string }

export async function historico(id: string): Promise<Movimento[]> {
  const { data, error } = await supabase.from('candidatura_historico').select('acao, de, para, por, em').eq('candidatura_id', id).order('em');
  if (error) throw error;
  return (data ?? []) as Movimento[];
}

/** "Rótulo" de uma marca do histórico: "resultado:aprovado" → "Aprovado". */
const rotuloDaMarca = (m: string | null) => {
  if (!m) return '';
  const [etapa, resultado] = m.split(':');
  return rotuloDaEtapa(etapa as Etapa, (resultado as Resultado) ?? null);
};

export function textoDoMovimento(m: Movimento): string {
  if (m.acao === 'enviada') return 'Enviada pelo candidato';
  if (m.acao === 'aberta') return `Aberta por ${m.por ?? 'RH'}`;
  if (m.acao === 'retirada') return 'Retirada pelo candidato';
  return `${rotuloDaMarca(m.de)} → ${rotuloDaMarca(m.para)} · ${m.por ?? 'RH'}`;
}

// --- Leitura da cópia do perfil ------------------------------------------------------

const txt = (v: unknown) => (typeof v === 'string' ? v : '');
export const nomeDoCandidato = (c: Pick<Candidatura, 'perfil'>) => txt(c.perfil.nome_social) || txt(c.perfil.nome) || 'Sem nome';
export const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const escolaridadeDe = (c: Pick<Candidatura, 'perfil'>) => ESCOLARIDADES.find(([k]) => k === c.perfil.escolaridade)?.[1] ?? '—';
export const experienciasDe = (c: Pick<Candidatura, 'perfil'>) => (Array.isArray(c.perfil.experiencias) ? c.perfil.experiencias : []) as Array<{ funcao: string; onde: string; inicio: string; fim: string | null; atual: boolean; descricao?: string }>;
export const lugarDe = (c: Pick<Candidatura, 'perfil'>) => [txt(c.perfil.cidade), txt(c.perfil.bairro)].filter(Boolean).join(' · ');

// --- Planilha ----------------------------------------------------------------------------

const campo = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const data = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };

/** A lista da vaga em CSV (ponto e vírgula, BOM): sem documentos, com a etapa. */
export function csvDosCandidatos(lista: CandidaturaRh[]): string {
  const cab = ['Protocolo', 'Enviada', 'Nome', 'WhatsApp', 'E-mail', 'Cidade', 'Bairro', 'Formação', 'Experiências', 'Requisitos marcados', 'Currículo', 'Etapa', 'Retirada'];
  const linhas = lista.map((c) => [
    c.protocolo, data(c.created_at), nomeDoCandidato(c), txt(c.perfil.whatsapp), txt(c.perfil.email), txt(c.perfil.cidade), txt(c.perfil.bairro),
    escolaridadeDe(c), String(experienciasDe(c).length), `${c.requisitos.filter((r) => r.atende).length} de ${c.requisitos.length}`,
    c.curriculo_caminho ? 'sim' : 'não', rotuloDaEtapa(c.etapa, c.resultado), c.retirada_em ? 'sim' : 'não',
  ].map(campo).join(';'));
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n') + '\r\n';
}

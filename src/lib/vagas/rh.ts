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
/** `podeFechar`: só o RH entra e sai do resultado (passo 3, 19/10/2026); o responsável vai até Entrevista. */
export function proximosPassos(c: Pick<Candidatura, 'etapa' | 'resultado' | 'retirada_em'>, podeFechar = true): {
  avancar: { etapa: Etapa; resultado: Resultado | null; rotulo: string } | null;
  voltar: { etapa: Etapa; rotulo: string } | null;
  podeRecusar: boolean;
} {
  if (c.retirada_em) return { avancar: null, voltar: null, podeRecusar: false };
  if (!podeFechar && c.etapa === 'resultado') return { avancar: null, voltar: null, podeRecusar: false };
  const i = ETAPAS.findIndex(([k]) => k === c.etapa);
  const avancar = c.etapa === 'recebida' ? { etapa: 'analise' as Etapa, resultado: null, rotulo: 'Mover para Análise' }
    : c.etapa === 'analise' ? { etapa: 'entrevista' as Etapa, resultado: null, rotulo: 'Mover para Entrevista' }
      : c.etapa === 'entrevista' && podeFechar ? { etapa: 'resultado' as Etapa, resultado: 'aprovado' as Resultado, rotulo: 'Aprovar' }
        : null;
  const anterior = i > 0 ? ETAPAS[c.etapa === 'resultado' ? 2 : i - 1] : null;
  return {
    avancar,
    voltar: anterior ? { etapa: anterior[0], rotulo: `Voltar para ${anterior[1]}` } : null,
    podeRecusar: podeFechar && !(c.etapa === 'resultado' && c.resultado === 'nao_selecionado'),
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

// --- Painel do RH e quadro (passo 2 do roteiro, decisões de 19/10/2026) ---------------

/** Dias sem mudar de etapa para contar como "parado" (decisão: 10). */
export const DIAS_PARADO = 10;

/** Última vez que cada candidatura entrou na etapa atual (envio ou mudança), pelo histórico. */
export async function ultimaMudanca(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!ids.length) return m;
  const { data, error } = await supabase.from('candidatura_historico').select('candidatura_id, em').in('acao', ['enviada', 'etapa']).in('candidatura_id', ids);
  if (error) throw error;
  for (const l of data ?? []) if (!m.has(l.candidatura_id) || m.get(l.candidatura_id)! < l.em) m.set(l.candidatura_id, l.em);
  return m;
}

export const estaParado = (desde: string | undefined, agora = Date.now()) => !!desde && agora - new Date(desde).getTime() >= DIAS_PARADO * 864e5;

/** A coluna do quadro de uma candidatura (Aprovado e Não selecionado são colunas próprias). */
export type Coluna = 'recebida' | 'analise' | 'entrevista' | 'aprovado' | 'nao_selecionado';
export const COLUNAS_DO_QUADRO: Array<[Coluna, string]> = [['recebida', 'Recebida'], ['analise', 'Análise'], ['entrevista', 'Entrevista'], ['aprovado', 'Aprovado'], ['nao_selecionado', 'Não selecionado']];
export const colunaDe = (c: Pick<Candidatura, 'etapa' | 'resultado'>): Coluna => (c.etapa === 'resultado' ? (c.resultado === 'aprovado' ? 'aprovado' : 'nao_selecionado') : c.etapa);
export const destinoDaColuna = (col: Coluna): { etapa: Etapa; resultado: Resultado | null } =>
  col === 'aprovado' ? { etapa: 'resultado', resultado: 'aprovado' } : col === 'nao_selecionado' ? { etapa: 'resultado', resultado: 'nao_selecionado' } : { etapa: col, resultado: null };
/** Soltar nestas pede confirmação: são as que mandam notícia definitiva (decisão de 19/10/2026). */
export const colunaPedeConfirmacao = (col: Coluna) => col === 'aprovado' || col === 'nao_selecionado';

export interface Painel {
  vagasAbertas: number;
  porArea: Record<string, number>;
  candidaturas: number;
  paraTriar: number;
  emEntrevista: number;
  aprovados: number;
  porColuna: Record<Coluna | 'retiradas', number>;
  atencao: Array<{ vaga: Pick<Vaga, 'id' | 'slug' | 'titulo'>; tipo: 'novos' | 'parados' | 'sem_candidatos'; quantidade: number; detalhe: string }>;
}

/**
 * Os números do Painel. `dias` nulo = tudo. Volumes, não pessoas: nada de
 * recorte por característica de quem se candidatou.
 */
export async function montarPainel(dias: number | null, area: string | null, agora = Date.now()): Promise<Painel> {
  const [{ data: vs, error: e1 }, { data: cs, error: e2 }] = await Promise.all([
    supabase.from('vagas').select('id, slug, titulo, area, status, publicada_em'),
    supabase.from('candidaturas').select('id, vaga_id, etapa, resultado, aberta_em, retirada_em, created_at'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const vagas = (vs ?? []).filter((v) => !area || v.area === area);
  const idsDasVagas = new Set(vagas.map((v) => v.id));
  const desde = dias === null ? 0 : agora - dias * 864e5;
  const todas = (cs ?? []).filter((c) => idsDasVagas.has(c.vaga_id));
  const doPeriodo = todas.filter((c) => new Date(c.created_at).getTime() >= desde);
  const ativas = todas.filter((c) => !c.retirada_em);
  const mudou = await ultimaMudanca(ativas.map((c) => c.id)).catch(() => new Map<string, string>());

  const abertas = vagas.filter((v) => v.status === 'publicada');
  const porArea: Record<string, number> = {};
  abertas.forEach((v) => { porArea[v.area] = (porArea[v.area] ?? 0) + 1; });

  const porColuna = { recebida: 0, analise: 0, entrevista: 0, aprovado: 0, nao_selecionado: 0, retiradas: 0 } as Painel['porColuna'];
  doPeriodo.forEach((c) => { if (c.retirada_em) porColuna.retiradas++; else porColuna[colunaDe(c as Pick<Candidatura, 'etapa' | 'resultado'>)]++; });

  const atencao: Painel['atencao'] = [];
  for (const v of abertas) {
    const daVaga = ativas.filter((c) => c.vaga_id === v.id);
    const novos = daVaga.filter((c) => !c.aberta_em);
    if (novos.length) {
      const maisAntigo = Math.max(...novos.map((c) => Math.floor((agora - new Date(c.created_at).getTime()) / 864e5)));
      atencao.push({ vaga: v, tipo: 'novos', quantidade: novos.length, detalhe: `${novos.length} ${novos.length === 1 ? 'novo' : 'novos'}${maisAntigo > 0 ? ` · o mais antigo há ${maisAntigo} ${maisAntigo === 1 ? 'dia' : 'dias'}` : ''}` });
    }
    const parados = daVaga.filter((c) => c.etapa !== 'resultado' && c.aberta_em && estaParado(mudou.get(c.id), agora));
    if (parados.length) atencao.push({ vaga: v, tipo: 'parados', quantidade: parados.length, detalhe: `${parados.length} sem mudar de etapa há ${DIAS_PARADO}+ dias` });
    const abertaHa = v.publicada_em ? Math.floor((agora - new Date(v.publicada_em).getTime()) / 864e5) : 0;
    if (!daVaga.length && abertaHa >= 14) atencao.push({ vaga: v, tipo: 'sem_candidatos', quantidade: 0, detalhe: `aberta há ${abertaHa} dias, nenhuma candidatura` });
  }
  const ordem = { novos: 0, parados: 1, sem_candidatos: 2 };
  atencao.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.quantidade - a.quantidade);

  return {
    vagasAbertas: abertas.length,
    porArea,
    candidaturas: doPeriodo.length,
    paraTriar: ativas.filter((c) => !c.aberta_em).length,
    emEntrevista: ativas.filter((c) => c.etapa === 'entrevista').length,
    aprovados: doPeriodo.filter((c) => !c.retirada_em && c.etapa === 'resultado' && c.resultado === 'aprovado').length,
    porColuna,
    atencao,
  };
}

// --- Processos e responsáveis (passo 3 do roteiro, decisões de 19/10/2026) ----------
// Qualquer pessoa ativa da equipe pode ser responsável; um por vaga; o
// responsável que não é RH vai até Entrevista (o resultado é do RH); ao ser
// nomeado, recebe e-mail.

export interface PessoaDaEquipe { user_id: string; nome: string; email: string | null; unidade: string | null }

export async function equipe(): Promise<PessoaDaEquipe[]> {
  const { data, error } = await supabase.rpc('equipe_para_responsavel');
  if (error) throw error;
  return (data ?? []) as PessoaDaEquipe[];
}

/** Define (ou tira) o responsável e o prazo; avisa a pessoa quando muda o responsável. */
export async function definirResponsavel(vaga: Pick<Vaga, 'id' | 'responsavel_id'>, responsavel: string | null, prazo: string | null): Promise<{ avisou: boolean; falhouAviso: boolean }> {
  const { error } = await supabase.from('vagas').update({ responsavel_id: responsavel, prazo_processo: prazo || null }).eq('id', vaga.id);
  if (error) throw error;
  if (!responsavel || responsavel === vaga.responsavel_id) return { avisou: false, falhouAviso: false };
  const { error: e2 } = await supabase.functions.invoke('candidatura-confirmacao', { body: { responsavel_vaga_id: vaga.id } });
  return { avisou: true, falhouAviso: !!e2 };
}

export type Situacao = 'no_prazo' | 'triagem_lenta' | 'sem_responsavel' | 'prazo_vencido';

export interface Processo {
  vaga: Vaga;
  porColuna: Record<Coluna, number>;
  novos: number;
  parados: number;
  abertoHa: number;
  situacao: Situacao;
}

/**
 * Os processos: cada vaga com os candidatos por coluna, novos, parados e a
 * situação. O RH vê todos; o responsável recebe só os dele (o banco filtra).
 */
export async function listarProcessos(agora = Date.now()): Promise<Processo[]> {
  const [{ data: vs, error: e1 }, { data: cs, error: e2 }] = await Promise.all([
    supabase.from('vagas').select('*'),
    supabase.from('candidaturas').select('id, vaga_id, etapa, resultado, aberta_em, retirada_em'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const ativas = (cs ?? []).filter((c) => !c.retirada_em);
  const mudou = await ultimaMudanca(ativas.map((c) => c.id)).catch(() => new Map<string, string>());
  return (vs ?? []).map((l) => {
    const vaga = paraVaga(l as Record<string, unknown>);
    const daVaga = ativas.filter((c) => c.vaga_id === vaga.id);
    const porColuna = { recebida: 0, analise: 0, entrevista: 0, aprovado: 0, nao_selecionado: 0 } as Record<Coluna, number>;
    daVaga.forEach((c) => { porColuna[colunaDe(c as Pick<Candidatura, 'etapa' | 'resultado'>)]++; });
    const parados = daVaga.filter((c) => c.etapa !== 'resultado' && c.aberta_em && estaParado(mudou.get(c.id), agora)).length;
    const abertoHa = vaga.publicada_em ? Math.max(0, Math.floor((agora - new Date(vaga.publicada_em).getTime()) / 864e5)) : 0;
    const vencido = !!vaga.prazo_processo && new Date(`${vaga.prazo_processo}T23:59:59`).getTime() < agora;
    const situacao: Situacao = !vaga.responsavel_id ? 'sem_responsavel' : vencido ? 'prazo_vencido' : parados > 0 ? 'triagem_lenta' : 'no_prazo';
    return { vaga, porColuna, novos: daVaga.filter((c) => !c.aberta_em).length, parados, abertoHa, situacao };
  });
}

export const ROTULO_DA_SITUACAO: Record<Situacao, string> = {
  no_prazo: 'No prazo', triagem_lenta: 'Triagem lenta', sem_responsavel: 'Sem responsável', prazo_vencido: 'Prazo vencido',
};

/** O prazo cai nos próximos 7 dias (e ainda não venceu). */
export const prazoEmBreve = (prazo: string | null, agora = Date.now()) => {
  if (!prazo) return false;
  const fim = new Date(`${prazo}T23:59:59`).getTime();
  return fim >= agora && fim - agora <= 7 * 864e5;
};

/** Busca sem acento e sem caixa. */
export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

import { supabase } from '@/integrations/supabase/client';
import { paraVaga } from './api';
import { ROTULO_DA_AREA, type Area, type Vaga } from './modelo';
import { DIAS_PARADO, equipe } from './rh';

/**
 * Os relatórios do RH (passo 6 do roteiro, decisões de 20/10/2026): como
 * andam os processos, em volumes e tempos. Nunca quem é o candidato, nem
 * recorte por idade, gênero, cor ou bairro. Só o RH vê (o banco já entrega
 * tudo só ao RH; o responsável não tem esta aba).
 *
 * `calcularRelatorio` é pura (recebe as linhas e o "agora"); `montarRelatorio`
 * busca as linhas e chama.
 */

const DIA = 864e5;
const ORDEM = ['recebida', 'analise', 'entrevista', 'resultado'];

export interface LinhaCandidatura { id: string; vaga_id: string; etapa: string; resultado: string | null; aberta_em: string | null; retirada_em: string | null; created_at: string; origem: string | null }
export interface LinhaHistorico { candidatura_id: string; acao: string; de: string | null; para: string | null; em: string }
export interface LinhaMensagem { id: string; candidatura_id: string; autor: string; tipo: string; responde_a: string | null; created_at: string }
export interface Dados { vagas: Vaga[]; candidaturas: LinhaCandidatura[]; historico: LinhaHistorico[]; mensagens: LinhaMensagem[]; nomes: Map<string, string> }
export interface Filtros { dias: number | null; area: Area | null; vaga: string | null }

export type SituacaoNoRelatorio = 'no_prazo' | 'triagem_lenta' | 'sem_responsavel' | 'prazo_vencido' | 'fechada';
export interface LinhaPorVaga {
  vaga: Pick<Vaga, 'id' | 'slug' | 'titulo' | 'codigo' | 'area'>;
  candidaturas: number;
  emAberto: number;
  primeiraOlhada: number | null;
  ateResultado: number | null;
  aprovados: number;
  responsavel: string | null;
  situacao: SituacaoNoRelatorio;
}
export interface Relatorio {
  candidaturas: number;
  candidaturasAntes: number | null;
  primeiraOlhada: number | null;
  primeiraOlhadaAntes: number | null;
  ateResultado: number | null;
  ateResultadoAntes: number | null;
  aprovados: number;
  vagasFechadas: number;
  funil: { recebidas: number; analise: number; entrevista: number; aprovadas: number; retiradas: number };
  tempos: Array<{ rotulo: string; dias: number | null }>;
  semanas: Array<{ inicio: string; n: number }>;
  origem: Array<{ rotulo: string; n: number; pct: number }>;
  porVaga: LinhaPorVaga[];
}

/** Mediana, em dias com uma casa (nulo sem dados). */
export function mediana(dias: number[]): number | null {
  if (!dias.length) return null;
  const o = [...dias].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  const v = o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  return Math.round(v * 10) / 10;
}

const etapaDe = (marca: string | null) => (marca ?? '').split(':')[0];
const t = (iso: string) => new Date(iso).getTime();

/** Até onde cada candidatura chegou (0 recebida … 3 resultado), pelo histórico e pela etapa atual. */
function alcance(c: LinhaCandidatura, eventos: LinhaHistorico[]): number {
  let max = ORDEM.indexOf(c.etapa);
  for (const e of eventos) if (e.acao === 'etapa') max = Math.max(max, ORDEM.indexOf(etapaDe(e.para)));
  return max;
}

/** Quanto tempo ficou numa etapa: da entrada até a próxima mudança (só estadias terminadas). */
function tempoNaEtapa(eventos: LinhaHistorico[], etapa: string): number[] {
  const mov = eventos.filter((e) => e.acao === 'etapa').sort((a, b) => t(a.em) - t(b.em));
  const out: number[] = [];
  mov.forEach((e, i) => {
    if (etapaDe(e.para) !== etapa) return;
    const saida = mov[i + 1];
    if (saida) out.push((t(saida.em) - t(e.em)) / DIA);
  });
  return out;
}

function ateResultadoDe(c: LinhaCandidatura, eventos: LinhaHistorico[]): number | null {
  const r = eventos.filter((e) => e.acao === 'etapa' && etapaDe(e.para) === 'resultado').sort((a, b) => t(a.em) - t(b.em))[0];
  return r ? (t(r.em) - t(c.created_at)) / DIA : null;
}

const primeiraOlhadaDe = (c: LinhaCandidatura) => (c.aberta_em ? Math.max(0, (t(c.aberta_em) - t(c.created_at)) / DIA) : null);
const numeros = (l: Array<number | null>) => l.filter((x): x is number => x !== null);

export function calcularRelatorio(d: Dados, f: Filtros, agora = Date.now()): Relatorio {
  const vagas = d.vagas.filter((v) => (!f.area || v.area === f.area) && (!f.vaga || v.id === f.vaga));
  const ids = new Set(vagas.map((v) => v.id));
  const desde = f.dias === null ? -Infinity : agora - f.dias * DIA;
  const antesDe = f.dias === null ? null : agora - 2 * f.dias * DIA;
  const daqui = d.candidaturas.filter((c) => ids.has(c.vaga_id));
  const noPeriodo = daqui.filter((c) => t(c.created_at) >= desde);
  const doAnterior = antesDe === null ? null : daqui.filter((c) => t(c.created_at) >= antesDe && t(c.created_at) < desde);

  const eventos = new Map<string, LinhaHistorico[]>();
  for (const h of d.historico) { const l = eventos.get(h.candidatura_id); if (l) l.push(h); else eventos.set(h.candidatura_id, [h]); }
  const ev = (id: string) => eventos.get(id) ?? [];

  const olhada = (l: LinhaCandidatura[]) => mediana(numeros(l.map(primeiraOlhadaDe)));
  const resultado = (l: LinhaCandidatura[]) => mediana(numeros(l.map((c) => ateResultadoDe(c, ev(c.id)))));
  const aprovado = (c: LinhaCandidatura) => !c.retirada_em && c.etapa === 'resultado' && c.resultado === 'aprovado';

  const ativasNoPeriodo = noPeriodo.filter((c) => !c.retirada_em);
  const funil = {
    recebidas: noPeriodo.length,
    analise: ativasNoPeriodo.filter((c) => alcance(c, ev(c.id)) >= 1).length,
    entrevista: ativasNoPeriodo.filter((c) => alcance(c, ev(c.id)) >= 2).length,
    aprovadas: noPeriodo.filter(aprovado).length,
    retiradas: noPeriodo.length - ativasNoPeriodo.length,
  };

  // Convite → resposta: do convite até a primeira resposta a ele.
  const idsNoPeriodo = new Set(noPeriodo.map((c) => c.id));
  const respostas = new Map<string, string>();
  for (const m of d.mensagens) if (m.autor === 'candidato' && m.responde_a && (!respostas.has(m.responde_a) || respostas.get(m.responde_a)! > m.created_at)) respostas.set(m.responde_a, m.created_at);
  const convites = d.mensagens.filter((m) => m.tipo === 'convite' && idsNoPeriodo.has(m.candidatura_id) && respostas.has(m.id));

  const tempos = [
    { rotulo: 'Recebida → aberta', dias: olhada(noPeriodo) },
    { rotulo: 'Análise', dias: mediana(noPeriodo.flatMap((c) => tempoNaEtapa(ev(c.id), 'analise'))) },
    { rotulo: 'Entrevista', dias: mediana(noPeriodo.flatMap((c) => tempoNaEtapa(ev(c.id), 'entrevista'))) },
    { rotulo: 'Convite → resposta', dias: mediana(convites.map((m) => (t(respostas.get(m.id)!) - t(m.created_at)) / DIA)) },
  ];

  // Semanas: até 13 barras, a última termina agora.
  const nSemanas = Math.max(1, Math.min(13, f.dias === null ? 13 : Math.ceil(f.dias / 7)));
  const semanas = Array.from({ length: nSemanas }, (_, i) => {
    const fim = agora - (nSemanas - 1 - i) * 7 * DIA;
    const ini = fim - 7 * DIA;
    return { inicio: new Date(ini).toISOString(), n: daqui.filter((c) => t(c.created_at) > ini && t(c.created_at) <= fim).length };
  });

  const contagem = new Map<string, number>();
  for (const c of noPeriodo) { const k = c.origem?.trim() || 'Não informado'; contagem.set(k, (contagem.get(k) ?? 0) + 1); }
  const origem = [...contagem.entries()].sort((a, b) => b[1] - a[1])
    .map(([rotulo, n]) => ({ rotulo, n, pct: noPeriodo.length ? Math.round((n / noPeriodo.length) * 100) : 0 }));

  const fechada = (v: Vaga) => v.status === 'encerrada' || v.status === 'arquivada';
  const ultima = (c: LinhaCandidatura) => Math.max(t(c.created_at), ...ev(c.id).filter((e) => e.acao === 'etapa').map((e) => t(e.em)));
  const porVaga: LinhaPorVaga[] = vagas
    .map((v) => {
      const todas = daqui.filter((c) => c.vaga_id === v.id);
      const doPeriodo = todas.filter((c) => t(c.created_at) >= desde);
      const abertas = todas.filter((c) => !c.retirada_em && c.etapa !== 'resultado');
      const parados = abertas.filter((c) => c.aberta_em && agora - ultima(c) >= DIAS_PARADO * DIA).length;
      const vencido = !!v.prazo_processo && t(`${v.prazo_processo}T23:59:59`) < agora;
      const situacao: SituacaoNoRelatorio = fechada(v) ? 'fechada' : !v.responsavel_id ? 'sem_responsavel' : vencido ? 'prazo_vencido' : parados ? 'triagem_lenta' : 'no_prazo';
      return {
        vaga: { id: v.id, slug: v.slug, titulo: v.titulo, codigo: v.codigo, area: v.area },
        candidaturas: doPeriodo.length,
        emAberto: abertas.length,
        primeiraOlhada: olhada(doPeriodo),
        ateResultado: resultado(doPeriodo),
        aprovados: doPeriodo.filter(aprovado).length,
        responsavel: v.responsavel_id ? d.nomes.get(v.responsavel_id) ?? 'pessoa da equipe' : null,
        situacao,
      };
    })
    // Entram as que tiveram candidatura no período ou ainda estão no ar.
    .filter((l) => l.candidaturas > 0 || l.emAberto > 0 || vagas.find((v) => v.id === l.vaga.id)?.status === 'publicada')
    .sort((a, b) => b.candidaturas - a.candidaturas || a.vaga.titulo.localeCompare(b.vaga.titulo, 'pt-BR'));

  return {
    candidaturas: noPeriodo.length,
    candidaturasAntes: doAnterior ? doAnterior.length : null,
    primeiraOlhada: olhada(noPeriodo),
    primeiraOlhadaAntes: doAnterior ? olhada(doAnterior) : null,
    ateResultado: resultado(noPeriodo),
    ateResultadoAntes: doAnterior ? resultado(doAnterior) : null,
    aprovados: funil.aprovadas,
    vagasFechadas: vagas.filter((v) => fechada(v) && (v.updated_at ? t(v.updated_at) >= desde : true)).length,
    funil,
    tempos,
    semanas,
    origem,
    porVaga,
  };
}

export async function montarRelatorio(f: Filtros, agora = Date.now()): Promise<Relatorio> {
  const [v, c, h, m] = await Promise.all([
    supabase.from('vagas').select('*'),
    supabase.from('candidaturas').select('id, vaga_id, etapa, resultado, aberta_em, retirada_em, created_at, origem'),
    supabase.from('candidatura_historico').select('candidatura_id, acao, de, para, em').eq('acao', 'etapa'),
    supabase.from('candidatura_mensagens').select('id, candidatura_id, autor, tipo, responde_a, created_at'),
  ]);
  if (v.error) throw v.error;
  if (c.error) throw c.error;
  if (h.error) throw h.error;
  const pessoas = await equipe().catch(() => []);
  return calcularRelatorio({
    vagas: (v.data ?? []).map((l) => paraVaga(l as Record<string, unknown>)),
    candidaturas: (c.data ?? []) as LinhaCandidatura[],
    historico: (h.data ?? []) as LinhaHistorico[],
    mensagens: (m.data ?? []) as LinhaMensagem[],
    nomes: new Map(pessoas.map((p): [string, string] => [p.user_id, p.nome])),
  }, f, agora);
}

export const ROTULO_DA_SITUACAO_NO_RELATORIO: Record<SituacaoNoRelatorio, string> = {
  no_prazo: 'No prazo', triagem_lenta: 'Triagem lenta', sem_responsavel: 'Sem responsável', prazo_vencido: 'Prazo vencido', fechada: 'Fechada',
};

/** "2,4 d" / "—". */
export const emDias = (d: number | null) => (d === null ? '—' : `${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`);

const campo = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** A planilha do relatório: só números, por vaga (nada de candidato). */
export function csvDoRelatorio(r: Relatorio): string {
  const cab = ['Vaga', 'Código', 'Área', 'Candidaturas no período', 'Em aberto', '1ª olhada (dias, mediana)', 'Até o resultado (dias, mediana)', 'Aprovados', 'Responsável', 'Situação'];
  const num = (d: number | null) => (d === null ? '' : String(d).replace('.', ','));
  const linhas = r.porVaga.map((l) => [
    l.vaga.titulo, l.vaga.codigo, ROTULO_DA_AREA[l.vaga.area] ?? l.vaga.area, String(l.candidaturas), String(l.emAberto),
    num(l.primeiraOlhada), num(l.ateResultado), String(l.aprovados), l.responsavel ?? '', ROTULO_DA_SITUACAO_NO_RELATORIO[l.situacao],
  ].map(campo).join(';'));
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n') + '\r\n';
}

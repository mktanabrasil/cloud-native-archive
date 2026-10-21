import { supabase } from '@/integrations/supabase/client';
import { AREAS_DE_AJUDA, AREAS_FORA_DO_FORMULARIO, PRAZO, UNIDADES_DO_VOLUNTARIADO, caminhoDoAoVivo, rotuloDaAjuda } from './modelo';

/**
 * O painel ao vivo da gestão (21/10/2026): o que o link de acompanhamento
 * mostra. O banco entrega as inscrições (nome, unidade, áreas, data; nunca
 * o WhatsApp) e a meta; as contas são feitas aqui, a cada 30 segundos.
 */

export const ATUALIZA_A_CADA_MS = 30_000;
export const TROCA_DE_BLOCO_MS = 10_000;

/** As cores de cada unidade, as mesmas da planilha (função voluntariado-planilha). */
export const COR_DA_UNIDADE: Record<string, string> = {
  'ANA Jardim Nilópolis': '#FFD9D2', 'ANA DIC': '#FFE5C2', 'ANA Jardim Santana': '#FFF2B8', 'ANA Piauí': '#F9D6E6',
  'Grupo de Oração Esperança': '#E8DAF5',
  'CEI Bem Querer Prof. Pierre Weil': '#D6ECFF', 'CEI Bem Querer Sen. João de Medeiros Calmon': '#CFF3EC',
  'CEI Bem Querer Célia A. J. Velardi Gaspar': '#DDF2D0', 'CEI Bem Querer Rogério L. P. Santana': '#E3E7FF',
  'CEI Bem Querer Prof. Anísio Spínola': '#D0F0F8', 'CEI Bem Querer Min. Gustavo Capanema': '#EAF5C8',
  'CEI Bem Querer Gov. Leonel de Moura Brizola': '#F3E2D3', 'CEI Bem Querer Paulo Reglus Neves Freire': '#E0EAF0',
  'CEI Bem Querer Mayara Masson Christofoletti': '#F6DDF0', 'CEI Bem Querer Profa. Renata Ferramola': '#D9F2E4',
  'CEI Bem Querer Vandir Justino da Costa Dias': '#FBE7D7',
};
export const corDaUnidade = (nome: string) => COR_DA_UNIDADE[nome] ?? '#EEEEEE';

export interface InscricaoAoVivo { nome: string; unidade_id: string; unidade_nome: string; area: 'educacao' | 'social'; opcao1: string; opcao2: string | null; created_at: string }
export interface Acompanhamento { meta: number | null; agora: string; inscricoes: InscricaoAoVivo[] }

export async function lerAcompanhamento(codigo: string): Promise<Acompanhamento> {
  const { data, error } = await supabase.rpc('acompanhamento_do_voluntariado', { p_codigo: codigo });
  if (error) throw error;
  return data as unknown as Acompanhamento;
}

const DIA = 864e5;
/** "2026-10-21" no fuso de Brasília. */
export const diaDe = (iso: string | number) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export interface Painel {
  total: number;
  hoje: number;
  unidades: { comInscritos: number; total: number };
  areas: { cobertas: number; total: number };
  comSegunda: number;
  mediaPorDia: number;
  faltamDias: number;
  meta: number | null;
  porDia: Array<{ dia: string; rotulo: string; n: number; hoje: boolean; futuro: boolean }>;
  porArea: Array<{ chave: string; rotulo: string; primeira: number; segunda: number }>;
  vazias: string[];
  porUnidade: Array<{ nome: string; n: number; cor: string; area: 'educacao' | 'social' }>;
  social: number;
  educacao: number;
  matriz: { colunas: Array<{ chave: string; rotulo: string }>; linhas: Array<{ nome: string; cor: string; valores: number[] }> };
  ultimas: Array<InscricaoAoVivo & { areas: string }>;
}

const CURTO: Record<string, string> = {
  cozinha: 'Cozinha', montagem: 'Montagem', recreacao_kids: 'Recreação', inflaveis: 'Infláveis', atividades_adultos: 'At. adultos',
  presentes_kids: 'Presentes', intercessao: 'Intercessão', limpeza_pre: 'Limp. pré', limpeza_durante: 'Limp. durante', limpeza_pos: 'Limp. pós', estacionamento: 'Estacion.',
};
export const rotuloCurto = (k: string) => CURTO[k] ?? rotuloDaAjuda(k);

export function calcularPainel(a: Acompanhamento, agora = Date.now()): Painel {
  const lista = a.inscricoes;
  const hojeDia = diaDe(agora);
  const nomesDasUnidades = UNIDADES_DO_VOLUNTARIADO.flatMap((g) => g.unidades.map((u) => ({ nome: u.name, area: g.area })));
  // As áreas do formulário, mais alguma tirada que alguém tenha escolhido antes.
  const areas = AREAS_DE_AJUDA.filter((x) => !AREAS_FORA_DO_FORMULARIO.includes(x.chave) || lista.some((i) => i.opcao1 === x.chave || i.opcao2 === x.chave));

  const porArea = areas.map((x) => ({ chave: x.chave as string, rotulo: x.rotulo, primeira: lista.filter((i) => i.opcao1 === x.chave).length, segunda: lista.filter((i) => i.opcao2 === x.chave).length }))
    .sort((p, q) => q.primeira - p.primeira || q.segunda - p.segunda || p.rotulo.localeCompare(q.rotulo, 'pt-BR'));
  const vazias = porArea.filter((x) => x.primeira === 0).map((x) => x.rotulo);

  // Unidades do formulário (com zero) e alguma de fora que já tenha inscrição.
  const unidades = [...nomesDasUnidades];
  for (const i of lista) if (!unidades.some((u) => u.nome === i.unidade_nome)) unidades.push({ nome: i.unidade_nome, area: i.area });
  const porUnidade = unidades.map((u) => ({ nome: u.nome, area: u.area, cor: corDaUnidade(u.nome), n: lista.filter((i) => i.unidade_nome === u.nome).length }))
    .sort((p, q) => q.n - p.n || p.nome.localeCompare(q.nome, 'pt-BR'));

  // Por dia: do primeiro dia com inscrição (ou hoje) até o último dia de inscrições.
  const fim = diaDe(PRAZO.getTime() - 1);
  const inicio = lista.length ? diaDe(lista[0].created_at) : hojeDia;
  const porDia: Painel['porDia'] = [];
  for (let t = new Date(`${inicio}T12:00:00-03:00`).getTime(); diaDe(t) <= fim && porDia.length < 60; t += DIA) {
    const d = diaDe(t);
    porDia.push({ dia: d, rotulo: d === hojeDia ? 'hoje' : `${d.slice(8, 10)}/${d.slice(5, 7)}`, n: lista.filter((i) => diaDe(i.created_at) === d).length, hoje: d === hojeDia, futuro: d > hojeDia });
  }
  const ultimos7 = porDia.filter((d) => !d.futuro).slice(-7);
  const mediaPorDia = ultimos7.length ? Math.round((ultimos7.reduce((s, d) => s + d.n, 0) / ultimos7.length) * 10) / 10 : 0;

  // Matriz: unidades com inscritos × áreas com alguém na 1ª opção.
  const colunas = porArea.filter((x) => x.primeira > 0).map((x) => ({ chave: x.chave, rotulo: rotuloCurto(x.chave) }));
  const linhas = porUnidade.filter((u) => u.n > 0).map((u) => ({ nome: u.nome, cor: u.cor, valores: colunas.map((c) => lista.filter((i) => i.unidade_nome === u.nome && i.opcao1 === c.chave).length) }));

  const ultimas = [...lista].sort((p, q) => q.created_at.localeCompare(p.created_at)).slice(0, 6)
    .map((i) => ({ ...i, areas: rotuloCurto(i.opcao1) + (i.opcao2 ? ` › ${rotuloCurto(i.opcao2)}` : '') }));

  return {
    total: lista.length,
    hoje: lista.filter((i) => diaDe(i.created_at) === hojeDia).length,
    // O total é a lista do formulário mais alguma de fora que já tenha inscrição.
    unidades: { comInscritos: porUnidade.filter((u) => u.n > 0).length, total: porUnidade.length },
    areas: { cobertas: porArea.length - vazias.length, total: porArea.length },
    comSegunda: lista.filter((i) => i.opcao2).length,
    mediaPorDia,
    faltamDias: Math.max(0, Math.ceil((PRAZO.getTime() - agora) / DIA)),
    meta: a.meta,
    porDia,
    porArea,
    vazias,
    porUnidade,
    social: lista.filter((i) => i.area === 'social').length,
    educacao: lista.filter((i) => i.area === 'educacao').length,
    matriz: { colunas, linhas },
    ultimas,
  };
}

/** "agora", "há 4 min", "há 2 h", "há 3 dias". */
export function haQuanto(iso: string, agora = Date.now()): string {
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

// --- No painel do Marketing ----------------------------------------------------------------

export interface ConfigDoAoVivo { codigo_acompanhamento: string; meta: number | null }

export async function lerConfig(): Promise<ConfigDoAoVivo | null> {
  const { data, error } = await supabase.from('voluntariado_config').select('codigo_acompanhamento, meta').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data as ConfigDoAoVivo | null;
}

export async function trocarCodigo(): Promise<string> {
  const { data, error } = await supabase.rpc('trocar_codigo_do_voluntariado');
  if (error) throw error;
  return String(data);
}

export async function definirMeta(meta: number | null): Promise<void> {
  const { error } = await supabase.rpc('definir_meta_do_voluntariado', { p_meta: meta });
  if (error) throw error;
}

export const linkDoAoVivo = (codigo: string) => `https://app.anabrasil.org${caminhoDoAoVivo(codigo)}`;

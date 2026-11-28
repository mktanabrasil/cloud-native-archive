import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVE_NEWS_UNITS, type NewsUnit } from '@/lib/news/units';
import { ESCRITORIO_ADM, areaDaUnidade, unidadeDaPizza } from '@/lib/pizza/modelo';
import { semAcento } from '@/lib/pizza/qr';
import { whatsappDoFormulario } from './central';
import type { AreaDeAjuda, Horario, Vinculo } from './modelo';

/**
 * Quem entrou sem o formulário (28/11/2026, a pedido): algumas pessoas foram
 * colocadas à mão na planilha da coordenação e no grupo geral do WhatsApp, e a
 * Central do Voluntário não as reconhecia. Três caminhos, todos no painel:
 *  1. "Adicionar voluntário": cadastro com protocolo, sem prazo nem meta;
 *  2. "Importar da planilha": colar as linhas da planilha do Google; entra
 *     quem ainda não tem protocolo (o que veio do formulário já está no banco);
 *  3. "Grupo geral": a lista de números do grupo; quem está só nela entra na
 *     Central e vê o cronograma e os avisos para todos.
 * O banco confere tudo de novo (SQL 20261128150000_voluntariado_sem_formulario).
 */

const db = supabase as unknown as SupabaseClient;

export type Origem = 'painel' | 'planilha';

export interface CadastroManual {
  nome: string;
  whatsapp: string;
  vinculo: Vinculo;
  opcao1: AreaDeAjuda;
  opcao2: AreaDeAjuda | null;
  horario: Horario | null;
  /** Só para funcionário(a): o id da unidade do app (ou o Escritório). */
  unidadeId: string | null;
}

/** Cadastra e devolve o protocolo sorteado (VL-XXXXX). */
export async function cadastrarManual(c: CadastroManual, origem: Origem = 'painel'): Promise<string> {
  const unidade = c.vinculo === 'funcionario' ? unidadeDaPizza(c.unidadeId) : undefined;
  if (c.vinculo === 'funcionario' && !unidade) throw new Error('unidade_invalida');
  const { data, error } = await db.rpc('cadastrar_voluntario_manual', {
    p_nome: c.nome.trim().replace(/\s+/g, ' '),
    p_whatsapp: whatsappDoFormulario(c.whatsapp),
    p_vinculo: c.vinculo,
    p_opcao1: c.opcao1,
    p_horario: c.horario,
    p_opcao2: c.opcao2,
    p_unidade_id: unidade?.id ?? null,
    p_unidade_nome: unidade?.name ?? null,
    p_area: unidade ? areaDaUnidade(unidade) : null,
    p_origem: origem,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

/** O motivo, para quem cadastra. */
export function mensagemDoCadastro(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/ja_inscrito/.test(t)) return 'Esse WhatsApp já está inscrito.';
  if (/whatsapp_invalido/.test(t)) return 'Confira o WhatsApp, com DDD.';
  if (/nome_invalido/.test(t)) return 'Escreva o nome completo.';
  if (/unidade_invalida/.test(t)) return 'Escolha a unidade de quem é funcionário(a).';
  if (/area_invalida/.test(t)) return 'Escolha a área.';
  if (/sem_permissao/.test(t)) return 'Só a comunicação e o ADM cadastram.';
  if (/cadastrar_voluntario_manual|schema cache|PGRST202/.test(t)) return 'O banco ainda não foi atualizado para o cadastro manual.';
  return 'Não deu para cadastrar. Tente de novo.';
}

// --- A planilha ---------------------------------------------------------------------------------

const normal = (s: string) => semAcento(s ?? '').replace(/[^a-z0-9]+/g, ' ').trim();

/** A área pelo que estiver escrito (a etiqueta da planilha, o nome do formulário ou parecido). */
export function areaDoTexto(texto: string): AreaDeAjuda | null {
  const t = normal(texto);
  if (!t) return null;
  const regras: Array<[RegExp, AreaDeAjuda]> = [
    [/cozinha|servimento|refeic/, 'cozinha'],
    [/montagem|desmontagem/, 'montagem'],
    [/decora/, 'decoracao'],
    [/limpeza/, 'limpeza_pre'],
    [/inflav|brinquedo/, 'inflaveis'],
    [/estac/, 'estacoes'],
    [/louvor/, 'louvor_kids'],
    [/recrea/, 'recreacao_kids'],
    [/presente/, 'presentes_kids'],
    [/ccii|idoso/, 'ccii'],
    [/atipic|autis/, 'atipicas'],
    [/(^| )som( |$)/, 'som'],
  ];
  return regras.find(([r]) => r.test(t))?.[1] ?? null;
}

export function horarioDoTexto(texto: string): Horario | null {
  const t = normal(texto);
  if (/anterior/.test(t)) return 'dia_anterior';
  if (/dia todo|integral/.test(t)) return 'dia_todo';
  if (/pos/.test(t)) return 'pos_evento';
  if (/manha/.test(t)) return 'manha';
  if (/tarde/.test(t)) return 'tarde';
  return null;
}

const UNIDADES: NewsUnit[] = [...ACTIVE_NEWS_UNITS, ESCRITORIO_ADM];

/** A unidade pelo nome (inteiro ou curto), como a planilha escreve. */
export function unidadeDoTexto(texto: string): NewsUnit | null {
  const t = normal(texto);
  if (!t) return null;
  return UNIDADES.find((u) => normal(u.name) === t) ?? UNIDADES.find((u) => normal(u.short) === t)
    ?? UNIDADES.find((u) => t.includes(normal(u.short)) && normal(u.short).length >= 3) ?? null;
}

export function vinculoDoTexto(texto: string, temUnidade: boolean): Vinculo {
  const t = normal(texto);
  if (/funcion/.test(t)) return 'funcionario';
  if (/alcance|jni|incc/.test(t)) return 'alcance';
  if (/volunt|comunidade/.test(t)) return 'comunidade';
  return temUnidade ? 'funcionario' : 'comunidade';
}

export const whatsappValidoParaCadastro = (t: string) => /^[1-9][0-9]{9,10}$/.test(whatsappDoFormulario(t));

export interface LinhaLida { linha: number; cadastro: CadastroManual }
export interface LinhaIgnorada { linha: number; nome: string; motivo: string }

/**
 * As linhas coladas da planilha "Voluntariado" (do Google: colunas separadas
 * por tabulação). A ordem das colunas é a da planilha da coordenação: Nome,
 * Área, Horário, WhatsApp, Vínculo, Unidade, 2ª opção, Indicado por, Igreja,
 * Protocolo, Quando, Acompanhantes. Quem tem protocolo veio do formulário e já
 * está no banco; quem já está inscrito (pelo WhatsApp) também fica de fora.
 */
export function linhasDaPlanilha(texto: string, jaInscritos: Iterable<string> = []): { entram: LinhaLida[]; ignoradas: LinhaIgnorada[] } {
  const inscritos = new Set([...jaInscritos].map(whatsappDoFormulario));
  const vistos = new Set<string>();
  const entram: LinhaLida[] = [];
  const ignoradas: LinhaIgnorada[] = [];
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1;
    if (!bruta.trim()) return;
    const c = bruta.split('\t').map((x) => x.trim());
    const [nome = '', area = '', horario = '', whatsapp = '', vinculo = '', unidade = '', opcao2 = '', , , protocolo = ''] = c;
    if (/^nome$/i.test(nome)) return; // o cabeçalho
    const ignora = (motivo: string) => ignoradas.push({ linha, nome: nome || '(sem nome)', motivo });
    if (/^VL-/i.test(protocolo)) return ignora('já tem protocolo: veio do formulário');
    if (nome.replace(/\s+/g, ' ').length < 3) return ignora('sem nome');
    if (!whatsappValidoParaCadastro(whatsapp)) return ignora('WhatsApp faltando ou incompleto');
    const tel = whatsappDoFormulario(whatsapp);
    if (inscritos.has(tel)) return ignora('esse WhatsApp já está inscrito');
    if (vistos.has(tel)) return ignora('WhatsApp repetido na lista');
    const opcao1 = areaDoTexto(area);
    if (!opcao1) return ignora(area ? `área "${area}" não reconhecida` : 'sem área');
    const u = unidadeDoTexto(unidade);
    const v = vinculoDoTexto(vinculo, !!u);
    if (v === 'funcionario' && !u) return ignora(unidade ? `unidade "${unidade}" não reconhecida` : 'funcionário(a) sem unidade');
    vistos.add(tel);
    const o2 = areaDoTexto(opcao2);
    entram.push({
      linha,
      cadastro: { nome: nome.replace(/\s+/g, ' '), whatsapp: tel, vinculo: v, opcao1, opcao2: o2 && o2 !== opcao1 ? o2 : null, horario: horarioDoTexto(horario), unidadeId: v === 'funcionario' ? u!.id : null },
    });
  });
  return { entram, ignoradas };
}

// --- O grupo geral -----------------------------------------------------------------------------

export interface NumeroDoGrupo { whatsapp: string; nome: string | null }

/**
 * Os números colados (um por linha, com ou sem nome, no formato que for: "+55 19
 * 99999-8888", "Maria · 19999998888"). O que sobra na linha vira o nome.
 */
export function numerosDoTexto(texto: string): NumeroDoGrupo[] {
  const vistos = new Map<string, NumeroDoGrupo>();
  for (const linha of texto.split(/\r?\n|;|,(?=\s*\+?\d)/)) {
    const m = linha.match(/\+?\(?\d[\d\s().-]{8,}\d/);
    if (!m) continue;
    const tel = whatsappDoFormulario(m[0]);
    if (!/^[1-9][0-9]{9,10}$/.test(tel)) continue;
    const nome = linha.replace(m[0], '').replace(/[·|:–()-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!vistos.has(tel)) vistos.set(tel, { whatsapp: tel, nome: nome.length >= 2 ? nome.slice(0, 120) : null });
  }
  return [...vistos.values()];
}

export interface EstadoDoGrupo { total: number; atualizadoEm: string | null }

export async function lerGrupo(): Promise<EstadoDoGrupo> {
  const { data, count, error } = await db.from('voluntariado_grupo').select('atualizado_em', { count: 'exact' }).order('atualizado_em', { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return { total: count ?? 0, atualizadoEm: (data?.[0] as { atualizado_em?: string } | undefined)?.atualizado_em ?? null };
}

/** Troca a lista inteira; devolve quantos números ficaram. */
export async function substituirGrupo(lista: NumeroDoGrupo[]): Promise<number> {
  const { data, error } = await db.rpc('substituir_grupo_do_voluntariado', { p_lista: lista });
  if (error) throw new Error(error.message);
  return Number(data);
}

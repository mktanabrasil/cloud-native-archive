import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AlteracaoDoCalendario, AnoDoCalendario, FolhaExtra, ItemDoCalendario, Percurso } from './regras';

/**
 * O Calendário Anual no banco (14/11/2026). As tabelas são novas e ainda não
 * estão nos tipos gerados; por isso o cliente sem tipo aqui, com os tipos à
 * mão em `regras.ts`. Quem decide o que cada um lê e grava é o banco (RLS e
 * os gatilhos de guarda da migração 20261114100000).
 */
const db = supabase as unknown as SupabaseClient;

/** O ano em preenchimento agora. */
export const ANO_DO_CALENDARIO = 2027;


const falhou = (error: { message?: string } | null) => { if (error) throw error; };

/**
 * Todas as colunas da atividade (13/11/2026), inclusive a autoria. Com `*`, a
 * tela não quebra se o app subir antes do SQL que cria as colunas novas.
 */
const COLUNAS_DO_ITEM = '*';

/** O balde privado da capa e do PDF aprovado (migração 20261114160000). */
export const BALDE_DO_CALENDARIO = 'calendario-anual';

export async function lerAno(ano: number): Promise<AnoDoCalendario | null> {
  const { data, error } = await db.from('calendario_anual').select('*').eq('ano', ano).maybeSingle();
  falhou(error);
  return (data as AnoDoCalendario | null) ?? null;
}

export async function lerItens(ano: number): Promise<ItemDoCalendario[]> {
  const { data, error } = await db.from('calendario_itens').select(COLUNAS_DO_ITEM).eq('ano', ano).order('dia').order('criado_em');
  falhou(error);
  return (data as ItemDoCalendario[]) ?? [];
}

/**
 * As mudanças no mês a mês depois da impressão (19/11/2026). Sem o SQL do
 * fichário (20261120090000) a tabela não existe: devolve vazio em vez de
 * quebrar a tela.
 */
export async function lerAlteracoes(ano: number): Promise<AlteracaoDoCalendario[]> {
  const { data, error } = await db.from('calendario_alteracoes').select('*').eq('ano', ano).order('em');
  if (error) return [];
  return (data as AlteracaoDoCalendario[]) ?? [];
}

/* ---------- as folhas extras (19/11/2026; SQL 20261120100000) ---------- */

/** Sem o SQL das folhas extras a tabela não existe: devolve vazio em vez de quebrar a tela. */
export async function lerFolhasExtras(ano: number): Promise<FolhaExtra[]> {
  const { data, error } = await db.from('calendario_folhas_extras').select('*').eq('ano', ano).order('criado_em');
  if (error) return [];
  return (data as FolhaExtra[]) ?? [];
}

type CamposDaFolha = Pick<FolhaExtra, 'titulo' | 'depois_do_mes' | 'unidades' | 'texto' | 'pauta'>;

export async function criarFolhaExtra(ano: number, campos: CamposDaFolha): Promise<FolhaExtra> {
  const { data, error } = await db.from('calendario_folhas_extras').insert({ ano, ...campos }).select('*').single();
  falhou(error);
  return data as FolhaExtra;
}

export async function salvarFolhaExtra(id: string, campos: CamposDaFolha): Promise<FolhaExtra> {
  const { data, error } = await db.from('calendario_folhas_extras').update(campos).eq('id', id).select('*').maybeSingle();
  falhou(error);
  if (!data) throw Object.assign(new Error('Só quem criou a folha (ou o marketing) pode mudá-la.'), { code: '42501' });
  return data as FolhaExtra;
}

export async function apagarFolhaExtra(id: string): Promise<void> {
  const { data, error } = await db.from('calendario_folhas_extras').delete().eq('id', id).select('id');
  falhou(error);
  if (!data?.length) throw Object.assign(new Error('Só quem criou a folha (ou o marketing) pode apagá-la.'), { code: '42501' });
}

export async function salvarAno(ano: number, campos: Partial<Pick<AnoDoCalendario, 'tema' | 'percursos' | 'meses_revisados' | 'textos'>>): Promise<AnoDoCalendario> {
  const { data, error } = await db.from('calendario_anual').update(campos).eq('ano', ano).select('*').maybeSingle();
  falhou(error);
  // O banco filtra em silêncio quando não pode (fora do preenchimento): zero linhas.
  if (!data) throw Object.assign(new Error('O calendário não está aberto para edição agora.'), { code: '42501' });
  return data as AnoDoCalendario;
}

export async function acrescentarItem(item: { ano: number; dia: string; texto: string; unidades: string[]; destaque: boolean }): Promise<ItemDoCalendario> {
  const { data, error } = await db.from('calendario_itens').insert({ ...item, tipo: 'atividade' }).select(COLUNAS_DO_ITEM).single();
  falhou(error);
  return data as ItemDoCalendario;
}

export async function editarItem(id: string, campos: Partial<Pick<ItemDoCalendario, 'texto' | 'unidades' | 'destaque' | 'oculto'>>): Promise<ItemDoCalendario> {
  const { data, error } = await db.from('calendario_itens').update(campos).eq('id', id).select(COLUNAS_DO_ITEM).maybeSingle();
  falhou(error);
  if (!data) throw Object.assign(new Error('Não foi possível alterar este item agora.'), { code: '42501' });
  return data as ItemDoCalendario;
}

export async function apagarItem(id: string): Promise<void> {
  const { data, error } = await db.from('calendario_itens').delete().eq('id', id).select('id');
  falhou(error);
  if (!data?.length) throw Object.assign(new Error('Não foi possível apagar este item agora.'), { code: '42501' });
}

/** O acesso de quem está logado (o banco só devolve a própria linha a quem não é do marketing). */
/* ---------- envio, revisão e aprovação (13/11/2026) ---------- */

async function mudarAno(ano: number, campos: Record<string, unknown>, aviso: string): Promise<AnoDoCalendario> {
  const { data, error } = await db.from('calendario_anual').update(campos).eq('ano', ano).select('*').maybeSingle();
  falhou(error);
  if (!data) throw Object.assign(new Error(aviso), { code: '42501' });
  return data as AnoDoCalendario;
}

/** A coordenadora envia: o banco anota quem e quando, e fecha a edição para elas. */
export const enviarAoMarketing = (ano: number) =>
  mudarAno(ano, { status: 'revisao' }, 'Não deu para enviar agora: o calendário não está em preenchimento.');

/** O marketing devolve (ou reabre depois de aprovado), com uma observação que aparece para elas. */
export const devolverAsCoordenadoras = (ano: number, observacao: string | null) =>
  mudarAno(ano, { status: 'preenchimento', observacao: observacao?.trim() || null }, 'Só o marketing devolve o calendário.');

/** Link temporário para um arquivo do balde; com `baixarComo`, o navegador baixa com esse nome. */
export async function linkDoArquivo(caminho: string, baixarComo?: string, segundos = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(BALDE_DO_CALENDARIO).createSignedUrl(caminho, segundos, baixarComo ? { download: baixarComo } : undefined);
  falhou(error);
  if (!data?.signedUrl) throw new Error('Não deu para abrir o arquivo agora.');
  return data.signedUrl;
}

async function guardarArquivo(caminho: string, arquivo: Blob, tipo: string) {
  const { error } = await supabase.storage.from(BALDE_DO_CALENDARIO).upload(caminho, arquivo, { contentType: tipo, upsert: false });
  falhou(error);
}

async function jogarFora(caminho: string | null | undefined, menos: string) {
  if (caminho && caminho !== menos) await supabase.storage.from(BALDE_DO_CALENDARIO).remove([caminho]);
}

/** O marketing troca a foto da capa; a anterior sai do balde. */
export async function trocarCapa(ano: AnoDoCalendario, foto: Blob, extensao: 'jpg' | 'png' | 'webp'): Promise<AnoDoCalendario> {
  const caminho = `${ano.ano}/capa-${crypto.randomUUID()}.${extensao}`;
  await guardarArquivo(caminho, foto, extensao === 'jpg' ? 'image/jpeg' : `image/${extensao}`);
  const novo = await mudarAno(ano.ano, { capa_url: caminho }, 'Só o marketing troca a foto da capa.');
  await jogarFora(ano.capa_url, caminho).catch(() => {});
  return novo;
}

/** O marketing aprova: o PDF final vai para o balde e o calendário fica aprovado. */
export async function aprovarComPdf(ano: AnoDoCalendario, pdf: Blob, quem: string): Promise<AnoDoCalendario> {
  const caminho = `${ano.ano}/calendario-anual-${ano.ano}-${Date.now()}.pdf`;
  await guardarArquivo(caminho, pdf, 'application/pdf');
  const novo = await mudarAno(ano.ano, { status: 'aprovado', aprovado_em: new Date().toISOString(), aprovado_por: quem, pdf_url: caminho, observacao: null }, 'Só o marketing aprova o calendário.');
  // A versão impressa (19/11/2026) nunca sai do balde: só o PDF de uma reaprovação
  // anterior. Sem o SQL do fichário (coluna ausente), na dúvida não apaga nada.
  if ('pdf_impresso_url' in novo && ano.pdf_url !== novo.pdf_impresso_url) await jogarFora(ano.pdf_url, caminho).catch(() => {});
  return novo;
}

export type { AnoDoCalendario, ItemDoCalendario, Percurso };

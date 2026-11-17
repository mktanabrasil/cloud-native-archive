import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { ConteudoDoSemanario, Semanario } from './regras';

/**
 * O Semanário no banco (17/11/2026). A tabela é nova e ainda não está nos
 * tipos gerados; por isso o cliente sem tipo, com os tipos à mão em
 * `regras.ts`. Quem lê e grava o quê é o banco que decide (RLS e o gatilho
 * `semanarios_guarda` da migração 20261117160000): a professora só a dela, a
 * orientadora só a devolutiva da unidade dela, o marketing só lê.
 */
const db = supabase as unknown as SupabaseClient;
const TABELA = 'semanarios';

/** O agrupamento vai sem espaço nas pontas (o banco também apara). */
const aparar = (c: Partial<ConteudoDoSemanario>) =>
  (c.agrupamento === undefined ? c : { ...c, agrupamento: c.agrupamento.trim() });

const falhou = (error: { message?: string } | null) => { if (error) throw error; };

/** Os semanários da professora logada, do mais novo para o mais antigo. */
export async function lerMeus(professoraId: string): Promise<Semanario[]> {
  const { data, error } = await db.from(TABELA).select('*').eq('professora_id', professoraId).order('semana', { ascending: false }).order('agrupamento');
  falhou(error);
  return (data as Semanario[]) ?? [];
}

/**
 * Os semanários que a pessoa logada pode ler numa semana: a orientadora vê os
 * da unidade dela; o marketing, todos (a RLS filtra).
 */
export async function lerDaSemana(semana: string, unidade?: string): Promise<Semanario[]> {
  let consulta = db.from(TABELA).select('*').eq('semana', semana);
  if (unidade) consulta = consulta.eq('unidade', unidade);
  const { data, error } = await consulta.order('unidade').order('professora_nome').order('agrupamento');
  falhou(error);
  return (data as Semanario[]) ?? [];
}

export async function lerUm(id: string): Promise<Semanario | null> {
  const { data, error } = await db.from(TABELA).select('*').eq('id', id).maybeSingle();
  falhou(error);
  return (data as Semanario | null) ?? null;
}

/** Cria o semanário da semana. O banco põe a professora, a unidade e o nome. */
export async function criar(semana: string, conteudo: Partial<ConteudoDoSemanario> = {}): Promise<Semanario> {
  const { data, error } = await db.from(TABELA).insert({ semana, ...aparar(conteudo) }).select('*').single();
  falhou(error);
  return data as Semanario;
}

/** Grava o conteúdo. Depois do envio, o banco só aceita a avaliação. */
export async function salvar(id: string, conteudo: Partial<ConteudoDoSemanario>): Promise<Semanario> {
  const { data, error } = await db.from(TABELA).update(aparar(conteudo)).eq('id', id).select('*').single();
  falhou(error);
  return data as Semanario;
}

/** Envia para a orientadora (grava o conteúdo junto, se vier). */
export async function enviar(id: string, conteudo: Partial<ConteudoDoSemanario> = {}): Promise<Semanario> {
  const { data, error } = await db.from(TABELA).update({ ...aparar(conteudo), status: 'enviado' }).eq('id', id).select('*').single();
  falhou(error);
  return data as Semanario;
}

/** Volta para preenchimento; o banco só deixa enquanto não houver devolutiva. */
export async function desfazerEnvio(id: string): Promise<Semanario> {
  const { data, error } = await db.from(TABELA).update({ status: 'preenchimento' }).eq('id', id).select('*').single();
  falhou(error);
  return data as Semanario;
}

/** A devolutiva da orientadora. Texto vazio apaga a devolutiva. */
export async function darDevolutiva(id: string, devolutiva: string): Promise<Semanario> {
  const { data, error } = await db.from(TABELA).update({ devolutiva }).eq('id', id).select('*');
  falhou(error);
  // A RLS esconde o que ela não pode mudar: sem linha de volta, não gravou.
  const linha = (data as Semanario[] | null)?.[0];
  if (!linha) throw new Error('Este semanário não está mais com você: o vínculo de orientação mudou, ou ele não existe mais.');
  return linha;
}

/** Apaga um semanário ainda em preenchimento (só a própria professora). */
export async function apagar(id: string): Promise<void> {
  // A RLS esconde o que não se pode apagar: sem linha de volta, não apagou.
  const { data, error } = await db.from(TABELA).delete().eq('id', id).select('id');
  falhou(error);
  if (!data?.length) throw new Error('Só dá para apagar um semanário seu ainda em preenchimento.');
}

import { supabase } from '@/integrations/supabase/client';

/**
 * Modelos de e-mail do Trabalhe Conosco (passo 7 do roteiro, decisões de
 * 21/10/2026): o RH reescreve o assunto, o título e o texto de cada e-mail;
 * a identidade (logo, botão, fio de cores, quadros do protocolo e da
 * entrevista) é fixa. Os campos entre chaves são trocados na hora de mandar,
 * pela função candidatura-confirmacao, com a mesma regra de `preencher`.
 */

export type ChaveDoModelo = 'confirmacao' | 'analise' | 'entrevista' | 'aprovado' | 'nao_selecionado' | 'convite' | 'pergunta' | 'recado' | 'responsavel';

export interface InfoDoModelo { chave: ChaveDoModelo; nome: string; quando: string; para: 'candidato' | 'equipe'; campos: string[]; botao: string }

const BASE = ['nome', 'vaga'];
export const MODELOS: InfoDoModelo[] = [
  { chave: 'confirmacao', nome: 'Candidatura recebida', quando: 'ao enviar a candidatura', para: 'candidato', campos: [...BASE, 'protocolo', 'data'], botao: 'Acompanhar candidatura' },
  { chave: 'analise', nome: 'Em análise', quando: 'ao mover para Análise', para: 'candidato', campos: [...BASE, 'protocolo'], botao: 'Acompanhar candidatura' },
  { chave: 'entrevista', nome: 'Entrevista', quando: 'ao mover para Entrevista', para: 'candidato', campos: [...BASE, 'protocolo'], botao: 'Acompanhar candidatura' },
  { chave: 'aprovado', nome: 'Aprovado(a)', quando: 'resultado', para: 'candidato', campos: [...BASE, 'protocolo'], botao: 'Acompanhar candidatura' },
  { chave: 'nao_selecionado', nome: 'Não selecionado(a)', quando: 'resultado', para: 'candidato', campos: [...BASE, 'protocolo'], botao: 'Acompanhar candidatura' },
  { chave: 'convite', nome: 'Convite para entrevista', quando: 'mensagem da ficha', para: 'candidato', campos: [...BASE, 'mensagem'], botao: 'Confirmar presença' },
  { chave: 'pergunta', nome: 'Pedir informação', quando: 'mensagem da ficha', para: 'candidato', campos: [...BASE, 'mensagem'], botao: 'Responder no app' },
  { chave: 'recado', nome: 'Mensagem livre', quando: 'mensagem da ficha', para: 'candidato', campos: [...BASE, 'mensagem'], botao: 'Abrir no app' },
  { chave: 'responsavel', nome: 'Responsável nomeado', quando: 'para a equipe', para: 'equipe', campos: [...BASE, 'codigo', 'prazo'], botao: 'Abrir o processo' },
];

export const DESCRICAO_DO_CAMPO: Record<string, string> = {
  nome: 'primeiro nome', vaga: 'título da vaga', protocolo: 'protocolo da candidatura', data: 'data e hora do envio',
  mensagem: 'o texto que o RH escreveu na ficha', codigo: 'código da vaga', prazo: 'prazo do processo',
};

/** Os valores da prévia e do "Mandar teste para mim". */
export const EXEMPLO: Record<string, string> = {
  nome: 'Leonardo', vaga: 'Educador Social de Música', protocolo: '2026-000418', data: '21/10/2026 09:42',
  mensagem: 'Olá, Leonardo! Sua entrevista será no dia 24/10, às 14:00, na Sede. Leve um documento com foto.',
  codigo: 'SOC-2026-031', prazo: '30/11/2026',
};

/** Troca {campo} pelo valor; campo desconhecido fica como está. Mesma regra da função do servidor. */
export const preencher = (t: string, valores: Record<string, string>) => t.replace(/\{([a-z_]+)\}/g, (todo, c: string) => (c in valores ? valores[c] : todo));

/** Os parágrafos do texto (linha em branco ou quebra separa). */
export const paragrafos = (t: string) => t.split(/\n+/).map((p) => p.trim()).filter(Boolean);

export interface Modelo { chave: ChaveDoModelo; assunto: string; titulo: string; texto: string; padrao_assunto: string; padrao_titulo: string; padrao_texto: string; atualizado_por: string | null; atualizado_em: string | null }
export interface Versao { id: number; chave: ChaveDoModelo; assunto: string; titulo: string; texto: string; por: string | null; em: string }

export const editado = (m: Pick<Modelo, 'assunto' | 'titulo' | 'texto' | 'padrao_assunto' | 'padrao_titulo' | 'padrao_texto'>) =>
  m.assunto !== m.padrao_assunto || m.titulo !== m.padrao_titulo || m.texto !== m.padrao_texto;

/** O que impede salvar; null quando está tudo certo. */
export function problemaDoModelo(info: InfoDoModelo, m: { assunto: string; titulo: string; texto: string }): string | null {
  if (!m.assunto.trim()) return 'Escreva o assunto.';
  if (!m.titulo.trim()) return 'Escreva o título.';
  if (!m.texto.trim()) return 'Escreva o texto.';
  if (m.assunto.length > 150 || m.titulo.length > 150) return 'Assunto e título vão até 150 letras.';
  if (m.texto.length > 2000) return 'O texto vai até 2.000 letras.';
  const usados = [...`${m.assunto} ${m.titulo} ${m.texto}`.matchAll(/\{([^}]*)\}/g)].map((x) => x[1]);
  const estranho = usados.find((c) => !info.campos.includes(c));
  if (estranho !== undefined) return `O campo {${estranho}} não existe neste e-mail. Use só: ${info.campos.map((c) => `{${c}}`).join(', ')}.`;
  if (info.campos.includes('mensagem') && !m.texto.includes('{mensagem}')) return 'O texto precisa ter {mensagem}: é onde entra o que o RH escreveu na ficha.';
  return null;
}

export async function listarModelos(): Promise<Modelo[]> {
  const { data, error } = await supabase.from('email_modelos').select('*');
  if (error) throw error;
  const ordem = MODELOS.map((m) => m.chave);
  return ((data ?? []) as Modelo[]).sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
}

export async function versoesDo(chave: ChaveDoModelo): Promise<Versao[]> {
  const { data, error } = await supabase.from('email_modelos_versoes').select('*').eq('chave', chave).order('em', { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []) as Versao[];
}

export async function salvarModelo(chave: ChaveDoModelo, m: { assunto: string; titulo: string; texto: string }): Promise<void> {
  const { error } = await supabase.rpc('salvar_email_modelo', { p_chave: chave, p_assunto: m.assunto, p_titulo: m.titulo, p_texto: m.texto });
  if (error) throw error;
}

/** Manda a prévia (com os valores de exemplo) para o e-mail de quem está editando. */
export async function mandarTeste(chave: ChaveDoModelo, m: { assunto: string; titulo: string; texto: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('candidatura-confirmacao', { body: { teste_modelo: { chave, ...m } } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  return String((data as { para?: string })?.para ?? '');
}

import { supabase } from '@/integrations/supabase/client';
import { UNIDADES } from '../../../supabase/functions/noticias/regras.ts';

/**
 * Marketing › Notícias (25/11/2026): o que o painel pede à função `noticias`.
 * Tudo mora no Drive (Setor Marketing › Blog ANA Brasil › unidade › ano ›
 * post); fotos e vídeos vão do navegador direto para lá, por um envio que a
 * função abre (nada passa pelo servidor).
 */

/** As unidades, na ordem do seletor, pelo endereço (slug) que a API usa. */
const TODAS_AS_UNIDADES = Object.values(UNIDADES).map((u) => ({ slug: u.slug, nome: u.nome }));
/**
 * Fora das notícias novas (26/11/2026): o Ana Oziel e o GOE. As notícias antigas
 * do GOE continuam no site e, se abertas no editor, mostram a unidade delas.
 */
export const UNIDADES_FORA_DAS_NOTICIAS = new Set(['ana-oziel', 'grupo-de-oracao-esperanca']);
/** As unidades que o editor oferece (só as ativas). */
export const UNIDADES_DAS_NOTICIAS = TODAS_AS_UNIDADES.filter((u) => !UNIDADES_FORA_DAS_NOTICIAS.has(u.slug));
/** As ativas e, se a notícia já tiver alguma das que saíram, essas também (para não sumir ao editar). */
export const unidadesParaOEditor = (jaUsadas: string[]) =>
  TODAS_AS_UNIDADES.filter((u) => !UNIDADES_FORA_DAS_NOTICIAS.has(u.slug) || jaUsadas.includes(u.slug));
export const nomeDaUnidade = (slug: string | null | undefined) => TODAS_AS_UNIDADES.find((u) => u.slug === slug)?.nome ?? slug ?? '';
/** Cor de cada unidade (a mesma bolinha do mockup aprovado). */
export const COR_DA_UNIDADE: Record<string, string> = {
  'ana-dic': '#01adff', 'ana-jardim-nilopolis': '#81e2cf', 'ana-piaui': '#fbce00', 'ana-jardim-santana': '#f37964',
  'aninha-cancela': '#f5dfba', 'grupo-de-oracao-esperanca': '#c9b6f0', institucional: '#d7d7d2', 'ana-oziel': '#8fd16a',
};

export interface NoticiaNaLista {
  pasta_id: string;
  slug: string | null;
  erro: string | null;
  lendo: boolean;
  titulo: string;
  data: string | null;
  data_hora: string | null;
  unidade: string | null;
  unidades: string[];
  publicado: boolean;
  na_lista: boolean;
  fixada: boolean;
  capa: string | null;
  fotos: number;
  videos: number;
}

export interface MidiaDoPainel {
  tipo: 'foto' | 'video';
  chave: string;
  nome: string;
  w: number | null;
  h: number | null;
  duracao: number | null;
  alt: string;
  mini: string;
  tela: string;
  original: string;
}

export interface NoticiaDoPainel {
  pasta_id: string;
  pasta_nome: string;
  slug: string | null;
  erro: string | null;
  atualizado_em: string | null;
  endereco_no_site: string | null;
  /** Fotos e vídeos já enviados ao Drive e ainda não salvos na notícia (o site não mostra). */
  enviados: MidiaDoPainel[];
  /** O salvar deixou a releitura para o ciclo (até 2 minutos); a tela fica com o que mandou. */
  relendo?: boolean;
  /** O Drive ainda está sendo relido para esta notícia (um salvar adiou a releitura, ou o ciclo viu mudança). */
  lendo?: boolean;
  dados: {
    titulo: string;
    data: string;
    data_hora: string;
    unidade: string;
    unidades: string[];
    texto: string[];
    capa: MidiaDoPainel | null;
    midias: MidiaDoPainel[];
    na_lista: boolean;
    fixada: boolean;
    publicado: boolean;
  } | null;
}

export interface PedidoDeSalvar {
  pasta_id?: string;
  /** Notícia nova: o mesmo código em todas as tentativas, para o salvar repetido não criar outra pasta. */
  novo_id?: string;
  titulo: string;
  data: string;
  hora?: string;
  unidade: string;
  unidades: string[];
  texto: string[];
  na_lista: boolean;
  fixada: boolean;
  publicado: boolean;
  capa: string | null;
  ordem: string[];
  videos: string[];
  remover: string[];
  descricoes: Record<string, string>;
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('noticias', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const listaDoPainel = () => chamar<{ noticias: NoticiaNaLista[]; base: string }>({ acao: 'lista' });
export const noticiaDoPainel = (pasta_id: string) => chamar<NoticiaDoPainel>({ acao: 'noticia', pasta_id });
export const salvarNoticia = (p: PedidoDeSalvar) => chamar<NoticiaDoPainel>({ acao: 'salvar', ...p });
export const excluirNoticia = (pasta_id: string) => chamar<{ ok: true }>({ acao: 'excluir', pasta_id });
export const envioConcluido = (pasta_id: string) => chamar<NoticiaDoPainel>({ acao: 'envio_concluido', pasta_id });
const iniciarEnvio = (pasta_id: string, f: File) =>
  chamar<{ url: string; nome: string }>({ acao: 'iniciar_envio', pasta_id, nome: f.name, mime: tipoDoArquivo(f), tamanho: f.size });

/** O tipo do arquivo; o HEIC do iPhone às vezes chega sem tipo. */
export function tipoDoArquivo(f: File): string {
  if (f.type) return f.type;
  const ext = f.name.toLowerCase().split('.').pop();
  return ({ heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' } as Record<string, string>)[ext ?? ''] ?? '';
}

/** Manda um arquivo direto para o Drive, com o progresso (0 a 1). */
export async function enviarArquivo(pasta_id: string, f: File, progresso: (p: number) => void): Promise<void> {
  const { url } = await iniciarEnvio(pasta_id, f);
  await new Promise<void>((ok, falhou) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', tipoDoArquivo(f));
    x.upload.onprogress = (e) => { if (e.lengthComputable) progresso(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : falhou(new Error(`O envio de "${f.name}" falhou (${x.status}).`)));
    x.onerror = () => falhou(new Error(`O envio de "${f.name}" caiu. Confira a internet e tente de novo.`));
    x.send(f);
  });
}

/** O texto do campo vira parágrafos: uma linha em branco separa. */
export const paragrafosDe = (texto: string) => texto.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
export const textoDe = (paragrafos: string[]) => paragrafos.join('\n\n');

/** Para a busca da lista: sem acento, minúsculo. */
export const semAcento = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const dataBR = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

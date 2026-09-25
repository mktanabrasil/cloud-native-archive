/**
 * Vagas do Trabalhe Conosco (fase 1, Parte 14 aprovada em 25/09/2026).
 *
 * O RH publica aqui e o site embute a vitrine. A vaga não tem unidade: área e
 * cidade bastam, e o RH define a unidade no processo. Sem prazo por padrão,
 * como hoje. Tudo fica no banco: `vagas` e `perguntas_de_vaga`.
 *
 * Aqui é o modelo e o que dá para calcular sem tocar no banco.
 */

export const AREAS = ['social', 'educacao', 'administracao'] as const;
export type Area = (typeof AREAS)[number];

export const ROTULO_DA_AREA: Record<Area, string> = {
  social: 'Social',
  educacao: 'Educação',
  administracao: 'Administração',
};

/** O prefixo do código da vaga: SOC-2026-031. */
export const PREFIXO_DA_AREA: Record<Area, string> = {
  social: 'SOC',
  educacao: 'EDU',
  administracao: 'ADM',
};

export const MODALIDADES = ['presencial', 'hibrido', 'remoto'] as const;
export type Modalidade = (typeof MODALIDADES)[number];
export const ROTULO_DA_MODALIDADE: Record<Modalidade, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
};

export const CONTRATACOES = ['clt', 'estagio', 'aprendiz', 'pj', 'temporario', 'voluntario'] as const;
export type Contratacao = (typeof CONTRATACOES)[number];
export const ROTULO_DA_CONTRATACAO: Record<Contratacao, string> = {
  clt: 'CLT',
  estagio: 'Estágio',
  aprendiz: 'Jovem Aprendiz',
  pj: 'PJ',
  temporario: 'Temporário',
  voluntario: 'Voluntário',
};

/** O ciclo de vida, na ordem em que a vaga costuma passar. */
export const STATUS_DA_VAGA = ['rascunho', 'revisao', 'publicada', 'pausada', 'encerrada', 'arquivada'] as const;
export type StatusDaVaga = (typeof STATUS_DA_VAGA)[number];
export const ROTULO_DO_STATUS: Record<StatusDaVaga, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  publicada: 'Publicada',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
  arquivada: 'Arquivada',
};

/** Para onde cada status pode ir. Arquivada é o fim; volta só por reabertura como rascunho. */
export const PROXIMOS_STATUS: Record<StatusDaVaga, readonly StatusDaVaga[]> = {
  rascunho: ['revisao', 'publicada', 'arquivada'],
  revisao: ['rascunho', 'publicada', 'arquivada'],
  publicada: ['pausada', 'encerrada'],
  pausada: ['publicada', 'encerrada'],
  encerrada: ['publicada', 'arquivada'],
  arquivada: ['rascunho'],
};

export const podeIrPara = (de: StatusDaVaga, para: StatusDaVaga): boolean => PROXIMOS_STATUS[de].includes(para);

export const TIPOS_DE_PERGUNTA = ['texto_curto', 'texto_longo', 'unica', 'multipla', 'sim_nao'] as const;
export type TipoDePergunta = (typeof TIPOS_DE_PERGUNTA)[number];

export interface Vaga {
  id: string;
  slug: string;
  codigo: string;
  titulo: string;
  area: Area;
  cidade: string;
  modalidade: Modalidade;
  contratacao: Contratacao;
  carga_horaria: string;
  descricao: string;
  responsabilidades: string[];
  requisitos: string[];
  diferenciais: string[];
  beneficios: string[];
  complementares: string;
  afirmativa_pcd: boolean;
  aberta_pcd: boolean;
  aprendizagem: boolean;
  status: StatusDaVaga;
  publicada_em: string | null;
  encerrada_em: string | null;
  /** ISO. Nulo: sem prazo, fica aberta até o RH encerrar. */
  prazo: string | null;
  /** O Forms atual da vaga; sai na fase 2. */
  link_externo: string | null;
  responsavel_id: string | null;
  versao: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerguntaDeVaga {
  id: string;
  /** Nulo: pergunta do banco, reaproveitável. */
  vaga_id: string | null;
  texto: string;
  tipo: TipoDePergunta;
  opcoes: string[];
  obrigatoria: boolean;
  ordem: number;
  bloqueada: boolean;
}

export const LIMITES = { titulo: { min: 3, max: 120 }, pergunta: { min: 3, max: 300 } } as const;

/** "Educador Social de Música" → "educador-social-de-musica", no formato que o banco aceita. */
export function slugDaVaga(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** O slug livre mais próximo: acrescenta -2, -3… se já existir. */
export function slugLivre(titulo: string, existentes: Iterable<string>): string {
  const base = slugDaVaga(titulo) || 'vaga';
  const usados = new Set(existentes);
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** SOC-2026-031: prefixo da área, ano e número com três dígitos (ou mais). */
export function codigoDaVaga(area: Area, ano: number, numero: number): string {
  return `${PREFIXO_DA_AREA[area]}-${ano}-${String(numero).padStart(3, '0')}`;
}

const CODIGO = /^(SOC|EDU|ADM)-(\d{4})-(\d{3,})$/;

/** O próximo código da área no ano, a partir dos que já existem. */
export function proximoCodigo(area: Area, ano: number, existentes: Iterable<string>): string {
  const prefixo = PREFIXO_DA_AREA[area];
  let maior = 0;
  for (const c of existentes) {
    const m = CODIGO.exec(c);
    if (m && m[1] === prefixo && Number(m[2]) === ano) maior = Math.max(maior, Number(m[3]));
  }
  return codigoDaVaga(area, ano, maior + 1);
}

/** A vaga aparece na vitrine: publicada e, se tiver prazo, antes dele. Igual à política do banco. */
export function estaNaVitrine(v: Pick<Vaga, 'status' | 'prazo'>, agora: Date = new Date()): boolean {
  return v.status === 'publicada' && (v.prazo === null || new Date(v.prazo) > agora);
}

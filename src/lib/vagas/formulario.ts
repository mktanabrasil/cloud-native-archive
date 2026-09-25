import type { DadosDaVaga, NovaPergunta } from './api';
import { LIMITES, proximoCodigo, slugLivre, type Area, type Contratacao, type Modalidade, type PerguntaDeVaga, type StatusDaVaga, type Vaga } from './modelo';
import { procurarTermos, type Achado } from './termos';

/**
 * O formulário da vaga em passos (tela 32), sem tocar no banco: o que cada
 * passo exige, o que barra a publicação e como vira a linha da tabela.
 */

export const PASSOS = ['Básico', 'Descrição', 'Requisitos', 'Benefícios', 'Perguntas', 'Revisão'] as const;

export interface FormularioDaVaga {
  titulo: string;
  area: Area | '';
  cidade: string;
  modalidade: Modalidade;
  contratacao: Contratacao;
  carga_horaria: string;
  afirmativa_pcd: boolean;
  aberta_pcd: boolean;
  aprendizagem: boolean;
  descricao: string;
  responsabilidades: string[];
  requisitos: string[];
  diferenciais: string[];
  beneficios: string[];
  complementares: string;
  link_externo: string;
  /** "2026-10-30" ou vazio (sem prazo). */
  prazo: string;
  perguntas: NovaPergunta[];
}

export const FORMULARIO_VAZIO: FormularioDaVaga = {
  titulo: '', area: '', cidade: 'Campinas/SP', modalidade: 'presencial', contratacao: 'clt', carga_horaria: '',
  afirmativa_pcd: false, aberta_pcd: true, aprendizagem: false,
  descricao: '', responsabilidades: [], requisitos: [], diferenciais: [],
  beneficios: ['Vale-transporte', 'Refeição na unidade'], complementares: '', link_externo: '', prazo: '', perguntas: [],
};

export function formularioDaVaga(v: Vaga, perguntas: PerguntaDeVaga[]): FormularioDaVaga {
  return {
    titulo: v.titulo, area: v.area, cidade: v.cidade, modalidade: v.modalidade, contratacao: v.contratacao, carga_horaria: v.carga_horaria,
    afirmativa_pcd: v.afirmativa_pcd, aberta_pcd: v.aberta_pcd, aprendizagem: v.aprendizagem,
    descricao: v.descricao, responsabilidades: v.responsabilidades, requisitos: v.requisitos, diferenciais: v.diferenciais,
    beneficios: v.beneficios, complementares: v.complementares, link_externo: v.link_externo ?? '',
    prazo: v.prazo ? v.prazo.slice(0, 10) : '',
    perguntas: perguntas.map(({ texto, tipo, opcoes, obrigatoria }) => ({ texto, tipo, opcoes, obrigatoria })),
  };
}

export const linkValido = (t: string) => t.trim() === '' || /^https:\/\/\S+\.\S+/.test(t.trim());

/** O que falta em cada passo para seguir. Lista vazia: pode avançar. */
export function faltasDoPasso(passo: number, f: FormularioDaVaga): string[] {
  const faltas: string[] = [];
  if (passo === 0) {
    const t = f.titulo.trim().length;
    if (t < LIMITES.titulo.min) faltas.push('Escreva o título da vaga.');
    if (t > LIMITES.titulo.max) faltas.push(`O título passa de ${LIMITES.titulo.max} caracteres.`);
    if (!f.area) faltas.push('Escolha a área.');
    if (!f.cidade.trim()) faltas.push('Informe a cidade.');
  }
  if (passo === 1 && !f.descricao.trim()) faltas.push('Conte o que a pessoa vai fazer.');
  if (passo === 2 && f.requisitos.length === 0) faltas.push('Inclua pelo menos um requisito.');
  if (passo === 3 && !linkValido(f.link_externo)) faltas.push('O link do formulário precisa começar com https://');
  if (passo === 4) {
    f.perguntas.forEach((p, i) => {
      if (p.texto.trim().length < LIMITES.pergunta.min) faltas.push(`Escreva a pergunta ${i + 1}.`);
      if ((p.tipo === 'unica' || p.tipo === 'multipla') && p.opcoes.filter(o => o.trim()).length < 2) faltas.push(`A pergunta ${i + 1} precisa de pelo menos duas opções.`);
    });
  }
  return faltas;
}

/** Tudo o que falta, de todos os passos, para gravar. */
export const faltasParaSalvar = (f: FormularioDaVaga) => PASSOS.slice(0, 5).flatMap((_, i) => faltasDoPasso(i, f));

/** Os termos que barram publicar, campo por campo. */
export function termosDoFormulario(f: FormularioDaVaga): Achado[] {
  return procurarTermos({
    'Título': f.titulo,
    'Descrição': f.descricao,
    'No dia a dia': f.responsabilidades,
    'Requisitos': f.requisitos,
    'Diferenciais': f.diferenciais,
    'Informações complementares': f.complementares,
    'Perguntas': f.perguntas.map(p => p.texto),
  });
}

/** Avisos que não barram, mas o RH deve ver na revisão. */
export function avisosDaRevisao(f: FormularioDaVaga): string[] {
  const avisos: string[] = [];
  if (!f.link_externo.trim()) avisos.push('Sem link do formulário: o botão da vaga vai mostrar "Inscrições em breve".');
  if (f.beneficios.length === 0) avisos.push('Nenhum benefício listado.');
  if (!f.carga_horaria.trim()) avisos.push('Sem carga horária: o cartão fica sem essa etiqueta.');
  return avisos;
}

const limparLista = (l: string[]) => l.map(t => t.trim()).filter(Boolean);

/**
 * A linha para gravar. Vaga nova ganha endereço e código livres; editando,
 * endereço e código ficam, para os links que já circulam não quebrarem.
 */
export function dadosParaGravar(
  f: FormularioDaVaga,
  status: StatusDaVaga,
  existente: Pick<Vaga, 'slug' | 'codigo'> | null,
  outras: Array<Pick<Vaga, 'slug' | 'codigo'>>,
  ano: number = new Date().getFullYear(),
): DadosDaVaga {
  const area = f.area as Area;
  return {
    slug: existente?.slug ?? slugLivre(f.titulo, outras.map(o => o.slug)),
    codigo: existente?.codigo ?? proximoCodigo(area, ano, outras.map(o => o.codigo)),
    titulo: f.titulo.trim().replace(/\s+/g, ' '),
    area,
    cidade: f.cidade.trim(),
    modalidade: f.modalidade,
    contratacao: f.contratacao,
    carga_horaria: f.carga_horaria.trim(),
    descricao: f.descricao.trim(),
    responsabilidades: limparLista(f.responsabilidades),
    requisitos: limparLista(f.requisitos),
    diferenciais: limparLista(f.diferenciais),
    beneficios: limparLista(f.beneficios),
    complementares: f.complementares.trim(),
    afirmativa_pcd: f.afirmativa_pcd,
    aberta_pcd: f.afirmativa_pcd || f.aberta_pcd,
    aprendizagem: f.aprendizagem || f.contratacao === 'aprendiz',
    status,
    // fim do dia escolhido, no horário de Brasília
    prazo: f.prazo ? `${f.prazo}T23:59:00-03:00` : null,
    link_externo: f.link_externo.trim() || null,
  };
}

/** Perguntas prontas para gravar: sem vazias, opções só onde cabe. */
export const perguntasParaGravar = (f: FormularioDaVaga): NovaPergunta[] =>
  f.perguntas
    .filter(p => p.texto.trim())
    .map(p => ({ ...p, texto: p.texto.trim(), opcoes: p.tipo === 'unica' || p.tipo === 'multipla' ? limparLista(p.opcoes) : [] }));

/** Colar várias linhas vira vários itens ("• ", "- " e numeração saem). */
export function itensDoTexto(texto: string): string[] {
  return texto.split(/\r?\n/).map(l => l.replace(/^\s*([•\-–*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
}

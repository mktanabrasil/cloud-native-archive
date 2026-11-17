/**
 * O Semanário (17/11/2026): o planejamento da semana de cada professora dos
 * CEIs (e do GOE), no modelo da Orientação Pedagógica (2 páginas A4). A
 * professora preenche os campos fixos da página 2 e envia até a quarta-feira
 * anterior; a orientadora pedagógica do CEI dá a devolutiva até a quinta.
 *
 * Os tipos são escritos à mão (a tabela ainda não está nos tipos gerados) e
 * espelham a migração 20261117160000_semanario_banco.sql. Quem pode o quê é o
 * banco que decide; aqui ficam só as contas que a tela usa.
 */

export type ChaveDoDia = 'seg' | 'ter' | 'qua' | 'qui' | 'sex';
export type CampoDoDia = 'projeto' | 'proposta' | 'objetivo' | 'desenvolvimento';
export type StatusDoSemanario = 'preenchimento' | 'enviado' | 'com_devolutiva';

export type DiaDoSemanario = Partial<Record<CampoDoDia, string>>;
export type DiasDoSemanario = Partial<Record<ChaveDoDia, DiaDoSemanario>>;

export interface Semanario {
  id: string;
  professora_id: string;
  professora_nome: string;
  unidade: string;
  /** A segunda-feira da semana, 'AAAA-MM-DD'. */
  semana: string;
  agrupamento: string;
  dias: DiasDoSemanario;
  formas_registro: string;
  materiais: string;
  avaliacao: string;
  status: StatusDoSemanario;
  enviado_em: string | null;
  devolutiva: string | null;
  devolutiva_por: string | null;
  devolutiva_por_id: string | null;
  devolutiva_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** O que a professora edita (o resto o banco preenche ou trava). */
export type ConteudoDoSemanario = Pick<Semanario, 'agrupamento' | 'dias' | 'formas_registro' | 'materiais' | 'avaliacao'>;

/** Os dias na ordem do modelo. O modelo traz "2ª FEIRA" duas vezes; a quinta aqui é a 5ª. */
export const DIAS: ReadonlyArray<{ chave: ChaveDoDia; rotulo: string; curto: string; deslocamento: number }> = [
  { chave: 'seg', rotulo: '2ª FEIRA', curto: 'Seg', deslocamento: 0 },
  { chave: 'ter', rotulo: '3ª FEIRA', curto: 'Ter', deslocamento: 1 },
  { chave: 'qua', rotulo: '4ª FEIRA', curto: 'Qua', deslocamento: 2 },
  { chave: 'qui', rotulo: '5ª FEIRA', curto: 'Qui', deslocamento: 3 },
  { chave: 'sex', rotulo: '6ª FEIRA', curto: 'Sex', deslocamento: 4 },
];

/** Os quatro campos de cada dia, com o rótulo do modelo. */
export const CAMPOS_DO_DIA: ReadonlyArray<{ chave: CampoDoDia; rotulo: string }> = [
  { chave: 'projeto', rotulo: 'PROJETO' },
  { chave: 'proposta', rotulo: 'PROPOSTA' },
  { chave: 'objetivo', rotulo: 'OBJETIVO DA PROPOSTA' },
  { chave: 'desenvolvimento', rotulo: 'DESENVOLVIMENTO DA PROPOSTA' },
];

/** Os campos da semana inteira, abaixo dos dias. */
export const CAMPOS_DA_SEMANA: ReadonlyArray<{ chave: 'formas_registro' | 'materiais' | 'avaliacao'; rotulo: string }> = [
  { chave: 'formas_registro', rotulo: 'FORMAS DE REGISTRO' },
  { chave: 'materiais', rotulo: 'MATERIAIS UTILIZADOS PARA A PROPOSTA DA SEMANA' },
  { chave: 'avaliacao', rotulo: 'AVALIAÇÃO DAS PROPOSTAS' },
];

/** Os mesmos tetos do banco (CHECKs da migração). */
export const LIMITES = {
  agrupamento: 80,
  campoDoDia: 1500,
  formas_registro: 1500,
  materiais: 1500,
  avaliacao: 3000,
  devolutiva: 3000,
} as const;

// --- Datas (sempre em UTC, para o fuso não trocar o dia) -----------------------

const paraData = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const paraIso = (data: Date) => data.toISOString().slice(0, 10);
const somarDias = (iso: string, dias: number) => {
  const data = paraData(iso);
  data.setUTCDate(data.getUTCDate() + dias);
  return paraIso(data);
};
/** A data local de hoje, 'AAAA-MM-DD'. */
export const hojeIso = (agora = new Date()) =>
  `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

/** A segunda-feira da semana de uma data. */
export function segundaDaSemana(iso: string): string {
  const diaDaSemana = paraData(iso).getUTCDay(); // 0 = domingo
  return somarDias(iso, diaDaSemana === 0 ? -6 : 1 - diaDaSemana);
}

/** A segunda-feira da próxima semana (o semanário se faz na semana anterior). */
export const proximaSegunda = (hoje: string) => somarDias(segundaDaSemana(hoje), 7);

export const ehSegunda = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && paraData(iso).getUTCDay() === 1;

/** A data de cada dia da semana. */
export const dataDoDia = (semana: string, chave: ChaveDoDia) =>
  somarDias(semana, DIAS.find((d) => d.chave === chave)!.deslocamento);

/** A sexta-feira da semana. */
export const sextaDaSemana = (semana: string) => somarDias(semana, 4);

/** Envio até a quarta-feira anterior à semana. */
export const prazoDeEnvio = (semana: string) => somarDias(semana, -5);

/** Devolutiva até a quinta-feira anterior à semana. */
export const prazoDaDevolutiva = (semana: string) => somarDias(semana, -4);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "23 a 27 de novembro", "30 de novembro a 4 de dezembro", "29 de dezembro de 2026 a 2 de janeiro de 2027". */
export function periodoPorExtenso(semana: string): string {
  const ini = paraData(semana);
  const fim = paraData(sextaDaSemana(semana));
  const [di, mi, ai] = [ini.getUTCDate(), ini.getUTCMonth(), ini.getUTCFullYear()];
  const [df, mf, af] = [fim.getUTCDate(), fim.getUTCMonth(), fim.getUTCFullYear()];
  if (ai !== af) return `${di} de ${MESES[mi]} de ${ai} a ${df} de ${MESES[mf]} de ${af}`;
  if (mi !== mf) return `${di} de ${MESES[mi]} a ${df} de ${MESES[mf]}`;
  return `${di} a ${df} de ${MESES[mf]}`;
}

/** "23/11 a 27/11", como no campo PERÍODO do modelo. */
export function periodoCurto(semana: string): string {
  const f = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${f(semana)} a ${f(sextaDaSemana(semana))}`;
}

/** "quarta, 18/11". */
export function diaComSemana(iso: string): string {
  return `${SEMANA[paraData(iso).getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// --- Conteúdo --------------------------------------------------------------------

const preenchido = (texto: string | null | undefined) => !!texto && texto.trim().length > 0;

/** Um dia está completo com os quatro campos preenchidos. */
export const diaCompleto = (dia: DiaDoSemanario | undefined) => CAMPOS_DO_DIA.every((c) => preenchido(dia?.[c.chave]));

/** Um dia foi começado com qualquer campo preenchido. */
export const diaComecado = (dia: DiaDoSemanario | undefined) => CAMPOS_DO_DIA.some((c) => preenchido(dia?.[c.chave]));

/** Quantos dias estão completos (0 a 5). */
export const diasCompletos = (dias: DiasDoSemanario) => DIAS.filter((d) => diaCompleto(dias[d.chave])).length;

/**
 * O que falta para enviar. A avaliação fica de fora: ela se escreve depois da
 * semana e continua aberta após o envio.
 */
export function faltasParaEnviar(s: Pick<Semanario, 'agrupamento' | 'dias' | 'formas_registro' | 'materiais'>): string[] {
  const faltas: string[] = [];
  if (!preenchido(s.agrupamento)) faltas.push('Agrupamento');
  for (const d of DIAS) {
    if (!diaCompleto(s.dias[d.chave])) faltas.push(d.rotulo);
  }
  if (!preenchido(s.formas_registro)) faltas.push('Formas de registro');
  if (!preenchido(s.materiais)) faltas.push('Materiais');
  return faltas;
}

/** Algum texto passa do teto do banco? Devolve o rótulo de onde. */
export function textosLongos(s: ConteudoDoSemanario): string[] {
  const longos: string[] = [];
  if (s.agrupamento.length > LIMITES.agrupamento) longos.push('Agrupamento');
  for (const d of DIAS) {
    if (CAMPOS_DO_DIA.some((c) => (s.dias[d.chave]?.[c.chave]?.length ?? 0) > LIMITES.campoDoDia)) longos.push(d.rotulo);
  }
  if (s.formas_registro.length > LIMITES.formas_registro) longos.push('Formas de registro');
  if (s.materiais.length > LIMITES.materiais) longos.push('Materiais');
  if (s.avaliacao.length > LIMITES.avaliacao) longos.push('Avaliação');
  return longos;
}

// --- Situação -----------------------------------------------------------------------

export type SituacaoDoSemanario =
  | 'em_preenchimento'
  | 'envio_atrasado'
  | 'aguardando_devolutiva'
  | 'devolutiva_atrasada'
  | 'com_devolutiva';

/**
 * A situação para a tela, com o atraso calculado pela data de hoje. Os prazos
 * são só aviso: nada trava depois deles.
 */
export function situacao(s: Pick<Semanario, 'semana' | 'status'>, hoje: string): SituacaoDoSemanario {
  if (s.status === 'com_devolutiva') return 'com_devolutiva';
  if (s.status === 'enviado') return hoje > prazoDaDevolutiva(s.semana) ? 'devolutiva_atrasada' : 'aguardando_devolutiva';
  return hoje > prazoDeEnvio(s.semana) ? 'envio_atrasado' : 'em_preenchimento';
}

export const ROTULO_DA_SITUACAO: Record<SituacaoDoSemanario, string> = {
  em_preenchimento: 'Em preenchimento',
  envio_atrasado: 'Envio atrasado',
  aguardando_devolutiva: 'Aguardando devolutiva',
  devolutiva_atrasada: 'Devolutiva atrasada',
  com_devolutiva: 'Com devolutiva',
};

/** Um semanário vazio, para a tela antes de criar a linha. */
export const conteudoVazio = (): ConteudoDoSemanario => ({
  agrupamento: '',
  dias: {},
  formas_registro: '',
  materiais: '',
  avaliacao: '',
});

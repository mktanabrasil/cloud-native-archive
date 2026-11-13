/**
 * As regras do Calendário Anual que não dependem do banco (14/11/2026).
 */

export type TipoDoItem = 'feriado' | 'data' | 'atividade';
export type StatusDoCalendario = 'preenchimento' | 'revisao' | 'aprovado';

export interface Percurso { mes: number; tema: string; sugestoes: string }

export interface AnoDoCalendario {
  ano: number;
  tema: string;
  percursos: Percurso[];
  textos: Record<string, string>;
  meses_revisados: number[];
  capa_url: string | null;
  status: StatusDoCalendario;
  observacao: string | null;
  enviado_em: string | null;
  enviado_por: string | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  pdf_url: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
}

export interface ItemDoCalendario {
  id: string;
  ano: number;
  dia: string; // AAAA-MM-DD
  texto: string;
  tipo: TipoDoItem;
  unidades: string[];
  destaque: boolean;
  oculto: boolean;
  fonte: string | null;
}

export const UNIDADES_DO_CALENDARIO = ['DIC', 'Nilópolis', 'Santana'] as const;
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DIAS_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const LIMITE_DO_TEXTO = 120;

/** "2027-02-09", sem fuso: o dia do calendário, não um instante. */
export const chaveDoDia = (ano: number, mes: number, dia: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** As semanas do mês (1 a 12), de domingo a sábado; `null` é célula vazia. */
export function semanasDoMes(ano: number, mes: number): (number | null)[][] {
  const primeiro = new Date(ano, mes - 1, 1).getDay();
  const dias = new Date(ano, mes, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** O dia da semana (0 = domingo) de um dia do calendário. */
export const diaDaSemana = (chave: string) => { const [a, m, d] = chave.split('-').map(Number); return new Date(a, m - 1, d).getDay(); };

/** Itens de um dia na ordem do PDF: feriado, datas, atividades (cada grupo na ordem em que chegou). */
const ORDEM: Record<TipoDoItem, number> = { feriado: 0, data: 1, atividade: 2 };
export function itensDoDia(itens: ItemDoCalendario[], chave: string): ItemDoCalendario[] {
  return itens.filter(i => i.dia === chave).sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo]);
}

/** O que vai para o PDF: tudo, menos a data relevante escondida. */
export const vaiProPdf = (i: ItemDoCalendario) => !(i.tipo === 'data' && i.oculto);

/** "Todas" quando a lista está vazia ou tem as três. */
export function rotuloDasUnidades(unidades: string[]): string {
  if (unidades.length === 0 || UNIDADES_DO_CALENDARIO.every(u => unidades.includes(u))) return 'Todas as unidades';
  return unidades.join(', ');
}

/** O tema do mês, dos percursos (mes de 1 a 12). */
export const temaDoMes = (percursos: Percurso[], mes: number) => percursos.find(p => p.mes === mes)?.tema?.trim() ?? '';

/** O título da página do mês no PDF: "Fevereiro 2027 - Cultivando o amor e o respeito". */
export function tituloDoMes(ano: number, mes: number, percursos: Percurso[]): string {
  const tema = temaDoMes(percursos, mes);
  return tema ? `${MESES[mes - 1]} ${ano} - ${tema}` : `${MESES[mes - 1]} ${ano}`;
}

/** Os 12 percursos, completando os meses que faltarem. */
export function percursosCompletos(percursos: Percurso[] | null | undefined): Percurso[] {
  return MESES.map((_, i) => {
    const p = (percursos ?? []).find(x => x.mes === i + 1);
    return { mes: i + 1, tema: p?.tema ?? '', sugestoes: p?.sugestoes ?? '' };
  });
}

/** O andamento de cada parte, para a tela de início. */
export function andamento(ano: AnoDoCalendario) {
  const percursos = percursosCompletos(ano.percursos).filter(p => p.tema.trim()).length;
  return {
    tema: ano.tema.trim().length > 0,
    percursos,
    meses: new Set(ano.meses_revisados).size,
  };
}

/** Pode mexer: só em preenchimento (o marketing mexe sempre, mas isso o banco decide). */
export const aberto = (ano: Pick<AnoDoCalendario, 'status'>) => ano.status === 'preenchimento';

/**
 * As regras do Calendário Anual que não dependem do banco (14/11/2026).
 */

export type TipoDoItem = 'feriado' | 'data' | 'atividade';
export type StatusDoCalendario = 'preenchimento' | 'revisao' | 'aprovado';

export interface Percurso { mes: number; tema: string; sugestoes: string }

/** Quem mexeu por último numa parte, gravado pelo banco (13/11/2026). */
export interface Autoria { nome: string; em: string }

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
  /** A versão impressa (19/11/2026): a primeira aprovação, guardada à parte pelo banco. */
  pdf_impresso_url?: string | null;
  impresso_em?: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
  /** "tema", "percurso:3", "texto:scfv", "revisado:2", "capa" → quem mexeu por último. */
  autoria?: Record<string, Autoria>;
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
  /** O e-mail de quem acrescentou (o banco grava). */
  criado_por?: string | null;
  /** Autoria (13/11/2026): quem acrescentou e quem mexeu por último; o banco é quem grava. */
  criado_por_nome?: string | null;
  criado_em?: string;
  alterado_por_nome?: string | null;
  alterado_em?: string | null;
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

/* ---------- o fichário digital (19/11/2026) ---------- */

/**
 * Depois de aprovado e impresso, o calendário vira um fichário: a gestão
 * segue mexendo só no mês a mês; tema, percursos, textos e "revisado" ficam
 * fechados. O banco confere de novo (migração 20261120090000).
 */
export const noFichario = (ano: Pick<AnoDoCalendario, 'status' | 'impresso_em'>) => ano.status === 'aprovado' && !!ano.impresso_em;

/** As atividades do mês a mês: em preenchimento e no fichário (o marketing sempre). */
export const itensAbertos = (ano: Pick<AnoDoCalendario, 'status' | 'impresso_em'>) => aberto(ano) || noFichario(ano);

/** A grafia da unidade nas atividades a partir da unidade do perfil ("dic" → "DIC"); null se não for do Social. */
export function unidadeDoCalendario(unidadeDoPerfil: string | null | undefined): string | null {
  const u = (unidadeDoPerfil ?? '').trim().toLowerCase();
  return UNIDADES_DO_CALENDARIO.find(x => x.toLowerCase() === u) ?? null;
}

/**
 * "As suas" no fichário (decisão de 19/11/2026): a gestão apaga a atividade
 * que ela acrescentou ou a que é só da unidade dela. As de todas ou de mais de
 * uma unidade, criadas por outra pessoa, só quem criou ou o marketing.
 */
export function atividadeEhMinha(i: Pick<ItemDoCalendario, 'tipo' | 'criado_por' | 'unidades'>, quem: { email: string | null | undefined; unidade: string | null }): boolean {
  if (i.tipo !== 'atividade') return false;
  if (i.criado_por && quem.email && i.criado_por.toLowerCase() === quem.email.toLowerCase()) return true;
  return i.unidades.length === 1 && !!quem.unidade && i.unidades[0] === quem.unidade;
}

/** Entrou depois da impressão: o contorno coral no mês a mês. */
export const entrouDepoisDaImpressao = (i: Pick<ItemDoCalendario, 'criado_em'>, ano: Pick<AnoDoCalendario, 'impresso_em'>) =>
  !!ano.impresso_em && !!i.criado_em && Date.parse(i.criado_em) > Date.parse(ano.impresso_em);

/** Uma mudança no mês a mês depois da impressão (tabela calendario_alteracoes). */
export interface AlteracaoDoCalendario {
  id: string;
  ano: number;
  mes: number;
  dia: string;
  acao: 'entrou' | 'saiu' | 'mudou';
  /** O tipo da atividade, ou 'tema' (o tema do mês mudou depois de reaberto). */
  tipo: TipoDoItem | 'tema';
  texto: string;
  unidades: string[];
  item_id: string | null;
  quem: string | null;
  em: string;
}

/**
 * As mudanças por mês (1 a 12), na ordem em que aconteceram. O que se desfez
 * dentro do mesmo mês (entrou e saiu, ou escondeu e mostrou de novo, sem
 * "mudou" no meio) não conta: a folha impressa continua valendo.
 */
export function mudancasPorMes(alteracoes: AlteracaoDoCalendario[]): Record<number, AlteracaoDoCalendario[]> {
  const r: Record<number, AlteracaoDoCalendario[]> = {};
  for (const a of [...alteracoes].sort((x, y) => Date.parse(x.em) - Date.parse(y.em))) (r[a.mes] ??= []).push(a);
  for (const mes of Object.keys(r).map(Number)) {
    const porItem = new Map<string, AlteracaoDoCalendario[]>();
    for (const a of r[mes]) if (a.item_id) porItem.set(a.item_id, [...(porItem.get(a.item_id) ?? []), a]);
    const desfeitos = new Set<string>();
    for (const [id, l] of porItem) {
      const ida = l[0].acao, volta = l[l.length - 1].acao;
      if (l.length > 1 && !l.some(x => x.acao === 'mudou') && ((ida === 'entrou' && volta === 'saiu') || (ida === 'saiu' && volta === 'entrou'))) desfeitos.add(id);
    }
    r[mes] = r[mes].filter(a => !a.item_id || !desfeitos.has(a.item_id));
    if (!r[mes].length) delete r[mes];
  }
  return r;
}

/** "12/03 · Passeio ao Sesc · Nilópolis" (a data relevante e o feriado dizem o que são). */
export function textoDaMudanca(a: Pick<AlteracaoDoCalendario, 'dia' | 'texto' | 'tipo' | 'unidades'>): string {
  if (a.tipo === 'tema') return `Tema do mês: ${a.texto}`;
  const [, m, d] = a.dia.split('-');
  const quem = a.tipo === 'atividade' ? rotuloDasUnidades(a.unidades) : a.tipo === 'feriado' ? 'feriado' : 'data relevante';
  return `${d}/${m} · ${a.texto} · ${quem}`;
}

/** "entrou", "saiu" ou "mudou", com o sinal da lista. */
export const SINAL_DA_MUDANCA: Record<AlteracaoDoCalendario['acao'], string> = { entrou: '+', saiu: '−', mudou: '~' };

/** "14/11", no horário de Brasília. */
export const diaEMes = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

/** Quem mexeu por último numa parte do ano: "Gestão DIC · 14/11", ou nada. */
export function autoriaDe(ano: Pick<AnoDoCalendario, 'autoria'>, chave: string): string | null {
  const a = ano.autoria?.[chave];
  return a?.nome ? `${a.nome} · ${diaEMes(a.em)}` : null;
}

/** A autoria de uma atividade: "Por Gestão DIC · 14/11 · editado por MKT ANA · 15/11". A base (feriados e datas) não tem. */
export function autoriaDoItem(i: ItemDoCalendario): string | null {
  const partes: string[] = [];
  if (i.criado_por_nome) partes.push(`Por ${i.criado_por_nome}${i.criado_em ? ` · ${diaEMes(i.criado_em)}` : ''}`);
  if (i.alterado_por_nome && i.alterado_em) partes.push(`${partes.length ? 'editado' : 'Editado'} por ${i.alterado_por_nome} · ${diaEMes(i.alterado_em)}`);
  return partes.length ? partes.join(' · ') : null;
}

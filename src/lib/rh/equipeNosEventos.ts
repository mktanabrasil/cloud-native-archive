import { limparFuncionarios } from '@/lib/events/equipe';

/**
 * Administração › RH (18/11/2026, PR 3): quem da equipe trabalhou em cada
 * evento, para o RH controlar o banco de horas depois. As linhas vêm da
 * função `rh_eventos_da_equipe` (confirmados e concluídos, com nomes).
 * Aqui só as contas, sem rede: o teste alcança.
 */
export interface EventoDaEquipe {
  id: string;
  title: string;
  unit: string;
  location: string | null;
  start_datetime: string;
  end_datetime: string | null;
  status: string;
  equipe_funcionarios: string[];
  conferido_em: string | null;
  conferido_por_nome: string | null;
  /** A equipe no momento em que o RH conferiu. */
  equipe_conferida: string[] | null;
}

const FUSO = 'America/Sao_Paulo';

/** O mês "AAAA-MM" em que cai uma data (no fuso de Brasília). */
export function mesDe(data: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).formatToParts(data).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}
/** O mês ao lado ("2026-11", +1 → "2026-12"). */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
/** O começo e o fim do mês, à meia-noite de Brasília (UTC−3), para a consulta. */
export function limitesDoMes(mes: string): { de: string; ate: string } {
  return { de: `${mes}-01T00:00:00-03:00`, ate: `${somarMeses(mes, 1)}-01T00:00:00-03:00` };
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesPorExtenso = (mes: string) => { const [a, m] = mes.split('-').map(Number); return `${MESES[m - 1]} de ${a}`; };

const diaEmBrasilia = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/**
 * Horas do evento (meia em meia hora). Sem término, zero. Evento que passa de
 * um dia (inclusive o que atravessa a virada do mês) devolve `null`: o
 * intervalo corrido contaria as noites, e o mesmo evento entraria em dois
 * meses. Esses aparecem como "vários dias", fora do total, para o RH contar.
 */
export function horasDoEvento(e: Pick<EventoDaEquipe, 'start_datetime' | 'end_datetime'>): number | null {
  if (!e.end_datetime) return 0;
  if (diaEmBrasilia(e.start_datetime) !== diaEmBrasilia(e.end_datetime)) return null;
  const h = (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3_600_000;
  return h > 0 ? Math.round(h * 2) / 2 : 0;
}
/** O mês do endereço, se for de verdade ("2026-13" não é). */
export const mesValido = (m: string | null): m is string => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
/** "3h", "2h30", "0h"; `null` é "vários dias". */
export function textoDasHoras(h: number | null): string {
  if (h === null) return 'vários dias';
  const inteiras = Math.floor(h);
  return h % 1 ? `${inteiras}h30` : `${inteiras}h`;
}

/** Sábado ou domingo (no fuso de Brasília): costuma virar banco de horas. */
export function caiNoFimDeSemana(e: Pick<EventoDaEquipe, 'start_datetime'>): boolean {
  const dia = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short' }).format(new Date(e.start_datetime));
  return dia === 'Sat' || dia === 'Sun';
}

/** A situação do evento para o RH. */
export type SituacaoNoRh = 'a_conferir' | 'conferido' | 'mudou';
export function situacaoNoRh(e: Pick<EventoDaEquipe, 'conferido_em' | 'equipe_funcionarios' | 'equipe_conferida'>): SituacaoNoRh {
  if (!e.conferido_em) return 'a_conferir';
  const agora = JSON.stringify(limparFuncionarios(e.equipe_funcionarios));
  const antes = JSON.stringify(limparFuncionarios(e.equipe_conferida ?? []));
  return agora === antes ? 'conferido' : 'mudou';
}

const chave = (nome: string) => nome.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface Funcionario {
  nome: string;
  /** Só dos eventos de um dia; os de vários dias contam em `variosDias`. */
  horas: number;
  variosDias: number;
  eventos: { id: string; title: string; unit: string; start_datetime: string; horas: number | null; fimDeSemana: boolean }[];
}

/**
 * Cada pessoa com os eventos dela e o total de horas. O nome junta sem olhar
 * acento nem maiúscula ("Marina Costa" e "marina costa" são a mesma); fica a
 * grafia que aparece primeiro.
 */
export function porFuncionario(eventos: readonly EventoDaEquipe[]): Funcionario[] {
  const mapa = new Map<string, Funcionario>();
  for (const e of eventos) {
    const horas = horasDoEvento(e);
    for (const nome of limparFuncionarios(e.equipe_funcionarios)) {
      const k = chave(nome);
      const f = mapa.get(k) ?? { nome, horas: 0, variosDias: 0, eventos: [] };
      if (horas === null) f.variosDias += 1; else f.horas += horas;
      f.eventos.push({ id: e.id, title: e.title, unit: e.unit, start_datetime: e.start_datetime, horas, fimDeSemana: caiNoFimDeSemana(e) });
      mapa.set(k, f);
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Os números do topo. */
export function numerosDoMes(eventos: readonly EventoDaEquipe[]) {
  return {
    eventos: eventos.length,
    funcionarios: porFuncionario(eventos).length,
    aConferir: eventos.filter(e => situacaoNoRh(e) !== 'conferido').length,
    fimDeSemana: eventos.filter(caiNoFimDeSemana).length,
  };
}

const dataCurta = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(new Date(iso));

/** O total da pessoa: "7h", ou "7h + 1 de vários dias". */
export const totalDaPessoa = (f: Pick<Funcionario, 'horas' | 'variosDias'>) =>
  f.variosDias ? `${textoDasHoras(f.horas)} + ${f.variosDias} de vários dias` : textoDasHoras(f.horas);

/** O texto para colar numa planilha ou mensagem: uma linha por pessoa e evento. */
export function textoParaCopiar(lista: readonly Funcionario[]): string {
  return lista.flatMap(f => [
    `${f.nome} · ${totalDaPessoa(f)} no mês`,
    ...f.eventos.map(e => `  ${dataCurta(e.start_datetime)} · ${e.title} (${e.unit}) · ${textoDasHoras(e.horas)}${e.fimDeSemana ? ' · fim de semana' : ''}`),
  ]).join('\n');
}

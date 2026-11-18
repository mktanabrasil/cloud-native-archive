import { digitosDoWhatsapp, formatarWhatsapp } from '@/lib/events/equipe';
import type { VoluntarioDoEvento } from '@/types';

/**
 * Administração › Voluntariado (18/11/2026, PR 4): os voluntários que as
 * unidades indicam no formulário de eventos. O cadastro em si é feito em outra
 * plataforma; aqui fica só o controle: confirmado ou a confirmar. Quem foi
 * confirmado aparece confirmado nos próximos eventos, reconhecido pelo nome e
 * pelo WhatsApp (dois irmãos com o número da mãe são duas pessoas). O
 * voluntariado do Natal Feliz continua no Marketing, com o formulário e a
 * planilha dele. Aqui só as contas, sem rede: o teste alcança.
 */
export interface EventoDoVoluntariado {
  id: string;
  title: string;
  unit: string;
  location: string | null;
  start_datetime: string;
  end_datetime: string | null;
  status: string;
  equipe_voluntarios: VoluntarioDoEvento[];
}

/** Uma confirmação (tabela `voluntarios`): `criado_*` é quem confirmou e quando. */
export interface Confirmacao {
  id: string;
  nome: string;
  whatsapp: string;
  primeiro_evento_id: string | null;
  criado_em: string;
  criado_por_nome: string | null;
}

/** O nome para comparar: sem acento, sem maiúscula, sem espaço sobrando. */
export const nomeChave = (nome: string) =>
  (nome ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A pessoa: WhatsApp (só dígitos, sem o 55) e nome. */
export const chaveDaPessoa = (v: Pick<VoluntarioDoEvento, 'nome' | 'whatsapp'>) => `${digitosDoWhatsapp(v.whatsapp ?? '')}|${nomeChave(v.nome)}`;

/** As confirmações pela pessoa. */
export const confirmacoesPorPessoa = (lista: readonly Confirmacao[]) => new Map(lista.map(c => [chaveDaPessoa(c), c]));

export type Situacao =
  | { status: 'confirmado'; confirmacao: Confirmacao }
  /** `mesmoNumero`: o WhatsApp já foi confirmado com outro nome (pode ser a mesma pessoa, escrita de outro jeito). */
  | { status: 'a_confirmar'; mesmoNumero: string | null };

export function situacaoDe(v: Pick<VoluntarioDoEvento, 'nome' | 'whatsapp'>, confirmacoes: readonly Confirmacao[]): Situacao {
  const c = confirmacoes.find(x => chaveDaPessoa(x) === chaveDaPessoa(v));
  if (c) return { status: 'confirmado', confirmacao: c };
  const w = digitosDoWhatsapp(v.whatsapp ?? '');
  const outro = confirmacoes.find(x => digitosDoWhatsapp(x.whatsapp) === w);
  return { status: 'a_confirmar', mesmoNumero: outro?.nome ?? null };
}

export interface EventoDaPessoa { id: string; title: string; unit: string; start_datetime: string }
export interface PessoaVoluntaria {
  chave: string;
  nome: string;
  whatsapp: string;
  /** Do mais recente para o mais antigo. */
  eventos: EventoDaPessoa[];
  /** O primeiro evento (o mais antigo) em que apareceu. */
  primeiroEventoId: string | null;
}

/**
 * Cada pessoa que já apareceu nos eventos, uma vez só, com os eventos dela. As
 * confirmações sem evento (o evento foi apagado) também entram, para dar para
 * desfazer.
 */
export function pessoasDosEventos(eventos: readonly EventoDoVoluntariado[], confirmacoes: readonly Confirmacao[] = []): PessoaVoluntaria[] {
  const mapa = new Map<string, PessoaVoluntaria>();
  const emOrdemDeData = [...eventos].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
  for (const e of emOrdemDeData) for (const v of e.equipe_voluntarios) {
    const chave = chaveDaPessoa(v);
    const p = mapa.get(chave) ?? { chave, nome: v.nome.trim(), whatsapp: digitosDoWhatsapp(v.whatsapp), eventos: [], primeiroEventoId: e.id };
    if (!p.eventos.some(x => x.id === e.id)) p.eventos.unshift({ id: e.id, title: e.title, unit: e.unit, start_datetime: e.start_datetime });
    mapa.set(chave, p);
  }
  for (const c of confirmacoes) {
    const chave = chaveDaPessoa(c);
    if (!mapa.has(chave)) mapa.set(chave, { chave, nome: c.nome, whatsapp: c.whatsapp, eventos: [], primeiroEventoId: null });
  }
  return [...mapa.values()];
}

/** Os números do mês: eventos, pessoas indicadas (uma vez cada), a confirmar e confirmadas. */
export function numerosDoMes(eventos: readonly EventoDoVoluntariado[], confirmacoes: readonly Confirmacao[]) {
  const pessoas = pessoasDosEventos(eventos);
  const confirmados = pessoas.filter(p => situacaoDe(p, confirmacoes).status === 'confirmado').length;
  return { eventos: eventos.length, voluntarios: pessoas.length, aConfirmar: pessoas.length - confirmados, confirmados };
}

const semAcento = (t: string) => t.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Procura pelo nome (sem acento nem maiúscula) ou pelos dígitos do WhatsApp. */
export function filtrarPessoas<T extends Pick<PessoaVoluntaria, 'nome' | 'whatsapp'>>(lista: readonly T[], termo: string): T[] {
  const t = termo.trim();
  if (!t) return [...lista];
  const d = t.replace(/\D/g, '');
  const n = semAcento(t);
  return lista.filter(v => semAcento(v.nome).includes(n) || (d.length >= 3 && v.whatsapp.includes(d)));
}

/** Em ordem alfabética, sem olhar acento. */
export const emOrdem = <T extends Pick<PessoaVoluntaria, 'nome'>>(lista: readonly T[]) =>
  [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

/** Uma pessoa por linha: "Nome — (21) 99999-9999", para colar no WhatsApp ou na planilha. */
export const contatosParaCopiar = (lista: readonly Pick<VoluntarioDoEvento, 'nome' | 'whatsapp'>[]) =>
  lista.map(v => `${v.nome.trim()} — ${formatarWhatsapp(v.whatsapp)}`).join('\n');

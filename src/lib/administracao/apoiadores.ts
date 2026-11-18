import type { PartnerType } from '@/types';

/**
 * Administração › Padrinhos e Parceiros (18/11/2026, PR 6). Decisão de 18/11:
 * começam como uma lista lida dos eventos, o que as unidades escreveram em
 * "Tem padrinho, doador ou empresa envolvida?" e nas instituições
 * participantes. Cada nome aparece uma vez (sem olhar acento nem maiúscula),
 * com os eventos em que foi citado. Aqui só as contas, sem rede.
 */
export interface EventoComApoiadores {
  id: string;
  title: string;
  unit: string;
  start_datetime: string;
  end_datetime: string | null;
  status: string;
  partners: Array<{ type?: PartnerType | string | null; name?: string | null }>;
  partner_type: string | null;
  partner_name: string | null;
  external_collaborators: Array<string | { name?: string | null; details?: string | null }>;
}

export type Lado = 'padrinhos' | 'parceiros';
export type TipoDeApoiador = 'padrinho' | 'doador' | 'empresa' | 'figura_publica' | 'instituicao' | 'outro';

export const ROTULO_DO_TIPO: Record<TipoDeApoiador, string> = {
  padrinho: 'Padrinho', doador: 'Doador', empresa: 'Empresa', figura_publica: 'Figura pública', instituicao: 'Instituição', outro: 'Outro',
};
/** Os tipos de cada página, na ordem dos filtros. */
export const TIPOS_DO_LADO: Record<Lado, TipoDeApoiador[]> = {
  padrinhos: ['padrinho', 'doador'],
  parceiros: ['empresa', 'figura_publica', 'instituicao', 'outro'],
};

const ladoDoTipo = (t: TipoDeApoiador): Lado => (t === 'padrinho' || t === 'doador' ? 'padrinhos' : 'parceiros');
const tipoDoFormulario = (t: string | null | undefined): TipoDeApoiador =>
  t === 'padrinho' || t === 'doador' || t === 'empresa' || t === 'figura_publica' ? t : 'outro';

export const chaveDoNome = (nome: string) =>
  (nome ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface CitacaoNoEvento { id: string; title: string; unit: string; start_datetime: string; status: string; detalhe: string | null }
export interface Apoiador {
  chave: string;
  nome: string;
  tipos: TipoDeApoiador[];
  /** Do mais recente para o mais antigo. */
  eventos: CitacaoNoEvento[];
}

/** O que cada evento cita, já com o tipo: parceiros da lista nova, o parceiro antigo (um só) e as instituições. */
function citacoes(e: EventoComApoiadores): { nome: string; tipo: TipoDeApoiador; detalhe: string | null }[] {
  const saida: { nome: string; tipo: TipoDeApoiador; detalhe: string | null }[] = [];
  const lista = Array.isArray(e.partners) ? e.partners : [];
  for (const p of lista) if (p && typeof p.name === 'string' && p.name.trim()) saida.push({ nome: p.name.trim(), tipo: tipoDoFormulario(p.type), detalhe: null });
  // O formato antigo (um parceiro só) vale quando a lista nova está vazia, como no detalhe do evento.
  if (lista.length === 0 && e.partner_name?.trim()) saida.push({ nome: e.partner_name.trim(), tipo: tipoDoFormulario(e.partner_type), detalhe: null });
  for (const x of Array.isArray(e.external_collaborators) ? e.external_collaborators : []) {
    const nome = typeof x === 'string' ? x : x?.name;
    const detalhe = typeof x === 'string' ? null : (x?.details?.trim() || null);
    if (nome && nome.trim()) saida.push({ nome: nome.trim(), tipo: 'instituicao', detalhe });
  }
  return saida;
}

/**
 * Cada padrinho/doador (ou parceiro) uma vez, com os tipos em que foi citado
 * e os eventos. O nome mostrado é o da citação mais recente.
 */
export function apoiadoresDoLado(eventos: readonly EventoComApoiadores[], lado: Lado): Apoiador[] {
  const mapa = new Map<string, Apoiador>();
  const recentes = [...eventos].sort((a, b) => b.start_datetime.localeCompare(a.start_datetime));
  for (const e of recentes) {
    const vistosNoEvento = new Set<string>();
    for (const c of citacoes(e)) {
      if (ladoDoTipo(c.tipo) !== lado) continue;
      const chave = chaveDoNome(c.nome);
      const a = mapa.get(chave) ?? { chave, nome: c.nome, tipos: [], eventos: [] };
      if (!a.tipos.includes(c.tipo)) a.tipos.push(c.tipo);
      if (!vistosNoEvento.has(chave)) {
        vistosNoEvento.add(chave);
        a.eventos.push({ id: e.id, title: e.title, unit: e.unit, start_datetime: e.start_datetime, status: e.status, detalhe: c.detalhe });
      }
      mapa.set(chave, a);
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/** Os números do topo: quantos nomes, em quantos eventos, e quantos eventos ainda vêm. */
export function numerosDoLado(lista: readonly Apoiador[], agora: Date) {
  const eventos = new Set<string>();
  const proximos = new Set<string>();
  for (const a of lista) for (const e of a.eventos) {
    eventos.add(e.id);
    if (new Date(e.start_datetime).getTime() >= agora.getTime()) proximos.add(e.id);
  }
  return { nomes: lista.length, eventos: eventos.size, proximos: proximos.size };
}

/** Busca pelo nome (sem acento) e filtro pelo tipo. */
export function filtrarApoiadores(lista: readonly Apoiador[], termo: string, tipo: TipoDeApoiador | null): Apoiador[] {
  const t = chaveDoNome(termo);
  return lista.filter(a => (!tipo || a.tipos.includes(tipo)) && (!t || a.chave.includes(t)));
}

const FUSO = 'America/Sao_Paulo';
const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

/** Uma linha por nome: "Nome (Padrinho) — 3 eventos: 22/11/2026 Karatê (Santana); …". */
export function textoParaCopiar(lista: readonly Apoiador[]): string {
  return lista.map(a => {
    const tipos = a.tipos.map(t => ROTULO_DO_TIPO[t]).join(', ');
    const n = a.eventos.length;
    return `${a.nome} (${tipos}) — ${n === 1 ? '1 evento' : `${n} eventos`}: ${a.eventos.map(e => `${data(e.start_datetime)} ${e.title} (${e.unit})`).join('; ')}`;
  }).join('\n');
}

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

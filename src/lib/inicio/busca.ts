/**
 * A busca da página inicial (17/11/2026): páginas do app, eventos e jornais.
 * Cada pessoa só encontra o que ela já pode abrir: as páginas vêm filtradas
 * pelo setor, os eventos são os que ela já vê na programação e os jornais
 * vêm do banco, que já recorta pela RLS.
 *
 * Tudo aqui é puro (sem tela nem banco), para a regra ser testada sozinha.
 */
import { ROTAS, rotaDoMarketing } from '@/config/navigation';

/** Minúsculas e sem acento: "Calendário" acha "calendario" e vice-versa. */
export const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O que cada página exige para aparecer na busca. */
export type Acesso = 'todos' | 'social' | 'calendario' | 'jornal' | 'vagas' | 'marketing' | 'perfil';

export interface PaginaDaBusca {
  titulo: string;
  /** A linha de baixo: o setor e, quando ajuda, o que tem lá. */
  detalhe: string;
  para: string;
  /** O setor (a chave de `COR_DO_SETOR`), para a cor do ícone. */
  setor: string;
  acesso: Acesso;
  /** Outras palavras que levam a ela ("senha" leva ao perfil). */
  palavras: string;
}

export const PAGINAS_DA_BUSCA: PaginaDaBusca[] = [
  { titulo: 'Eventos', detalhe: 'Social · a programação', para: ROTAS.eventos, setor: ROTAS.eventos, acesso: 'social', palavras: 'programacao agenda evento' },
  { titulo: 'Calendário de eventos', detalhe: 'Social · mês, semana e lista', para: `${ROTAS.eventos}?tela=calendario`, setor: ROTAS.eventos, acesso: 'social', palavras: 'calendario mes semana conflitos' },
  { titulo: 'Visão Geral', detalhe: 'Social · os eventos em números e o que aprovar', para: `${ROTAS.eventos}?tela=visao-geral`, setor: ROTAS.eventos, acesso: 'social', palavras: 'visao geral aprovar aprovacoes pendentes resumo' },
  { titulo: 'Calendário Anual', detalhe: 'Social · o calendário dos educadores', para: ROTAS.calendario, setor: ROTAS.eventos, acesso: 'calendario', palavras: 'calendario anual educadores percursos coordenadoras' },
  { titulo: 'Jornal Institucional', detalhe: 'Educação · os jornais da unidade', para: ROTAS.jornal, setor: ROTAS.jornal, acesso: 'jornal', palavras: 'jornal informativo edicao esboco' },
  { titulo: 'Jornais das unidades', detalhe: 'Educação · os finalizados, para ler e baixar', para: ROTAS.jornaisDasUnidades, setor: ROTAS.jornal, acesso: 'jornal', palavras: 'jornais finalizados feed pdf' },
  { titulo: 'Vagas', detalhe: 'Vagas · processos e candidaturas', para: '/vagas', setor: '/vagas', acesso: 'vagas', palavras: 'vagas trabalhe conosco candidatos candidaturas processos rh' },
  { titulo: 'Mercado Solidário', detalhe: 'Marketing', para: ROTAS.mercado, setor: ROTAS.marketing, acesso: 'marketing', palavras: 'mercado solidario doacoes cestas' },
  { titulo: 'Pizza da Alegria', detalhe: 'Marketing · pedidos, ranking e retirada', para: rotaDoMarketing('pizza'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'pizza pedidos ranking retirada' },
  { titulo: 'Voluntariado', detalhe: 'Marketing · inscrições do Natal Feliz', para: rotaDoMarketing('voluntariado'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'voluntariado voluntarios inscricoes natal feliz' },
  { titulo: 'Enquetes', detalhe: 'Marketing', para: rotaDoMarketing('enquetes'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'enquetes enquete votacao votos' },
  { titulo: 'Manual Design', detalhe: 'Marketing · a identidade visual', para: rotaDoMarketing('design-manual'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'manual design identidade marca cores logo' },
  { titulo: 'Portal Transparência', detalhe: 'Marketing', para: rotaDoMarketing('transparencia'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'portal transparencia documentos prestacao contas' },
  { titulo: 'Widgets', detalhe: 'Marketing · o que o site incorpora', para: rotaDoMarketing('widgets'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'widgets embed site incorporar' },
  { titulo: 'Auditoria', detalhe: 'Marketing · o histórico de alterações', para: rotaDoMarketing('auditoria'), setor: ROTAS.marketing, acesso: 'marketing', palavras: 'auditoria historico registros alteracoes' },
  { titulo: 'Painel', detalhe: 'Usuários, acessos e agenda', para: ROTAS.painel, setor: ROTAS.painel, acesso: 'marketing', palavras: 'painel usuarios acessos pessoas agenda contas perfil senha' },
  { titulo: 'Meu perfil', detalhe: 'Nome, foto e senha', para: ROTAS.painel, setor: ROTAS.painel, acesso: 'perfil', palavras: 'perfil senha conta foto dados' },
];

/** Quem a pessoa é, para a busca (tudo vem de `useUserRole`). */
export interface QuemBusca {
  soEducacao: boolean;
  canAccessJournal: boolean;
  temCalendario: boolean;
  veVagas: boolean;
  isMarketing: boolean;
}

export function podeVer(acesso: Acesso, q: QuemBusca): boolean {
  switch (acesso) {
    case 'todos': return true;
    case 'social': return !q.soEducacao;
    case 'calendario': return !q.soEducacao && q.temCalendario;
    case 'jornal': return q.canAccessJournal;
    case 'vagas': return q.veVagas;
    case 'marketing': return q.isMarketing;
    // O marketing chega ao próprio perfil pelo "Painel".
    case 'perfil': return !q.isMarketing;
  }
}

/** Todas as palavras da busca aparecem no texto (em qualquer ordem). */
const casa = (termo: string, ...textos: string[]) => {
  const alvo = normalizar(textos.join(' '));
  return normalizar(termo).split(/\s+/).filter(Boolean).every(p => alvo.includes(p));
};

/** Primeiro o que começa com o termo, depois o que tem o termo no título, depois o resto. */
const peso = (termo: string, titulo: string) => {
  const t = normalizar(titulo); const b = normalizar(termo.trim());
  return t.startsWith(b) ? 0 : t.includes(b) ? 1 : 2;
};

export function buscarPaginas(termo: string, q: QuemBusca, limite = 4): PaginaDaBusca[] {
  if (!termo.trim()) return [];
  return PAGINAS_DA_BUSCA
    .filter(p => podeVer(p.acesso, q) && casa(termo, p.titulo, p.detalhe, p.palavras))
    .sort((a, b) => peso(termo, a.titulo) - peso(termo, b.titulo))
    .slice(0, limite);
}

/** O mínimo de um evento que a busca e a lista usam. */
export interface EventoDaBusca {
  id: string;
  title: string;
  unit: string;
  location?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  status: string;
  visibility: string;
  slug?: string | null;
  deleted_at?: string | null;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Os que ainda vão acontecer (ou estão acontecendo), do mais perto ao mais longe. */
export function proximosEventos<T extends EventoDaBusca>(eventos: T[], agora: Date, limite = 3): T[] {
  return eventos
    .filter(e => !e.deleted_at && e.status !== 'cancelado' && new Date(e.end_datetime || e.start_datetime).getTime() >= agora.getTime())
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
    .slice(0, limite);
}

/** Pelo nome, unidade, local ou data (dd/mm): os que vêm primeiro, depois os que já foram. */
export function buscarEventos<T extends EventoDaBusca>(termo: string, eventos: T[], agora: Date, limite = 4): T[] {
  if (!termo.trim()) return [];
  const achados = eventos.filter(e => !e.deleted_at && casa(termo, e.title, e.unit, e.location ?? '', dataCurta(e.start_datetime)));
  const vem = achados.filter(e => new Date(e.end_datetime || e.start_datetime) >= agora).sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
  const foi = achados.filter(e => new Date(e.end_datetime || e.start_datetime) < agora).sort((a, b) => b.start_datetime.localeCompare(a.start_datetime));
  return [...vem, ...foi].slice(0, limite);
}

/** O endereço que abre o evento: a programação com o detalhe aberto (aceita slug ou id). */
export const linkDoEvento = (e: Pick<EventoDaBusca, 'id' | 'slug'>) => `${ROTAS.eventos}?slug=${encodeURIComponent(e.slug || e.id)}`;

/** O mínimo de um jornal que a busca usa. */
export interface JornalDaBusca {
  id: string;
  name: string;
  unit_id: string | null;
  status: string;
  reference_month: string | null;
  updated_at: string;
}

export function buscarJornais<T extends JornalDaBusca>(termo: string, jornais: T[], nomeDaUnidade: (id: string | null) => string, limite = 4): T[] {
  if (!termo.trim()) return [];
  return jornais
    .filter(j => j.status !== 'arquivado' && casa(termo, j.name, nomeDaUnidade(j.unit_id), j.reference_month ?? ''))
    .sort((a, b) => peso(termo, a.name) - peso(termo, b.name) || b.updated_at.localeCompare(a.updated_at))
    .slice(0, limite);
}

/** Abre o jornal no Jornal Institucional, na unidade dele (ver `?abrir=` em JournalPage). */
export const linkDoJornal = (j: Pick<JornalDaBusca, 'id' | 'unit_id'>) => `${ROTAS.jornal}?unidade=${encodeURIComponent(j.unit_id ?? 'geral')}&abrir=${encodeURIComponent(j.id)}`;

/**
 * Onde o termo aparece no texto, ignorando acento e caixa: [antes, achado, depois].
 * Sem o termo, o texto inteiro fica no "antes".
 */
export function marcarTermo(texto: string, termo: string): [string, string, string] {
  const b = normalizar(termo.trim());
  if (!b) return [texto, '', ''];
  // O índice no texto normalizado aponta para o mesmo índice no original
  // quando cada letra vira uma letra só (é o caso do português).
  const mapa: number[] = [];
  let norm = '';
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i]);
    for (let k = 0; k < n.length; k++) mapa.push(i);
    norm += n;
  }
  const ini = norm.indexOf(b);
  if (ini < 0) return [texto, '', ''];
  const de = mapa[ini]; const ate = mapa[ini + b.length - 1] + 1;
  return [texto.slice(0, de), texto.slice(de, ate), texto.slice(ate)];
}

/** "Bom dia" até meio-dia, "Boa tarde" até 18h, depois "Boa noite". */
export function saudacao(agora: Date): string {
  const h = agora.getHours();
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "Terça-feira, 17 de novembro". */
export function dataPorExtenso(agora: Date): string {
  const t = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Enquetes (23/09/2026, mockup aprovado).
 *
 * A equipe cria no Painel do Marketing e manda dois links: um para votar e
 * outro para acompanhar. Quem vota se identifica pelo WhatsApp e um PIN de
 * 4 dígitos criado na hora (pedido da chefia: alguma autenticação, sem ser
 * difícil). Um voto por número; trocar pede o mesmo número e PIN; no prazo,
 * congela. Tudo fica no banco: `enquetes` e `votos_de_enquete`.
 *
 * Aqui é o modelo e o que dá para calcular sem tocar no banco.
 */

/** As cores de opção, na ordem da faixa da marca. */
export const CORES_DE_OPCAO = ['azul', 'verde', 'amarelo', 'coral', 'areia', 'grafite'] as const;
export type CorDeOpcao = (typeof CORES_DE_OPCAO)[number];

/** Hex e nome de cada cor, para o formulário e para quem precisa do valor. */
export const COR_HEX: Record<CorDeOpcao, string> = {
  azul: '#01ADFF',
  verde: '#81E2CF',
  amarelo: '#FBCE00',
  coral: '#F37964',
  areia: '#F5DFBB',
  grafite: '#1F2322',
};

export interface OpcaoDeEnquete {
  /** Estável, gerado ao criar; o voto aponta para ele, não para o texto. */
  id: string;
  titulo: string;
  subtitulo: string;
  cor: CorDeOpcao;
}

/** Um dia em destaque no topo da enquete ("SEG 12 · Feriado"). */
export interface DiaEmDestaque {
  /** ISO da data, só a parte do dia: "2026-10-12". */
  data: string;
  rotulo: string;
  cor: CorDeOpcao | null;
}

export interface Enquete {
  id: string;
  slug: string;
  pergunta: string;
  texto: string;
  opcoes: OpcaoDeEnquete[];
  dias: DiaEmDestaque[];
  /** Quem vota vê a contagem na hora. Desligado: só no encerramento. */
  mostrar_resultado: boolean;
  /** Pede nome, WhatsApp e PIN. Desligado: anônima por aparelho. */
  identificar: boolean;
  permitir_troca: boolean;
  /** ISO. Nulo: sem prazo, encerra à mão. */
  encerra_em: string | null;
  /** ISO de quando foi encerrada à mão. Nulo: não foi. */
  encerrada_em: string | null;
  criada_por: string;
  created_at: string;
  deleted_at: string | null;
}

/** O que a função pública `enquete_resultado` devolve. */
export interface ResultadoDaEnquete {
  total: number;
  por_opcao: Record<string, number>;
  /** Só quando a enquete identifica: nome e fim do número. */
  votantes: Array<{ nome: string; fim: string; opcao_id: string; em: string }>;
  ultimo_voto_em: string | null;
}

export const LIMITES = { opcoes: { min: 2, max: 6 }, pergunta: 140, texto: 1200, titulo: 80, subtitulo: 120, rotuloDia: 20, dias: 10 } as const;

export const novaOpcao = (indice: number): OpcaoDeEnquete => ({
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
  titulo: '',
  subtitulo: '',
  cor: CORES_DE_OPCAO[indice % CORES_DE_OPCAO.length],
});

/** Aberta agora? Considera o prazo e o encerramento manual. */
export function estaAberta(e: Pick<Enquete, 'encerra_em' | 'encerrada_em' | 'deleted_at'>, agora: Date = new Date()): boolean {
  if (e.deleted_at || e.encerrada_em) return false;
  if (!e.encerra_em) return true;
  return new Date(e.encerra_em).getTime() > agora.getTime();
}

/** "faltam 2h 40" · "faltam 3 dias" · "encerra em 12 min" · null sem prazo. */
export function tempoRestante(encerra_em: string | null, agora: Date = new Date()): string | null {
  if (!encerra_em) return null;
  const ms = new Date(encerra_em).getTime() - agora.getTime();
  if (ms <= 0) return 'encerrada';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `faltam ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `faltam ${h}h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
  const d = Math.floor(h / 24);
  return `faltam ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** As opções na ordem do resultado: mais votada primeiro; empate mantém a ordem. */
export function ordenarPorVotos(opcoes: OpcaoDeEnquete[], porOpcao: Record<string, number>): OpcaoDeEnquete[] {
  return opcoes
    .map((o, i) => ({ o, i, v: porOpcao[o.id] ?? 0 }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map(x => x.o);
}

export const percentual = (votos: number, total: number): number => (total === 0 ? 0 : Math.round((votos / total) * 100));

/** A opção que está ganhando, ou null em empate ou sem votos. */
export function lider(opcoes: OpcaoDeEnquete[], porOpcao: Record<string, number>): OpcaoDeEnquete | null {
  const ordem = ordenarPorVotos(opcoes, porOpcao);
  if (ordem.length === 0) return null;
  const v0 = porOpcao[ordem[0].id] ?? 0;
  if (v0 === 0) return null;
  if (ordem[1] && (porOpcao[ordem[1].id] ?? 0) === v0) return null;
  return ordem[0];
}

/**
 * O texto de contexto aceita **negrito** entre asteriscos duplos. Devolve
 * pedaços para o React renderizar sem HTML cru.
 */
export function pedacosDoTexto(texto: string): Array<{ negrito: boolean; texto: string }> {
  // `split` com grupo devolve [normal, negrito, normal, negrito…]: o índice
  // ímpar é o que estava entre asteriscos.
  return texto
    .split(/\*\*(.+?)\*\*/g)
    .map((p, i) => ({ negrito: i % 2 === 1, texto: p }))
    .filter(p => p.texto !== '');
}

import type { Confirmacao } from './api';
import { PRAZO } from './modelo';

/**
 * O ranking da disputa da Pizza da Alegria (11/11/2026, mockup aprovado:
 * https://claude.ai/artifact/9zTrCbAGR8hA2h6tMfsZUN). A unidade que mais
 * comprar e a pessoa que mais comprar ganham um brinde; os campeões são
 * anunciados em 17/12, na Integração dos Funcionários.
 *
 * Decisões dele: unidades pelo total de pizzas (as 5 primeiras na arte);
 * pessoas, só as 3 primeiras; no empate, fica à frente quem chegou primeiro
 * ao número (o último pedido mais antigo); a arte e a mensagem vão ao grupo
 * de WhatsApp às sextas, 15h (13/11, 20/11 e 27/11).
 */

export interface Colocado { chave: string; nome: string; unidade?: string; pizzas: number; ultimo: string }
export interface Ranking { unidades: Colocado[]; pessoas: Colocado[]; pizzas: number; pedidos: number }

const comparavel = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** A pessoa: o WhatsApp; sem ele (pedidos de antes de 10/11), o nome e a unidade. Igual à planilha. */
export const chaveDaPessoa = (c: Pick<Confirmacao, 'telefone' | 'nome' | 'unidade_id'>) =>
  (c.telefone ? `w:${c.telefone}` : `n:${comparavel(c.nome)}|${c.unidade_id}`);

/** Mais pizzas primeiro; no empate, quem chegou primeiro ao número. */
const ordem = (a: Colocado, b: Colocado) => b.pizzas - a.pizzas || a.ultimo.localeCompare(b.ultimo) || a.nome.localeCompare(b.nome);

function agrupar(lista: Confirmacao[], chave: (c: Confirmacao) => string, base: (c: Confirmacao) => Omit<Colocado, 'pizzas' | 'ultimo' | 'chave'>): Colocado[] {
  const m = new Map<string, Colocado>();
  for (const c of [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const k = chave(c);
    const atual = m.get(k) ?? { chave: k, ...base(c), pizzas: 0, ultimo: c.created_at };
    atual.pizzas += c.quantidade;
    atual.ultimo = c.created_at; // em ordem: fica o do último pedido
    m.set(k, atual);
  }
  return [...m.values()].sort(ordem);
}

export function calcularRanking(lista: Confirmacao[]): Ranking {
  return {
    unidades: agrupar(lista, (c) => c.unidade_id, (c) => ({ nome: c.unidade_nome })),
    pessoas: agrupar(lista, chaveDaPessoa, (c) => ({ nome: c.nome, unidade: c.unidade_nome })),
    pizzas: lista.reduce((a, c) => a + c.quantidade, 0),
    pedidos: lista.length,
  };
}

/** Dias até o fim dos pedidos (30/11, inclusive). 1 = hoje é o último dia; 0 = encerrado. */
export function diasQueFaltam(agora: Date = new Date()): number {
  const ms = PRAZO.getTime() - agora.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 864e5);
}

const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export const textoDosDias = (dias: number) => (dias <= 0 ? 'pedidos encerrados' : dias === 1 ? 'último dia' : `faltam ${dias} dias`);

/** A mensagem que vai junto da imagem no grupo de WhatsApp. */
export function mensagemDoRanking(r: Ranking, agora: Date = new Date()): string {
  const dias = diasQueFaltam(agora);
  const linhas = [`🍕 *Ranking da Pizza da Alegria · parcial até ${dataCurta(agora)}*`, ''];
  const [u1, u2, u3] = r.unidades;
  if (u1) {
    linhas.push(`🥇 *${u1.nome}* lidera entre as unidades, com ${plural(u1.pizzas, 'pizza', 'pizzas')}!`);
    if (u2) linhas.push(`🥈 ${u2.nome} · ${u2.pizzas}`);
    if (u3) linhas.push(`🥉 ${u3.nome} · ${u3.pizzas}`);
    linhas.push('');
  }
  const p1 = r.pessoas[0];
  if (p1) linhas.push(`Entre as pessoas, *${p1.nome}* (${p1.unidade}) está na frente, com ${plural(p1.pizzas, 'pizza', 'pizzas')}. 👏`, '');
  linhas.push(`Já são *${plural(r.pizzas, 'pizza', 'pizzas')}*, e cada uma ajuda a tornar o Natal das crianças atendidas pela ANA Brasil ainda mais especial. 🎄`, '');
  linhas.push('A unidade campeã e quem mais comprar ganham um brinde. Os campeões serão anunciados na Integração dos Funcionários, em 17/12.');
  if (dias <= 0) linhas.push('Os pedidos já foram encerrados. Obrigado a todos que participaram! 🧡');
  else if (dias === 1) linhas.push('*Hoje é o último dia* para pedir! ⏰');
  else if (dias <= 4) linhas.push(`*Última semana!* Os pedidos fecham na segunda, *30/11*. ⏰`);
  else linhas.push(`Ainda dá tempo: pedidos até *30/11*.`);
  if (dias > 0) linhas.push('👉 https://app.anabrasil.org/pizza-da-alegria?c=3');
  return linhas.join('\n');
}

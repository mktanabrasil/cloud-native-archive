/**
 * O ranking da disputa da Pizza da Alegria, no servidor (11/11/2026): a mesma
 * conta e a mesma mensagem de src/lib/pizza/ranking.ts, que é a referência.
 * Mudou lá, muda aqui (os testes de lá cobrem as regras).
 *
 * Unidades pelo total de pizzas; pessoas pelo WhatsApp (sem ele, nome e
 * unidade); no empate, fica à frente quem chegou primeiro ao número.
 */

export interface Pedido {
  nome: string;
  unidade_id: string;
  unidade_nome: string;
  quantidade: number;
  telefone?: string | null;
  created_at: string;
}
export interface Colocado { chave: string; nome: string; unidade?: string; pizzas: number; ultimo: string }
export interface Ranking { unidades: Colocado[]; pessoas: Colocado[]; pizzas: number; pedidos: number }

/** Fim dos pedidos: 05/12/2026, 23:59 em Brasília. A mesma data de src/lib/pizza/modelo.ts. */
export const PRAZO = new Date('2026-12-06T00:00:00-03:00');

const comparavel = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const chaveDaPessoa = (c: Pedido) => (c.telefone ? `w:${c.telefone}` : `n:${comparavel(c.nome)}|${c.unidade_id}`);
const ordem = (a: Colocado, b: Colocado) => b.pizzas - a.pizzas || a.ultimo.localeCompare(b.ultimo) || a.nome.localeCompare(b.nome);

function agrupar(lista: Pedido[], chave: (c: Pedido) => string, base: (c: Pedido) => Omit<Colocado, 'pizzas' | 'ultimo' | 'chave'>): Colocado[] {
  const m = new Map<string, Colocado>();
  for (const c of [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const k = chave(c);
    const atual = m.get(k) ?? { chave: k, ...base(c), pizzas: 0, ultimo: c.created_at };
    atual.pizzas += c.quantidade;
    atual.ultimo = c.created_at;
    m.set(k, atual);
  }
  return [...m.values()].sort(ordem);
}

export function calcularRanking(lista: Pedido[]): Ranking {
  return {
    unidades: agrupar(lista, (c) => c.unidade_id, (c) => ({ nome: c.unidade_nome })),
    pessoas: agrupar(lista, chaveDaPessoa, (c) => ({ nome: c.nome, unidade: c.unidade_nome })),
    pizzas: lista.reduce((a, c) => a + c.quantidade, 0),
    pedidos: lista.length,
  };
}

export function diasQueFaltam(agora: Date = new Date()): number {
  const ms = PRAZO.getTime() - agora.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 864e5);
}

export const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export const textoDosDias = (dias: number) => (dias <= 0 ? 'pedidos encerrados' : dias === 1 ? 'último dia' : `faltam ${dias} dias`);

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
  else if (dias <= 4) linhas.push(`*Última semana!* Os pedidos fecham no sábado, *05/12*. ⏰`);
  else linhas.push(`Ainda dá tempo: pedidos até *05/12*.`);
  if (dias > 0) linhas.push('👉 https://app.anabrasil.org/pizza-da-alegria?c=3');
  return linhas.join('\n');
}

import type { Alimento, Fornecedor, ItemComDetalhe } from '@/types';
import { chaveDe } from './itens';

/**
 * A comida por refeição (decisão de 22/09/2026, mockup aprovado).
 *
 * Até então cada refeição ligada ("Almoço", "Lanche") abria uma caixa de
 * texto livre, e a coordenação lia "arroz pra 120, o frango vem da padaria,
 * suco a unidade traz" e montava a lista de compras de cabeça. Agora cada
 * refeição tem linhas: alimento, quantidade e quem fornece. "ANA" quer dizer
 * que precisamos providenciar; Unidade, Parceiro e Doação são coisas que
 * chegam por conta de outra pessoa, com o nome ao lado. Mais o cardápio da
 * refeição, que é como ela vai ser servida.
 *
 * O texto livre antigo (`detalhes`) não se perde: aparece como "Observação
 * antiga" enquanto existir. Nada aqui apaga o que a gestora escreveu.
 */

export const FORNECEDORES: Fornecedor[] = ['ANA', 'Unidade', 'Parceiro', 'Doação'];
export const LIMITE_CARDAPIO = 500;
export const LIMITE_CAMPO = 80;

export const novoAlimento = (): Alimento => ({ nome: '', quantidade: '', fornecedor: 'ANA' });

/** Precisamos providenciar? Sim quando a ANA é quem fornece. */
export const providenciar = (a: Alimento): boolean => a.fornecedor === 'ANA';

/** "ANA" · "Unidade" · "Parceiro · Padaria Sol" · "Doação · família Silva". */
export const textoDoFornecedor = (a: Alimento): string =>
  a.fornecedor === 'ANA' || !a.quem?.trim() ? a.fornecedor : `${a.fornecedor} · ${a.quem.trim()}`;

/** A refeição tem a tabelinha nova (mesmo vazia) em vez do texto antigo? */
export const temTabela = (i: ItemComDetalhe): boolean => Array.isArray(i.alimentos);

export const alimentosDe = (itens: ItemComDetalhe[] | null | undefined, chave: string): Alimento[] =>
  (itens ?? []).find(i => chaveDe(i) === chave)?.alimentos ?? [];

export const cardapioDe = (itens: ItemComDetalhe[] | null | undefined, chave: string): string =>
  (itens ?? []).find(i => chaveDe(i) === chave)?.cardapio ?? '';

/** Troca a lista de alimentos de uma refeição, sem mexer nas demais. */
export function comAlimentos(itens: ItemComDetalhe[] | null | undefined, chave: string, alimentos: Alimento[]): ItemComDetalhe[] {
  return (itens ?? []).map(i => (chaveDe(i) === chave ? { ...i, alimentos } : i));
}

export function comCardapio(itens: ItemComDetalhe[] | null | undefined, chave: string, cardapio: string): ItemComDetalhe[] {
  return (itens ?? []).map(i => (chaveDe(i) === chave ? { ...i, cardapio } : i));
}

/** Pronto para gravar: aparado, no limite, sem linha sem nome. */
export function limparAlimentos(alimentos: Alimento[] | null | undefined): Alimento[] {
  return (alimentos ?? [])
    .filter(a => a.nome.trim())
    .map(a => ({
      nome: a.nome.trim().slice(0, LIMITE_CAMPO),
      quantidade: (a.quantidade ?? '').trim().slice(0, LIMITE_CAMPO),
      fornecedor: FORNECEDORES.includes(a.fornecedor) ? a.fornecedor : 'ANA',
      ...(a.fornecedor !== 'ANA' && a.quem?.trim() ? { quem: a.quem.trim().slice(0, LIMITE_CAMPO) } : {}),
    }));
}

/** "2 alimentos · 1 a providenciar", para o lado do interruptor da refeição. */
export function resumoDaRefeicao(alimentos: Alimento[] | null | undefined): string {
  const lista = limparAlimentos(alimentos);
  if (lista.length === 0) return '';
  const n = lista.length;
  const p = lista.filter(providenciar).length;
  const partes = [`${n} ${n === 1 ? 'alimento' : 'alimentos'}`];
  if (p > 0) partes.push(`${p} a providenciar`);
  return partes.join(' · ');
}

/** "Arroz e feijão (120 porções)" · "Bolo de cenoura". */
export const alimentoEmTexto = (a: Alimento): string => (a.quantidade ? `${a.nome} (${a.quantidade})` : a.nome);

/** Tudo que a ANA precisa providenciar, refeição por refeição. */
export function paraProvidenciar(itens: ItemComDetalhe[] | null | undefined): Array<{ refeicao: string; alimento: Alimento }> {
  const saida: Array<{ refeicao: string; alimento: Alimento }> = [];
  for (const i of itens ?? []) {
    if (i.item === 'Nenhum') continue;
    for (const a of limparAlimentos(i.alimentos)) if (providenciar(a)) saida.push({ refeicao: i.item, alimento: a });
  }
  return saida;
}

/**
 * As linhas de uma refeição para colar no WhatsApp:
 *   • Almoço
 *     – Arroz e feijão, 120 porções — providenciar (ANA)
 *     – Suco, 40 L — Unidade
 *     Cardápio: …
 */
export function linhasDaRefeicao(i: ItemComDetalhe): string[] {
  const linhas = [`• ${i.item}`];
  for (const a of limparAlimentos(i.alimentos)) {
    const qtd = a.quantidade ? `, ${a.quantidade}` : '';
    linhas.push(`  – ${a.nome}${qtd} — ${providenciar(a) ? 'providenciar (ANA)' : textoDoFornecedor(a)}`);
  }
  if (i.cardapio?.trim()) linhas.push(`  Cardápio: ${i.cardapio.trim()}`);
  if (i.detalhes?.trim()) linhas.push(`  Obs.: ${i.detalhes.trim()}`);
  return linhas;
}

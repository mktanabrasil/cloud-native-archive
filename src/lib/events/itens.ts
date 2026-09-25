import type { ItemComDetalhe } from '@/types';
import { limparAlimentos, linhasDaRefeicao, temTabela } from './alimentos';

/**
 * Alimentação e equipamentos como lista de itens com detalhe.
 *
 * Até 08/09/2026 cada grupo era uma string: "Almoço, Lanche, Café dos
 * voluntários". O que se sabia do almoço (para quantos, a que hora, quem
 * traz) ia para um campo geral, misturado com o lanche e o café. Agora cada
 * item ligado tem o seu detalhe, e a string continua existindo — derivada da
 * lista — para validação, filtros e telas antigas não mudarem.
 *
 * Chaves: um item fixo é identificado pelo próprio nome ("Almoço"); o texto
 * livre do "Outro" pela chave `OUTRO`, porque o nome dele muda enquanto a
 * pessoa digita e o detalhe não pode se perder a cada tecla.
 */

export const OUTRO = '__outro__';
export const LIMITE_DETALHE = 300;

export const OPCOES_COMIDA = ['Almoço', 'Café da manhã / da tarde', 'Lanche', 'Jantar', 'Nenhum'];
/**
 * "Notebook" saiu em 22/09/2026: não é equipamento que a ANA empresta para
 * evento. Um evento antigo com "Notebook" gravado continua legível — cai em
 * "Outro equipamento", com o texto preservado.
 */
export const OPCOES_EQUIP = ['Som', 'Microfone', 'Projetor', 'Televisão', 'Nenhum'];

/**
 * Quantos de cada equipamento a ANA tem, para a gestora saber o que dá para
 * pedir. Só o que já foi contado (22/09/2026): o levantamento dos demais
 * vem depois e entra aqui.
 */
export const ESTOQUE_EQUIP: Partial<Record<string, number>> = { Projetor: 1 };

/** "temos 1" · "temos 3", ou vazio quando ainda não foi contado. */
export const pistaDoEstoque = (opcao: string): string => {
  const n = ESTOQUE_EQUIP[opcao];
  return n === undefined ? '' : `temos ${n}`;
};

const separar = (valor: string | null | undefined): string[] =>
  (valor ?? '').split(', ').map(v => v.trim()).filter(Boolean);

export const chaveDe = (i: ItemComDetalhe): string => (i.outro ? OUTRO : i.item);

/**
 * A lista que corresponde ao valor atual do grupo, preservando os detalhes
 * já escritos. Chamada a cada mudança nos interruptores ou no texto do
 * "Outro": o que foi desligado sai, o que continua ligado mantém o detalhe.
 */
export function sincronizarItens(valor: string | null | undefined, atuais: ItemComDetalhe[] | null | undefined, opcoes: string[]): ItemComDetalhe[] {
  const partes = separar(valor);
  const mapa = new Map((atuais ?? []).map(i => [chaveDe(i), i]));
  /** O que a refeição já tinha: detalhe, tabela e cardápio. */
  const guardado = (chave: string) => {
    const g = mapa.get(chave);
    return { detalhes: g?.detalhes ?? '', ...(g?.alimentos ? { alimentos: g.alimentos } : {}), ...(g?.cardapio ? { cardapio: g.cardapio } : {}) };
  };
  const itens: ItemComDetalhe[] = [];
  const livres: string[] = [];
  for (const p of partes) {
    if (opcoes.includes(p)) {
      if (p === 'Nenhum') return [{ item: 'Nenhum', detalhes: '' }];
      itens.push({ item: p, ...guardado(p) });
    } else {
      livres.push(p);
    }
  }
  // Tudo que não é opção fixa é um "Outro" só (varredura de 25/09/2026).
  // Antes cada texto livre virava um item com a mesma chave OUTRO, e a tela
  // só mostrava o primeiro: "Notebook, Extensão" perdia a "Extensão" no
  // primeiro toque. E um item antigo gravado sem a marca `outro` (o
  // "Notebook" que saiu da lista em 22/09) perdia o detalhe, porque a busca
  // era só pela chave OUTRO. Agora vale a chave OUTRO e, se não houver, o
  // detalhe de cada texto pelo próprio nome.
  if (livres.length > 0) {
    const doOutro = mapa.get(OUTRO);
    let extra: Omit<ItemComDetalhe, 'item'>;
    if (doOutro) {
      extra = guardado(OUTRO);
    } else {
      const antigos = livres.map(l => mapa.get(l)).filter((g): g is ItemComDetalhe => !!g);
      const comTexto = antigos.filter(g => g.detalhes?.trim());
      const detalhes = comTexto.length === 1
        ? comTexto[0].detalhes
        : comTexto.map(g => `${g.item}: ${g.detalhes.trim()}`).join(' · ');
      const comTabela = antigos.find(g => g.alimentos || g.cardapio);
      extra = {
        detalhes: detalhes.slice(0, LIMITE_DETALHE),
        ...(comTabela?.alimentos ? { alimentos: comTabela.alimentos } : {}),
        ...(comTabela?.cardapio ? { cardapio: comTabela.cardapio } : {}),
      };
    }
    itens.push({ item: livres.join(', '), ...extra, outro: true });
  }
  return itens;
}

/** Troca o detalhe de um item (por chave), sem mexer nos demais. */
export function comDetalhe(itens: ItemComDetalhe[] | null | undefined, chave: string, detalhes: string): ItemComDetalhe[] {
  return (itens ?? []).map(i => (chaveDe(i) === chave ? { ...i, detalhes } : i));
}

/** O detalhe de uma chave, ou vazio. */
export function detalheDe(itens: ItemComDetalhe[] | null | undefined, chave: string): string {
  return (itens ?? []).find(i => chaveDe(i) === chave)?.detalhes ?? '';
}

/** Pronto para gravar: aparado, no limite, sem item sem nome. */
export function limparItens(itens: ItemComDetalhe[] | null | undefined): ItemComDetalhe[] {
  return (itens ?? [])
    .filter(i => i.item.trim())
    .map(i => ({
      item: i.item.trim(),
      detalhes: (i.detalhes ?? '').trim().slice(0, LIMITE_DETALHE),
      ...(i.outro ? { outro: true } : {}),
      // Alimentação por refeição (22/09/2026): a tabela e o cardápio viajam junto.
      ...(temTabela(i) ? { alimentos: limparAlimentos(i.alimentos) } : {}),
      ...(i.cardapio?.trim() ? { cardapio: i.cardapio.trim() } : {}),
    }));
}

/** A string de compatibilidade: "Almoço, Lanche, Café dos voluntários". */
export function paraTexto(itens: ItemComDetalhe[] | null | undefined): string {
  return limparItens(itens).map(i => i.item).join(', ');
}

/**
 * Para um evento gravado antes do modelo (só a string), a lista sem
 * detalhes — assim a tela nova funciona com o dado antigo.
 */
export function itensDeTexto(valor: string | null | undefined, opcoes: string[]): ItemComDetalhe[] {
  return sincronizarItens(valor, [], opcoes);
}

/** Itens que mostram algo no resumo: tudo menos "Nenhum". */
export function itensDoResumo(itens: ItemComDetalhe[] | null | undefined): ItemComDetalhe[] {
  return limparItens(itens).filter(i => i.item !== 'Nenhum');
}

/** Um item por linha, para colar no WhatsApp. */
export function linhasParaCopiar(titulo: string, itens: ItemComDetalhe[] | null | undefined): string {
  const lista = itensDoResumo(itens);
  if (lista.length === 0) return `${titulo}: nenhum`;
  return [`${titulo}:`, ...lista.flatMap(i => (temTabela(i) ? linhasDaRefeicao(i) : [`• ${i.item}${i.detalhes ? ` — ${i.detalhes}` : ''}`]))].join('\n');
}

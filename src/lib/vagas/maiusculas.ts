/**
 * Maiúsculas automáticas nos campos do candidato (06/10/2026).
 *
 * No celular quase todo mundo digita tudo em minúsculas, e a ficha chegava ao
 * RH como "leonardo garbo rodrigues" e "campinas/sp". Ao salvar, o app ajeita:
 * cada palavra com a inicial maiúscula, menos as ligações do português no meio
 * (da, de, do, e…), e a sigla do estado depois da barra ou do hífen em
 * maiúsculas ("Campinas/SP").
 *
 * O que a pessoa escreveu com maiúscula de propósito fica como está: siglas
 * (SESC, TI) e nomes como McDonald's. A exceção é o nome de pessoa todo em
 * maiúsculas ("LEONARDO SILVA"), que vira "Leonardo Silva".
 */

const LIGACOES = new Set(['da', 'das', 'de', 'des', 'di', 'do', 'dos', 'du', 'e', 'em', 'na', 'nas', 'no', 'nos', 'para', 'por', 'a', 'o', 'as', 'os', 'com']);

const UFS = new Set(['ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to']);

const inicial = (p: string) => p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1);

/** Uma palavra (pode ter hífen ou apóstrofo dentro: "joão-pedro", "d'ávila"). */
function palavra(p: string, primeira: boolean, pessoa: boolean): string {
  const minuscula = p === p.toLocaleLowerCase('pt-BR');
  const maiuscula = p === p.toLocaleUpperCase('pt-BR') && /\p{L}{2,}/u.test(p);
  if (!minuscula && !(pessoa && maiuscula)) return p; // escrito assim de propósito
  const base = p.toLocaleLowerCase('pt-BR');
  if (!primeira && LIGACOES.has(base)) return base;
  return base.split(/(['’-])/).map((pedaco, i, todos) => {
    if (pedaco === '' || /['’-]/.test(pedaco)) return pedaco;
    // d'ávila → d'Ávila; a primeira parte curta antes do apóstrofo fica minúscula
    if (todos[i + 1] && /['’]/.test(todos[i + 1]) && pedaco.length <= 2 && !(primeira && i === 0)) return pedaco;
    return inicial(pedaco);
  }).join('');
}

/**
 * Ajeita as maiúsculas de um nome, lugar ou título. `pessoa` também converte
 * nome escrito todo em maiúsculas. Espaços repetidos viram um só.
 */
export function comMaiusculas(texto: string, { pessoa = false }: { pessoa?: boolean } = {}): string {
  const limpo = texto.trim().replace(/\s+/g, ' ');
  if (!limpo) return limpo;
  // "campinas/sp", "campinas - sp", "campinas, sp": a sigla do estado no fim
  const uf = limpo.match(/^(.*?)(\s*[/,-]\s*)(\p{L}{2})$/u);
  if (uf && UFS.has(uf[3].toLocaleLowerCase('pt-BR'))) {
    return `${comMaiusculas(uf[1], { pessoa })}${uf[2]}${uf[3].toLocaleUpperCase('pt-BR')}`;
  }
  return limpo.split(' ').map((p, i) => palavra(p, i === 0, pessoa)).join(' ');
}

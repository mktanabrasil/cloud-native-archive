/**
 * A marcação dos textos do Calendário Anual (13/11/2026): simples o bastante
 * para as coordenadoras escreverem num campo de texto comum.
 *
 * - uma linha por parágrafo;
 * - "- " (ou "• ") no começo da linha vira item de lista;
 * - **assim** vira negrito;
 * - linha em branco dá um respiro entre blocos;
 * - {ano}, {tema} e {TEMA} viram o ano, o tema e o tema em maiúsculas.
 */

export interface Trecho { texto: string; negrito: boolean }
export type Bloco =
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'item'; trechos: Trecho[] }
  | { tipo: 'respiro' };

/** Troca {ano}, {tema} e {TEMA}. Sem tema, fica um lembrete entre colchetes. */
export function trocarMarcas(texto: string, ano: number, tema: string): string {
  const t = tema.trim() || '[tema do ano]';
  return texto.replace(/\{ano\}/g, String(ano)).replace(/\{TEMA\}/g, t.toLocaleUpperCase('pt-BR')).replace(/\{tema\}/g, t);
}

/** Separa o negrito: "a **b** c" → [a ][b][ c]. Asterisco sem par fica como está. */
export function trechosDe(linha: string): Trecho[] {
  const partes = linha.split('**');
  if (partes.length % 2 === 0) return [{ texto: linha, negrito: false }];
  return partes.map((texto, i) => ({ texto, negrito: i % 2 === 1 })).filter(t => t.texto.length > 0);
}

/** O corpo de uma seção em blocos, na ordem. Respiros repetidos viram um só. */
export function blocosDe(corpo: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const bruta of corpo.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim();
    if (!linha) {
      if (blocos.length && blocos[blocos.length - 1].tipo !== 'respiro') blocos.push({ tipo: 'respiro' });
      continue;
    }
    const item = /^[-•]\s+/.exec(linha);
    if (item) blocos.push({ tipo: 'item', trechos: trechosDe(linha.slice(item[0].length)) });
    else blocos.push({ tipo: 'paragrafo', trechos: trechosDe(linha) });
  }
  while (blocos.length && blocos[blocos.length - 1].tipo === 'respiro') blocos.pop();
  return blocos;
}

export interface Palavra { texto: string; negrito: boolean; largura: number; espacoAntes: boolean }

/**
 * Quebra trechos em linhas que caibam em `largura`, medindo cada palavra com o
 * estilo dela. O espaço entre palavras é medido à parte, porque o negrito e o
 * regular têm espaços de larguras diferentes.
 */
export function quebrarEmLinhas(
  trechos: Trecho[],
  largura: number,
  medir: (texto: string, negrito: boolean) => number,
): Palavra[][] {
  const palavras: Palavra[] = [];
  let espacoPendente = false;
  for (const t of trechos) {
    const pedacos = t.texto.split(/(\s+)/);
    for (const p of pedacos) {
      if (!p) continue;
      if (/^\s+$/.test(p)) { espacoPendente = palavras.length > 0; continue; }
      // "**negrito**," → a vírgula cola na palavra anterior, sem espaço.
      palavras.push({ texto: p, negrito: t.negrito, largura: medir(p, t.negrito), espacoAntes: espacoPendente });
      espacoPendente = false;
    }
    if (/\s$/.test(t.texto)) espacoPendente = palavras.length > 0;
  }
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let usado = 0;
  for (const p of palavras) {
    const espaco = atual.length && p.espacoAntes ? medir(' ', p.negrito) : 0;
    if (atual.length && usado + espaco + p.largura > largura) {
      linhas.push(atual);
      atual = [{ ...p, espacoAntes: false }];
      usado = p.largura;
    } else {
      atual.push(atual.length ? p : { ...p, espacoAntes: false });
      usado += espaco + p.largura;
    }
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

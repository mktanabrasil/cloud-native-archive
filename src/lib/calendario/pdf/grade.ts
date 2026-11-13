import { UNIDADES_DO_CALENDARIO, type ItemDoCalendario } from '../regras';

/**
 * O que vai escrito em cada dia da grade do mês (13/11/2026), no padrão de 2026:
 *
 * - o primeiro item leva o número do dia: "21 - TIRADENTES";
 * - feriado em coral e negrito, com "FERIADO" uma linha abaixo;
 * - data relevante em traço fino;
 * - atividade em preto, negrito quando está em destaque;
 * - tudo em maiúsculas; a unidade vai entre parênteses quando não são todas.
 *
 * A letra é de 10 pt, como em 2026; quando não cabe, diminui até 6,5 pt; se nem assim couber, as últimas
 * linhas saem e a célula fica marcada como cheia, para a prévia avisar.
 */

export type EstiloDaLetra = 'light' | 'normal' | 'bold';
export interface LinhaDaCelula { texto: string; estilo: EstiloDaLetra; cor: string; /** Distância da primeira linha base, em pt. */ dy: number }
export interface Celula { tamanho: number; linhas: LinhaDaCelula[]; cheia: boolean }

export const CORAL = '#f37964';
export const PRETO = '#000000';
const TAMANHOS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5];

export function sufixoDasUnidades(unidades: string[]): string {
  const so = UNIDADES_DO_CALENDARIO.filter(u => unidades.includes(u));
  if (so.length === 0 || so.length === UNIDADES_DO_CALENDARIO.length) return '';
  return ` (${so.join(' e ')})`;
}

const maiusculas = (t: string) => t.toLocaleUpperCase('pt-BR');

interface Bloco { texto: string; estilo: EstiloDaLetra; cor: string; feriado: boolean }

function blocosDoDia(dia: number, itens: ItemDoCalendario[]): Bloco[] {
  if (!itens.length) return [{ texto: String(dia), estilo: 'light', cor: PRETO, feriado: false }];
  return itens.map((i, n) => {
    const texto = (n === 0 ? `${dia} - ` : '') + maiusculas(i.texto.trim() + sufixoDasUnidades(i.unidades));
    if (i.tipo === 'feriado') return { texto, estilo: 'bold' as const, cor: CORAL, feriado: true };
    if (i.tipo === 'data') return { texto, estilo: 'light' as const, cor: PRETO, feriado: false };
    return { texto, estilo: i.destaque ? 'bold' as const : 'normal' as const, cor: PRETO, feriado: false };
  });
}

/** Quebra simples por palavras; palavra maior que a largura vai sozinha na linha. */
function quebrar(texto: string, largura: number, medir: (t: string) => number): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && medir(tentativa) > largura) { linhas.push(atual); atual = palavra; } else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/**
 * Monta a célula de um dia. `itens` já vem filtrado e na ordem do PDF
 * (`itensDoDia` + `vaiProPdf`). `medir(texto, estilo, tamanho)` dá a largura em pt.
 * `altura` é o espaço da primeira linha base até o pé da célula.
 */
export function montarCelula(
  dia: number,
  itens: ItemDoCalendario[],
  largura: number,
  altura: number,
  medir: (texto: string, estilo: EstiloDaLetra, tamanho: number) => number,
): Celula {
  const blocos = blocosDoDia(dia, itens);
  const tentar = (tamanho: number) => {
    const entrelinha = tamanho * 1.08;
    const linhas: LinhaDaCelula[] = [];
    let y = 0;
    blocos.forEach((b, n) => {
      if (n > 0) y += entrelinha + tamanho * 0.45;
      quebrar(b.texto, largura, t => medir(t, b.estilo, tamanho)).forEach((t, k) => {
        if (k > 0) y += entrelinha;
        linhas.push({ texto: t, estilo: b.estilo, cor: b.cor, dy: y });
      });
      if (b.feriado) { y += entrelinha * 2; linhas.push({ texto: 'FERIADO', estilo: 'bold', cor: CORAL, dy: y }); }
    });
    return { linhas, fim: y };
  };
  for (const tamanho of TAMANHOS) {
    const r = tentar(tamanho);
    if (r.fim <= altura) return { tamanho, linhas: r.linhas, cheia: false };
  }
  const menor = TAMANHOS[TAMANHOS.length - 1];
  const r = tentar(menor);
  return { tamanho: menor, linhas: r.linhas.filter(l => l.dy <= altura), cheia: true };
}

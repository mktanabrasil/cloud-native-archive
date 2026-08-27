/**
 * Quanto conteúdo passou do que cabe na folha.
 *
 * Existe porque o corte é **silencioso**: a grade da folha é `flex-1` com
 * `min-height: auto`, então ela **cresce** até a altura do conteúdo — numa
 * folha onde cabiam 999px ela mediu 1290px. Quem recorta é o `overflow-hidden`
 * do miolo, não a grade. Consequência prática, e medida: perguntar a altura da
 * grade responde a altura já crescida, e a conta conclui que tudo cabe mesmo
 * com dois parágrafos fora da página.
 *
 * A medida certa é o espaço visível — do topo da área de conteúdo até o fim do
 * miolo, que é exatamente o topo da faixa institucional.
 */

/** Uma peça já medida na folha. */
export interface PecaMedida {
  /** Distância do topo da grade até o topo da peça. */
  topo: number;
  altura: number;
}

export interface Transbordo {
  /** Última coordenada que ainda cabe na mancha. */
  limite: number;
  /** Índice da primeira peça que ultrapassa o limite; -1 quando nenhuma. */
  primeiraFora: number;
  /** Quantos pixels a última peça passa do limite. Zero quando cabe. */
  sobra: number;
  /** Quantas peças ficam total ou parcialmente fora. */
  pecasFora: number;
  transborda: boolean;
}

/** Respiro inferior da grade (`py-6` do `JournalPageView`). */
export const RESPIRO_INFERIOR = 24;

/**
 * A conta, isolada do DOM para poder ser testada.
 *
 * `alturaVisivel` é o espaço realmente pintado, não a altura da grade.
 */
export function calcularTransbordo(pecas: PecaMedida[], alturaVisivel: number): Transbordo {
  const limite = Math.max(0, alturaVisivel - RESPIRO_INFERIOR);

  let primeiraFora = -1;
  let pecasFora = 0;
  let maiorBase = 0;

  pecas.forEach((peca, indice) => {
    const base = peca.topo + peca.altura;
    if (base > maiorBase) maiorBase = base;
    if (base > limite) {
      if (primeiraFora === -1) primeiraFora = indice;
      pecasFora += 1;
    }
  });

  return {
    limite,
    primeiraFora,
    sobra: Math.max(0, Math.round(maiorBase - limite)),
    pecasFora,
    transborda: primeiraFora !== -1,
  };
}

/**
 * Mede uma folha montada na tela.
 *
 * `grade` é o elemento da grade de blocos (`[data-journal-canvas]`). Sobe dois
 * níveis até o miolo — a mesma hierarquia do `JournalPageView` — para
 * descobrir o espaço visível. Devolve `null` quando a folha ainda não está no
 * layout, caso em que medir só produziria zeros.
 */
export function medirFolha(grade: HTMLElement | null): Transbordo | null {
  if (!grade) return null;

  const area = grade.parentElement;
  const miolo = area?.parentElement;
  if (!area || !miolo) return null;

  const alturaVisivel = miolo.clientHeight - area.offsetTop;
  if (alturaVisivel <= 0) return null;

  const pecas: PecaMedida[] = Array.from(grade.children).map((filho) => {
    const el = filho as HTMLElement;
    return { topo: el.offsetTop, altura: el.offsetHeight };
  });
  if (!pecas.length) return null;

  return calcularTransbordo(pecas, alturaVisivel);
}

/** A frase que a diretora lê. Fala de conteúdo, não de pixels. */
export function avisoDeTransbordo(transbordo: Transbordo | null): string | null {
  if (!transbordo?.transborda) return null;

  const { pecasFora } = transbordo;
  return pecasFora === 1
    ? 'Uma peça desta página não está cabendo e vai sumir no PDF.'
    : `${pecasFora} peças desta página não estão cabendo e vão sumir no PDF.`;
}

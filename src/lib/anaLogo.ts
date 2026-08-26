import raw from '@/assets/ana-brasil-logo.svg?raw';

/**
 * Tamanho intrínseco do logo, do `viewBox` do arquivo.
 *
 * Precisa ir nos atributos `width`/`height` de todo `<img>` que o use, mesmo
 * quando o CSS define outra altura. O motivo é a exportação em PDF.
 *
 * Com `h-9 w-auto` e sem esses atributos, a largura só existe depois que a
 * imagem carrega — medido, a caixa fica em **0 × 36** até lá. O html2canvas
 * monta um documento clonado e mede na hora: encontra largura zero e não
 * desenha nada, em silêncio. No celular isso acontece sempre; no desktop a
 * imagem já está decodificada do preview e a medida chega a tempo.
 *
 * Com os atributos o navegador conhece a proporção antes de qualquer
 * carregamento, e `w-auto` resolve para 90px na hora. É a mesma razão pela qual
 * as Formas ANA nunca sumiram do PDF: elas sempre declararam `width`/`height`.
 */
export const ANA_LOGO_SIZE = { width: 2206, height: 883 } as const;

/**
 * Logo como data URI, e não como arquivo servido pela rede.
 *
 * Não é o que corrige o sumiço no PDF — isso são os atributos acima. É só uma
 * dependência a menos no caminho da exportação: uma requisição que não precisa
 * ser feita nem esperada. Custa cerca de 7 KB no bundle.
 */
export const ANA_LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(raw)}`;

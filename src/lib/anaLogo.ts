import raw from '@/assets/ana-brasil-logo.svg?raw';

/** Proporção do desenho, do `viewBox` do arquivo: 2206 / 883. */
const RAZAO = 2206 / 883;

/**
 * Medidas desenhadas do logo, para irem nos atributos `width`/`height`.
 *
 * Atributo, e nunca CSS. É a diferença entre o logo e as Formas ANA, e foi o
 * que fez um sair do PDF do celular e o outro não: as formas sempre
 * declararam o tamanho por atributo; o logo vinha de `h-9 w-auto`, e largura
 * `auto` só existe depois que a imagem carrega. O html2canvas mede o
 * documento clonado na hora, encontra zero e não desenha nada, em silêncio.
 *
 * Sem `object-fit` também: a caixa já tem a proporção exata do desenho, e o
 * html2canvas não suporta essa propriedade — é por isso que as fotos do
 * jornal precisam ser convertidas em `background-image` na exportação.
 */
export const anaLogoSize = (altura: number) => ({
  width: Math.round(altura * RAZAO),
  height: altura,
});

/** Cor única do desenho, hoje declarada via classe `.cls-2` no arquivo. */
const TINTA = '#484848';

/**
 * Normaliza o SVG do logo para a forma que o html2canvas sabe desenhar.
 *
 * O arquivo vem do Figma com três coisas que o exportador não digere bem, e
 * nenhuma delas existe no SVG das Formas ANA — que nunca sumiram do PDF:
 *
 * 1. **Prólogo XML e DOCTYPE** apontando para um DTD externo na w3.org. Ao
 *    desenhar num canvas, o navegador pode tentar resolver esse DTD e abortar.
 * 2. **`<style>` interno com classes.** Folha de estilo dentro de SVG carregado
 *    por `<img>` nem sempre é aplicada nesse caminho: o desenho existe, mas sai
 *    sem preenchimento — invisível.
 * 3. **Retângulos `.cls-1`** com `fill: none`, que só existem como respiro no
 *    arquivo original e não pintam nada.
 *
 * A saída é estruturalmente igual à das formas: `<svg>` direto, sem defs, com
 * `fill` em cada path.
 */
function normalizar(svg: string): string {
  return svg
    // 1. fora prólogo e DOCTYPE — mantém só a partir de `<svg`
    .slice(svg.indexOf('<svg'))
    // 2. fora o bloco de estilos
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    // 3. fora os retângulos invisíveis
    .replace(/<rect[^>]*class="cls-1"[^>]*\/>/g, '')
    // 4. a classe vira atributo, como nas formas
    .replace(/class="cls-2"/g, `fill="${TINTA}"`);
}

/**
 * Logo como data URI já normalizado.
 *
 * Data URI, e não arquivo: uma requisição a menos no caminho da exportação.
 */
export const ANA_LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(normalizar(raw))}`;

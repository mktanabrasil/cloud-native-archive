import raw from '@/assets/ana-brasil-logo.svg?raw';

/** Proporção do desenho, do `viewBox` do arquivo. */
const RAZAO = 2206 / 883;
const TINTA = '#484848';

/**
 * Normaliza o SVG para a forma que o html2canvas sabe desenhar.
 *
 * O arquivo vem do Figma com prólogo XML, DOCTYPE apontando para um DTD externo
 * e as cores num `<style>` interno com classes — nada disso existe no SVG das
 * Formas ANA, que sempre saíram no PDF. Sai tudo; o `fill` vira atributo.
 */
const NORMALIZADO = raw
  .slice(raw.indexOf('<svg'))
  .replace(/<defs>[\s\S]*?<\/defs>/g, '')
  .replace(/<rect[^>]*class="cls-1"[^>]*\/>/g, '')
  .replace(/class="cls-2"/g, `fill="${TINTA}"`);

/**
 * Logo pronto para uso: `src`, `width` e `height` de uma vez.
 *
 * Duas regras aqui vêm de erro medido no PDF gerado por celular, e as duas
 * copiam o que `JournalDecorationLayer` já fazia com as Formas ANA — que nunca
 * sumiram do PDF, no mesmo aparelho e no mesmo documento:
 *
 * 1. **O tamanho vai em atributo, nunca em CSS.** Com `h-9 w-auto` a largura só
 *    existe depois que a imagem carrega. O html2canvas mede o documento clonado
 *    na hora, encontra zero e não desenha nada, em silêncio.
 *
 * 2. **O SVG declara por dentro o tamanho desenhado**, e não o intrínseco. Sem
 *    isso o navegador rasteriza numa dimensão arbitrária — é a mesma razão que
 *    já está comentada na camada das formas.
 *
 * Também não se usa `object-fit`: a caixa já tem a proporção exata do desenho,
 * e o html2canvas não suporta essa propriedade.
 */
export const anaLogo = (altura: number) => {
  const width = Math.round(altura * RAZAO);
  const svg = NORMALIZADO.replace(
    /^<svg([^>]*)>/,
    (tag) =>
      tag
        .replace(/\swidth="[^"]*"/, '')
        .replace(/\sheight="[^"]*"/, '')
        .replace('<svg', `<svg width="${width}" height="${altura}"`),
  );
  return { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, width, height: altura };
};

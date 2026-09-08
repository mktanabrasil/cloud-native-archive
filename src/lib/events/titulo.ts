/**
 * O marcador de quebra que a pessoa escreve no título: `<br>`, `<br/>` e
 * `<br />`, em qualquer caixa. É o único pedaço de marcação que o título
 * reconhece; o componente `TituloDoEvento` o transforma em quebra de linha e
 * escapa todo o resto.
 */
export const MARCADOR_DE_QUEBRA = /<br\s*\/?>/i;

/**
 * O título como texto corrido, para onde não existe quebra de linha: o `alt`
 * da imagem, a mensagem do WhatsApp, a confirmação de exclusão. O marcador
 * vira um espaço; o resto fica como a pessoa escreveu.
 */
export const tituloEmTexto = (texto: string): string =>
  texto
    .split(new RegExp(MARCADOR_DE_QUEBRA.source, 'gi'))
    .map(p => p.trim())
    .filter(Boolean)
    .join(' ');

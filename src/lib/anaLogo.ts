import raw from '@/assets/ana-brasil-logo.svg?raw';

/**
 * Logo institucional como data URI, e não como arquivo servido pela rede.
 *
 * O motivo é a exportação em PDF. O html2canvas desenha a partir do que já está
 * decodificado, e o contêiner de exportação vive em `left: -20000px` — bem fora
 * da tela. No celular, sob pressão de memória, o navegador adia ou descarta a
 * decodificação de imagens tão distantes: o `naturalWidth` fica em zero e o
 * logo some do PDF **em silêncio**, sem erro nenhum.
 *
 * Como data URI não há rede nem espera de decodificação. É o mesmo motivo pelo
 * qual as Formas ANA são montadas assim em `JournalDecorationLayer` — elas
 * sempre saíram no PDF, e o logo era o que faltava entrar nesse padrão.
 *
 * O `?inline` do Vite não resolve: testado, o bundle continua apontando para o
 * arquivo. Daí o `?raw` com a montagem à mão.
 *
 * Custo: cerca de 7 KB no bundle, contra uma requisição a menos.
 */
export const ANA_LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(raw)}`;

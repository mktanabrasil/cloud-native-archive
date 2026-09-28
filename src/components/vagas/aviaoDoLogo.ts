/**
 * O avião do logotipo da ANA em vetor (28/09/2026), o mesmo desenho dos SVGs
 * que o marketing mandou. Preenchido por `fill`: pinta de qualquer cor sem
 * imagem nem máscara (máscara SVG com url(#id) não era encontrada no visor
 * dos mockups e virava um retângulo cheio).
 *
 * No logotipo, o avião ocupa 64,9% da largura do quadrado verde (312 de
 * 481 px) e fica no centro dele.
 */
export const AVIAO_DO_LOGO_D =
  'M 371.238281 66.550781 C 371.601562 65.636719 371.710938 64.90625 371.601562 64.289062 C 371.273438 62.609375 369.449219 61.917969 367.296875 61.917969 C 363.867188 61.917969 360.550781 63.085938 357.230469 63.8125 C 352.34375 64.871094 347.964844 66.148438 347.054688 66.402344 C 330.675781 71.144531 314.550781 76.691406 298.246094 81.652344 C 273.042969 89.273438 247.945312 97.152344 222.738281 104.742188 C 210.15625 108.535156 197.5 112.253906 184.839844 115.867188 C 180.753906 117.035156 158.613281 120.316406 163.5 128.558594 C 166.238281 133.191406 175.648438 136.914062 180.355469 139.027344 C 184.660156 140.960938 189.144531 142.492188 193.742188 143.589844 C 197.097656 144.390625 202.96875 144.097656 205.085938 147.273438 C 205.851562 148.441406 206.253906 149.789062 206.652344 151.140625 C 209.863281 162.484375 212.453125 174.230469 216.246094 185.355469 C 220.550781 197.976562 234.449219 181.816406 240.03125 177.730469 C 243.675781 175.066406 246.707031 174.886719 250.789062 176.527344 C 257.902344 179.410156 269.027344 189.730469 275.59375 185.0625 C 291.789062 173.5 302.039062 154.75 314.113281 139.394531 C 326.882812 123.125 340.269531 107.332031 353.253906 91.207031 C 359.234375 83.765625 367.515625 75.339844 371.273438 66.476562 Z';

/** A caixa do desenho acima, no espaço dele. */
export const AVIAO_DO_LOGO_CAIXA = { x: 162.6, y: 61.9, largura: 209.2, altura: 128.5 } as const;

/** Proporção do avião dentro do quadrado do logotipo. */
export const AVIAO_NO_QUADRADO = 0.649;
/** O raio do canto do quadrado do logotipo, em fração do lado. */
export const CANTO_DO_QUADRADO = 0.27;

export const VERDE_DO_LOGO = '#81E2CF';
export const AVIAO_CLARO = '#F0EEE4';

/** O transform que põe o avião com a largura dada, centrado no ponto (0,0). */
export function transformDoAviao(largura: number): string {
  const k = largura / AVIAO_DO_LOGO_CAIXA.largura;
  const cx = AVIAO_DO_LOGO_CAIXA.x + AVIAO_DO_LOGO_CAIXA.largura / 2;
  const cy = AVIAO_DO_LOGO_CAIXA.y + AVIAO_DO_LOGO_CAIXA.altura / 2;
  return `scale(${k.toFixed(5)}) translate(${-cx} ${-cy})`;
}

/** A curva de tempo do voo e do traço: cubic-bezier(.45, 0, .2, 1), resolvida em JS. */
export function curvaDoVoo(t: number): number {
  const [x1, y1, x2, y2] = [0.45, 0, 0.2, 1];
  let a = 0, b = 1, m = 0;
  for (let i = 0; i < 30; i++) {
    m = (a + b) / 2;
    const x = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m;
    if (x < t) a = m; else b = m;
  }
  m = (a + b) / 2;
  return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m;
}

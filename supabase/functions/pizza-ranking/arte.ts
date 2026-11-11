/**
 * A arte do ranking da Pizza da Alegria, desenhada no servidor (11/11/2026):
 * o mesmo layout aprovado (https://claude.ai/artifact/9zTrCbAGR8hA2h6tMfsZUN,
 * versão 3), montado em SVG e convertido em PNG pelo resvg, sem navegador,
 * para o envio automático ao grupo de WhatsApp. O painel usa esta mesma arte.
 *
 * 1080 × 1350: a ilustração das pizzas esmaecendo no gradiente da arte oficial
 * (vermelho sob as pizzas, terracota embaixo, bordas mais escuras), as 5
 * unidades com barra, as 3 pessoas que mais compraram, o total, os dias que
 * faltam e o link; o fio de cinco cores da ANA.
 */
import opentype from 'npm:opentype.js@1.3.4';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';
import jpeg from 'npm:jpeg-js@0.4.4';
import type { Colocado, Ranking } from './ranking.ts';

export interface Recursos {
  /** Poppins 500, 600, 800 e 900 (TTF). */
  fontes: { 500: Uint8Array; 600: Uint8Array; 800: Uint8Array; 900: Uint8Array };
  /** A ilustração das pizzas (JPEG). */
  foto: Uint8Array;
}

/** Largura e altura de um JPEG, lidas do cabeçalho (marcador SOF). */
export function tamanhoDoJpeg(b: Uint8Array): { largura: number; altura: number } {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { altura: (b[i + 5] << 8) | b[i + 6], largura: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  throw new Error('foto_sem_tamanho');
}

const L = 1080, A = 1350, M = 72, DIR = L - M;
const CREME = '#F5DFBB', AMARELO = '#FBCE00', VERDE = '#81E2CF';
const FIO = ['#F5DFBB', '#FBCE00', '#F37964', '#81E2CF', '#01ADFF'];
const COR_DA_POSICAO: Array<[string, number]> = [[AMARELO, 1], [VERDE, 1], [CREME, 1], [CREME, 0.7], [CREME, 0.7]];
const COR_DA_BARRA: Array<[string, number]> = [[AMARELO, 1], [VERDE, 1], [CREME, 1], [CREME, 0.6], [CREME, 0.6]];

/** O motor do SVG, da mesma versão do import; o jsDelivr é a reserva do unpkg. */
const WASM = ['https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm', 'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm'];
let wasmPronto: Promise<void> | null = null;
function prepararWasm() {
  wasmPronto ??= (async () => {
    let ultimo: unknown;
    for (const url of WASM) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!r.ok) throw new Error(`${r.status}`);
        await initWasm(await r.arrayBuffer());
        return;
      } catch (e) { ultimo = e; }
    }
    throw new Error(`não carreguei o motor da arte (resvg): ${ultimo instanceof Error ? ultimo.message : ultimo}`);
  })().catch((e) => { wasmPronto = null; throw e; });
  return wasmPronto;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

type Peso = 500 | 600 | 800 | 900;

export async function desenharRanking(r: Ranking, quando: string, dias: string, rec: Recursos): Promise<Uint8Array> {
  await prepararWasm();
  // deno-lint-ignore no-explicit-any
  const fontes: Record<Peso, any> = {
    500: opentype.parse(rec.fontes[500].buffer.slice(rec.fontes[500].byteOffset, rec.fontes[500].byteOffset + rec.fontes[500].byteLength)),
    600: opentype.parse(rec.fontes[600].buffer.slice(rec.fontes[600].byteOffset, rec.fontes[600].byteOffset + rec.fontes[600].byteLength)),
    800: opentype.parse(rec.fontes[800].buffer.slice(rec.fontes[800].byteOffset, rec.fontes[800].byteOffset + rec.fontes[800].byteLength)),
    900: opentype.parse(rec.fontes[900].buffer.slice(rec.fontes[900].byteOffset, rec.fontes[900].byteOffset + rec.fontes[900].byteLength)),
  };
  const largura = (t: string, peso: Peso, tam: number) => fontes[peso].getAdvanceWidth(t, tam);
  const caber = (t: string, peso: Peso, tam: number, max: number) => {
    if (largura(t, peso, tam) <= max) return t;
    let s = t;
    while (s.length > 1 && largura(`${s}…`, peso, tam) > max) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const texto = (t: string, x: number, y: number, peso: Peso, tam: number, cor: string, o: { fim?: boolean; opacidade?: number; espaco?: number; filtro?: string } = {}) =>
    `<text x="${x}" y="${y}" font-family="Poppins" font-weight="${peso}" font-size="${tam}" fill="${cor}"${o.opacidade !== undefined && o.opacidade < 1 ? ` fill-opacity="${o.opacidade}"` : ''}${o.fim ? ' text-anchor="end"' : ''}${o.espaco ? ` letter-spacing="${o.espaco}"` : ''}${o.filtro ? ` filter="url(#${o.filtro})"` : ''}>${esc(t)}</text>`;

  const p: string[] = [];
  const tam = tamanhoDoJpeg(rec.foto);
  const alt = Math.round((L * tam.altura) / tam.largura);
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}">`);
  p.push(`<defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="${A}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#C9452F"/><stop offset="0.3" stop-color="#B84E30"/><stop offset="0.62" stop-color="#A9502E"/><stop offset="1" stop-color="#9C4627"/>
    </linearGradient>
    <radialGradient id="luz" cx="540" cy="${A * 0.62}" r="${L * 0.85}" gradientUnits="userSpaceOnUse" gradientTransform="translate(540 ${A * 0.62}) scale(1 ${(A * 0.6) / (L * 0.85)}) translate(-540 ${-A * 0.62})">
      <stop offset="0" stop-color="#D67850" stop-opacity="0.22"/><stop offset="0.7" stop-color="#D67850" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="borda" cx="540" cy="${A * 0.55}" r="${L * 1.2}" gradientUnits="userSpaceOnUse" gradientTransform="translate(540 ${A * 0.55}) scale(1 ${(A * 0.9) / (L * 1.2)}) translate(-540 ${-A * 0.55})">
      <stop offset="0.55" stop-color="#5A1E0C" stop-opacity="0"/><stop offset="1" stop-color="#5A1E0C" stop-opacity="0.38"/>
    </radialGradient>
    <linearGradient id="esmaecer" x1="0" y1="0" x2="0" y2="${alt}" gradientUnits="userSpaceOnUse">
      <stop offset="0.7" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <mask id="foto" maskUnits="userSpaceOnUse" x="0" y="0" width="${L}" height="${alt}"><rect x="0" y="0" width="${L}" height="${alt}" fill="url(#esmaecer)"/></mask>
    <filter id="sombra" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="9" flood-color="#5A1E0C" flood-opacity="0.45"/></filter>
  </defs>`);
  p.push(`<rect width="${L}" height="${A}" fill="url(#fundo)"/><rect width="${L}" height="${A}" fill="url(#luz)"/><rect width="${L}" height="${A}" fill="url(#borda)"/>`);
  p.push(`<image href="data:image/jpeg;base64,${base64(rec.foto)}" x="0" y="0" width="${L}" height="${alt}" mask="url(#foto)" preserveAspectRatio="none"/>`);

  // Título
  p.push(texto('RANKING', M, 520, 900, 80, CREME, { espaco: -1, filtro: 'sombra' }));
  p.push(texto('DA SEMANA', M, 592, 900, 80, CREME, { espaco: -1, filtro: 'sombra' }));
  p.push(texto(`Parcial até ${quando}`, DIR, 556, 800, 34, AMARELO, { fim: true }));
  p.push(texto('Pedidos até 05/12', DIR, 592, 600, 26, CREME, { fim: true }));

  const cabecalho = (titulo: string, y: number) => {
    p.push(texto(titulo.toUpperCase(), M, y, 800, 28, CREME, { espaco: 0.5 }));
    p.push(texto('pizzas', DIR, y, 500, 22, CREME, { fim: true }));
    p.push(`<rect x="${M}" y="${y + 15}" width="${L - 2 * M}" height="3" fill="${CREME}" fill-opacity="0.5"/>`);
  };

  // As listas: cheias (5 unidades e 3 pessoas), vão de 636 a 1232, como no
  // mockup aprovado. Com menos linhas (começo da campanha, 11/11/2026), o
  // bloco desce para o meio desse espaço, em vez de deixar um vão no meio.
  const unidades = r.unidades.slice(0, 5), pessoas = r.pessoas.slice(0, 3);
  const altU = unidades.reduce((a, _, i) => a + (i === 0 ? 64 : 54), 0);
  const altP = pessoas.reduce((a, _, i) => a + (i === 0 ? 62 : 56), 0);
  const desce = Math.round(((64 + 54 * 4) + (62 + 56 * 2) - altU - altP) / 2);

  // Unidades: as 5 primeiras, com barra
  cabecalho('Unidades', 664 + desce);
  const xNome = M + 84 + 18, larguraNum = 76, fimBarra = DIR - larguraNum - 18;
  const maxU = Math.max(1, ...unidades.map((u) => u.pizzas));
  let y = 690 + desce;
  unidades.forEach((u: Colocado, i) => {
    const h = i === 0 ? 64 : 54, meio = y + h / 2;
    const [cp, op] = COR_DA_POSICAO[i];
    p.push(texto(`${i + 1}º`, M, meio + (i === 0 ? 20 : i < 3 ? 17 : 14), 900, i === 0 ? 56 : i < 3 ? 48 : 40, cp, { opacidade: op }));
    const pesoNome: Peso = i === 0 ? 800 : 600, tamNome = i === 0 ? 36 : 30;
    p.push(texto(caber(u.nome, pesoNome, tamNome, fimBarra - xNome), xNome, meio + (i === 0 ? 4 : 2), pesoNome, tamNome, CREME));
    const yBarra = meio + (i === 0 ? 14 : 12);
    const [cb, ob] = COR_DA_BARRA[i];
    p.push(`<rect x="${xNome}" y="${yBarra}" width="${fimBarra - xNome}" height="8" fill="${CREME}" fill-opacity="0.22"/>`);
    p.push(`<rect x="${xNome}" y="${yBarra}" width="${Math.max(4, ((fimBarra - xNome) * u.pizzas) / maxU).toFixed(1)}" height="8" fill="${cb}"${ob < 1 ? ` fill-opacity="${ob}"` : ''}/>`);
    p.push(texto(String(u.pizzas), DIR, meio + (i === 0 ? 15 : 11), 800, i === 0 ? 42 : 32, i === 0 ? AMARELO : CREME, { fim: true }));
    y += h;
  });

  // Pessoas: as 3 primeiras, 62 px depois da última unidade (cheio: 1032)
  cabecalho('Quem mais comprou', y + 62);
  y += 62 + 26;
  pessoas.forEach((pe: Colocado, i) => {
    const h = i === 0 ? 62 : 56, meio = y + h / 2;
    const [cp] = COR_DA_POSICAO[i];
    p.push(texto(`${i + 1}º`, M, meio + (i === 0 ? 17 : 15), 900, i === 0 ? 48 : 42, cp));
    const pesoNome: Peso = i === 0 ? 800 : 600, tamNome = i === 0 ? 36 : 32;
    const nome = caber(pe.nome, pesoNome, tamNome, DIR - larguraNum - 18 - xNome - 120);
    p.push(texto(nome, xNome, meio + 12, pesoNome, tamNome, CREME));
    const xUnidade = xNome + largura(nome, pesoNome, tamNome) + 12;
    p.push(texto(caber(pe.unidade ?? '', 500, 22, DIR - larguraNum - 18 - xUnidade), xUnidade, meio + 11, 500, 22, CREME));
    p.push(texto(String(pe.pizzas), DIR, meio + 14, 800, i === 0 ? 40 : 34, i === 0 ? AMARELO : CREME, { fim: true }));
    y += h;
  });

  // Rodapé
  p.push(`<rect x="${M}" y="1278" width="${L - 2 * M}" height="3" fill="${CREME}" fill-opacity="0.5"/>`);
  const total = `${r.pizzas} ${r.pizzas === 1 ? 'pizza' : 'pizzas'}`;
  p.push(texto(total, M, 1314, 800, 22, CREME));
  // O SVG apaga o espaço do começo de um texto: vai um espaço que não se apaga (U+00A0).
  p.push(texto(` · ${dias}`, M + largura(total, 800, 22), 1314, 500, 22, CREME));
  p.push(texto('app.anabrasil.org/pizza-da-alegria', DIR, 1314, 500, 22, CREME, { fim: true }));
  FIO.forEach((cor, i) => p.push(`<rect x="${(L / 5) * i}" y="${A - 16}" width="${L / 5 + 1}" height="16" fill="${cor}"/>`));
  p.push('</svg>');

  const resvg = new Resvg(p.join(''), {
    font: { fontBuffers: [rec.fontes[500], rec.fontes[600], rec.fontes[800], rec.fontes[900]], loadSystemFonts: false, defaultFontFamily: 'Poppins' },
    fitTo: { mode: 'original' },
  });
  // JPEG, como a arte que o painel baixava: bem menor que PNG, e o WhatsApp recomprime de todo jeito.
  const img = resvg.render();
  const { data } = jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, 90);
  img.free(); resvg.free();
  return new Uint8Array(data);
}

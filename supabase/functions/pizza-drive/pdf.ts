/**
 * O PDF de respostas de cada confirmação da Pizza da Alegria (mockup aprovado
 * em 07/10/2026: https://claude.ai/artifact/Gww14EyRbEdw2UwUUUQLuq). Uma
 * folha A4: topo vermelho com a marca e o número, quem confirmou, a tabela de
 * sabores com o total, a forma de pagamento com a MINIATURA do comprovante e
 * a retirada. Sem o campo "Conferido por".
 *
 * Recebe a biblioteca (pdf-lib) e as fontes de fora, para rodar igual no
 * Deno (função) e no Node (teste): este arquivo não importa nada.
 */

export interface DadosDoPdf {
  numero: string;
  quando: string; // "07/10/2026 às 14:32"
  nome: string;
  unidade: string;
  area: string; // "Educação" | "Social"
  sabores: Array<{ sabor: string; qtd: number }>;
  preco: number;
  forma: string; // "Pix"
  dinheiro: boolean;
  comprovante: { nome: string; tamanho: string; tipo: 'jpg' | 'png' | 'pdf' | 'outro'; bytes?: Uint8Array } | null;
  retirada: string; // "Na unidade · sexta, 04/12/2026"
}

// deno-lint-ignore no-explicit-any
type Lib = any;

const cor = (lib: Lib, hex: string) => lib.rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const reais = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * O logotipo oficial "ana ✈ brasil", horizontal (Id. Visual - Ana Brasil /
 * Logo - Variação.svg, pedido de 07/10/2026). Os caminhos vêm do arquivo;
 * os dois retângulos (o "i" e o "l" de "brasil") viraram caminhos também.
 * Caixa do desenho: 2656,45 × 481,27.
 */
const LOGO = [
  "M1578.4,17.4c1.4-3.4,1.8-6.2,1.3-8.6-1.2-6.1-8-8.8-16.1-8.8-12.8.1-25.2,4.4-37.6,7.2-18.2,4-34.6,8.7-38,9.7-61.1,17.8-121.3,38.7-182.2,57.2-94.1,28.6-187.8,58.2-281.9,86.7-47.1,14.3-94.2,28.3-141.4,41.8-15.2,4.4-97.9,16.7-79.7,47.6,10.2,17.3,45.3,31.4,62.9,39.3,16.1,7.2,32.9,13,50,17.2,12.6,3,34.4,1.9,42.4,13.9,2.9,4.3,4.4,9.5,5.8,14.5,12,42.5,21.7,86.6,35.8,128.4,16,47.4,68-13.3,88.8-28.6,13.6-10,25-10.7,40.1-4.5,26.6,10.9,68.1,49.6,92.5,32,60.4-43.4,98.8-113.7,143.9-171.4,47.7-61.1,97.6-120.4,146.1-180.8,22.5-27.8,53.4-59.5,67.3-92.8h0ZM1017.8,397.4c-2.4,1.9-5.4,2.6-9.1,1.5-13-3.8-13.7-26-16.3-36.5-4.4-17.4-16.1-36.9-10.2-55.3,3.3-10.1,18.9-13.5,27.4-16.9,27.4-11,53.5-24.9,80.2-37.2,85.4-35.2,167.9-77.5,251.3-117.2,23.8-11.3,58.4-35,80.6-37.3,8.3-.8-20.9,20.9-31.4,26.9-16.2,9.2-33.6,16.2-49.7,25.6-36.7,21.4-73.5,42.9-110.2,64.3-47.9,27.9-90.5,63.5-136.1,94.7-18.3,12.6-44.8,22.6-59.1,39.9-6.1,7.4-6.7,39.1-17.4,47.5h0ZM1078.3,424.3c-11.7,5.9-22.5,13.7-33.9,20.1-3.5,1.9-12.7,9-16.9,8.2-7.7-1.3-.9-23.9.2-28,1.4-5.7,3.2-11.4,4.8-17.1,1.4-5.4.9-14.4,5.3-18.1.4-.3.8-.6,1.2-.8,5.7-2.9,16.9,4.5,22,6.9,8.5,4,16.8,8.4,24.3,14.1,10.7,8.5,1.2,10.6-7,14.7h0ZM1492.1,93.6c-16.6,31.3-207.2,254.9-240,305.8-13.1,20.4-33.7,38.8-61.9,28.4-22.9-8.4-45.1-18.6-67.3-28.9-12.2-5.7-63.1-21.4-57.3-39.8,3.5-11.3,22.1-18.8,31.4-24.9,16.5-10.9,33-21.7,49.7-32.5,33.2-21.5,66.6-42.6,100.1-63.8,35.7-22.6,71.9-44.4,107.4-67.3,33.5-21.5,62.9-48,95-71.3,10.7-7.8,22.2-15.2,35.4-16.5,3.4-.3,7.7.3,9,3.4.8,2.5-.3,5.2-1.5,7.4h0ZM1450.5,67.6c-20.5,9.4-41.5,17.8-61.8,27.6-76.8,37.4-158.5,65.1-236.7,101.6-40.2,18.7-78.3,39.5-119.1,57-38.1,16.3-72.2,42.5-114.1,28.4-19.6-6.6-40.3-10.6-58.8-20.2-5.3-2.8-25.1-12.8-24.9-20.1,0-.2,0-.4.1-.6,1.4-8.5,26.8-13.7,33.3-15.6,42.2-12.6,84.6-24.6,126.9-36.9,86.7-25.1,173.9-48.3,260.4-74,43.7-13,87.3-26.6,130.4-41.3,21.1-7.2,42.1-14.7,63-22.5,12.4-4.6,46.5-17.4,56.3-15.5,16.1,2.8-40,25.3-55,32.1h0Z",
  "M1859.95,239.11c0-68.5-42-111.3-95.7-111.3-31.1,0-54.8,14.4-66.9,33.8V60.11h-66.5v287.9h66.5v-30.3c12.1,19.1,35,33.5,66.9,33.5,53.3-.1,95.7-43.7,95.7-112.1h0ZM1744.35,293.21c-24.9,0-47.5-19.1-47.5-53.7s22.6-53.7,47.5-53.7,47.8,18.7,47.8,53.3-22.5,54.1-47.8,54.1Z",
  "M2013.95,128.61c-29.2,0-52.9,15.6-68.1,38.5v-36.2h-66.5v217.1h66.6v-100.8c0-37.3,18.3-48.2,49.8-48.2h18.2v-70.4h0Z",
  "M2256.55,348.01v-217.1h-66.5v30.7c-11.7-19.1-34.6-33.8-66.9-33.8-53.3,0-95.7,42.8-95.7,111.3s42.4,112,95.3,112c32.3,0,55.2-14.8,67.3-33.8v30.7h66.5ZM2142.55,293.21c-24.9,0-47.5-19.5-47.5-54.1s22.6-53.3,47.5-53.3,47.5,19.1,47.5,53.7-22.2,53.7-47.5,53.7Z",
  "M2346.75,194.01c0-10.5,8.6-16.7,24.1-16.7,18.7,0,29.9,9.7,31.9,24.5h61.5c-4.3-42.8-35.4-73.9-91.4-73.9s-88.3,30.3-88.3,67.3c0,79.8,118.3,54.5,118.3,89.5,0,9.7-8.9,17.5-26.1,17.5-18.3,0-31.9-10.1-33.4-25.3h-65.7c3.1,42,42,74.3,100,74.3,54.5,0,87.9-28.4,87.9-66.1-1.3-81-118.8-56.5-118.8-91.1h0Z",
  "M2524.15,36.41c-23.7,0-39.7,16-39.7,36.2s15.9,35.8,39.7,35.8,39.3-16,39.3-35.8-15.9-36.2-39.3-36.2Z",
  "M0,240.29c0,68.5,42.4,112,95.3,112,32.3,0,55.2-14.8,67.3-33.8v30.7h66.5v-217.1h-66.5v30.7c-11.7-19.1-34.6-33.8-66.9-33.8-53.3,0-95.7,42.8-95.7,111.3h0ZM162.6,240.69c0,34.6-22.2,53.7-47.5,53.7s-47.5-19.5-47.5-54.1,22.6-53.3,47.5-53.3,47.5,19.1,47.5,53.7h0Z",
  "M328.3,231.29c0-29.6,16.3-45.9,41.6-45.9s41.6,16.3,41.6,45.9v117.9h66.1v-126.8c0-58.3-33.4-92.6-83.6-92.6-29.2,0-52.5,12.8-65.7,31.1v-28.8h-66.5v217.1h66.5v-117.9h0Z",
  "M590.5,352.29c32.3,0,55.2-14.8,67.3-33.8v30.7h66.5v-217.1h-66.5v30.7c-11.7-19.1-34.6-33.8-66.9-33.8-53.3,0-95.7,42.8-95.7,111.3s42.4,112,95.3,112h0ZM610.4,186.99c25.3,0,47.5,19.1,47.5,53.7s-22.2,53.7-47.5,53.7-47.5-19.5-47.5-54.1,22.6-53.3,47.5-53.3h0Z",
  "M2490.75,130.91h66.5v217.1h-66.5Z",
  "M2589.95,60.11h66.5v287.9h-66.5Z"
];
const LOGO_CAIXA = { largura: 2656.45, altura: 481.27 };

export async function montarPdf(lib: Lib, fontes: { regular: Uint8Array | null; negrito: Uint8Array | null; fontkit?: unknown }, d: DadosDoPdf): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create();
  doc.setTitle(`${d.numero} · ${d.nome}`);
  doc.setAuthor('ANA Brasil');
  doc.setCreator('app.anabrasil.org');
  let f, fb;
  if (fontes.regular && fontes.negrito && fontes.fontkit) {
    doc.registerFontkit(fontes.fontkit);
    f = await doc.embedFont(fontes.regular, { subset: true });
    fb = await doc.embedFont(fontes.negrito, { subset: true });
  } else {
    f = await doc.embedFont(lib.StandardFonts.Helvetica);
    fb = await doc.embedFont(lib.StandardFonts.HelveticaBold);
  }

  const W = 595, H = 842, M = 32;
  const pg = doc.addPage([W, H]);
  const C = {
    vermelho: cor(lib, '#D8463A'), vermelhoEsc: cor(lib, '#A9322A'), creme: cor(lib, '#F4E7D2'), amarelo: cor(lib, '#FBCE00'),
    marrom: cor(lib, '#6B2E1C'), tinta: cor(lib, '#2B1A14'), mut: cor(lib, '#7A6359'), linha: cor(lib, '#F1E6D6'),
    fundoComp: cor(lib, '#FBF6EE'), borda: cor(lib, '#EADBC8'), verde: cor(lib, '#2E8B57'), verdeBg: cor(lib, '#E6F4EC'),
    amareloBg: cor(lib, '#FFF5CC'), amareloTx: cor(lib, '#6B4E00'), branco: lib.rgb(1, 1, 1), rodape: cor(lib, '#9A8478'),
  };
  const texto = (t: string, x: number, y: number, o: { fonte?: unknown; tam?: number; cor?: unknown; direita?: boolean; espaco?: number } = {}) => {
    const fonte = o.fonte ?? f; const tam = o.tam ?? 11;
    // deno-lint-ignore no-explicit-any
    const larg = (fonte as any).widthOfTextAtSize(t, tam) + (o.espaco ?? 0) * t.length;
    pg.drawText(t, { x: o.direita ? x - larg : x, y, size: tam, font: fonte, color: o.cor ?? C.tinta, characterSpacing: o.espaco });
  };
  const corte = (t: string, fonte: unknown, tam: number, max: number) => {
    // deno-lint-ignore no-explicit-any
    let s = t; while (s.length > 1 && (fonte as any).widthOfTextAtSize(s, tam) > max) s = s.slice(0, -1);
    return s === t ? t : s.slice(0, -1) + '…';
  };

  // Topo
  const topo = 112;
  pg.drawRectangle({ x: 0, y: H - topo, width: W, height: topo, color: C.vermelho });
  const k = 138 / LOGO_CAIXA.largura;
  for (const d of LOGO) pg.drawSvgPath(d, { x: M, y: H - 16, scale: k, color: C.creme });
  texto('Pizza da Alegria', M, H - 66, { fonte: fb, tam: 24, cor: C.creme });
  texto('CONFIRMAÇÃO DE PAGAMENTO', M, H - 84, { tam: 8.5, cor: C.branco, espaco: 1.2 });
  texto('Confirmação', W - M, H - 40, { tam: 9, cor: C.branco, direita: true });
  texto(d.numero, W - M, H - 68, { fonte: fb, tam: 26, cor: C.amarelo, direita: true });
  texto(d.quando, W - M, H - 84, { tam: 9, cor: C.branco, direita: true });

  let y = H - topo - 34;
  const titulo = (t: string) => {
    texto(t.toUpperCase(), M, y, { fonte: fb, tam: 8.5, cor: C.vermelhoEsc, espaco: 1.2 });
    pg.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 1.5, color: C.creme });
    y -= 26;
  };
  const linha = (rot: string, val: string) => {
    texto(rot, M, y, { tam: 11, cor: C.mut });
    texto(corte(val, fb, 11, W - 2 * M - 150), M + 150, y, { fonte: fb, tam: 11 });
    y -= 18;
  };

  titulo('Quem confirmou');
  linha('Nome', d.nome);
  linha('Unidade', d.unidade);
  linha('Área', d.area);
  y -= 10;

  titulo('Sabores');
  texto('SABOR', M, y, { fonte: fb, tam: 8, cor: C.mut, espaco: 0.8 });
  texto('QTD.', W - M - 110, y, { fonte: fb, tam: 8, cor: C.mut, direita: true, espaco: 0.8 });
  texto('VALOR', W - M, y, { fonte: fb, tam: 8, cor: C.mut, direita: true, espaco: 0.8 });
  y -= 8;
  let qtdTotal = 0;
  for (const s of d.sabores) {
    pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: C.linha });
    y -= 16;
    texto(s.sabor, M, y, { tam: 11 });
    texto(String(s.qtd), W - M - 110, y, { tam: 11, direita: true });
    texto(reais(s.qtd * d.preco), W - M, y, { tam: 11, direita: true });
    y -= 8;
    qtdTotal += s.qtd;
  }
  pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2, color: C.tinta });
  y -= 18;
  texto('Total', M, y, { fonte: fb, tam: 13 });
  texto(String(qtdTotal), W - M - 110, y, { fonte: fb, tam: 13, direita: true });
  texto(reais(qtdTotal * d.preco), W - M, y, { fonte: fb, tam: 13, direita: true });
  y -= 30;

  titulo('Pagamento');
  texto('Forma', M, y, { tam: 11, cor: C.mut });
  // deno-lint-ignore no-explicit-any
  const largSelo = (fb as any).widthOfTextAtSize(d.forma, 10) + 20;
  pg.drawRectangle({ x: M + 150, y: y - 5, width: largSelo, height: 18, color: d.dinheiro ? C.amareloBg : C.verdeBg });
  texto(d.forma, M + 160, y, { fonte: fb, tam: 10, cor: d.dinheiro ? C.amareloTx : C.verde });
  y -= 22;

  // Comprovante, com miniatura
  const alt = 140;
  pg.drawRectangle({ x: M, y: y - alt, width: W - 2 * M, height: alt, color: C.fundoComp });
  const mx = M + 12, my = y - alt + 12, mw = 88, mh = alt - 24;
  pg.drawRectangle({ x: mx, y: my, width: mw, height: mh, color: C.branco, borderColor: C.borda, borderWidth: 1 });
  let desenhou = false;
  if (d.comprovante?.bytes && (d.comprovante.tipo === 'jpg' || d.comprovante.tipo === 'png')) {
    try {
      const img = d.comprovante.tipo === 'jpg' ? await doc.embedJpg(d.comprovante.bytes) : await doc.embedPng(d.comprovante.bytes);
      const k = Math.min((mw - 6) / img.width, (mh - 6) / img.height);
      pg.drawImage(img, { x: mx + (mw - img.width * k) / 2, y: my + (mh - img.height * k) / 2, width: img.width * k, height: img.height * k });
      desenhou = true;
    } catch { /* imagem que não abre: fica o quadro */ }
  }
  if (!desenhou) {
    const rot = !d.comprovante ? 'sem anexo' : d.comprovante.tipo === 'pdf' ? 'PDF' : 'FOTO';
    // deno-lint-ignore no-explicit-any
    const lr = (fb as any).widthOfTextAtSize(rot, 10);
    texto(rot, mx + (mw - lr) / 2, my + mh / 2 - 4, { fonte: fb, tam: 10, cor: C.mut });
  }
  const tx = mx + mw + 16;
  if (d.comprovante) {
    texto(corte(`${d.numero} · comprovante`, fb, 11, W - M - tx - 12), tx, y - 50, { fonte: fb, tam: 11 });
    texto(corte(`Anexado pela pessoa · ${d.comprovante.tamanho}`, f, 10, W - M - tx - 12), tx, y - 66, { tam: 10, cor: C.mut });
    texto('Na mesma pasta deste arquivo.', tx, y - 80, { tam: 10, cor: C.mut });
  } else {
    texto('Sem comprovante', tx, y - 58, { fonte: fb, tam: 11 });
    texto('No dinheiro o anexo é opcional.', tx, y - 74, { tam: 10, cor: C.mut });
  }
  y -= alt + 16;

  // Retirada
  const altR = 46;
  pg.drawRectangle({ x: M, y: y - altR, width: W - 2 * M, height: altR, color: C.marrom });
  texto('RETIRADA', M + 14, y - 17, { tam: 8, cor: C.creme, espaco: 1.2 });
  texto(d.retirada, M + 14, y - 34, { fonte: fb, tam: 12, cor: C.creme });
  texto(corte(d.unidade, fb, 12, 220), W - M - 14, y - 27, { fonte: fb, tam: 12, cor: C.creme, direita: true });

  // Rodapé com o fio de cinco cores
  texto('Gerado automaticamente pelo app ANA Brasil · app.anabrasil.org', M, 22, { tam: 8, cor: C.rodape });
  texto('Página 1 de 1', W - M, 22, { tam: 8, cor: C.rodape, direita: true });
  const fio = ['#F5DFBB', '#FBCE00', '#F37964', '#81E2CF', '#01ADFF'];
  fio.forEach((c, i) => pg.drawRectangle({ x: (W / 5) * i, y: 0, width: W / 5, height: 7, color: cor(lib, c) }));

  return await doc.save();
}

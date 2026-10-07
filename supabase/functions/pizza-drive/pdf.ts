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

/** O avião do logotipo (o mesmo vetor de src/components/vagas/aviaoDoLogo.ts), caixa x 162,6 · y 61,9 · 209,2 de largura. */
const AVIAO = 'M 371.238281 66.550781 C 371.601562 65.636719 371.710938 64.90625 371.601562 64.289062 C 371.273438 62.609375 369.449219 61.917969 367.296875 61.917969 C 363.867188 61.917969 360.550781 63.085938 357.230469 63.8125 C 352.34375 64.871094 347.964844 66.148438 347.054688 66.402344 C 330.675781 71.144531 314.550781 76.691406 298.246094 81.652344 C 273.042969 89.273438 247.945312 97.152344 222.738281 104.742188 C 210.15625 108.535156 197.5 112.253906 184.839844 115.867188 C 180.753906 117.035156 158.613281 120.316406 163.5 128.558594 C 166.238281 133.191406 175.648438 136.914062 180.355469 139.027344 C 184.660156 140.960938 189.144531 142.492188 193.742188 143.589844 C 197.097656 144.390625 202.96875 144.097656 205.085938 147.273438 C 205.851562 148.441406 206.253906 149.789062 206.652344 151.140625 C 209.863281 162.484375 212.453125 174.230469 216.246094 185.355469 C 220.550781 197.976562 234.449219 181.816406 240.03125 177.730469 C 243.675781 175.066406 246.707031 174.886719 250.789062 176.527344 C 257.902344 179.410156 269.027344 189.730469 275.59375 185.0625 C 291.789062 173.5 302.039062 154.75 314.113281 139.394531 C 326.882812 123.125 340.269531 107.332031 353.253906 91.207031 C 359.234375 83.765625 367.515625 75.339844 371.273438 66.476562 Z';
const AVIAO_CAIXA = { x: 162.6, y: 61.9, largura: 209.2 };

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
  texto('ana', M, H - 36, { fonte: fb, tam: 15, cor: C.branco });
  const k = 22 / AVIAO_CAIXA.largura;
  pg.drawSvgPath(AVIAO, { x: M + 33 - AVIAO_CAIXA.x * k, y: H - 23 + AVIAO_CAIXA.y * k, scale: k, color: C.creme });
  texto('brasil', M + 58, H - 36, { fonte: fb, tam: 15, cor: C.branco });
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

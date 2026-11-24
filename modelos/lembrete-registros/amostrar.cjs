// Lê as cores de cada variante (artes originais 2400x1350) e recorta o logo.
const fs = require('fs'); const path = require('path');
const { abrir } = require('./cdp.cjs');
const VAR = [['azul', ''], ['amarelo', ' (Amarelo)'], ['coral', ' (Coral)'], ['verde', ' (Verde-água)'], ['areia', ' (Areia)']];
// Pontos em coordenadas de 1600x900.
const PONTOS = {
  fundo: [800, 820], pilula: [405, 224], caixa: [385, 560], chipFotos: [310, 630], chipVideos: [575, 630], chipInfo: [945, 656],
  circulo: [130, 640], circuloVideos: [365, 640], circuloInfo: [630, 640], ponto: [1360, 225],
  decoA: [1290, 60], decoB: [1440, 150], decoC: [1560, 40], decoD: [1560, 260],
};
// Janelas onde o texto domina: a cor mais comum que não é o fundo local.
const TEXTOS = {
  tinta: [112, 300, 60, 80], textoPilula: [190, 205, 190, 40], textoCaixa: [410, 440, 120, 90], textoChip: [205, 640, 90, 30],
  iconeChip: [140, 645, 25, 20], legenda: [110, 738, 480, 30], logo: [165, 70, 150, 70], alerta: [135, 210, 30, 28],
};
fs.mkdirSync(path.join(__dirname, 'logos'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'index.html'), '<!doctype html><body style="margin:0"></body>');
(async () => {
  const b = await abrir(__dirname);
  await b.ir('/', 800, 600);
  const saida = {};
  for (const [nome, suf] of VAR) {
    const arq = `/orig/${encodeURIComponent(`Lembrete - Registros das unidades${suf}.jpg`)}`;
    const r = await b.avaliar(`(async () => {
      const img = new Image(); img.src = ${JSON.stringify(arq)}; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); const k = img.naturalWidth / 1600;
      const hex = (d) => '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      const px = (a, b) => x.getImageData(Math.round(a * k), Math.round(b * k), 1, 1).data;
      const P = ${JSON.stringify(PONTOS)}, T = ${JSON.stringify(TEXTOS)}, o = {};
      for (const [n, [a, b]] of Object.entries(P)) o[n] = hex(px(a, b));
      for (const [n, [a, b, w, h]] of Object.entries(T)) {
        const d = x.getImageData(Math.round(a * k), Math.round(b * k), Math.round(w * k), Math.round(h * k)).data;
        const cont = new Map(); const q = (v) => Math.round(v / 6) * 6;
        for (let i = 0; i < d.length; i += 4) { const key = q(d[i]) + ',' + q(d[i + 1]) + ',' + q(d[i + 2]); cont.set(key, (cont.get(key) || 0) + 1); }
        const ord = [...cont.entries()].sort((p, q2) => q2[1] - p[1]).slice(0, 3).map(([kk, v]) => hex(kk.split(',').map(Number)) + ':' + Math.round(100 * v / (d.length / 4)) + '%');
        o[n] = ord.join(' ');
      }
      // Logo: recorte na resolução original.
      const L = [72, 34, 250, 112]; const lc = document.createElement('canvas'); lc.width = Math.round(L[2] * k); lc.height = Math.round(L[3] * k);
      lc.getContext('2d').drawImage(img, L[0] * k, L[1] * k, L[2] * k, L[3] * k, 0, 0, lc.width, lc.height);
      o.logoPng = lc.toDataURL('image/png');
      return o; })()`);
    fs.writeFileSync(path.join(__dirname, 'logos', `logo-${nome}.png`), Buffer.from(r.logoPng.split(',')[1], 'base64'));
    delete r.logoPng; saida[nome] = r;
  }
  console.log(JSON.stringify(saida, null, 1));
  b.fechar(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

// Gera as artes 1:1 do lembrete (registros) e acerta o rodapé do "Como enviar".
const fs = require('fs'); const path = require('path'); const { abrir } = require('./cdp.cjs');
const VAR = [['azul', ''], ['amarelo', ' (Amarelo)'], ['coral', ' (Coral)'], ['verde', ' (Verde-água)'], ['areia', ' (Areia)']];
const HEX = { amarelo: '#fbce00', coral: '#f37964', verde: '#81e2cf', azul: '#01adff', areia: '#f5dfba' };
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const so = process.argv[2] ? process.argv[2].split(',') : VAR.map(v => v[0]);
(async () => {
  const b = await abrir(__dirname);
  for (const [nome, suf] of VAR.filter(v => so.includes(v[0]))) {
    await b.ir(`/registros.html?v=${nome}`);
    await b.foto(path.join(OUT, `registros-${nome}.jpg`));
    // "Como enviar": a arte dele, só o rodapé refeito.
    const src = `/orig/${encodeURIComponent(`Como enviar os registros - mockup WhatsApp${suf}.jpg`)}`;
    const ordem = ['areia', 'amarelo', 'coral', 'verde', 'azul'].filter(c => c !== nome).map(c => HEX[c]);
    const url = await b.avaliar(`(async () => {
      const img = new Image(); img.src = ${JSON.stringify(src)}; await img.decode();
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1600; const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 1600, 1600);

      const cores = ${JSON.stringify(ordem)}; cores.forEach((cor, i) => { x.fillStyle = cor; x.fillRect(i * 400, 1548, 400, 52); });
      return c.toDataURL('image/jpeg', 0.88); })()`);
    fs.writeFileSync(path.join(OUT, `como-enviar-${nome}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(nome, 'ok');
  }
  b.fechar(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

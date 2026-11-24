// Chrome headless por CDP: serve uma pasta (raiz /) e as artes originais (/orig/), avalia expressões e tira prints.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ORIGEM = 'C:/Users/anabr/Downloads/Blog - Postagens';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrir(raiz, porta = 8812, dbg = 9372) {
  const srv = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    const f = u.startsWith('/orig/') ? path.join(ORIGEM, u.slice(6)) : path.join(raiz, u === '/' ? 'index.html' : u.slice(1));
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  }).listen(porta);
  const perfil = path.join(__dirname, 'perfil'); fs.rmSync(perfil, { recursive: true, force: true });
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let alvo; for (let i = 0; i < 60 && !alvo; i++) { await espera(250); try { alvo = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  const cdp = (m, p = {}) => new Promise((res) => { const k = ++id; pend.set(k, res); ws.send(JSON.stringify({ id: k, method: m, params: p })); });
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } });
  await cdp('Page.enable'); await cdp('Runtime.enable');
  const base = `http://localhost:${porta}`;
  return {
    base, cdp,
    async ir(caminho, w = 1600, h = 1600) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await cdp('Page.navigate', { url: base + caminho }); await espera(600);
      await this.avaliar('document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))))');
      await espera(300);
    },
    async avaliar(expr) {
      const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 600));
      return r.result.value;
    },
    async foto(arquivo, w = 1600, h = 1600, qualidade = 88) {
      const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: qualidade, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      fs.writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
    },
    fechar() { ws.close(); chrome.kill(); srv.close(); },
  };
}
module.exports = { abrir, espera };

import { diasQueFaltam, textoDosDias, type Colocado, type Ranking } from './ranking';

/**
 * A arte do ranking para o grupo de WhatsApp (11/11/2026, mockup aprovado:
 * https://claude.ai/artifact/9zTrCbAGR8hA2h6tMfsZUN, versão 3): 1080 × 1350,
 * o formato que o WhatsApp mostra inteiro. Em cima, a ilustração das pizzas da
 * arte oficial, esmaecendo no fundo; o fundo é o gradiente da arte oficial
 * (vermelho sob as pizzas, terracota embaixo, bordas mais escuras); as 5
 * unidades com barra e as 3 pessoas que mais compraram; rodapé com o total,
 * os dias que faltam e o link; o fio de cinco cores da ANA.
 */

const L = 1080, A = 1350, M = 72, DIR = L - M;
const C = { creme: '#F5DFBB', amarelo: '#FBCE00', verde: '#81E2CF', fio: 'rgba(245,223,187,.5)', trilho: 'rgba(245,223,187,.22)' };
const FIO = ['#F5DFBB', '#FBCE00', '#F37964', '#81E2CF', '#01ADFF'];
/** Cor do número da posição (1º amarelo, 2º verde-água, 3º creme, os outros creme apagado). */
const COR_DA_POSICAO = [C.amarelo, C.verde, C.creme, 'rgba(245,223,187,.7)', 'rgba(245,223,187,.7)'];
const COR_DA_BARRA = [C.amarelo, C.verde, C.creme, 'rgba(245,223,187,.6)', 'rgba(245,223,187,.6)'];
export const IMAGEM_DAS_PIZZAS = '/pizza-da-alegria-faixa.webp';

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('imagem_nao_carregou')); i.src = src; });
}

/** Corta o texto com "…" para caber na largura. */
function caber(g: CanvasRenderingContext2D, t: string, max: number): string {
  if (g.measureText(t).width <= max) return t;
  let s = t;
  while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function elipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, paradas: Array<[number, string]>) {
  g.save();
  g.translate(cx, cy); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr; g.fillRect(-rx * 2, -rx * 2, rx * 4, rx * 4);
  g.restore();
}

function cabecalho(g: CanvasRenderingContext2D, titulo: string, y: number) {
  g.fillStyle = C.creme; g.textAlign = 'left';
  g.font = '800 28px Poppins'; g.letterSpacing = '0.5px'; g.fillText(titulo.toUpperCase(), M, y); g.letterSpacing = '0px';
  g.font = '500 22px Poppins'; g.textAlign = 'right'; g.fillText('pizzas', DIR, y);
  g.fillStyle = C.fio; g.fillRect(M, y + 15, L - 2 * M, 3);
}

export async function desenharRanking(r: Ranking, agora: Date = new Date()): Promise<Blob> {
  await Promise.all(['500 22px Poppins', '600 30px Poppins', '800 30px Poppins', '900 80px Poppins'].map((f) => document.fonts?.load(f).catch(() => null)));
  const c = document.createElement('canvas');
  c.width = L; c.height = A;
  const g = c.getContext('2d')!;

  // Fundo: o gradiente da arte oficial
  const fundo = g.createLinearGradient(0, 0, 0, A);
  fundo.addColorStop(0, '#C9452F'); fundo.addColorStop(0.3, '#B84E30'); fundo.addColorStop(0.62, '#A9502E'); fundo.addColorStop(1, '#9C4627');
  g.fillStyle = fundo; g.fillRect(0, 0, L, A);
  elipse(g, L / 2, A * 0.62, L * 0.85, A * 0.6, [[0, 'rgba(214,120,80,.22)'], [0.7, 'rgba(214,120,80,0)']]);
  elipse(g, L / 2, A * 0.55, L * 1.2, A * 0.9, [[0.55, 'rgba(90,30,12,0)'], [1, 'rgba(90,30,12,.38)']]);

  // A ilustração das pizzas, esmaecendo no fundo a partir de 70% da altura
  try {
    const img = await carregar(IMAGEM_DAS_PIZZAS);
    const alt = Math.round((L * img.naturalHeight) / img.naturalWidth);
    const foto = document.createElement('canvas'); foto.width = L; foto.height = alt;
    const f = foto.getContext('2d')!;
    f.drawImage(img, 0, 0, L, alt);
    f.globalCompositeOperation = 'destination-in';
    const mascara = f.createLinearGradient(0, 0, 0, alt);
    mascara.addColorStop(0.7, 'rgba(0,0,0,1)'); mascara.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = mascara; f.fillRect(0, 0, L, alt);
    g.drawImage(foto, 0, 0);
  } catch { /* sem a foto, fica o fundo */ }

  // Título
  g.save();
  g.shadowColor = 'rgba(90,30,12,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 3;
  g.fillStyle = C.creme; g.textAlign = 'left'; g.font = '900 80px Poppins'; g.letterSpacing = '-1px';
  g.fillText('RANKING', M, 520); g.fillText('DA SEMANA', M, 592);
  g.restore();
  g.letterSpacing = '0px';
  const quando = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  g.textAlign = 'right';
  g.fillStyle = C.amarelo; g.font = '800 34px Poppins'; g.fillText(`Parcial até ${quando}`, DIR, 556);
  g.fillStyle = C.creme; g.font = '600 26px Poppins'; g.fillText('Pedidos até 30/11', DIR, 592);

  // Unidades: as 5 primeiras, com barra
  cabecalho(g, 'Unidades', 664);
  const xNome = M + 84 + 18, larguraNum = 76, fimBarra = DIR - larguraNum - 18;
  const maxU = Math.max(1, ...r.unidades.slice(0, 5).map((u) => u.pizzas));
  let y = 690;
  r.unidades.slice(0, 5).forEach((u: Colocado, i) => {
    const alt = i === 0 ? 64 : 54, meio = y + alt / 2;
    g.textAlign = 'left'; g.fillStyle = COR_DA_POSICAO[i];
    g.font = `900 ${i === 0 ? 56 : i < 3 ? 48 : 40}px Poppins`; g.fillText(`${i + 1}º`, M, meio + (i === 0 ? 20 : i < 3 ? 17 : 14));
    g.fillStyle = C.creme; g.font = i === 0 ? '800 36px Poppins' : '600 30px Poppins';
    g.fillText(caber(g, u.nome, fimBarra - xNome), xNome, meio + (i === 0 ? 4 : 2));
    const yBarra = meio + (i === 0 ? 14 : 12);
    g.fillStyle = C.trilho; g.fillRect(xNome, yBarra, fimBarra - xNome, 8);
    g.fillStyle = COR_DA_BARRA[i]; g.fillRect(xNome, yBarra, Math.max(4, ((fimBarra - xNome) * u.pizzas) / maxU), 8);
    g.textAlign = 'right'; g.fillStyle = i === 0 ? C.amarelo : C.creme; g.font = `800 ${i === 0 ? 42 : 32}px Poppins`;
    g.fillText(String(u.pizzas), DIR, meio + (i === 0 ? 15 : 11));
    y += alt;
  });

  // Pessoas: as 3 primeiras
  cabecalho(g, 'Quem mais comprou', 1032);
  y = 1058;
  r.pessoas.slice(0, 3).forEach((p: Colocado, i) => {
    const alt = i === 0 ? 62 : 56, meio = y + alt / 2;
    g.textAlign = 'left'; g.fillStyle = COR_DA_POSICAO[i];
    g.font = `900 ${i === 0 ? 48 : 42}px Poppins`; g.fillText(`${i + 1}º`, M, meio + (i === 0 ? 17 : 15));
    g.fillStyle = C.creme; g.font = i === 0 ? '800 36px Poppins' : '600 32px Poppins';
    const nome = caber(g, p.nome, DIR - larguraNum - 18 - xNome - 120);
    g.fillText(nome, xNome, meio + 12);
    const xUnidade = xNome + g.measureText(nome).width + 12;
    g.font = '500 22px Poppins';
    g.fillText(caber(g, p.unidade ?? '', DIR - larguraNum - 18 - xUnidade), xUnidade, meio + 11);
    g.textAlign = 'right'; g.fillStyle = i === 0 ? C.amarelo : C.creme; g.font = `800 ${i === 0 ? 40 : 34}px Poppins`;
    g.fillText(String(p.pizzas), DIR, meio + 14);
    y += alt;
  });

  // Rodapé: total, dias que faltam e o link
  g.fillStyle = C.fio; g.fillRect(M, 1278, L - 2 * M, 3);
  g.fillStyle = C.creme; g.textAlign = 'left';
  const total = `${r.pizzas} ${r.pizzas === 1 ? 'pizza' : 'pizzas'}`;
  g.font = '800 22px Poppins'; g.fillText(total, M, 1314);
  const xResto = M + g.measureText(total).width;
  g.font = '500 22px Poppins'; g.fillText(` · ${textoDosDias(diasQueFaltam(agora))}`, xResto, 1314);
  g.textAlign = 'right'; g.fillText('app.anabrasil.org/pizza-da-alegria', DIR, 1314);
  FIO.forEach((cor, i) => { g.fillStyle = cor; g.fillRect((L / 5) * i, A - 16, L / 5 + 1, 16); });

  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('ranking_vazio'))), 'image/jpeg', 0.92));
}

/** Celular: menu de compartilhar (dá para mandar direto ao grupo). Computador: download. */
export async function salvarRanking(blob: Blob, agora: Date = new Date()): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const dia = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const arquivo = new File([blob], `ranking-pizza-da-alegria-${dia}.jpg`, { type: 'image/jpeg' });
  const celular = window.matchMedia?.('(pointer: coarse)').matches;
  if (celular && navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: 'Ranking · Pizza da Alegria' }); return 'compartilhado'; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'cancelado'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = arquivo.name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}

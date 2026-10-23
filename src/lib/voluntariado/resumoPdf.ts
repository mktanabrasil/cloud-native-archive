import { anaLogo } from '@/lib/anaLogo';
import { DIA_DO_EVENTO, TREINAMENTO, ULTIMO_DIA, parceirosPorExtenso } from './modelo';
import type { Painel } from './aoVivo';

/**
 * O "Baixar resumo" do painel ao vivo (decisões de 23/10/2026): uma folha A4
 * paisagem, para apresentação, com o que o painel mostra — números, metas por
 * área, quem são, horários e inscrições por dia. Sem ranking de unidades, sem
 * nomes e sem telefones. Peça da identidade: capa da campanha, logo ANA e o
 * rodapé do Social (as cinco faixas, de ponta a ponta).
 *
 * Desenhada num canvas em 3x (a folha tem 1123 × 794 px a 96 dpi) e posta
 * inteira numa página do jsPDF.
 */

const W = 1123;
const H = 794;
const ESCALA = 3;
const COR = {
  fundo: '#FFFCF6', verde: '#1E4D3A', vermelho: '#C8372D', tinta: '#1f2322', grafite: '#484848', mut: '#6E655B',
  fio: '#e6dccb', trilho: '#EDE6D8', reserva: '#A9D3C2', ok: '#1D6B43', falta: '#8A5A00', creme: '#F6EEDF',
};
/** Quem são: as cores da paleta ANA na barra, e um tom mais escuro para o número (leitura). */
const VINCULO = [
  { chave: 'funcionario', rotulo: 'Funcionários ANA', barra: '#01adff', texto: '#0077B3' },
  { chave: 'alcance', rotulo: 'Alcance JNI', barra: '#f37964', texto: '#C24A35' },
  { chave: 'comunidade', rotulo: 'Voluntários de fora', barra: '#81e2cf', texto: '#1A7F5A' },
] as const;
/** O rodapé do Social: as cinco faixas da paleta, na ordem. */
const RODAPE = ['#f5dfbb', '#fbce00', '#f37964', '#81e2cf', '#01adff'];

const fonte = (peso: number, px: number) => `${peso} ${px}px Poppins, sans-serif`;

async function imagem(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Texto com cores diferentes por trecho, terminando em `xFim`. */
function trechosADireita(g: CanvasRenderingContext2D, partes: Array<[string, string, string]>, xFim: number, y: number) {
  const larguras = partes.map(([t, f]) => { g.font = f; return g.measureText(t).width; });
  let x = xFim - larguras.reduce((s, l) => s + l, 0);
  partes.forEach(([t, f, c], i) => { g.font = f; g.fillStyle = c; g.fillText(t, x, y); x += larguras[i]; });
}

/** Corta o texto com reticências para caber na largura. */
function caber(g: CanvasRenderingContext2D, t: string, max: number): string {
  if (g.measureText(t).width <= max) return t;
  let s = t;
  while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

const dataHora = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ').replace(':', 'h');

export async function desenharResumo(p: Painel, lidoEm: number): Promise<HTMLCanvasElement> {
  await Promise.all([[400, 12], [600, 12], [700, 12], [800, 30]].map(([peso, px]) => document.fonts?.load(fonte(peso, px)).catch(() => null)));
  const c = document.createElement('canvas');
  c.width = W * ESCALA; c.height = H * ESCALA;
  const g = c.getContext('2d')!;
  g.scale(ESCALA, ESCALA);
  g.fillStyle = COR.fundo; g.fillRect(0, 0, W, H);

  // Topo: capa, título e a hora da leitura.
  const [capa, logo] = await Promise.all([imagem('/voluntariado-natal-feliz-capa.webp'), imagem(anaLogo(50 * ESCALA).src)]);
  g.fillStyle = COR.verde; g.fillRect(0, 0, W, 170);
  g.drawImage(capa, 0, 0, 348, 170);
  g.fillStyle = COR.creme;
  g.font = fonte(700, 12); g.fillText('RESUMO DAS INSCRIÇÕES', 382, 72);
  g.font = fonte(800, 30); g.fillText(`Dia do Voluntariado · Natal Feliz 2026`, 382, 108);
  g.font = fonte(400, 14); g.fillText(caber(g, `${DIA_DO_EVENTO} no ${TREINAMENTO.local} · em parceria com ${parceirosPorExtenso()} · inscrições até ${ULTIMO_DIA}`, W - 382 - 30), 382, 134);
  g.font = fonte(400, 11.5); g.textAlign = 'right'; g.fillText(`Atualizado em ${dataHora(lidoEm)}`, W - 30, 34); g.textAlign = 'left';
  g.fillStyle = COR.vermelho; g.fillRect(0, 170, W, 6);

  const titulo = (t: string, x: number, y: number) => { g.fillStyle = COR.vermelho; g.font = fonte(700, 12); g.fillText(t, x, y); };
  const fio = (x: number, y: number, w: number) => { g.fillStyle = COR.fio; g.fillRect(x, y, w, 1.5); };

  // Coluna 1: os números.
  const x0 = 34, w0 = 220;
  titulo('NÚMEROS', x0, 212);
  fio(x0, 228, w0);
  g.fillStyle = COR.verde; g.font = fonte(800, 64); g.fillText(String(p.total), x0, 292);
  g.fillStyle = COR.tinta; g.font = fonte(400, 14); g.fillText(p.total === 1 ? 'voluntário inscrito' : 'voluntários inscritos', x0, 314);
  g.fillStyle = COR.ok; g.font = fonte(600, 12); g.fillText(`+${p.hoje} hoje`, x0, 332);
  fio(x0, 344, w0);
  if (p.vagas.total) {
    const pct = Math.round((p.vagas.preenchidas / p.vagas.total) * 100);
    g.fillStyle = COR.tinta; g.font = fonte(800, 36); g.fillText(String(p.vagas.preenchidas), x0, 384);
    const l = g.measureText(String(p.vagas.preenchidas)).width;
    g.fillStyle = COR.mut; g.font = fonte(600, 20); g.fillText(` / ${p.vagas.total}`, x0 + l, 384);
    g.fillStyle = COR.trilho; g.fillRect(x0, 393, w0, 8);
    g.fillStyle = COR.verde; g.fillRect(x0, 393, w0 * Math.min(1, pct / 100), 8);
    g.fillStyle = COR.tinta; g.font = fonte(400, 13); g.fillText(`vagas das metas · ${pct}%`, x0, 420);
  } else {
    g.fillStyle = COR.mut; g.font = fonte(400, 13); g.fillText('Nenhuma meta por área definida.', x0, 384);
  }
  fio(x0, 432, w0);
  g.fillStyle = COR.tinta; g.font = fonte(800, 36); g.fillText(String(p.faltamDias), x0, 472);
  let l = g.measureText(String(p.faltamDias)).width;
  g.font = fonte(700, 18); g.fillText(p.faltamDias === 1 ? ' dia' : ' dias', x0 + l, 472);
  g.font = fonte(400, 13); g.fillText(`para encerrar (${ULTIMO_DIA})`, x0, 492);
  fio(x0, 504, w0);
  const media = p.mediaPorDia.toLocaleString('pt-BR');
  g.fillStyle = COR.tinta; g.font = fonte(800, 36); g.fillText(media, x0, 544);
  l = g.measureText(media).width;
  g.font = fonte(700, 18); g.fillText(' por dia', x0 + l, 544);
  g.font = fonte(400, 13); g.fillText('média dos últimos 7 dias', x0, 564);

  // Coluna 2: as metas por área.
  const x1 = 284, w1 = 475, nome = 150, sit = 150, bx = x1 + nome + 12, bw = w1 - nome - sit - 24;
  titulo('METAS POR ÁREA · 1ª OPÇÃO CONTA PARA A META', x1, 212);
  const alt = Math.min(52, 430 / Math.max(1, p.porArea.length));
  const esc = Math.max(1, ...p.porArea.map((a) => Math.max(a.meta ?? 0, a.primeira + a.segunda))) * 1.05;
  p.porArea.forEach((a, i) => {
    const y = 228 + i * alt;
    fio(x1, y, w1);
    g.fillStyle = COR.tinta; g.font = fonte(700, 14);
    if (g.measureText(a.rotulo).width > nome) g.font = fonte(700, 12);
    g.fillText(caber(g, a.rotulo, nome), x1, y + alt / 2 + 2);
    g.fillStyle = COR.mut; g.font = fonte(400, 11);
    g.fillText(a.segunda ? `${a.segunda} na reserva` : 'sem reserva', x1, y + alt / 2 + 16);
    const by = y + alt / 2 - 3;
    g.fillStyle = COR.trilho; g.fillRect(bx, by, bw, 14);
    g.fillStyle = COR.reserva; g.fillRect(bx, by, bw * ((a.primeira + a.segunda) / esc), 14);
    g.fillStyle = COR.verde; g.fillRect(bx, by, bw * (a.primeira / esc), 14);
    if (a.meta) { g.fillStyle = COR.tinta; g.fillRect(bx + bw * (a.meta / esc) - 1, by - 4, 2, 22); }
    const ys = y + alt / 2 + 8;
    if (!a.meta) trechosADireita(g, [[`${a.primeira} inscritos · sem meta`, fonte(400, 13), COR.mut]], x1 + w1, ys);
    else if (a.lotada) trechosADireita(g, [[`${a.primeira} de ${a.meta} · lotada${a.primeira > a.meta ? ` (+${a.primeira - a.meta})` : ''}`, fonte(700, 13), COR.ok]], x1 + w1, ys);
    else trechosADireita(g, [[String(a.primeira), fonte(700, 13), COR.tinta], [` de ${a.meta} · `, fonte(400, 13), COR.tinta], [`faltam ${a.meta - a.primeira}`, fonte(700, 13), COR.falta]], x1 + w1, ys);
  });
  const yl = 228 + p.porArea.length * alt + 18;
  g.font = fonte(400, 11);
  g.fillStyle = COR.verde; g.fillRect(x1, yl - 8, 9, 9); g.fillStyle = COR.mut; g.fillText('1ª opção', x1 + 13, yl);
  g.fillStyle = COR.reserva; g.fillRect(x1 + 80, yl - 8, 9, 9); g.fillStyle = COR.mut; g.fillText('2ª opção (reserva)', x1 + 93, yl);
  g.fillStyle = COR.tinta; g.fillRect(x1 + 210, yl - 10, 2, 12); g.fillStyle = COR.mut; g.fillText('meta', x1 + 217, yl);

  // Coluna 3: quem são, por horário e por dia.
  const x2 = 789, w2 = 300;
  titulo('QUEM SÃO', x2, 212);
  const total = Math.max(1, p.total);
  let xv = x2;
  const vivos = VINCULO.filter((v) => p.porVinculo[v.chave] > 0);
  vivos.forEach((v, i) => {
    const largura = (w2 - 2 * (vivos.length - 1)) * (p.porVinculo[v.chave] / total);
    g.fillStyle = v.barra; g.fillRect(xv, 222, largura, 16);
    xv += largura + (i < vivos.length - 1 ? 2 : 0);
  });
  if (!vivos.length) { g.fillStyle = COR.trilho; g.fillRect(x2, 222, w2, 16); }
  VINCULO.forEach((v, i) => {
    const y = 262 + i * 18;
    g.fillStyle = v.barra; g.fillRect(x2, y - 9, 10, 10);
    g.fillStyle = COR.tinta; g.font = fonte(400, 13); g.fillText(v.rotulo, x2 + 17, y);
    const n = p.porVinculo[v.chave];
    trechosADireita(g, [[String(n), fonte(700, 13), v.texto], [` · ${Math.round((n / total) * 100)}%`, fonte(400, 13), COR.mut]], x2 + w2, y);
  });

  titulo('POR HORÁRIO', x2, 328);
  const maxH = Math.max(1, ...p.porHorario.map((h) => h.n));
  p.porHorario.forEach((h, i) => {
    const y = 348 + i * 19;
    g.fillStyle = h.cor; g.beginPath(); g.arc(x2 + 5, y - 4, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = COR.tinta; g.font = fonte(400, 12);
    g.fillText(caber(g, h.detalhe ? `${h.rotulo} · ${h.detalhe}` : h.rotulo, 150), x2 + 17, y);
    g.fillStyle = COR.trilho; g.fillRect(x2 + 172, y - 9, 96, 10);
    g.fillStyle = COR.verde; g.fillRect(x2 + 172, y - 9, 96 * (h.n / maxH), 10);
    g.font = fonte(700, 12); g.textAlign = 'right'; g.fillText(String(h.n), x2 + w2, y); g.textAlign = 'left';
  });

  const dias = p.porDia.filter((d) => !d.futuro);
  const yd = 348 + p.porHorario.length * 19 + 22;
  titulo(`INSCRIÇÕES POR DIA${dias.length ? ` · ${dias[0].rotulo === 'hoje' ? 'HOJE' : `${dias[0].rotulo} A HOJE`}` : ''}`, x2, yd);
  const maxD = Math.max(1, ...dias.map((d) => d.n));
  const gap = dias.length > 20 ? 2 : 3;
  const larg = dias.length ? (w2 - gap * (dias.length - 1)) / dias.length : 0;
  dias.forEach((d, i) => {
    const h = Math.max(1, (d.n / maxD) * 64);
    const x = x2 + i * (larg + gap);
    g.fillStyle = d.hoje ? COR.verde : COR.reserva; g.fillRect(x, yd + 92 - h, larg, h);
    if (larg >= 8) { g.fillStyle = COR.tinta; g.font = fonte(700, 9); g.textAlign = 'center'; g.fillText(String(d.n), x + larg / 2, yd + 88 - h); g.textAlign = 'left'; }
  });

  // Rodapé: logo, a nota e as cinco faixas do Social, de ponta a ponta.
  const lw = 50 * (2206 / 883);
  g.drawImage(logo, x0 - 16, H - 44 - 50, lw, 50);
  g.fillStyle = COR.grafite; g.font = fonte(400, 11.5); g.textAlign = 'right';
  g.fillText('Painel ao vivo do voluntariado · app da ANA Brasil', W - 34, H - 64);
  g.fillText('Sem nomes nem telefones', W - 34, H - 49);
  g.textAlign = 'left';
  RODAPE.forEach((cor, i) => { g.fillStyle = cor; g.fillRect((W / RODAPE.length) * i, H - 30, W / RODAPE.length + 0.5, 30); });

  return c;
}

/** Gera o PDF (A4 paisagem) e baixa. */
export async function baixarResumo(p: Painel, lidoEm: number): Promise<void> {
  const canvas = await desenharResumo(p, lidoEm);
  const { default: JsPDF } = await import('jspdf');
  const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
  const d = new Date(lidoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
  pdf.save(`resumo-voluntariado-natal-feliz-${d}.pdf`);
}

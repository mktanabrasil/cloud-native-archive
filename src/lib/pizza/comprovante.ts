import { desenharQr, linkDaRetirada } from './qr';

/**
 * O comprovante do pagamento online da Pizza da Alegria (mockup aprovado em
 * 10/11/2026: https://claude.ai/artifact/YFLkrrZasjah83MbQnV3Ee), no lugar do
 * "tire um print": uma imagem JPEG leve com o número, quem pediu, os sabores,
 * o total, a forma de pagamento, a hora, o código da operação no Mercado Pago
 * e a retirada. Os dados do pagamento vêm da função pizza-pagamento, que os
 * leu do Mercado Pago. A cópia do Drive é um PDF feito pelo servidor
 * (função pizza-drive), com o mesmo conteúdo.
 *
 * No celular abre o menu de compartilhar, que salva na galeria; no computador,
 * ou onde não houver o menu, baixa o arquivo (como no Voluntariado).
 *
 * Desde 10/11/2026 traz um QR Code com o número do pedido, que a equipe lê na
 * Integração dos Funcionários para dar baixa (qr.ts). No mesmo dia virou
 * 1080 × 1920, a proporção do celular, com o QR Code grande no centro (mockup:
 * https://claude.ai/artifact/9SBAvUhduZ9fr21iGGJUuq).
 */

export interface DadosDoComprovante {
  numero: string;
  nome: string;
  unidade: string;
  itens: ReadonlyArray<{ sabor: string; qtd: number }>;
  /** Preço de cada pizza no pedido (o banco grava o total). */
  preco: number;
  total: number;
  forma: string; // "Pix", "Cartão de crédito Visa"
  pagoEm: string; // "10/11/2026, 14:32"
  codigo: string; // id do pagamento no Mercado Pago
  retirada: string; // "quinta, 17/12/2026"
}

const COR = {
  vermelho: '#D8463A', vermelhoEsc: '#A9322A', creme: '#F4E7D2', fundo: '#FFFBF5', tinta: '#2B1A14', mut: '#7A6359',
  linha: '#EADBC8', marrom: '#6B2E1C', branco: '#FFFFFF', seloBg: '#E3F2E9', seloTx: '#1E6B41',
};
const FIO = ['#F5DFBB', '#FBCE00', '#F37964', '#81E2CF', '#01ADFF'];
const LARGURA = 1080;
/** A proporção da tela do celular (9:16): a imagem abre ocupando a tela, sem faixas. */
const ALTURA_MINIMA = 1920;
const MARGEM = 72;

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Quebra o texto na largura; devolve as linhas. */
function quebrar(g: CanvasRenderingContext2D, txt: string, max: number): string[] {
  const linhas: string[] = [];
  let l = '';
  for (const p of txt.split(' ')) {
    const t = l ? `${l} ${p}` : p;
    if (g.measureText(t).width > max && l) { linhas.push(l); l = p; } else l = t;
  }
  linhas.push(l);
  return linhas;
}

export async function desenharComprovante(d: DadosDoComprovante): Promise<Blob> {
  await Promise.all(['400 30px Poppins', '600 30px Poppins', '700 30px Poppins', '800 60px Poppins'].map((f) => document.fonts?.load(f).catch(() => null)));
  const rascunho = document.createElement('canvas');
  rascunho.width = LARGURA; rascunho.height = 3200;
  const g = rascunho.getContext('2d')!;
  g.fillStyle = COR.fundo; g.fillRect(0, 0, LARGURA, rascunho.height);
  const direita = LARGURA - MARGEM;
  const centro = (t: string, y: number) => g.fillText(t, (LARGURA - g.measureText(t).width) / 2, y);

  // Topo vermelho
  const topo = 230;
  g.fillStyle = COR.vermelho; g.fillRect(0, 0, LARGURA, topo);
  g.fillStyle = COR.branco;
  g.font = '600 26px Poppins'; g.fillText('ANA BRASIL  ·  PIZZA DA ALEGRIA', MARGEM, 84);
  g.font = '800 60px Poppins'; g.fillText('Comprovante de pagamento', MARGEM, 162);

  // O QR Code no centro, grande: é ele que a equipe lê na retirada
  let y = topo + 60;
  const ladoQr = 680, folga = 24;
  const xCartao = (LARGURA - ladoQr - 2 * folga) / 2;
  g.fillStyle = COR.branco; g.strokeStyle = COR.linha; g.lineWidth = 4;
  g.beginPath(); g.roundRect(xCartao, y, ladoQr + 2 * folga, ladoQr + 2 * folga, 36); g.fill(); g.stroke();
  desenharQr(g, linkDaRetirada(d.numero), xCartao + folga, y + folga, ladoQr, COR.tinta);
  y += ladoQr + 2 * folga + 104;

  // O número e o selo "Pago", centralizados
  g.font = '800 84px Poppins';
  const larguraNum = g.measureText(d.numero).width;
  g.font = '700 30px Poppins';
  const larguraSelo = g.measureText('PAGO').width + 52;
  const xNum = (LARGURA - (larguraNum + 28 + larguraSelo)) / 2;
  g.fillStyle = COR.vermelhoEsc; g.font = '800 84px Poppins'; g.fillText(d.numero, xNum, y);
  const xSelo = xNum + larguraNum + 28;
  g.fillStyle = COR.seloBg; g.beginPath(); g.roundRect(xSelo, y - 52, larguraSelo, 60, 30); g.fill();
  g.fillStyle = COR.seloTx; g.font = '700 30px Poppins'; g.fillText('PAGO', xSelo + 26, y - 11);
  y += 56;

  // A faixa da retirada
  const alturaFaixa = 156;
  g.fillStyle = COR.marrom; g.beginPath(); g.roundRect(MARGEM, y, LARGURA - 2 * MARGEM, alturaFaixa, 28); g.fill();
  g.fillStyle = COR.creme; g.font = '700 38px Poppins'; centro('Mostre este QR Code na retirada', y + 66);
  g.font = '400 30px Poppins'; g.globalAlpha = 0.92;
  centro(`${d.retirada[0].toUpperCase() + d.retirada.slice(1)} · Integração dos Funcionários`, y + 116); g.globalAlpha = 1;
  y += alturaFaixa + 24;

  // Os dados, menores: rótulo à esquerda, valor à direita
  const linha = (rotulo: string, valor: string, fonte = '600 30px Poppins') => {
    y += 52;
    g.fillStyle = COR.mut; g.font = '400 28px Poppins'; g.fillText(rotulo, MARGEM, y);
    g.fillStyle = COR.tinta; g.font = fonte;
    const partes = quebrar(g, valor, LARGURA - 2 * MARGEM - 260);
    partes.forEach((p, i) => g.fillText(p, direita - g.measureText(p).width, y + i * 40));
    y += (partes.length - 1) * 40;
  };
  linha('Nome', d.nome);
  linha('Unidade', d.unidade);

  y += 30;
  const alturaItem = 54;
  const alturaQuadro = (d.itens.length + 1) * alturaItem + 20;
  g.fillStyle = COR.branco; g.strokeStyle = COR.linha; g.lineWidth = 3;
  g.beginPath(); g.roundRect(MARGEM, y, LARGURA - 2 * MARGEM, alturaQuadro, 22); g.fill(); g.stroke();
  let yi = y + 10;
  const dentro = MARGEM + 28, dentroDir = direita - 28;
  for (const it of d.itens) {
    yi += alturaItem;
    g.fillStyle = COR.tinta; g.font = '400 28px Poppins'; g.fillText(`${it.qtd} × ${it.sabor}`, dentro, yi - 18);
    const v = reais(it.qtd * d.preco); g.fillText(v, dentroDir - g.measureText(v).width, yi - 18);
    g.setLineDash([8, 8]); g.strokeStyle = COR.linha; g.lineWidth = 2;
    g.beginPath(); g.moveTo(dentro, yi); g.lineTo(dentroDir, yi); g.stroke(); g.setLineDash([]);
  }
  yi += alturaItem;
  const pizzas = d.itens.reduce((a, it) => a + it.qtd, 0);
  g.fillStyle = COR.tinta; g.font = '700 30px Poppins';
  g.fillText(`Total · ${pizzas} ${pizzas === 1 ? 'pizza' : 'pizzas'}`, dentro, yi - 18);
  const t = reais(d.total); g.fillText(t, dentroDir - g.measureText(t).width, yi - 18);
  y += alturaQuadro + 6;

  linha('Pagamento', `${d.forma} · ${d.pagoEm}`);
  linha('Código da operação', d.codigo, '600 24px Poppins');
  y += 64;
  g.fillStyle = COR.mut; g.font = '400 22px Poppins'; centro('Pagamento confirmado pelo Mercado Pago · app.anabrasil.org', y);
  y += 36;

  // Pelo menos a altura da tela do celular (1080 × 1920); cresce se o pedido for longo.
  const altura = Math.max(ALTURA_MINIMA, y + 16);
  const final = document.createElement('canvas');
  final.width = LARGURA; final.height = altura;
  const f = final.getContext('2d')!;
  f.fillStyle = COR.fundo; f.fillRect(0, 0, LARGURA, altura);
  f.drawImage(rascunho, 0, 0);
  FIO.forEach((c, i) => { f.fillStyle = c; f.fillRect((LARGURA / 5) * i, altura - 16, LARGURA / 5 + 1, 16); });
  return new Promise((ok, falha) => final.toBlob((b) => (b ? ok(b) : falha(new Error('comprovante_vazio'))), 'image/jpeg', 0.9));
}

/** Celular: menu de compartilhar (salva na galeria). Computador ou sem o menu: download. */
export async function salvarComprovante(d: DadosDoComprovante): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const blob = await desenharComprovante(d);
  const nome = `comprovante-${d.numero}.jpg`;
  const arquivo = new File([blob], nome, { type: 'image/jpeg' });
  const celular = window.matchMedia?.('(pointer: coarse)').matches;
  if (celular && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Comprovante · Pizza da Alegria' });
      return 'compartilhado';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}

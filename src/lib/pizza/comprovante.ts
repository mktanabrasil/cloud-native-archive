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
  await Promise.all(['400 26px Poppins', '600 30px Poppins', '700 30px Poppins', '800 56px Poppins'].map((f) => document.fonts?.load(f).catch(() => null)));
  const rascunho = document.createElement('canvas');
  rascunho.width = LARGURA; rascunho.height = 3000;
  const g = rascunho.getContext('2d')!;
  g.fillStyle = COR.fundo; g.fillRect(0, 0, LARGURA, rascunho.height);
  const direita = LARGURA - MARGEM;

  // Topo vermelho
  const topo = 250;
  g.fillStyle = COR.vermelho; g.fillRect(0, 0, LARGURA, topo);
  g.fillStyle = COR.branco;
  g.font = '600 24px Poppins'; g.fillText('ANA BRASIL  ·  PIZZA DA ALEGRIA', MARGEM, 78);
  g.font = '800 56px Poppins'; g.fillText('Comprovante de pagamento', MARGEM, 152);
  g.font = '400 26px Poppins'; g.globalAlpha = 0.92; g.fillText('Campanha 2026 · compras até 30/11', MARGEM, 200); g.globalAlpha = 1;

  // Número e selo "Pago"
  let y = topo + 100;
  g.fillStyle = COR.vermelhoEsc; g.font = '800 64px Poppins'; g.fillText(d.numero, MARGEM, y);
  g.font = '700 26px Poppins';
  const larguraSelo = g.measureText('PAGO').width + 48;
  g.fillStyle = COR.seloBg; g.beginPath(); g.roundRect(direita - larguraSelo, y - 46, larguraSelo, 54, 27); g.fill();
  g.fillStyle = COR.seloTx; g.fillText('PAGO', direita - larguraSelo + 24, y - 10);
  y += 36;
  g.fillStyle = COR.linha; g.fillRect(MARGEM, y, LARGURA - 2 * MARGEM, 3);

  // Rótulo à esquerda, valor à direita (quebra em linhas, alinhadas à direita)
  const linha = (rotulo: string, valor: string, fonte = '600 30px Poppins') => {
    y += 58;
    g.fillStyle = COR.mut; g.font = '400 28px Poppins'; g.fillText(rotulo, MARGEM, y);
    g.fillStyle = COR.tinta; g.font = fonte;
    const max = LARGURA - 2 * MARGEM - 280;
    const partes = quebrar(g, valor, max);
    partes.forEach((p, i) => g.fillText(p, direita - g.measureText(p).width, y + i * 42));
    y += (partes.length - 1) * 42;
  };
  linha('Nome', d.nome);
  linha('Unidade', d.unidade);

  // Os sabores, num quadro branco
  y += 44;
  const alturaItem = 62;
  const alturaQuadro = (d.itens.length + 1) * alturaItem + 24;
  g.fillStyle = COR.branco; g.strokeStyle = COR.linha; g.lineWidth = 3;
  g.beginPath(); g.roundRect(MARGEM, y, LARGURA - 2 * MARGEM, alturaQuadro, 24); g.fill(); g.stroke();
  let yi = y + 12;
  const dentro = MARGEM + 32, dentroDir = direita - 32;
  for (const it of d.itens) {
    yi += alturaItem;
    g.fillStyle = COR.tinta; g.font = '400 30px Poppins'; g.fillText(`${it.qtd} × ${it.sabor}`, dentro, yi - 20);
    const v = reais(it.qtd * d.preco); g.fillText(v, dentroDir - g.measureText(v).width, yi - 20);
    g.setLineDash([8, 8]); g.strokeStyle = COR.linha; g.lineWidth = 2;
    g.beginPath(); g.moveTo(dentro, yi); g.lineTo(dentroDir, yi); g.stroke(); g.setLineDash([]);
  }
  yi += alturaItem;
  const pizzas = d.itens.reduce((a, it) => a + it.qtd, 0);
  g.fillStyle = COR.tinta; g.font = '700 32px Poppins';
  g.fillText(`Total · ${pizzas} ${pizzas === 1 ? 'pizza' : 'pizzas'}`, dentro, yi - 20);
  const t = reais(d.total); g.fillText(t, dentroDir - g.measureText(t).width, yi - 20);
  y += alturaQuadro + 10;

  // O pagamento
  linha('Forma', d.forma);
  linha('Pago em', d.pagoEm);
  linha('Código da operação', d.codigo, '600 26px Poppins');

  // Retirada
  y += 50;
  g.font = '400 28px Poppins';
  const texto = quebrar(g, 'Na Integração dos Funcionários. Apresente este comprovante no dia.', LARGURA - 2 * MARGEM - 64);
  const alturaRet = 100 + texto.length * 40;
  g.fillStyle = COR.creme; g.beginPath(); g.roundRect(MARGEM, y, LARGURA - 2 * MARGEM, alturaRet, 24); g.fill();
  g.fillStyle = COR.marrom; g.font = '700 32px Poppins'; g.fillText(`Retirada: ${d.retirada}`, MARGEM + 32, y + 62);
  g.fillStyle = COR.tinta; g.font = '400 28px Poppins';
  texto.forEach((p, i) => g.fillText(p, MARGEM + 32, y + 108 + i * 40));
  y += alturaRet + 56;
  g.fillStyle = COR.mut; g.font = '400 22px Poppins'; g.fillText('Pagamento confirmado pelo Mercado Pago · app.anabrasil.org', MARGEM, y);
  y += 44;

  // O fio de cinco cores
  const final = document.createElement('canvas');
  final.width = LARGURA; final.height = y + 16;
  const f = final.getContext('2d')!;
  f.drawImage(rascunho, 0, 0);
  FIO.forEach((c, i) => { f.fillStyle = c; f.fillRect((LARGURA / 5) * i, y, LARGURA / 5 + 1, 16); });
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

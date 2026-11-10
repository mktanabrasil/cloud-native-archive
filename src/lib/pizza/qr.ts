import qrcode from 'qrcode-generator';

/**
 * A retirada com leitor (10/11/2026, mockup aprovado:
 * https://claude.ai/artifact/41wgaj3mM5yXTcrXmwSMwB).
 *
 * O comprovante traz um QR Code com o endereço da tela de retirada e o número
 * do pedido. Na Integração dos Funcionários, o leitor USB "digita" esse
 * endereço no campo da tela e aperta Enter: a tela acha o número e dá baixa.
 * A câmera do celular abre o mesmo endereço, e a tela pede um toque para
 * confirmar. Só quem pode ver a Pizza dá baixa (registrar_retirada_pizza).
 *
 * Este arquivo não fala com o banco: o comprovante usa só o desenho do QR Code.
 */

export const ROTA_DA_RETIRADA = '/pizza-da-alegria/retirada';
/** O que vai no QR Code: https://app.anabrasil.org/pizza-da-alegria/retirada?n=PZ-7KQ2M */
export const linkDaRetirada = (numero: string) => `https://app.anabrasil.org${ROTA_DA_RETIRADA}?n=${encodeURIComponent(numero)}`;

/**
 * O número do pedido no que o leitor digitou (o endereço inteiro, só o número,
 * minúsculas, ou com a pontuação trocada por um teclado de outro idioma).
 * Os números são PZ-XXXXX (sorteados) ou PZ-0001 (os primeiros, até 09/11).
 */
export function numeroLido(texto: string): string | null {
  const m = texto.toUpperCase().match(/PZ\W?([0-9A-Z]{4,5})(?![0-9A-Z])/);
  return m ? `PZ-${m[1]}` : null;
}

/** A matriz do QR Code (true = quadradinho escuro). Correção M: aguenta um amassado. */
export function matrizDoQr(texto: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Desenha o QR Code num canvas, com a margem branca que os leitores pedem (4 módulos). */
export function desenharQr(g: CanvasRenderingContext2D, texto: string, x: number, y: number, lado: number, cor = '#2B1A14') {
  const m = matrizDoQr(texto);
  const total = m.length + 8;
  const passo = lado / total;
  g.fillStyle = '#FFFFFF';
  g.fillRect(x, y, lado, lado);
  g.fillStyle = cor;
  m.forEach((linha, r) => linha.forEach((escuro, c) => {
    // +0.5 nas bordas para não sobrar fio branco entre os módulos.
    if (escuro) g.fillRect(x + (c + 4) * passo, y + (r + 4) * passo, passo + 0.5, passo + 0.5);
  }));
}

/** Sem acento e em minúsculas, para achar "joão" com "joao". */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

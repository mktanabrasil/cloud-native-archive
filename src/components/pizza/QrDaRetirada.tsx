import { useEffect, useRef } from 'react';
import { desenharQr, linkDaRetirada } from '@/lib/pizza/qr';

/**
 * O QR Code da retirada na própria tela (10/11/2026): na tela final do pagamento
 * e em "Seus pedidos". Quem não baixar a imagem pode mostrar a tela na retirada.
 * Desenhado em canvas na resolução do aparelho, para não borrar.
 */
export function QrDaRetirada({ numero, lado = 260 }: { numero: string; lado?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext?.('2d');
    if (!c || !g) return;
    const escala = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    c.width = lado * escala; c.height = lado * escala;
    desenharQr(g, linkDaRetirada(numero), 0, 0, lado * escala, '#2B1A14');
  }, [numero, lado]);
  return (
    <canvas
      ref={ref} width={lado} height={lado} data-testid="qr-na-tela" role="img" aria-label={`QR Code da retirada do pedido ${numero}`}
      className="block rounded-xl bg-white" style={{ width: lado, height: lado, maxWidth: '78vw', maxHeight: '78vw' }}
    />
  );
}

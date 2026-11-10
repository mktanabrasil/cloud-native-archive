import { describe, expect, it } from 'vitest';
import { linkDaRetirada, matrizDoQr, numeroLido, semAcento } from './qr';

describe('QR Code da retirada', () => {
  it('o QR Code leva à tela de retirada com o número', () => {
    expect(linkDaRetirada('PZ-7KQ2M')).toBe('https://app.anabrasil.org/pizza-da-alegria/retirada?n=PZ-7KQ2M');
  });

  it('acha o número no que o leitor digitar', () => {
    expect(numeroLido('https://app.anabrasil.org/pizza-da-alegria/retirada?n=PZ-7KQ2M')).toBe('PZ-7KQ2M');
    // Leitor configurado para teclado americano num computador ABNT2: a pontuação vem trocada.
    expect(numeroLido('https:;;app.anabrasil.org;pizza-da-alegria;retirada?n=PZ-7KQ2M')).toBe('PZ-7KQ2M');
    // Caps Lock ligado inverte as letras; o número vale igual.
    expect(numeroLido('HTTPS://APP.ANABRASIL.ORG/PIZZA-DA-ALEGRIA/RETIRADA?N=pz-7kq2m')).toBe('PZ-7KQ2M');
    expect(numeroLido('pz7kq2m')).toBe('PZ-7KQ2M');
    expect(numeroLido('PZ-0137')).toBe('PZ-0137'); // os primeiros números, até 09/11
    expect(numeroLido('Maria Souza')).toBeNull();
    expect(numeroLido('PZ-7KQ2M9')).toBeNull();
  });

  it('a matriz é quadrada e tem os três quadrados de canto', () => {
    const m = matrizDoQr(linkDaRetirada('PZ-7KQ2M'));
    const n = m.length;
    expect(m.every((l) => l.length === n)).toBe(true);
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      expect(m[r][c] && m[r][c + 6] && m[r + 6][c] && m[r + 6][c + 6] && m[r + 3][c + 3]).toBe(true);
      expect(m[r + 1][c + 1]).toBe(false);
    }
  });

  it('busca por nome sem acento', () => {
    expect(semAcento('João Conceição')).toBe('joao conceicao');
  });
});

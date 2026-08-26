import { describe, expect, it } from 'vitest';
import { prepararClone } from './prepararClone';

/**
 * A regra que este arquivo existe para travar: **o logo sai como `<img>`**.
 *
 * Ele já foi convertido em `background-image` aqui, na tentativa de fazê-lo
 * aparecer no PDF do celular, e o efeito foi o PDF parar de sair: o Safari do
 * iPhone contamina o canvas ao desenhar esse SVG por esse caminho, e o
 * `toDataURL` morre com "The operation is insecure". A bissecção no aparelho
 * apontou "limpa sem logo" enquanto as Formas ANA — o mesmo SVG, em `<img>` —
 * saíam sem problema.
 */

const FOTO = 'https://exemplo.supabase.co/fotos/a.jpg';
const LOGO = 'data:image/svg+xml,%3Csvg%3E';

const clone = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = `
    <div data-journal-page>
      <img data-ana-logo="true" src="${LOGO}" width="90" height="36" />
      <img data-ana-forma="true" src="${LOGO}" width="60" height="24" />
      <div data-block-kind="image"><img src="${FOTO}" /></div>
    </div>`;
  return doc;
};

describe('prepararClone', () => {
  it('deixa o logo como <img> — nunca como background-image', () => {
    const doc = clone();

    prepararClone(doc, new Map());

    expect(doc.querySelector('img[data-ana-logo]')).not.toBeNull();
    expect(doc.body.innerHTML).not.toContain('background-image: url("data:image/svg+xml');
  });

  it('troca a foto por um bloco com background-image, que é o que respeita o enquadramento', () => {
    const doc = clone();

    prepararClone(doc, new Map());

    expect(doc.querySelector('[data-block-kind="image"] img')).toBeNull();
    const substituto = doc.querySelector<HTMLElement>('[data-block-kind="image"] div');
    expect(substituto?.style.backgroundImage).toContain(FOTO);
    expect(substituto?.style.backgroundSize).toBe('cover');
  });

  it('aponta cada imagem para a cópia embutida antes de qualquer troca', () => {
    const doc = clone();
    const embutida = 'data:image/jpeg;base64,AAAA';

    prepararClone(doc, new Map([[FOTO, embutida]]));

    const substituto = doc.querySelector<HTMLElement>('[data-block-kind="image"] div');
    expect(substituto?.style.backgroundImage).toContain(embutida);
    expect(substituto?.style.backgroundImage).not.toContain(FOTO);
  });

  it('não mexe nas Formas ANA: elas já saem no PDF do celular', () => {
    const doc = clone();

    prepararClone(doc, new Map());

    const forma = doc.querySelector('img[data-ana-forma]');
    expect(forma).not.toBeNull();
    expect(forma?.getAttribute('src')).toBe(LOGO);
  });
});

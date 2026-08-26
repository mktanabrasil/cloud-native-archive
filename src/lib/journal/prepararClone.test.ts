import { describe, expect, it } from 'vitest';
import { prepararClone } from './prepararClone';

/**
 * Duas regras que este arquivo existe para travar, e as duas custaram um PDF.
 *
 * **1. Nenhuma `<img>` tem o `src` trocado aqui.** O html2canvas decide se
 * desenha por `intrinsicWidth > 0`, que é o `naturalWidth` da `<img>` no
 * clone. Trocar o `src` zera esse valor, e a imagem some sem erro: foi assim
 * que as Formas ANA sumiram do PDF de 26/08 — 18% de cor no canto superior
 * esquerdo antes, 0% depois, medido nos pixels dos dois PDFs.
 *
 * **2. O logo sai como `<img>`**.
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
  it('deixa o logo como <img> — nunca como background-image', async () => {
    const doc = clone();

    await prepararClone(doc, new Map());

    expect(doc.querySelector('img[data-ana-logo]')).not.toBeNull();
    expect(doc.body.innerHTML).not.toContain('background-image: url("data:image/svg+xml');
  });

  it('troca a foto por um bloco com background-image, que é o que respeita o enquadramento', async () => {
    const doc = clone();

    await prepararClone(doc, new Map());

    expect(doc.querySelector('[data-block-kind="image"] img')).toBeNull();
    const substituto = doc.querySelector<HTMLElement>('[data-block-kind="image"] div');
    expect(substituto?.style.backgroundImage).toContain(FOTO);
    expect(substituto?.style.backgroundSize).toBe('cover');
  });

  it('usa a cópia embutida da foto, que é o que impede o canvas contaminado', async () => {
    const doc = clone();
    const embutida = 'data:image/jpeg;base64,AAAA';

    await prepararClone(doc, new Map([[FOTO, embutida]]));

    const substituto = doc.querySelector<HTMLElement>('[data-block-kind="image"] div');
    expect(substituto?.style.backgroundImage).toContain(embutida);
    expect(substituto?.style.backgroundImage).not.toContain(FOTO);
  });

  it('não troca o src de nenhuma <img>: src trocado é imagem que some', async () => {
    const doc = clone();
    const antes = Array.from(doc.querySelectorAll('img')).map((img) => img.getAttribute('src'));

    await prepararClone(doc, new Map([[LOGO, 'data:image/svg+xml;base64,AAAA']]));

    const depois = Array.from(doc.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(depois).toEqual(antes.slice(0, depois.length));
  });

  it('avisa quem ficou sem medida, em vez de deixar sumir calado', async () => {
    const doc = clone();
    const semMedida = new Set<string>();

    // No jsdom nenhuma imagem tem `naturalWidth`, então todas caem na conta —
    // o que importa aqui é que a notícia chega a quem chamou.
    await prepararClone(doc, new Map(), semMedida);

    expect(semMedida.size).toBeGreaterThan(0);
  });

  it('não mexe nas Formas ANA: elas já saem no PDF do celular', async () => {
    const doc = clone();

    await prepararClone(doc, new Map());

    const forma = doc.querySelector('img[data-ana-forma]');
    expect(forma).not.toBeNull();
    expect(forma?.getAttribute('src')).toBe(LOGO);
  });
});

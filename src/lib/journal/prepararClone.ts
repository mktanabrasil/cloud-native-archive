/**
 * Deixa o clone pronto para virar imagem. Vale para a exportação e para o
 * diagnóstico — os dois precisam da folha exatamente igual.
 *
 * A regra que rege este arquivo é uma frase do html2canvas:
 *
 *     if (image && container.intrinsicWidth > 0 && container.intrinsicHeight > 0)
 *
 * `intrinsicWidth` é o `naturalWidth` da `<img>` **no clone**, lido no instante
 * em que ele monta a árvore. Zero ali significa nada desenhado, sem erro
 * nenhum — é assim que uma imagem some do PDF em silêncio.
 */

/**
 * `decode()` com rede de proteção: nem todo ambiente o implementa, e chamá-lo
 * direto lança um `TypeError` **síncrono** que nenhum `.catch()` pega.
 */
const decodificar = (img: HTMLImageElement) =>
  typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();

/** Espera com limite: uma imagem quebrada não pode travar a exportação. */
const comLimite = (promessa: Promise<unknown>) =>
  Promise.race([promessa, new Promise((resolve) => setTimeout(resolve, 3000))]);

export const prepararClone = async (
  doc: Document,
  embutidas: Map<string, string>,
  semMedida?: Set<string>,
) => {
  // html2canvas colapsa parte do espaçamento vertical do grid; reforçamos
  // o respiro acima das imagens para o PDF ficar igual ao preview.
  doc.querySelectorAll<HTMLElement>('[data-block-kind="image"]').forEach((el) => {
    el.style.paddingTop = '8px';
  });

  // html2canvas não suporta `object-fit`: ele estica a foto até o box,
  // deformando-a. Trocamos cada <img> por um bloco com background-size
  // cover/center, que reproduz exatamente o enquadramento do preview.
  //
  // A foto entra aqui pela cópia embutida em base64: como `background-image`
  // quem carrega é o próprio html2canvas, e base64 é a única forma que ele
  // marca como anônima (`isInlineBase64Image`) — sem isso o Safari do iPhone
  // contamina o canvas e derruba o PDF inteiro.
  doc.querySelectorAll<HTMLImageElement>('[data-block-kind="image"] img').forEach((img) => {
    const original = img.currentSrc || img.src;
    const src = embutidas.get(original) ?? original;
    if (!src) return;
    const rect = img.getBoundingClientRect();
    const replacement = doc.createElement('div');
    replacement.className = img.className;
    replacement.style.cssText = img.style.cssText;
    replacement.style.width = '100%';
    replacement.style.height = rect.height > 0 ? `${rect.height}px` : '100%';
    replacement.style.backgroundImage = `url("${src}")`;
    replacement.style.backgroundSize = 'cover';
    replacement.style.backgroundPosition = 'center';
    replacement.style.backgroundRepeat = 'no-repeat';
    replacement.style.borderRadius = '15px';
    img.replaceWith(replacement);
  });

  // O que sobrou de `<img>` — logo e Formas ANA — precisa estar decodificado
  // **antes** de o html2canvas medir. Ele espera as imagens do clone só uma
  // vez, e no WebKit isso acontece antes deste gancho; qualquer imagem que
  // ainda não tenha decodificado aqui vale zero e não é desenhada.
  //
  // Trocar o `src` aqui dentro é proibido pelo mesmo motivo: zera o
  // `naturalWidth` e a imagem some. Já sumiram as Formas ANA assim.
  const restantes = Array.from(doc.querySelectorAll('img'));
  await Promise.all(restantes.map((img) => comLimite(decodificar(img))));

  // Quem continuar sem medida não vai aparecer no PDF. Quem chamou decide o
  // que fazer com a notícia — o importante é ela não se perder.
  restantes.forEach((img) => {
    if (!img.naturalWidth || !img.naturalHeight) {
      semMedida?.add(img.getAttribute('alt') || img.src.slice(0, 60));
    }
  });
};

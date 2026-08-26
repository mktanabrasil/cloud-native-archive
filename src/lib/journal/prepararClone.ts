/**
 * Deixa o clone pronto para virar imagem. Vale para a exportação e para o
 * diagnóstico — os dois precisam da folha exatamente igual.
 */
export const prepararClone = (doc: Document, embutidas: Map<string, string>) => {
  // Primeiro de tudo: toda imagem passa a apontar para a cópia embutida
  // em base64. É o que impede o canvas de ser contaminado — ver o
  // porquê em `embutirImagens`. As trocas abaixo já leem o src novo.
  doc.querySelectorAll('img').forEach((img) => {
    const embutida = embutidas.get(img.currentSrc || img.src);
    if (embutida) img.src = embutida;
  });

  // html2canvas colapsa parte do espaçamento vertical do grid; reforçamos
  // o respiro acima das imagens para o PDF ficar igual ao preview.
  doc.querySelectorAll<HTMLElement>('[data-block-kind="image"]').forEach((el) => {
    el.style.paddingTop = '8px';
  });
  // O logo continua `<img>`, como as Formas ANA. Já foi `background-image`
  // aqui, e foi assim que o PDF parou de sair: o Safari do iPhone contamina
  // o canvas ao desenhar esse SVG por esse caminho, e o `toDataURL` morre
  // com "The operation is insecure" — medido pela bissecção, que apontou
  // "limpa sem logo" enquanto as formas, o mesmo SVG em `<img>`, saem bem.

  // html2canvas não suporta `object-fit`: ele estica a foto até o box,
  // deformando-a. Trocamos cada <img> por um bloco com background-size
  // cover/center, que reproduz exatamente o enquadramento do preview.
  doc.querySelectorAll<HTMLImageElement>('[data-block-kind="image"] img').forEach((img) => {
    const src = img.currentSrc || img.src;
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
};


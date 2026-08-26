/**
 * Reescreve as fontes das imagens da folha como data URI **base64**, para o
 * canvas da exportação nunca ficar contaminado.
 *
 * O `toDataURL` que fecha a exportação morre com `SecurityError: The operation
 * is insecure` se qualquer coisa desenhada no canvas não for de origem
 * confiável — e ele derruba o PDF inteiro, não só o desenho culpado. Duas
 * fontes de contaminação chegam nessa folha:
 *
 * 1. **Foto do Supabase é origem cruzada.** O Safari do iPhone tem um defeito
 *    antigo de cache: a resposta guardada sem CORS é reaproveitada no pedido
 *    com CORS, e a imagem carrega mas contamina o canvas.
 * 2. **Data URI que não seja base64 não recebe `crossOrigin`.** A checagem do
 *    html2canvas é `data:image/*;base64,`; percent-encoded não casa. O
 *    comentário no fonte dele, ao lado da linha, diz o porquê: *"ios safari
 *    10.3 taints canvas with data urls unless crossOrigin is set to anonymous"*.
 *
 * Base64 embutido resolve as duas: não é origem nenhuma, e é a forma que o
 * html2canvas marca como anônima.
 */

/** Já está na forma que o html2canvas reconhece — nada a fazer. */
const JA_BASE64 = /^data:image\/[^;,]+;base64,/i;

/** Data URI de SVG em texto (percent-encoded), a forma que contamina. */
const SVG_EM_TEXTO = /^data:image\/svg\+xml[^;,]*,/i;

const paraBase64 = (texto: string) => {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach((byte) => {
    binario += String.fromCharCode(byte);
  });
  return btoa(binario);
};

/** SVG como data URI base64 — a forma que o html2canvas marca como anônima. */
export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${paraBase64(svg)}`;

const blobParaDataUri = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error ?? new Error('falha ao ler o blob'));
    leitor.readAsDataURL(blob);
  });

interface Opcoes {
  /** Injetável para teste; por padrão o `fetch` do navegador. */
  buscar?: typeof fetch;
}

/**
 * Devolve, para cada fonte de imagem da folha, a versão embutida em base64.
 *
 * Chave e valor são strings de `src`: o `onclone` da exportação troca uma pela
 * outra. Fonte que não puder ser baixada fica de fora do mapa — a folha ainda
 * sai pela URL original, que é exatamente o comportamento de antes.
 */
export async function embutirImagens(raiz: HTMLElement, opcoes: Opcoes = {}) {
  const buscar = opcoes.buscar ?? fetch;
  const mapa = new Map<string, string>();

  const fontes = new Set<string>();
  raiz.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.src;
    if (src && !JA_BASE64.test(src)) fontes.add(src);
  });

  await Promise.all(
    Array.from(fontes).map(async (fonte) => {
      try {
        if (SVG_EM_TEXTO.test(fonte)) {
          const texto = decodeURIComponent(fonte.slice(fonte.indexOf(',') + 1));
          mapa.set(fonte, svgDataUri(texto));
          return;
        }
        // `cache: 'reload'` é o ponto: sem ele o Safari devolve a resposta que
        // guardou sem CORS, que é justamente a que contamina.
        const resposta = await buscar(fonte, { mode: 'cors', cache: 'reload' });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        mapa.set(fonte, await blobParaDataUri(await resposta.blob()));
      } catch (erro) {
        console.warn('[jornal] não consegui embutir a imagem', fonte, erro);
      }
    }),
  );

  return mapa;
}

/**
 * Descobre qual imagem contaminou o canvas.
 *
 * Só roda depois que a folha já falhou: desenha cada fonte sozinha num canvas
 * de 1px e vê qual delas derruba o `toDataURL`. Sem isso, "The operation is
 * insecure" não diz de quem é a culpa — e foi essa falta de nome que fez o
 * caso do logo custar cinco rodadas.
 */
export async function acharContaminante(raiz: HTMLElement, mapa: Map<string, string>) {
  const fontes = new Set<string>();
  raiz.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.src;
    if (src) fontes.add(mapa.get(src) ?? src);
  });

  for (const fonte of fontes) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const contexto = canvas.getContext('2d');
    if (!contexto) return null;

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const elemento = new Image();
        // Mesma regra do html2canvas, para o teste valer alguma coisa.
        if (JA_BASE64.test(fonte) || /^https?:/i.test(fonte)) elemento.crossOrigin = 'anonymous';
        elemento.onload = () => resolve(elemento);
        elemento.onerror = () => reject(new Error('não carregou'));
        elemento.src = fonte;
      });
      contexto.drawImage(img, 0, 0, 1, 1);
      canvas.toDataURL();
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'SecurityError') {
        return fonte.slice(0, 120);
      }
    }
  }

  return null;
}

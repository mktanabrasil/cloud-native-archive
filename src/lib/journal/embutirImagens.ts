/**
 * Baixa as fotos da folha e devolve cada uma como data URI **base64**.
 *
 * A foto vira `background-image` na exportação, e aí quem a carrega é o
 * próprio html2canvas. Ele só marca a imagem como anônima quando a fonte casa
 * com `data:image/*;base64,` (`isInlineBase64Image`) ou quando é remota com
 * `useCORS` — e o comentário no fonte dele explica o preço de não marcar:
 * *"ios safari 10.3 taints canvas with data urls unless crossOrigin is set to
 * anonymous"*. Canvas contaminado derruba o PDF inteiro no `toDataURL`.
 *
 * Só fotos remotas passam por aqui. O logo e as Formas ANA continuam `<img>`
 * com o `src` original: **trocar o `src` de uma `<img>` no clone zera o
 * `naturalWidth`, e o html2canvas não desenha o que não consegue medir** —
 * foi assim que as formas sumiram do PDF de 26/08.
 */

const REMOTA = /^https?:/i;

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
 * Devolve, para cada foto remota da folha, a versão embutida em base64.
 *
 * Foto que não puder ser baixada fica de fora do mapa — a folha ainda sai pela
 * URL original, que é exatamente o comportamento de antes.
 */
export async function embutirImagens(raiz: HTMLElement, opcoes: Opcoes = {}) {
  const buscar = opcoes.buscar ?? fetch;
  const mapa = new Map<string, string>();

  const fontes = new Set<string>();
  raiz.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.src;
    if (REMOTA.test(src)) fontes.add(src);
  });

  await Promise.all(
    Array.from(fontes).map(async (fonte) => {
      try {
        // `cache: 'reload'` é o ponto: sem ele o Safari devolve a resposta que
        // guardou sem CORS, que é justamente a que contamina.
        const resposta = await buscar(fonte, { mode: 'cors', cache: 'reload' });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        mapa.set(fonte, await blobParaDataUri(await resposta.blob()));
      } catch (erro) {
        console.warn('[jornal] não consegui embutir a foto', fonte, erro);
      }
    }),
  );

  return mapa;
}

/** Erro de canvas contaminado — não adianta repetir em escala menor. */
export class ErroDeContaminacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeContaminacao';
  }
}

/**
 * Camadas removidas uma a uma para achar a que contamina o canvas.
 *
 * A ordem vai da suspeita mais provável para a mais ampla: se a folha sair
 * limpa sem as fotos, não faz diferença saber o que aconteceria sem o logo.
 */
const CAMADAS = [
  { nome: 'fotos', seletor: '[data-block-kind="image"] img' },
  { nome: 'logo', seletor: 'img[data-ana-logo]' },
  { nome: 'formas', seletor: '[data-ana-forma]' },
  { nome: 'imagem alguma', seletor: 'img' },
] as const;

/** Rasteriza a folha aplicando um recorte extra ao clone. */
export type Rasterizar = (recorte: (doc: Document) => void) => Promise<HTMLCanvasElement>;

const saiLimpa = async (rasterizar: Rasterizar, seletor: string) => {
  try {
    const canvas = await rasterizar((doc) => {
      doc.querySelectorAll(seletor).forEach((elemento) => elemento.remove());
    });
    try {
      canvas.toDataURL();
      return true;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } catch {
    return false;
  }
};

/**
 * Descobre **qual camada** contamina o canvas, perguntando ao aparelho.
 *
 * Desenhar cada imagem sozinha num canvas de teste não reproduziu a
 * contaminação: o que o Safari recusa aparece só no caminho real do
 * html2canvas. Então a pergunta muda de "esta imagem contamina?" para "a folha
 * sai limpa sem esta camada?" — mesma rasterização da exportação, só que
 * miúda e com uma camada a menos por vez.
 *
 * Roda apenas depois da falha, e é a diferença entre um erro com dono e mais
 * uma rodada de palpite.
 */
export async function diagnosticarContaminacao(rasterizar: Rasterizar) {
  for (const camada of CAMADAS) {
    if (await saiLimpa(rasterizar, camada.seletor)) return `limpa sem ${camada.nome}`;
  }
  return 'suja mesmo sem imagem alguma';
}

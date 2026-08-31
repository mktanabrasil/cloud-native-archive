/**
 * Onde estão as fotos dentro do PDF, medidas no navegador.
 *
 * Isto não passa por IA e não custa nada: a geometria das imagens está escrita
 * no próprio arquivo. Perguntá-la a um modelo seria pagar por um palpite sobre
 * algo que já é certo — e, pior, um palpite que erra a orientação. Medido no
 * jornal do GOE: as cinco fotos da página 2 estão **em pé** (proporção 0,75),
 * e o modelo as devolvia como quadros deitados, o que recortaria 44% de cada
 * uma, topo e base, que é onde ficam os rostos.
 *
 * O PDF não guarda "esta foto está no canto": guarda uma matriz de
 * transformação corrente aplicada a um quadrado unitário. Para saber a posição
 * real é preciso simular a pilha de estado gráfico e ler a matriz no instante
 * em que a imagem é pintada.
 */

/** Uma foto encontrada no arquivo de origem, já medida. */
export interface FotoMedida {
  /** Página do documento de origem, começando em 1. */
  pagina: number;
  /** Fileira dentro daquela página: fotos lado a lado compartilham o número. */
  fileira: number;
  /** Largura dividida pela altura. Maior que 1 é deitada; menor, em pé. */
  proporcao: number;
}

/** Proporções que o bloco de imagem do Jornal aceita. */
const PROPORCOES = [
  { nome: '16/9' as const, valor: 16 / 9 },
  { nome: '4/3' as const, valor: 4 / 3 },
  { nome: '1/1' as const, valor: 1 },
  { nome: '3/4' as const, valor: 3 / 4 },
];

export type ProporcaoJornal = (typeof PROPORCOES)[number]['nome'];

/** A proporção autorizada mais próxima da foto original. */
export function proporcaoMaisProxima(razao: number): ProporcaoJornal {
  if (!Number.isFinite(razao) || razao <= 0) return '16/9';
  return PROPORCOES.reduce((melhor, atual) =>
    Math.abs(atual.valor - razao) < Math.abs(melhor.valor - razao) ? atual : melhor,
  ).nome;
}

/** Multiplicação de matrizes no formato do PDF: [a, b, c, d, e, f]. */
const multiplicar = (m1: number[], m2: number[]): number[] => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

interface Bruta {
  pagina: number;
  topo: number;
  x: number;
  largura: number;
  altura: number;
}

/**
 * Descarta a moldura do documento.
 *
 * Modelos de portfólio — os do Canva, sobretudo — desenham ornamentos de canto
 * como imagens. Medido no "Portfólio CEI Pierre": **70 imagens brutas em 5
 * páginas, das quais 10 desenhos eram moldura repetida**. Sem este filtro
 * sobravam 14 imagens por página, as fotos de verdade se perdiam no meio, e o
 * pareamento com os blocos saía todo deslocado.
 *
 * A regra é a mesma que vale para cabeçalho e rodapé de texto: o que se repete
 * na mesma posição em várias páginas é moldura, não conteúdo.
 */
function semMolduras(todas: Bruta[], paginas: number): Bruta[] {
  if (paginas < 2) return todas;

  // Arredondar a 4px absorve as diferenças de subpixel entre uma página e
  // outra sem juntar desenhos que são de fato distintos.
  const assinatura = (im: Bruta) =>
    [
      Math.round(im.x / 4),
      Math.round(im.topo / 4),
      Math.round(im.largura / 4),
      Math.round(im.altura / 4),
    ].join(':');

  const ondeAparece = new Map<string, Set<number>>();
  todas.forEach((im) => {
    const chave = assinatura(im);
    const paginasDaChave = ondeAparece.get(chave) ?? new Set<number>();
    paginasDaChave.add(im.pagina);
    ondeAparece.set(chave, paginasDaChave);
  });

  const minimo = Math.max(2, Math.ceil(paginas * 0.5));
  const molduras = new Set(
    [...ondeAparece.entries()].filter(([, onde]) => onde.size >= minimo).map(([chave]) => chave),
  );

  return todas.filter((im) => !molduras.has(assinatura(im)));
}

/** Fotos que dividem a mesma faixa horizontal estão lado a lado. */
function agruparEmFileiras(fotos: Bruta[]): FotoMedida[] {
  const porPagina = new Map<number, Bruta[]>();
  fotos.forEach((foto) => {
    const lista = porPagina.get(foto.pagina) ?? [];
    lista.push(foto);
    porPagina.set(foto.pagina, lista);
  });

  const medidas: FotoMedida[] = [];

  [...porPagina.keys()]
    .sort((a, b) => a - b)
    .forEach((pagina) => {
      const daPagina = (porPagina.get(pagina) ?? []).sort(
        (a, b) => a.topo - b.topo || a.x - b.x,
      );

      const fileiras: { topo: number; itens: Bruta[] }[] = [];
      daPagina.forEach((foto) => {
        // Metade da altura de tolerância: fotos de uma fileira raramente
        // alinham no pixel, mas nunca ficam a meia altura de distância.
        const fileira = fileiras.find((f) => Math.abs(f.topo - foto.topo) < foto.altura * 0.5);
        if (fileira) fileira.itens.push(foto);
        else fileiras.push({ topo: foto.topo, itens: [foto] });
      });

      fileiras.forEach((fileira, indice) => {
        fileira.itens
          .sort((a, b) => a.x - b.x)
          .forEach((foto) => {
            medidas.push({
              pagina,
              fileira: indice,
              proporcao: foto.altura > 0 ? foto.largura / foto.altura : 1,
            });
          });
      });
    });

  return medidas;
}

/**
 * Mede as fotos de um PDF.
 *
 * A biblioteca entra por `import()` de propósito: ela pesa alguns megabytes, e
 * carregá-la no pacote principal faria toda pessoa que abre o app pagar o
 * download — inclusive quem nunca vai importar nada.
 *
 * **O `arquivo` sai daqui vazio.** O `pdfjs` transfere o buffer para o worker,
 * e depois desta chamada o `byteLength` dele é zero — medido no navegador com
 * um PDF de 19 MB. Quem precisar dos mesmos bytes depois tem de guardar uma
 * cópia antes, ou ler o `File` de novo.
 *
 * Nunca lança. Se a leitura falhar, devolve lista vazia e a importação segue
 * sem a geometria: melhor um arranjo padrão do que uma importação perdida.
 */
export async function medirFotosDoPdf(arquivo: ArrayBuffer): Promise<FotoMedida[]> {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();

    const doc = await pdfjs.getDocument({ data: new Uint8Array(arquivo) }).promise;
    const brutas: Bruta[] = [];

    // Os nomes vieram de `Object.keys(OPS)` desta versão, não de memória: o
    // `paintJpegXObject` que eu esperava encontrar simplesmente não existe
    // aqui, e em JavaScript um operador inexistente vira `undefined` sem
    // reclamar — o filtro passaria a não casar com nada, em silêncio.
    const PINTA = new Set([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
    ]);

    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: 1 });
      const ops = await pagina.getOperatorList();

      let ctm = [1, 0, 0, 1, 0, 0];
      const pilha: number[][] = [];

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === pdfjs.OPS.save) pilha.push(ctm.slice());
        else if (fn === pdfjs.OPS.restore) ctm = pilha.pop() ?? [1, 0, 0, 1, 0, 0];
        else if (fn === pdfjs.OPS.transform) ctm = multiplicar(ctm, ops.argsArray[i] as number[]);
        else if (PINTA.has(fn)) {
          const largura = Math.abs(ctm[0]);
          const altura = Math.abs(ctm[3]);
          // Marca d'água e filete decorativo entram como imagem; nada abaixo de
          // 5% da página é foto de atividade.
          if (largura < vista.width * 0.05 || altura < vista.height * 0.03) continue;
          brutas.push({
            pagina: n,
            x: ctm[4],
            topo: vista.height - (ctm[5] + altura),
            largura,
            altura,
          });
        }
      }
    }

    return agruparEmFileiras(semMolduras(brutas, doc.numPages));
  } catch {
    return [];
  }
}

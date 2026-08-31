import type { BlockSpan, JournalBlock, JournalPage } from './types';
import { proporcaoMaisProxima, type FotoMedida, type ProporcaoJornal } from './pdfImagens';

/**
 * Põe as fotos importadas em fileiras, na proporção que elas têm de verdade.
 *
 * Duas coisas motivaram este arquivo, e as duas foram medidas num jornal real:
 *
 * 1. A leitura devolve as fotos uma embaixo da outra, cada uma ocupando a
 *    largura toda. Cinco fotos assim somam 1.152px além da mancha de uma folha
 *    A4 — três delas somem do PDF sem aviso.
 * 2. A proporção vinha de palpite, e o palpite era "deitada". As fotos do
 *    documento estavam **em pé**. Como o bloco de imagem preenche e recorta,
 *    isso comeria 44% de cada foto, topo e base — onde ficam os rostos.
 *
 * A correção usa a geometria lida do próprio PDF (`medirFotosDoPdf`): a fileira
 * vem de como a pessoa já agrupou as fotos no documento dela, e a proporção
 * vem da foto. Sem geometria, cai numa regra por contagem, que ao menos evita
 * o empilhamento.
 *
 * É passo determinístico e vale para qualquer provedor de leitura. Pedir isto
 * na instrução do modelo seria possível, mas instrução é sugestão: o resultado
 * varia de um modelo para outro, e este arranjo não pode variar.
 */

/** Largura de cada foto, dado quantas dividem a fileira. */
export function larguraParaFileira(quantidade: number): BlockSpan {
  if (quantidade <= 1) return 6;
  if (quantidade === 2) return 3;
  return 2;
}

/** Nenhuma fileira passa de três: a quarta foto já sai estreita demais. */
const MAX_POR_FILEIRA = 3;

const ehImagem = (bloco: JournalBlock) => bloco.kind === 'image';

/** Quebra uma fileira grande em fileiras de no máximo três. */
function partir<T>(itens: T[], tamanho: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) partes.push(itens.slice(i, i + tamanho));
  return partes;
}

/** A proporção que mais se repete no grupo — uma medida torta não desalinha a fileira. */
function proporcaoDoGrupo(medidas: (FotoMedida | undefined)[]): ProporcaoJornal | null {
  const nomes = medidas
    .filter((m): m is FotoMedida => !!m)
    .map((m) => proporcaoMaisProxima(m.proporcao));
  if (!nomes.length) return null;

  const contagem = new Map<ProporcaoJornal, number>();
  nomes.forEach((n) => contagem.set(n, (contagem.get(n) ?? 0) + 1));
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Arruma as fotos de todas as páginas.
 *
 * `fotos` são as medidas do arquivo de origem, em ordem de documento. Elas são
 * casadas com os blocos de imagem pela ordem — o primeiro bloco recebe a
 * primeira foto. **Se as contagens não baterem, a geometria inteira é
 * descartada**: uma lista deslocada erraria com confiança, e errar em silêncio
 * é pior do que não saber.
 *
 * Não altera nada além dos blocos de imagem: texto e indicadores passam
 * intactos, na mesma ordem.
 */
export function arranjarImagens(paginas: JournalPage[], fotos: FotoMedida[]): JournalPage[] {
  /**
   * As fotos são casadas com os blocos pela ordem. Se as contagens não baterem,
   * essa ordem está deslocada: o terceiro bloco receberia a geometria da quarta
   * foto, e assim por diante — uma foto em pé ganharia quadro deitado com toda
   * a confiança do mundo. Nesse caso é melhor não usar geometria nenhuma e
   * cair na regra por contagem, que ao menos evita o empilhamento.
   */
  const totalBlocos = paginas.reduce(
    (soma, pagina) => soma + pagina.blocks.filter(ehImagem).length,
    0,
  );
  const medidasDoArquivo = fotos.length === totalBlocos ? fotos : [];

  let proxima = 0;

  return paginas.map((pagina) => {
    const blocos: JournalBlock[] = [];
    let i = 0;

    while (i < pagina.blocks.length) {
      const bloco = pagina.blocks[i];

      if (!ehImagem(bloco)) {
        blocos.push(bloco);
        i += 1;
        continue;
      }

      // Sequência de imagens sem texto entre elas: é isto que vira fileira.
      const sequencia: JournalBlock[] = [];
      const medidas: (FotoMedida | undefined)[] = [];
      while (i < pagina.blocks.length && ehImagem(pagina.blocks[i])) {
        sequencia.push(pagina.blocks[i]);
        medidas.push(medidasDoArquivo[proxima]);
        proxima += 1;
        i += 1;
      }

      // Com geometria, a fileira vem de como a pessoa agrupou no documento
      // dela. Sem geometria, cai na contagem.
      const grupos: number[][] = [];
      if (medidas.some(Boolean)) {
        let atual: number[] = [];
        let chave: string | null = null;
        sequencia.forEach((_, indice) => {
          const medida = medidas[indice];
          const nova = medida ? `${medida.pagina}:${medida.fileira}` : `solta:${indice}`;
          if (chave !== null && nova !== chave) {
            grupos.push(atual);
            atual = [];
          }
          chave = nova;
          atual.push(indice);
        });
        if (atual.length) grupos.push(atual);
      } else {
        grupos.push(sequencia.map((_, indice) => indice));
      }

      grupos
        .flatMap((grupo) => partir(grupo, MAX_POR_FILEIRA))
        .forEach((fileira) => {
          const span = larguraParaFileira(fileira.length);
          const proporcao = proporcaoDoGrupo(fileira.map((indice) => medidas[indice]));
          fileira.forEach((indice) => {
            const original = sequencia[indice];
            if (original.kind !== 'image') return;
            blocos.push({
              ...original,
              span,
              ...(proporcao ? { ratio: proporcao } : {}),
            });
          });
        });
    }

    // Página que virou só fotos é galeria, e o modelo dela deve dizer isso.
    const soImagens = blocos.length > 0 && blocos.every(ehImagem);
    const template = soImagens && blocos.length >= 3 ? 'galeria' : pagina.template;

    return { ...pagina, template, blocks: blocos };
  });
}

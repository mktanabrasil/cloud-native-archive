import { describe, expect, it } from 'vitest';
import { arranjarImagens, larguraParaFileira } from './arranjarImagens';
import { proporcaoMaisProxima, type FotoMedida } from './pdfImagens';
import type { JournalBlock, JournalPage } from './types';

/**
 * O arranjo das fotos importadas.
 *
 * Os números aqui não são hipóteses: saíram do jornal "DA HORTA À MESA" do GOE,
 * medido em 31/08/2026. Página 1 com uma foto deitada; página 2 com cinco fotos
 * **em pé**, arrumadas pela própria diretora em duas fileiras, 2 e depois 3.
 */

const imagem = (id: string): JournalBlock => ({
  id,
  kind: 'image',
  url: '',
  caption: '',
  span: 6,
  ratio: '16/9',
  fit: 'cover',
});

const texto = (id: string): JournalBlock => ({
  id,
  kind: 'text',
  style: 'corpo',
  content: 'texto',
  align: 'left',
  span: 6,
});

const pagina = (blocks: JournalBlock[]): JournalPage => ({ id: 'p', template: 'materia', blocks });

/** As seis fotos reais do arquivo: 1 deitada na página 1; 5 em pé na página 2. */
const FOTOS_REAIS: FotoMedida[] = [
  { pagina: 1, fileira: 0, proporcao: 404 / 219 },
  { pagina: 2, fileira: 0, proporcao: 184 / 218 },
  { pagina: 2, fileira: 0, proporcao: 165 / 220 },
  { pagina: 2, fileira: 1, proporcao: 164 / 219 },
  { pagina: 2, fileira: 1, proporcao: 165 / 219 },
  { pagina: 2, fileira: 1, proporcao: 164 / 218 },
];

describe('largura pela quantidade na fileira', () => {
  it('uma foto ocupa a folha; duas, metade; três, um terço', () => {
    expect(larguraParaFileira(1)).toBe(6);
    expect(larguraParaFileira(2)).toBe(3);
    expect(larguraParaFileira(3)).toBe(2);
  });
});

describe('proporção mais próxima', () => {
  it('reconhece as fotos em pé do documento como 3/4', () => {
    expect(proporcaoMaisProxima(165 / 220)).toBe('3/4');
    expect(proporcaoMaisProxima(164 / 219)).toBe('3/4');
  });

  it('reconhece a foto deitada da capa como 16/9', () => {
    expect(proporcaoMaisProxima(404 / 219)).toBe('16/9');
  });

  it('cai no padrão quando a medida não faz sentido', () => {
    expect(proporcaoMaisProxima(0)).toBe('16/9');
    expect(proporcaoMaisProxima(Number.NaN)).toBe('16/9');
  });
});

describe('arranjar com a geometria do arquivo', () => {
  /** O caso que motivou tudo: cinco fotos empilhadas passavam da folha. */
  it('reproduz as fileiras que a diretora montou: 2 e depois 3', () => {
    const entrada = [pagina([texto('t'), ...['a', 'b', 'c', 'd', 'e'].map(imagem)])];
    const [saida] = arranjarImagens(entrada, FOTOS_REAIS.slice(1));

    const spans = saida.blocks.filter((b) => b.kind === 'image').map((b) => b.span);
    expect(spans).toEqual([3, 3, 2, 2, 2]);
  });

  it('mantém as fotos em pé, em vez de recortá-las num quadro deitado', () => {
    const entrada = [pagina([...['a', 'b', 'c', 'd', 'e'].map(imagem)])];
    const [saida] = arranjarImagens(entrada, FOTOS_REAIS.slice(1));

    saida.blocks.forEach((bloco) => {
      if (bloco.kind === 'image') expect(bloco.ratio).toBe('3/4');
    });
  });

  it('a foto sozinha da capa fica com a largura toda e deitada', () => {
    const entrada = [pagina([texto('t'), imagem('capa')])];
    const [saida] = arranjarImagens(entrada, [FOTOS_REAIS[0]]);
    const foto = saida.blocks[1];

    expect(foto).toMatchObject({ kind: 'image', span: 6, ratio: '16/9' });
  });

  /** Uma medida torta não pode desalinhar a fileira inteira. */
  it('usa a proporção que se repete no grupo, não a de cada foto', () => {
    const tortas: FotoMedida[] = [
      { pagina: 1, fileira: 0, proporcao: 0.75 },
      { pagina: 1, fileira: 0, proporcao: 0.75 },
      { pagina: 1, fileira: 0, proporcao: 1.9 },
    ];
    const [saida] = arranjarImagens([pagina(['a', 'b', 'c'].map(imagem))], tortas);

    saida.blocks.forEach((b) => {
      if (b.kind === 'image') expect(b.ratio).toBe('3/4');
    });
  });
});

describe('arranjar sem geometria', () => {
  it('sem medidas, agrupa pela contagem em vez de empilhar', () => {
    const [saida] = arranjarImagens([pagina(['a', 'b', 'c'].map(imagem))], []);
    expect(saida.blocks.map((b) => b.span)).toEqual([2, 2, 2]);
  });

  it('nunca passa de três por fileira', () => {
    const cinco = ['a', 'b', 'c', 'd', 'e'].map(imagem);
    const [saida] = arranjarImagens([pagina(cinco)], []);
    // três na primeira fileira, duas na segunda
    expect(saida.blocks.map((b) => b.span)).toEqual([2, 2, 2, 3, 3]);
  });

  it('sem geometria, não inventa proporção: mantém a que veio', () => {
    const [saida] = arranjarImagens([pagina([imagem('a'), imagem('b')])], []);
    saida.blocks.forEach((b) => {
      if (b.kind === 'image') expect(b.ratio).toBe('16/9');
    });
  });
});

describe('o que o arranjo não pode estragar', () => {
  it('texto e ordem passam intactos', () => {
    const entrada = [pagina([texto('t1'), imagem('i1'), texto('t2'), imagem('i2')])];
    const [saida] = arranjarImagens(entrada, FOTOS_REAIS);

    expect(saida.blocks.map((b) => b.id)).toEqual(['t1', 'i1', 't2', 'i2']);
    expect(saida.blocks.filter((b) => b.kind === 'text')).toHaveLength(2);
  });

  /** Fotos separadas por texto não são fileira: cada uma fica sozinha. */
  it('imagens separadas por texto não se agrupam', () => {
    const entrada = [pagina([imagem('i1'), texto('t'), imagem('i2')])];
    const [saida] = arranjarImagens(entrada, FOTOS_REAIS.slice(1, 3));

    expect(saida.blocks[0].span).toBe(6);
    expect(saida.blocks[2].span).toBe(6);
  });

  it('a foto recortada e enviada entra no bloco', () => {
    const comUrl = FOTOS_REAIS.slice(1, 3).map((f, i) => ({
      ...f,
      url: `https://exemplo.org/foto-${i}.jpg`,
    }));
    const [saida] = arranjarImagens([pagina(['a', 'b'].map(imagem))], comUrl);

    expect(saida.blocks.map((b) => (b.kind === 'image' ? b.url : null))).toEqual([
      'https://exemplo.org/foto-0.jpg',
      'https://exemplo.org/foto-1.jpg',
    ]);
  });

  /** Envio que falhou deixa o encaixe reservado, como antes — não quebra nada. */
  it('foto sem envio deixa o bloco vazio, e as vizinhas seguem com a sua', () => {
    const misto = [
      { ...FOTOS_REAIS[1], url: 'https://exemplo.org/ok.jpg' },
      FOTOS_REAIS[2],
    ];
    const [saida] = arranjarImagens([pagina(['a', 'b'].map(imagem))], misto);

    expect(saida.blocks.map((b) => (b.kind === 'image' ? b.url : null))).toEqual([
      'https://exemplo.org/ok.jpg',
      '',
    ]);
  });

  it('a legenda da foto sobrevive ao arranjo', () => {
    const base = imagem('i');
    const comLegenda: JournalBlock =
      base.kind === 'image' ? { ...base, caption: 'Equipe de voluntários' } : base;
    const [saida] = arranjarImagens([pagina([comLegenda])], [FOTOS_REAIS[0]]);
    const foto = saida.blocks[0];

    expect(foto.kind).toBe('image');
    if (foto.kind === 'image') expect(foto.caption).toBe('Equipe de voluntários');
  });

  it('página sem imagem nenhuma passa sem alteração', () => {
    const entrada = [pagina([texto('a'), texto('b')])];
    const [saida] = arranjarImagens(entrada, FOTOS_REAIS);

    expect(saida.blocks).toEqual(entrada[0].blocks);
    expect(saida.template).toBe('materia');
  });

  it('página que virou só fotos passa a ser galeria', () => {
    const entrada = [pagina(['a', 'b', 'c', 'd'].map(imagem))];
    const [saida] = arranjarImagens(entrada, FOTOS_REAIS.slice(1));

    expect(saida.template).toBe('galeria');
  });

  it('as fotos são casadas na ordem, atravessando as páginas', () => {
    const entrada = [pagina([imagem('capa')]), pagina(['a', 'b'].map(imagem))];
    // Três blocos, três medidas: a da capa é deitada, as duas seguintes em pé.
    const saida = arranjarImagens(entrada, FOTOS_REAIS.slice(0, 3));

    expect(saida[0].blocks[0]).toMatchObject({ ratio: '16/9', span: 6 });
    expect(saida[1].blocks.map((b) => b.span)).toEqual([3, 3]);
    saida[1].blocks.forEach((b) => {
      if (b.kind === 'image') expect(b.ratio).toBe('3/4');
    });
  });
});

describe('quando as contagens não batem', () => {
  /**
   * O caso do "Portfólio CEI Pierre": o documento tinha 70 imagens brutas, das
   * quais 10 eram moldura repetida. Antes do filtro, a lista de medidas ficava
   * muito maior que a de blocos — e o pareamento por ordem daria a cada bloco a
   * geometria de outra foto, com toda a confiança do mundo.
   */
  it('descarta a geometria inteira em vez de aplicá-la deslocada', () => {
    const entrada = [pagina(['a', 'b', 'c'].map(imagem))];
    // Três blocos, uma medida só: deslocado. A foto medida é deitada (16/9);
    // se a geometria fosse usada, a primeira sairia 16/9 e as outras não.
    const saida = arranjarImagens(entrada, [FOTOS_REAIS[0]]);

    expect(saida[0].blocks).toHaveLength(3);
    // Caiu na regra por contagem: três numa fileira, sem tocar na proporção.
    expect(saida[0].blocks.map((b) => b.span)).toEqual([2, 2, 2]);
  });

  it('ainda assim evita o empilhamento, que era o problema maior', () => {
    const cinco = ['a', 'b', 'c', 'd', 'e'].map(imagem);
    const saida = arranjarImagens([pagina(cinco)], [FOTOS_REAIS[0], FOTOS_REAIS[1]]);

    expect(saida[0].blocks.every((b) => b.span !== 6)).toBe(true);
  });
});

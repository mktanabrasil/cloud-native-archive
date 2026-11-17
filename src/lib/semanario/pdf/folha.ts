import { CAMPOS_DO_DIA, type ChaveDoDia, type ConteudoDoSemanario } from '../regras';

/**
 * A página 2 do Semanário (17/11/2026), no modelo da Orientação Pedagógica:
 * as medidas saíram do próprio PDF do modelo (pdf.js, em pontos; a página de
 * lá começa 8,6 pt acima, já somado). Aqui é só a conta: onde cada texto cai.
 * Desenhar é com `gerar.ts`.
 *
 * Cada quadro escreve o rótulo do modelo e, logo depois, o que a professora
 * escreveu. A letra começa no tamanho do modelo e diminui igual na folha
 * inteira até caber; os quadros crescem ou encolhem dentro da coluna, sempre
 * perto da proporção do modelo. Se nem com a letra mínima couber, a conta diz
 * quais quadros passaram (e o envio espera a professora encurtar).
 */

export const LARGURA = 842.25;
export const ALTURA = 595.5;

export const COR = {
  rotulo: '#484848',
  texto: '#000000',
  faixa: '#f1f1f1',
  quadro: '#f1f1f1',
  separador: '#ffffff',
  amarelo: '#fbce00',
  verde: '#81e2cf',
  coral: '#f37964',
  branco: '#ffffff',
  miniatura: '#eeeeee',
} as const;

/** A letra do modelo e a menor que ainda se lê bem impressa. */
export const LETRA_DO_MODELO = 13.11;
export const LETRA_MINIMA = 7;
const PASSO = 0.25;

const ENTRELINHA = 1.357; // 17,8 pt na letra do modelo
const ACIMA = 4; // do topo do quadro à primeira letra
const ABAIXO = 4;
const SEPARADOR = 1.75;
const MARGEM = 8.3; // da borda da coluna ao texto
const RECUO = 2.2; // os campos do dia ficam um pouco para dentro do título

export const COLUNAS = {
  esquerda: { x: 0, largura: 417.5 },
  direita: { x: 424.7, largura: 417.5 },
};
export const TOPO_DAS_COLUNAS = 110.9;

/** As três linhas fixas do alto da coluna da esquerda. */
export const LINHAS_FIXAS = [
  { chave: 'agrupamento', rotulo: 'AGRUPAMENTO:', topo: 110.9, base: 144 },
  { chave: 'professora', rotulo: 'PROFESSORA:', topo: 145.75, base: 178.75 },
  { chave: 'periodo', rotulo: 'PERÍODO:', topo: 180.5, base: 213.75 },
] as const;

type ChaveDoQuadro = ChaveDoDia | 'formas_registro' | 'materiais' | 'avaliacao';

/** Os quadros de cada coluna, com a altura do modelo. */
const QUADROS: Record<'esquerda' | 'direita', { topo: number; quadros: { chave: ChaveDoQuadro; altura: number }[] }> = {
  esquerda: { topo: 215.5, quadros: [{ chave: 'seg', altura: 125.5 }, { chave: 'ter', altura: 125.5 }, { chave: 'qua', altura: 125.5 }] },
  direita: {
    topo: TOPO_DAS_COLUNAS,
    quadros: [
      { chave: 'qui', altura: 97.6 }, { chave: 'sex', altura: 115.5 },
      { chave: 'formas_registro', altura: 25.5 }, { chave: 'materiais', altura: 25.5 }, { chave: 'avaliacao', altura: 213.5 },
    ],
  },
};

const ROTULO_DO_QUADRO: Record<ChaveDoQuadro, string> = {
  seg: '2ª FEIRA', ter: '3ª FEIRA', qua: '4ª FEIRA', qui: '5ª FEIRA', sex: '6ª FEIRA',
  formas_registro: 'FORMAS DE REGISTRO:', materiais: 'MATERIAIS UTILIZADOS PARA A PROPOSTA DA SEMANA:', avaliacao: 'AVALIAÇÃO DAS PROPOSTAS:',
};

/**
 * O que a Poppins não desenha (emoji, setas, sinais de visto) sairia como um
 * quadrado vazio: as setas e os vistos viram texto, o resto sai do PDF.
 */
export function limparParaPdf(texto: string): string {
  return texto
    .replace(/[→⇒➔➜➡]/g, '->').replace(/[←⇐]/g, '<-')
    .replace(/[✓✔☑✅]/g, '(ok)').replace(/[✗✘❌]/g, '(x)')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}]|︎|️|‍|⃣/gu, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Mede a largura de um texto (em pt) na Poppins. */
export type Medir = (texto: string, negrito: boolean, tamanho: number) => number;

export interface Trecho { x: number; texto: string; negrito: boolean; cor: string }
export interface Linha { y: number; trechos: Trecho[] }
export interface Quadro { chave: string; rotulo: string; x: number; y: number; largura: number; altura: number; linhas: Linha[] }

export interface Folha {
  /** O tamanho da letra dos quadros (igual na folha inteira). */
  tamanho: number;
  linhasFixas: { chave: string; tamanho: number; linhas: Linha[] }[];
  quadros: Quadro[];
  /** Os rótulos dos quadros que não couberam nem com a letra mínima ("3ª FEIRA"). */
  cheios: string[];
}

export interface DadosDaFolha extends ConteudoDoSemanario {
  professora: string;
  /** "23/11 a 27/11". */
  periodo: string;
}

/* ---------- quebra de linhas com rótulo + texto ---------- */

interface Pedaco { texto: string; negrito: boolean; cor: string }

/**
 * Quebra um parágrafo (o rótulo e o texto da professora) na largura dada. As
 * quebras de linha que ela digitou continuam; palavra maior que a linha é
 * cortada onde precisar.
 */
export function quebrar(pedacos: Pedaco[], largura: number, tamanho: number, medir: Medir): Pedaco[][] {
  const linhas: Pedaco[][] = [[]];
  let usado = 0;
  const novaLinha = () => { linhas.push([]); usado = 0; };
  const pôr = (texto: string, p: Pedaco) => {
    const atual = linhas[linhas.length - 1];
    const ultimo = atual[atual.length - 1];
    if (ultimo && ultimo.negrito === p.negrito && ultimo.cor === p.cor) ultimo.texto += texto;
    else atual.push({ ...p, texto });
    usado += medir(texto, p.negrito, tamanho);
  };
  for (const p of pedacos) {
    const paragrafos = p.texto.replace(/\r\n?/g, '\n').split('\n');
    paragrafos.forEach((par, i) => {
      if (i > 0) novaLinha();
      for (const palavra of par.split(/[ \t]+/).filter(Boolean)) {
        const comEspaco = usado > 0 ? ' ' + palavra : palavra;
        const w = medir(comEspaco, p.negrito, tamanho);
        if (usado + w <= largura) { pôr(comEspaco, p); continue; }
        if (usado > 0) novaLinha();
        // A palavra sozinha não cabe: corta em pedaços.
        let resto = palavra;
        while (medir(resto, p.negrito, tamanho) > largura) {
          let n = resto.length - 1;
          while (n > 1 && medir(resto.slice(0, n), p.negrito, tamanho) > largura) n--;
          pôr(resto.slice(0, n), p); novaLinha(); resto = resto.slice(n);
        }
        pôr(resto, p);
      }
    });
  }
  // As linhas em branco digitadas ficam; só as do fim saem.
  while (linhas.length > 1 && linhas[linhas.length - 1].length === 0) linhas.pop();
  return linhas;
}

const passoDaLinha = (f: number) => f * ENTRELINHA;
const primeiraBase = (f: number) => ACIMA + f * 0.95;
const alturaPara = (linhas: number, f: number) => primeiraBase(f) + Math.max(0, linhas - 1) * passoDaLinha(f) + f * 0.3 + ABAIXO;

/** Os parágrafos de um quadro, já quebrados: cada um com o seu recuo. */
function paragrafosDo(chave: ChaveDoQuadro, d: DadosDaFolha, largura: number, f: number, medir: Medir): { recuo: number; linhas: Pedaco[][] }[] {
  const texto = (t: string | undefined) => (t ?? '').trim();
  if (chave === 'formas_registro' || chave === 'materiais' || chave === 'avaliacao') {
    const valor = texto(d[chave]);
    const pedacos: Pedaco[] = [{ texto: ROTULO_DO_QUADRO[chave], negrito: true, cor: COR.rotulo }];
    if (valor) pedacos.push({ texto: ' ' + valor, negrito: false, cor: COR.texto });
    return [{ recuo: 0, linhas: quebrar(pedacos, largura, f, medir) }];
  }
  const dia = d.dias[chave] ?? {};
  const titulo = { recuo: 0, linhas: [[{ texto: ROTULO_DO_QUADRO[chave], negrito: true, cor: COR.rotulo }]] };
  const campos = CAMPOS_DO_DIA.map(c => {
    const valor = texto(dia[c.chave]);
    const pedacos: Pedaco[] = [{ texto: `${c.rotulo}:`, negrito: false, cor: COR.rotulo }];
    if (valor) pedacos.push({ texto: ' ' + valor, negrito: false, cor: COR.texto });
    return { recuo: RECUO, linhas: quebrar(pedacos, largura - RECUO, f, medir) };
  });
  return [titulo, ...campos];
}

/** As alturas finais: cada quadro com o que precisa, e a sobra puxando para a proporção do modelo. */
export function repartir(precisa: number[], modelo: number[], disponivel: number): number[] {
  const sobra = disponivel - precisa.reduce((a, b) => a + b, 0);
  if (sobra <= 0) return precisa;
  const falta = precisa.map((p, i) => Math.max(0, modelo[i] - p));
  const totalFalta = falta.reduce((a, b) => a + b, 0);
  if (sobra <= totalFalta) return precisa.map((p, i) => p + (totalFalta ? sobra * falta[i] / totalFalta : 0));
  const totalModelo = modelo.reduce((a, b) => a + b, 0);
  return precisa.map((p, i) => p + falta[i] + (sobra - totalFalta) * modelo[i] / totalModelo);
}

/** Uma linha fixa do alto ("AGRUPAMENTO: AG I B"): letra do modelo, menor só se não couber na largura. */
function linhaFixa(rotulo: string, valor: string, topo: number, medir: Medir): { tamanho: number; linhas: Linha[] } {
  const x = COLUNAS.esquerda.x + MARGEM;
  const largura = COLUNAS.esquerda.largura - 2 * MARGEM;
  let f = LETRA_DO_MODELO;
  const larguraDe = (t: number, val: string) => medir(rotulo, true, t) + (val ? medir(' ' + val, false, t) : 0);
  while (f > LETRA_MINIMA && larguraDe(f, valor) > largura) f = Math.max(LETRA_MINIMA, +(f - PASSO).toFixed(2));
  let v = valor;
  // Nem com a letra mínima: corta e termina com reticências, que também contam.
  if (larguraDe(f, v) > largura) { while (v.length > 1 && larguraDe(f, v + '…') > largura) v = v.slice(0, -1); v = v.trimEnd() + '…'; }
  const y = topo + 20.4 * (f / LETRA_DO_MODELO) + (LETRA_DO_MODELO - f) * 0.35;
  const trechos: Trecho[] = [{ x, texto: rotulo, negrito: true, cor: COR.rotulo }];
  if (v) trechos.push({ x: x + medir(rotulo, true, f), texto: ' ' + v, negrito: false, cor: COR.texto });
  return { tamanho: f, linhas: [{ y, trechos }] };
}

/** A conta da folha inteira. */
export function diagramar(d: DadosDaFolha, medir: Medir): Folha {
  const linhasFixas = LINHAS_FIXAS.map(l => ({
    chave: l.chave,
    ...linhaFixa(l.rotulo, l.chave === 'agrupamento' ? d.agrupamento.trim() : l.chave === 'professora' ? d.professora.trim() : d.periodo, l.topo, medir),
  }));

  const colunas = (['esquerda', 'direita'] as const).map(nome => {
    const col = COLUNAS[nome];
    const { topo, quadros } = QUADROS[nome];
    const disponivel = ALTURA - topo - SEPARADOR * (quadros.length - 1);
    const largura = col.largura - 2 * MARGEM;
    const medidas = (f: number) => quadros.map(q => {
      const ps = paragrafosDo(q.chave, d, largura, f, medir);
      const n = ps.reduce((a, p) => a + p.linhas.length, 0);
      return { ps, precisa: alturaPara(n, f) };
    });
    return { nome, col, topo, quadros, disponivel, largura, medidas };
  });

  // A maior letra em que as duas colunas cabem.
  let f = LETRA_DO_MODELO;
  const cabe = (t: number) => colunas.every(c => c.medidas(t).reduce((a, m) => a + m.precisa, 0) <= c.disponivel + 0.01);
  while (f > LETRA_MINIMA && !cabe(f)) f = Math.max(LETRA_MINIMA, +(f - PASSO).toFixed(2));

  const quadros: Quadro[] = [];
  const cheios: string[] = [];
  for (const c of colunas) {
    const medidas = c.medidas(f);
    const precisa = medidas.map(m => m.precisa);
    const modelo = c.quadros.map(q => q.altura);
    const total = precisa.reduce((a, b) => a + b, 0);
    if (total > c.disponivel + 0.01) {
      // Não coube nem com a letra mínima: aponta os quadros que passaram da parte deles.
      const escala = c.disponivel / modelo.reduce((a, b) => a + b, 0);
      const passaram = c.quadros.filter((_, i) => precisa[i] > modelo[i] * escala);
      cheios.push(...(passaram.length ? passaram : c.quadros).map(q => ROTULO_DO_QUADRO[q.chave].replace(/:$/, '')));
    }
    const alturas = repartir(precisa, modelo, c.disponivel);
    let y = c.topo;
    c.quadros.forEach((q, i) => {
      const linhas: Linha[] = [];
      let base = y + primeiraBase(f);
      for (const p of medidas[i].ps) {
        for (const l of p.linhas) {
          let x = c.col.x + MARGEM + p.recuo;
          const trechos: Trecho[] = [];
          for (const t of l) {
            const texto = trechos.length === 0 ? t.texto.replace(/^ /, '') : t.texto;
            trechos.push({ x, texto, negrito: t.negrito, cor: t.cor });
            x += medir(texto, t.negrito, f);
          }
          linhas.push({ y: base, trechos });
          base += passoDaLinha(f);
        }
      }
      quadros.push({ chave: q.chave, rotulo: ROTULO_DO_QUADRO[q.chave], x: c.col.x, y, largura: c.col.largura, altura: alturas[i], linhas });
      y += alturas[i] + SEPARADOR;
    });
  }
  return { tamanho: f, linhasFixas, quadros, cheios };
}


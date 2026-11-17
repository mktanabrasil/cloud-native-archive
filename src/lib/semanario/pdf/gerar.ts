import type { jsPDF as JsPdf } from 'jspdf';
import { periodoCurto, periodoPorExtenso, type Semanario } from '../regras';
import { ALTURA, COLUNAS, COR, LARGURA, LINHAS_FIXAS, TOPO_DAS_COLUNAS, diagramar, limparParaPdf, type DadosDaFolha, type Folha, type Medir } from './folha';

/**
 * O PDF do Semanário (17/11/2026): as duas páginas A4 deitadas do modelo da
 * Orientação Pedagógica, desenhadas em vetor com as medidas do próprio
 * modelo. A página 1 (as orientações) é sempre a mesma; a página 2 sai com o
 * que a professora escreveu (a conta fica em `folha.ts`). As únicas imagens
 * são o logo e o aviãozinho do cabeçalho, recortados do modelo.
 */

const FONTE = 'Poppins';
const PECAS = '/semanario-pdf';
const FONTES = { normal: '/fontes/poppins-regular.ttf', bold: '/fontes/poppins-bold.ttf' } as const;

export interface Imagem { dados: Uint8Array; largura: number; altura: number }
export interface RecursosDoSemanario {
  /** TTF em base64. */
  fontes: { normal: string; bold: string };
  logo: Imagem;
  aviao: Imagem;
}

/* ---------- página 1: o texto fixo do modelo ---------- */

type Seg = string | { b: string };
interface LinhaFixa { y: number; segs: Seg[]; x?: number; justificar?: boolean; marcador?: boolean }

/** As orientações, linha a linha, como no modelo (11 pt, x = 52,9; justificadas até 509). */
const ORIENTACOES: LinhaFixa[] = [
  { y: 160.9, segs: [{ b: 'Professora,' }] },
  { y: 190.9, segs: ['O semanário deve ser enviado pelo e-mail da professora (@educa) para o e-mail'], justificar: true },
  { y: 205.9, segs: ['da Orientadora Pedagógica (@anabrasil) toda ', { b: 'quarta-feira' }, ' com as propostas'] },
  { y: 220.9, segs: ['da semana seguinte.'] },
  { y: 250.9, segs: [{ b: 'Observação:' }, ' Não é permitido enviar pelo e-mail particular.'] },
  { y: 265.9, segs: ['A Orientadora Pedagógica dará a devolutiva na ', { b: 'quinta-feira' }, ' do semanário logo'], justificar: true },
  { y: 280.9, segs: ['após a leitura, correção e separação dos materiais.'] },
  { y: 295.9, segs: ['O semanário contemplará as propostas para o desenvolvimento dos projetos'] },
  { y: 310.9, segs: ['e atividades diárias utilizando todos os recursos conforme o plano para os tempos'], justificar: true },
  { y: 325.9, segs: ['e espaços do CEI, incluindo os ambientes educativos.'] },
  { y: 355.9, segs: ['O semanário terá como estrutura básica:'] },
  { y: 370.9, segs: [{ b: 'Projeto, proposta do projeto e desenvolvimento da proposta' }], x: 71.6, marcador: true },
  { y: 385.9, segs: ['Neste campo, colocar o nome do projeto, planejar ATIVIDADES DIÁRIAS'] },
  { y: 400.9, segs: ['que contemplem os projetos. Elencar aqui como ela será realizada.'] },
  { y: 431.0, segs: [{ b: 'Registro' }], x: 71.6, marcador: true },
  { y: 446.0, segs: ['Registrar e avaliar as propostas da semana, pensando que é um instrumento'], justificar: true },
  { y: 461.0, segs: ['avaliativo para intervenções coletivas, individuais e formativas.'] },
  { y: 491.0, segs: [{ b: 'Material utilizado com as crianças' }], x: 71.6, marcador: true },
  { y: 506.0, segs: ['A professora registrará no quadro indicado no semanário o material pedagógico'], justificar: true },
  { y: 521.0, segs: ['que fará uso na semana para trabalhar as propostas com as crianças.'] },
  { y: 536.0, segs: ['A professora receberá o material solicitado na ', { b: 'sexta-feira' }, '.'] },
  { y: 566.0, segs: [{ b: 'Observação:' }, ' Não serão disponibilizados materiais pedagógicos no decorrer'] },
  { y: 581.0, segs: ['da semana para realização das propostas.'] },
];

/** A miniatura do semanário, à direita da página 1: rótulos (8,53 pt) e faixas brancas. */
const MINIATURA = {
  x: 526.4, largura: 297.2,
  titulo: { topo: 106.75, base: 138.75 },
  corpo: { topo: 142.25, base: 582.25 },
  faixas: [159.25, 179.5, 199.75, 264.5, 329, 393.75, 458.5, 523.25, 543, 562.75],
  rotulos: [
    { y: 152.7, t: 'AGRUPAMENTO:', b: true }, { y: 173.0, t: 'PROFESSORA:', b: true }, { y: 193.2, t: 'PERÍODO:', b: true },
    ...['2ª', '3ª', '4ª', '5ª', '6ª'].flatMap((d, i) => {
      const y = 213.5 + i * 64.7;
      return [
        { y, t: `${d} FEIRA`, b: true }, { y: y + 11.3, t: 'PROJETO:', b: false }, { y: y + 22.5, t: 'PROPOSTA:', b: false },
        { y: y + 33.8, t: 'OBJETIVO DA PROPOSTA:', b: false }, { y: y + 45.1, t: 'DESENVOLVIMENTO DA PROPOSTA:', b: false },
      ];
    }),
    { y: 537.0, t: 'FORMAS DE REGISTRO:', b: true }, { y: 556.7, t: 'MATERIAIS UTILIZADOS PARA A PROPOSTA DA SEMANA:', b: true },
    { y: 576.4, t: 'AVALIAÇÃO DAS PROPOSTAS:', b: true },
  ],
};

export interface ResultadoDoSemanario { pdf: JsPdf; folha: Folha }

export function dadosDaFolha(s: Pick<Semanario, 'agrupamento' | 'dias' | 'formas_registro' | 'materiais' | 'avaliacao' | 'professora_nome' | 'semana'>): DadosDaFolha {
  const l = (t: string | null | undefined) => limparParaPdf(t ?? '');
  const dias = Object.fromEntries(Object.entries(s.dias ?? {}).map(([k, d]) => [k, Object.fromEntries(Object.entries(d ?? {}).map(([c, t]) => [c, l(t as string)]))]));
  return {
    agrupamento: l(s.agrupamento), dias, formas_registro: l(s.formas_registro), materiais: l(s.materiais), avaliacao: l(s.avaliacao),
    professora: l(s.professora_nome), periodo: periodoCurto(s.semana),
  };
}

export function montarPdf(JsPDF: typeof import('jspdf').jsPDF, dados: DadosDaFolha, recursos: RecursosDoSemanario, titulo?: string): ResultadoDoSemanario {
  const pdf = new JsPDF({ orientation: 'landscape', unit: 'pt', format: [LARGURA, ALTURA], compress: true });
  pdf.addFileToVFS('Poppins-Regular.ttf', recursos.fontes.normal); pdf.addFont('Poppins-Regular.ttf', FONTE, 'normal');
  pdf.addFileToVFS('Poppins-Bold.ttf', recursos.fontes.bold); pdf.addFont('Poppins-Bold.ttf', FONTE, 'bold');
  if (titulo) pdf.setProperties({ title: titulo, creator: 'ANA Brasil' });

  const letra = (negrito: boolean, tamanho: number, cor: string) => { pdf.setFont(FONTE, negrito ? 'bold' : 'normal'); pdf.setFontSize(tamanho); pdf.setTextColor(cor); };
  const medir: Medir = (texto, negrito, tamanho) => { pdf.setFont(FONTE, negrito ? 'bold' : 'normal'); pdf.setFontSize(tamanho); return pdf.getTextWidth(texto); };
  const retangulo = (x: number, y: number, w: number, h: number, cor: string) => { pdf.setFillColor(cor); pdf.rect(x, y, w, h, 'F'); };
  const pilula = (x: number, y: number, w: number, h: number, cor: string) => { pdf.setFillColor(cor); pdf.roundedRect(x, y, w, h, Math.min(w, h) / 2, Math.min(w, h) / 2, 'F'); };

  const cabecalho = () => {
    retangulo(0, 0, LARGURA, 78.6, COR.faixa);
    pdf.addImage(recursos.logo.dados, 'PNG', 262, 3, 100, 63, 'logo', 'FAST');
    pdf.addImage(recursos.aviao.dados, 'PNG', 569, 10, 64, 39, 'aviao', 'FAST');
    pdf.setDrawColor('#000000'); pdf.setLineWidth(0.9); pdf.line(367.5, 14.4, 367.5, 64.3);
    letra(false, 14.42, '#000000');
    pdf.text('Organização do trabalho', 375.1, 32.3);
    pdf.text('da Orientação Pedagógica.', 375.1, 52.0);
  };
  const faixinhas = () => {
    pilula(369.7, 76.3, 32.5, 4.7, COR.amarelo);
    pilula(404.9, 76.3, 32.5, 4.7, COR.verde);
    pilula(439.9, 76.3, 32.5, 4.7, COR.coral);
  };

  /* ---------- página 1 ---------- */
  cabecalho();
  faixinhas();
  pilula(24.9, 112.5, 3.9, 141.8, COR.coral);
  pilula(24.9, 265.2, 3.9, 141.8, COR.verde);
  pilula(24.9, 418.7, 3.9, 141.8, COR.amarelo);
  letra(true, 22.01, '#000000'); pdf.text('ORIENTAÇÕES SOBRE O SEMANÁRIO', 52.9, 127.1);
  const FIM_DA_LINHA = 509.0;
  for (const l of ORIENTACOES) {
    const x0 = l.x ?? 52.9;
    if (l.marcador) { pdf.setFillColor('#000000'); pdf.circle(61.5, l.y - 3.3, 1.9, 'F'); }
    // As palavras, cada uma com o seu peso; justificar espalha a sobra entre os espaços.
    // "colada": sem espaço antes (o "." depois de "sexta-feira").
    const palavras: { t: string; b: boolean; colada: boolean }[] = [];
    let espacoAntes = false;
    for (const s of l.segs) {
      const b = typeof s !== 'string'; const t = typeof s === 'string' ? s : s.b;
      t.split(' ').forEach((p, i, arr) => {
        if (p) { palavras.push({ t: p, b, colada: palavras.length > 0 && !espacoAntes }); espacoAntes = false; }
        if (i < arr.length - 1) espacoAntes = true;
      });
    }
    const espaco = medir(' ', false, 11);
    const larguraNatural = palavras.reduce((a, p, i) => a + medir(p.t, p.b, 11) + (i > 0 && !p.colada ? espaco : 0), 0);
    const vaos = palavras.filter((p, i) => i > 0 && !p.colada).length;
    const extra = l.justificar && vaos ? (FIM_DA_LINHA - x0 - larguraNatural) / vaos : 0;
    let x = x0;
    palavras.forEach((p, i) => {
      if (i > 0 && !p.colada) x += espaco + extra;
      letra(p.b, 11, '#000000'); pdf.text(p.t, x, l.y);
      x += medir(p.t, p.b, 11);
    });
  }
  // A miniatura do semanário.
  retangulo(MINIATURA.x, MINIATURA.titulo.topo, MINIATURA.largura, MINIATURA.titulo.base - MINIATURA.titulo.topo, COR.miniatura);
  retangulo(MINIATURA.x, MINIATURA.corpo.topo, MINIATURA.largura, MINIATURA.corpo.base - MINIATURA.corpo.topo, COR.miniatura);
  for (const y of MINIATURA.faixas) retangulo(MINIATURA.x, y, MINIATURA.largura, 3, COR.branco);
  letra(true, 16.41, COR.rotulo); pdf.text('Semanário', 628.4, 127.5);
  for (const r of MINIATURA.rotulos) { letra(r.b, 8.53, COR.rotulo); pdf.text(r.t, MINIATURA.x, r.y); }

  /* ---------- página 2 ---------- */
  pdf.addPage([LARGURA, ALTURA], 'landscape');
  cabecalho();
  retangulo(0, 78.6, LARGURA, TOPO_DAS_COLUNAS - 78.6, COR.rotulo);
  faixinhas();
  letra(true, 16.41, COR.branco); pdf.text('Semanário', 374.5, 99.4);
  retangulo(COLUNAS.esquerda.x, TOPO_DAS_COLUNAS, COLUNAS.esquerda.largura, ALTURA - TOPO_DAS_COLUNAS, COR.quadro);
  retangulo(COLUNAS.direita.x, TOPO_DAS_COLUNAS, COLUNAS.direita.largura, ALTURA - TOPO_DAS_COLUNAS, COR.quadro);

  const folha = diagramar(dados, medir);
  // As faixas brancas entre as linhas fixas e entre os quadros.
  for (const l of LINHAS_FIXAS) retangulo(COLUNAS.esquerda.x, l.base, COLUNAS.esquerda.largura, 1.75, COR.separador);
  for (const q of folha.quadros) {
    if (q.y + q.altura < ALTURA - 0.5) retangulo(q.x, q.y + q.altura, q.largura, 1.75, COR.separador);
  }
  for (const l of folha.linhasFixas) {
    for (const ln of l.linhas) for (const t of ln.trechos) { letra(t.negrito, l.tamanho, t.cor); pdf.text(t.texto, t.x, ln.y); }
  }
  for (const q of folha.quadros) {
    for (const ln of q.linhas) for (const t of ln.trechos) { letra(t.negrito, folha.tamanho, t.cor); pdf.text(t.texto, t.x, ln.y); }
  }
  return { pdf, folha };
}

/* ---------- recursos (baixados uma vez por sessão) ---------- */

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não deu para carregar ${url} (${r.status}).`);
  return r.arrayBuffer();
}
const paraBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const imagem = async (url: string): Promise<Imagem> => {
  const dados = new Uint8Array(await baixar(url));
  return { dados, largura: 0, altura: 0 };
};

let recursos: Promise<RecursosDoSemanario> | null = null;
export function carregarRecursos(): Promise<RecursosDoSemanario> {
  recursos ??= (async () => {
    const [normal, bold, logo, aviao] = await Promise.all([baixar(FONTES.normal), baixar(FONTES.bold), imagem(`${PECAS}/logo-cabecalho.png`), imagem(`${PECAS}/aviao-cabecalho.png`)]);
    return { fontes: { normal: paraBase64(normal), bold: paraBase64(bold) }, logo, aviao };
  })();
  recursos.catch(() => { recursos = null; });
  return recursos;
}

/** O nome do arquivo: "Semanário AG I B - 23 a 27 de novembro.pdf". */
export function nomeDoArquivo(s: Pick<Semanario, 'agrupamento' | 'semana'>): string {
  const ag = s.agrupamento.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return `Semanário${ag ? ` ${ag}` : ''} - ${periodoPorExtenso(s.semana)}.pdf`;
}

/** Gera o PDF no navegador. */
export async function gerarPdfDoSemanario(s: Parameters<typeof dadosDaFolha>[0]) {
  const [{ jsPDF }, r] = await Promise.all([import('jspdf'), carregarRecursos()]);
  const { pdf, folha } = montarPdf(jsPDF, dadosDaFolha(s), r, nomeDoArquivo({ agrupamento: s.agrupamento ?? '', semana: s.semana }).replace(/\.pdf$/, ''));
  return { blob: pdf.output('blob') as Blob, cheios: folha.cheios, tamanho: folha.tamanho };
}

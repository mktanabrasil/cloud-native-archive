import type { jsPDF as JsPdf } from 'jspdf';
import {
  DIAS_DA_SEMANA, MESES, chaveDoDia, itensDoDia, percursosCompletos, semanasDoMes, tituloDoMes, vaiProPdf,
  type AnoDoCalendario, type ItemDoCalendario,
} from '../regras';
import { montarCelula, type EstiloDaLetra } from './grade';
import { blocosDe, quebrarEmLinhas, trocarMarcas } from './marcacao';
import { corpoDaSecao, secoesDoAno } from './textosBase';

/**
 * O PDF do Calendário Anual (13/11/2026), no formato do de 2026: A4 deitado,
 * capa, as páginas de texto, três páginas por mês (duas em branco e a grade) e
 * doze em branco no fim — 58 páginas quando os textos cabem em nove.
 *
 * As medidas saíram do próprio PDF de 2026 (pdf.js: posições, fontes e cores).
 * Tudo é desenhado direto no PDF, em vetor; as únicas imagens são a foto da
 * capa e as peças fixas da identidade (logo, aviãozinho e a faixa da capa),
 * recortadas do PDF de 2026 em alta resolução.
 *
 * A grade de 2026 usava a Open Sauce One, que não temos; aqui ela sai em
 * Poppins, a fonte do resto do calendário.
 */

export const LARGURA = 842.25;
export const ALTURA = 595.5;
const FONTE = 'Poppins';

const COR = {
  preto: '#000000',
  titulo: '#484848',
  linha: '#a6a6a6',
  fimDeSemana: '#f0faff',
  faixa: '#f1f1f1',
  amarelo: '#fbce00',
  verde: '#81e2cf',
  coral: '#f37964',
  branco: '#ffffff',
};

export interface Imagem { dados: Uint8Array; formato: 'PNG' | 'JPEG'; largura: number; altura: number }
export type EstiloDaFonte = 'light' | 'normal' | 'medium' | 'bold';

export interface RecursosDoPdf {
  /** TTF em base64. */
  fontes: Record<EstiloDaFonte, string>;
  rodapeCapa: Imagem;
  logoCabecalho: Imagem;
  aviaoCabecalho: Imagem;
  logoMes: Imagem;
  aviaoMes: Imagem;
  /** A foto escolhida pelo marketing; sem ela, a capa mostra o lugar da foto. */
  capa: Imagem | null;
  /** Sombra suave atrás dos textos brancos da capa, desenhada à parte (canvas). */
  sombraDaCapa?: Imagem | null;
}

export interface ResultadoDoPdf {
  pdf: JsPdf;
  paginas: number;
  paginasDeTexto: number;
  /** Dias cuja célula não coube nem com a letra menor ("2027-03-14"). */
  celulasCheias: string[];
}

/** As linhas do tema na capa, como em 2026: quebra depois da vírgula, ou ao meio. */
export function linhasDoTema(tema: string): [string, string] | [string] | [] {
  const t = tema.trim().toLocaleUpperCase('pt-BR');
  if (!t) return [];
  const virgula = t.indexOf(',');
  if (virgula > 0 && virgula < t.length - 1) return [`“${t.slice(0, virgula + 1)}`, `${t.slice(virgula + 1).trim()}”`];
  const palavras = t.split(/\s+/);
  if (palavras.length < 3) return [`“${t}”`];
  let melhor = 1; let diferenca = Infinity;
  for (let i = 1; i < palavras.length; i++) {
    const d = Math.abs(palavras.slice(0, i).join(' ').length - palavras.slice(i).join(' ').length);
    if (d < diferenca) { diferenca = d; melhor = i; }
  }
  return [`“${palavras.slice(0, melhor).join(' ')}`, `${palavras.slice(melhor).join(' ')}”`];
}

export function montarPdf(
  JsPDF: typeof import('jspdf').jsPDF,
  ano: AnoDoCalendario,
  itens: ItemDoCalendario[],
  recursos: RecursosDoPdf,
  opcoes: { previa?: boolean } = {},
): ResultadoDoPdf {
  const pdf = new JsPDF({ orientation: 'landscape', unit: 'pt', format: [LARGURA, ALTURA], compress: true });
  const nomes: Record<EstiloDaFonte, string> = { light: 'Poppins-Light.ttf', normal: 'Poppins-Regular.ttf', medium: 'Poppins-Medium.ttf', bold: 'Poppins-Bold.ttf' };
  (Object.keys(nomes) as EstiloDaFonte[]).forEach(e => {
    pdf.addFileToVFS(nomes[e], recursos.fontes[e]);
    pdf.addFont(nomes[e], FONTE, e);
  });

  const letra = (estilo: EstiloDaFonte, tamanho: number, cor = COR.preto) => {
    pdf.setFont(FONTE, estilo); pdf.setFontSize(tamanho); pdf.setTextColor(cor);
  };
  const medir = (texto: string, estilo: EstiloDaFonte, tamanho: number) => {
    pdf.setFont(FONTE, estilo); pdf.setFontSize(tamanho);
    return pdf.getTextWidth(texto);
  };
  const imagem = (img: Imagem, alias: string, x: number, y: number, w: number, h: number) =>
    pdf.addImage(img.dados, img.formato, x, y, w, h, alias, 'FAST');
  const retangulo = (x: number, y: number, w: number, h: number, cor: string) => { pdf.setFillColor(cor); pdf.rect(x, y, w, h, 'F'); };
  const fio = (x1: number, y1: number, x2: number, y2: number) => { pdf.setDrawColor(COR.linha); pdf.setLineWidth(0.75); pdf.line(x1, y1, x2, y2); };
  const novaFolha = () => pdf.addPage([LARGURA, ALTURA], 'landscape');

  const tema = ano.tema.trim();
  const marcas = (t: string) => trocarMarcas(t, ano.ano, tema);

  /* ---------- capa ---------- */
  if (recursos.capa) {
    // Cobre a área da foto (a faixa branca e o rodapé cobrem o que sobrar embaixo).
    const area = { w: LARGURA, h: 467 };
    const escala = Math.max(area.w / recursos.capa.largura, area.h / recursos.capa.altura);
    const w = recursos.capa.largura * escala; const h = recursos.capa.altura * escala;
    imagem(recursos.capa, 'capa', (LARGURA - w) / 2, (area.h - h) / 2 - 2, w, h);
  } else {
    retangulo(0, 0, LARGURA, 461, '#d9dde0');
    letra('normal', 14, '#5f6b73');
    pdf.text('Foto da capa: escolhida pelo marketing na revisão', LARGURA / 2, 240, { align: 'center' });
  }
  if (recursos.sombraDaCapa) imagem(recursos.sombraDaCapa, 'sombra-capa', 0, 0, LARGURA, 461);
  letra('bold', 34.22, COR.branco); pdf.text('CALENDÁRIO', 47.3, 69.5);
  letra('light', 34.22, COR.branco); pdf.text(`ANUAL ${ano.ano}`, 47.3, 106.3);
  const temaNaCapa = linhasDoTema(tema);
  if (temaNaCapa.length) {
    const larguraMaxima = 640;
    let tamanho = 34.22;
    while (tamanho > 22 && temaNaCapa.some((l, i) => medir(l, i === temaNaCapa.length - 1 && temaNaCapa.length > 1 ? 'bold' : 'light', tamanho) > larguraMaxima)) tamanho -= 1;
    if (temaNaCapa.length === 2) {
      letra('light', tamanho, COR.branco); pdf.text(temaNaCapa[0], 811.7, 382.5, { align: 'right' });
      letra('bold', tamanho, COR.branco); pdf.text(temaNaCapa[1], 811.7, 419.2, { align: 'right' });
    } else {
      letra('bold', tamanho, COR.branco); pdf.text(temaNaCapa[0], 811.7, 419.2, { align: 'right' });
    }
  }
  retangulo(0, 461, LARGURA, 40.2, COR.branco);
  letra('bold', 20, COR.titulo); pdf.text('EDUCADOR:', 41.6, 486.8); pdf.text('OFICINA:', 499.2, 486.8);
  imagem(recursos.rodapeCapa, 'rodape-capa', 0, 501.2, LARGURA, ALTURA - 501.2);

  /* ---------- cabeçalho das páginas de texto e das em branco ---------- */
  const cabecalho = () => {
    retangulo(0, 0, LARGURA, 62.5, COR.faixa);
    imagem(recursos.aviaoCabecalho, 'aviao-cabecalho', 545, 4.5, 44.2, 25.2);
    imagem(recursos.logoCabecalho, 'logo-cabecalho', 180, 10.6, 78.3, 41.5);
    retangulo(263.0, 11.0, 0.8, 40.5, COR.preto);
    letra('bold', 32.88); pdf.text(`CALENDÁRIO ANUAL’${String(ano.ano).slice(-2)}`, 269.4, 45.8);
    retangulo(380.2, 60.7, 25.9, 3.7, COR.amarelo);
    retangulo(408.2, 60.7, 25.9, 3.7, COR.verde);
    retangulo(436.1, 60.7, 25.9, 3.7, COR.coral);
  };
  const paginaEmBranco = () => { novaFolha(); cabecalho(); };

  /* ---------- páginas de texto ---------- */
  // Medidas de 2026 (a página de lá começa 8,6 pt acima; já está somado).
  const ESQUERDA = 29.8, DIREITA = 812.4, RECUO = 48.5, LIMITE = 581, TOPO = 82;
  let paginasDeTexto = 0;
  let cursor = 0; // linha base da próxima linha de corpo
  let inicioDaPagina = true;
  const abrirPaginaDeTexto = () => { novaFolha(); cabecalho(); paginasDeTexto++; cursor = TOPO; inicioDaPagina = true; };
  const medirTrecho = (tamanho: number) => (t: string, negrito: boolean) => medir(t, negrito ? 'bold' : 'normal', tamanho);
  const desenharLinha = (palavras: ReturnType<typeof quebrarEmLinhas>[number], x: number, y: number, tamanho: number) => {
    let px = x;
    for (const p of palavras) {
      if (p.espacoAntes) px += medir(' ', p.negrito ? 'bold' : 'normal', tamanho);
      letra(p.negrito ? 'bold' : 'normal', tamanho);
      pdf.text(p.texto, px, y);
      px += p.largura;
    }
  };
  const titulo = (texto: string, nivel: 1 | 2, compacto = false) => {
    const tamanho = nivel === 1 ? 15 : 12;
    const linhas = quebrarEmLinhas([{ texto, negrito: true }], DIREITA - ESQUERDA, medirTrecho(tamanho));
    const antes = inicioDaPagina ? 0 : compacto ? 5 : nivel === 1 ? 10 : 7;
    const depois = compacto ? (nivel === 1 ? 16 : 14) : nivel === 1 ? 21 : 18;
    // Título não fica sozinho no pé da página.
    if (!inicioDaPagina && cursor + antes + (linhas.length - 1) * tamanho * 1.25 + depois + 15 > LIMITE) abrirPaginaDeTexto();
    let y = cursor + (inicioDaPagina ? 0 : antes);
    linhas.forEach((l, i) => { if (i) y += tamanho * 1.25; desenharLinha(l, ESQUERDA, y, tamanho); });
    cursor = y + depois;
    inicioDaPagina = false;
  };
  const corpo = (texto: string) => {
    for (const b of blocosDe(texto)) {
      if (b.tipo === 'respiro') { cursor += 8; continue; }
      const x = b.tipo === 'item' ? RECUO : ESQUERDA;
      const linhas = quebrarEmLinhas(b.trechos.map(t => ({ ...t, texto: marcas(t.texto) })), DIREITA - x, medirTrecho(11));
      linhas.forEach((l, i) => {
        if (cursor > LIMITE) { abrirPaginaDeTexto(); inicioDaPagina = false; }
        if (b.tipo === 'item' && i === 0) { pdf.setFillColor(COR.preto); pdf.circle(38.4, cursor - 3.3, 1.9, 'F'); }
        desenharLinha(l, x, cursor, 11);
        cursor += 15;
      });
      inicioDaPagina = false;
    }
  };

  const percursos = percursosCompletos(ano.percursos);
  const tabelaDosPercursos = () => {
    // Em 2026 a linha tinha 26,15 pt; aqui ela encolhe até 21 pt para a tabela
    // caber embaixo da metodologia. Menos que isso, a tabela vai para a página seguinte.
    const rotulo = marcas('PERCURSOS - {ano} - “{TEMA}”');
    const PE = ALTURA - 14;
    let base = cursor + (inicioDaPagina ? 0 : 5);
    if (PE - (base + 15.1) < 21 * 13) { abrirPaginaDeTexto(); base = cursor; }
    const ALTURA_DA_LINHA = Math.min(26.15, (PE - (base + 15.1)) / 13);
    const ALTURA_DA_TABELA = ALTURA_DA_LINHA * 13;
    desenharLinha(quebrarEmLinhas([{ texto: rotulo, negrito: true }], 780, medirTrecho(12))[0] ?? [], ESQUERDA, base, 12);
    const topo = base + 15.1;
    const x0 = ESQUERDA, x1 = x0 + 118.3, x2 = x1 + 399.4, x3 = x0 + 777;
    retangulo(x0, topo, x1 - x0, ALTURA_DA_TABELA, COR.fimDeSemana);
    for (let i = 1; i <= 12; i += 2) retangulo(x1, topo + i * ALTURA_DA_LINHA, x3 - x1, ALTURA_DA_LINHA, COR.faixa);
    pdf.setDrawColor(COR.linha); pdf.setLineWidth(0.75); pdf.rect(x0, topo, x3 - x0, ALTURA_DA_TABELA, 'S');
    fio(x1, topo, x1, topo + ALTURA_DA_TABELA); fio(x2, topo, x2, topo + ALTURA_DA_TABELA);
    for (let i = 1; i < 13; i++) fio(x0, topo + i * ALTURA_DA_LINHA, x3, topo + i * ALTURA_DA_LINHA);
    const escrever = (texto: string, xa: number, xb: number, linha: number, centro: boolean) => {
      const t = texto.toLocaleUpperCase('pt-BR');
      let tamanho = 9.5;
      while (tamanho > 6.5 && medir(t, 'normal', tamanho) > xb - xa - 11) tamanho -= 0.5;
      letra('normal', tamanho);
      const y = topo + linha * ALTURA_DA_LINHA + ALTURA_DA_LINHA / 2 + tamanho * 0.35;
      if (centro) pdf.text(t, (xa + xb) / 2, y, { align: 'center' }); else pdf.text(t, xa + 5.6, y);
    };
    escrever('Mês', x0, x1, 0, true); escrever('Temas transversais', x1, x2, 0, true); escrever('Sugestões de atividades', x2, x3, 0, true);
    percursos.forEach((p, i) => {
      escrever(MESES[i], x0, x1, i + 1, true);
      escrever(p.tema, x1, x2, i + 1, false);
      escrever(p.sugestoes, x2, x3, i + 1, false);
    });
    cursor = topo + ALTURA_DA_TABELA + 15;
  };

  for (const s of secoesDoAno(ano.textos)) {
    if (s.novaPagina || paginasDeTexto === 0) abrirPaginaDeTexto();
    titulo(marcas(s.titulo), s.nivel, s.compacto);
    corpo(corpoDaSecao(ano.textos, s.id));
    if (s.id === 'avaliacao') tabelaDosPercursos();
  }

  /* ---------- os meses ---------- */
  const celulasCheias: string[] = [];
  const doAno = itens.filter(i => i.ano === ano.ano && vaiProPdf(i));
  for (let mes = 1; mes <= 12; mes++) {
    paginaEmBranco();
    paginaEmBranco();
    novaFolha();
    imagem(recursos.aviaoMes, 'aviao-mes', 769, 4.5, 67, 38.4);
    imagem(recursos.logoMes, 'logo-mes', 10, 11.7, 78.3, 41.3);
    const nome = tituloDoMes(ano.ano, mes, percursos);
    let tamanhoDoTitulo = 20;
    while (tamanhoDoTitulo > 13 && medir(nome, 'bold', tamanhoDoTitulo) > 620) tamanhoDoTitulo -= 0.5;
    letra('bold', tamanhoDoTitulo, COR.titulo); pdf.text(nome, 132.3, 40.0);

    const X0 = 16.6, Y0 = 59.6, W = 809.5, CABECA = 44.0, CORPO = 432.0;
    const coluna = W / 7;
    const semanas = semanasDoMes(ano.ano, mes);
    const linha = CORPO / semanas.length;
    retangulo(X0, Y0 + CABECA, coluna, CORPO, COR.fimDeSemana);
    retangulo(X0 + 6 * coluna, Y0 + CABECA, coluna, CORPO, COR.fimDeSemana);
    pdf.setDrawColor(COR.linha); pdf.setLineWidth(0.75); pdf.rect(X0, Y0, W, CABECA + CORPO, 'S');
    for (let c = 1; c < 7; c++) fio(X0 + c * coluna, Y0, X0 + c * coluna, Y0 + CABECA + CORPO);
    fio(X0, Y0 + CABECA, X0 + W, Y0 + CABECA);
    for (let r = 1; r < semanas.length; r++) fio(X0, Y0 + CABECA + r * linha, X0 + W, Y0 + CABECA + r * linha);
    letra('medium', 10);
    DIAS_DA_SEMANA.forEach((d, c) => pdf.text(d.toLocaleUpperCase('pt-BR'), X0 + c * coluna + coluna / 2, 84.8, { align: 'center' }));

    semanas.forEach((semana, r) => semana.forEach((dia, c) => {
      if (!dia) return;
      const chave = chaveDoDia(ano.ano, mes, dia);
      const celula = montarCelula(dia, itensDoDia(doAno, chave), coluna - 11.4, linha - 19, (t, e, tam) => medir(t, e as EstiloDaLetra, tam));
      if (celula.cheia) celulasCheias.push(chave);
      const base = Y0 + CABECA + r * linha + 15.1;
      for (const l of celula.linhas) {
        letra(l.estilo, celula.tamanho, l.cor);
        pdf.text(l.texto, X0 + c * coluna + 5.7, base + l.dy);
      }
    }));
    fio(16.6, 556.5, 826.1, 556.5);
    fio(16.6, 578.6, 826.1, 578.6);
  }

  /* ---------- as doze em branco do fim ---------- */
  for (let i = 0; i < 12; i++) paginaEmBranco();

  /* ---------- a marca da prévia ---------- */
  // Toda prévia sai marcada, para não circular como se fosse o PDF aprovado.
  if (opcoes.previa) {
    const angulo = 24; const rad = (angulo * Math.PI) / 180;
    const tamanho = 150; const texto = 'PRÉVIA';
    const largura = medir(texto, 'bold', tamanho); const altura = tamanho * 0.7;
    // jsPDF gira em volta do começo da linha base; acha o começo para o centro cair no meio da folha.
    const x = LARGURA / 2 - Math.cos(rad) * largura / 2 + Math.sin(rad) * altura / 2;
    const y = ALTURA / 2 + Math.sin(rad) * largura / 2 + Math.cos(rad) * altura / 2;
    const total = pdf.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);
      pdf.saveGraphicsState();
      // A tipagem do jsPDF declara GState como função; em execução é a classe da transparência.
      const GState = (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
      pdf.setGState(new GState({ opacity: 0.13 }) as Parameters<typeof pdf.setGState>[0]);
      letra('bold', tamanho, COR.coral);
      pdf.text(texto, x, y, { angle: angulo });
      pdf.restoreGraphicsState();
    }
  }

  return { pdf, paginas: pdf.getNumberOfPages(), paginasDeTexto, celulasCheias };
}

/* ---------- carregar no navegador ---------- */

const PECAS = '/calendario-pdf';
const FONTES: Record<EstiloDaFonte, string> = {
  light: '/fontes/poppins-light.ttf',
  normal: '/fontes/poppins-regular.ttf',
  medium: '/fontes/poppins-medium.ttf',
  bold: '/fontes/poppins-bold.ttf',
};

const paraBase64 = (dados: ArrayBuffer) => {
  const bytes = new Uint8Array(dados);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não deu para carregar ${url} (${r.status}).`);
  return r.arrayBuffer();
}

async function lerImagem(url: string): Promise<Imagem> {
  const dados = new Uint8Array(await baixar(url));
  const formato: Imagem['formato'] = dados[0] === 0x89 && dados[1] === 0x50 ? 'PNG' : 'JPEG';
  const bitmap = await createImageBitmap(new Blob([dados]));
  const img = { dados, formato, largura: bitmap.width, altura: bitmap.height };
  bitmap.close();
  return img;
}

/**
 * A sombra dos textos brancos da capa, como a de 2026: desenhada num canvas com
 * a própria Poppins e posta como imagem atrás do texto (o PDF não faz desfoque).
 */
async function sombraDaCapa(ano: AnoDoCalendario, fontes: Record<EstiloDaFonte, ArrayBuffer>): Promise<Imagem | null> {
  try {
    const faces = { light: new FontFace('PoppinsCapaLight', fontes.light), bold: new FontFace('PoppinsCapaBold', fontes.bold) };
    await Promise.all([faces.light.load(), faces.bold.load()]);
    document.fonts.add(faces.light); document.fonts.add(faces.bold);
    const k = 2; const canvas = document.createElement('canvas');
    canvas.width = Math.round(LARGURA * k); canvas.height = Math.round(461 * k);
    const g = canvas.getContext('2d');
    if (!g) return null;
    const LONGE = 4000;
    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 16 * k; g.shadowOffsetX = LONGE * k; g.fillStyle = '#000';
    const escrever = (t: string, familia: string, tamanho: number, x: number, y: number, alinhar: CanvasTextAlign) => {
      g.font = `${tamanho * k}px ${familia}`; g.textAlign = alinhar; g.fillText(t, x * k - LONGE * k, y * k);
    };
    escrever('CALENDÁRIO', 'PoppinsCapaBold', 34.22, 47.3, 69.5, 'left');
    escrever(`ANUAL ${ano.ano}`, 'PoppinsCapaLight', 34.22, 47.3, 106.3, 'left');
    const tema = linhasDoTema(ano.tema);
    if (tema.length === 2) { escrever(tema[0], 'PoppinsCapaLight', 34.22, 811.7, 382.5, 'right'); escrever(tema[1], 'PoppinsCapaBold', 34.22, 811.7, 419.2, 'right'); }
    else if (tema.length === 1) escrever(tema[0], 'PoppinsCapaBold', 34.22, 811.7, 419.2, 'right');
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) return null;
    return { dados: new Uint8Array(await blob.arrayBuffer()), formato: 'PNG', largura: canvas.width, altura: canvas.height };
  } catch {
    return null; // sem sombra o PDF sai igual, só mais seco
  }
}

export async function carregarRecursos(ano: AnoDoCalendario, capaUrl: string | null): Promise<RecursosDoPdf> {
  const estilos = Object.keys(FONTES) as EstiloDaFonte[];
  const brutas = await Promise.all(estilos.map(e => baixar(FONTES[e])));
  const fontesBrutas = Object.fromEntries(estilos.map((e, i) => [e, brutas[i]])) as Record<EstiloDaFonte, ArrayBuffer>;
  const [rodapeCapa, logoCabecalho, aviaoCabecalho, logoMes, aviaoMes, capa, sombra] = await Promise.all([
    lerImagem(`${PECAS}/rodape-capa.png`),
    lerImagem(`${PECAS}/logo-cabecalho.png`),
    lerImagem(`${PECAS}/aviao-cabecalho.png`),
    lerImagem(`${PECAS}/logo-mes.png`),
    lerImagem(`${PECAS}/aviao-mes.png`),
    capaUrl ? lerImagem(capaUrl).catch(() => null) : Promise.resolve(null),
    sombraDaCapa(ano, fontesBrutas),
  ]);
  return {
    fontes: Object.fromEntries(estilos.map(e => [e, paraBase64(fontesBrutas[e])])) as Record<EstiloDaFonte, string>,
    rodapeCapa, logoCabecalho, aviaoCabecalho, logoMes, aviaoMes, capa, sombraDaCapa: sombra,
  };
}

/** Gera o PDF inteiro no navegador. */
export async function gerarPdfDoCalendario(
  ano: AnoDoCalendario,
  itens: ItemDoCalendario[],
  opcoes: { capaUrl?: string | null; previa?: boolean } = {},
) {
  // A capa vem como link pronto (assinado, do balde privado); quem chama resolve.
  const capaUrl = opcoes.capaUrl ?? null;
  const [{ jsPDF }, recursos] = await Promise.all([import('jspdf'), carregarRecursos(ano, capaUrl)]);
  const r = montarPdf(jsPDF, ano, itens, recursos, { previa: opcoes.previa });
  return { blob: r.pdf.output('blob') as Blob, paginas: r.paginas, paginasDeTexto: r.paginasDeTexto, celulasCheias: r.celulasCheias };
}


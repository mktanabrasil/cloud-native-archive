import type { AppEvent } from '@/types';
import { eventUnitLabel } from '@/types';
import { montarChecklist, type Checklist } from './checklist';
import { textoDaData, textoDoHorario } from './periodo';
import { enderecoDoLocal } from './local';
import { tituloEmTexto } from './titulo';

/**
 * O PDF do checklist (22/09/2026, mockup aprovado).
 *
 * Uma folha A4 na identidade da ANA: marca no topo, título do evento, a
 * linha com data, horário, local e responsável, três colunas de caixinhas
 * — Antes, No dia, Depois — e, no rodapé, a faixa das cinco cores. **Só no
 * rodapé**: ele pediu para tirar a de cima.
 *
 * Desenhado com o jsPDF que o Jornal já usa, carregado só na hora (o
 * formulário não paga o peso dele). Fonte Poppins, a da identidade: os dois
 * pesos (Regular e Bold, ~300 KB, licença OFL em `public/fontes/`) são
 * baixados só quando o PDF é gerado e embutidos nele. Se não der para
 * baixar, sai em Helvetica em vez de falhar.
 * Se a lista passar da folha, continua numa segunda, com o mesmo rodapé.
 */

/** As cinco cores da faixa, na ordem da marca. */
export const FAIXA = ['#01ADFF', '#81E2CF', '#FBCE00', '#F37964', '#F5DFBB'];

const GRAFITE = '#1F2322';
const CINZA = '#6B7280';
const LARGURA = 210;
const ALTURA = 297;
const MARGEM = 14;
const RODAPE = 18;

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** A imagem do logo como data URL, ou null se não deu para carregar. */
async function carregarLogo(): Promise<string | null> {
  try {
    const r = await fetch('/logo.png');
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((ok, erro) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = () => erro(leitor.error);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Um arquivo público em base64, ou null se não deu para baixar. */
async function baixarBase64(caminho: string): Promise<string | null> {
  try {
    const r = await fetch(caminho);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

export const FONTES_POPPINS = { normal: '/fontes/poppins-regular.ttf', bold: '/fontes/poppins-bold.ttf' };

/**
 * Registra a Poppins no PDF e devolve o nome da fonte a usar. Sem os dois
 * arquivos, fica a Helvetica do próprio PDF.
 */
async function registrarPoppins(pdf: { addFileToVFS: (n: string, d: string) => unknown; addFont: (f: string, n: string, e: string) => unknown }): Promise<'Poppins' | 'helvetica'> {
  const [normal, bold] = await Promise.all([baixarBase64(FONTES_POPPINS.normal), baixarBase64(FONTES_POPPINS.bold)]);
  if (!normal || !bold) return 'helvetica';
  pdf.addFileToVFS('Poppins-Regular.ttf', normal);
  pdf.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
  pdf.addFileToVFS('Poppins-Bold.ttf', bold);
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
  return 'Poppins';
}

/** "Sábado, 27 de setembro de 2026 · 14:00 às 18:00 · Unidade Nilópolis · R. Ana… · Responsável: Carla" */
export function linhaDoEvento(e: Partial<AppEvent>): string {
  const partes: string[] = [];
  if (e.start_datetime && e.end_datetime) {
    partes.push(textoDaData({ start_datetime: e.start_datetime, end_datetime: e.end_datetime }));
    partes.push(textoDoHorario({ start_datetime: e.start_datetime, end_datetime: e.end_datetime }));
  }
  if (e.location) partes.push(e.location);
  const endereco = enderecoDoLocal(e.location);
  if (endereco) partes.push(endereco);
  else if (e.unit) partes.push(eventUnitLabel(e.unit));
  if (e.created_by) partes.push(`Responsável: ${e.created_by}`);
  return partes.join(' · ');
}

export const nomeDoArquivo = (e: Partial<AppEvent>): string =>
  `checklist-${(e.slug || tituloEmTexto(e.title || 'evento')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'evento'}.pdf`;

/**
 * Gera e baixa o PDF. Devolve o nome do arquivo. Em teste, passe `salvar`
 * falso para não abrir download.
 */
export async function gerarChecklistPdf(
  e: Partial<AppEvent>,
  checklist: Checklist = montarChecklist(e),
  salvar = true,
): Promise<{ nome: string; paginas: number; fonte: 'Poppins' | 'helvetica'; bytes?: ArrayBuffer }> {
  const { default: JsPDF } = await import('jspdf');
  // `compress`: a fonte embutida é o que pesa; comprimida, o PDF cai de ~1 MB para uma fração.
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const [logo, fonte] = await Promise.all([carregarLogo(), registrarPoppins(pdf)]);
  const geradoEm = new Date().toLocaleDateString('pt-BR');

  const rodape = (pagina: number, total: number) => {
    // A faixa das cinco cores, só aqui.
    const larguraFaixa = LARGURA / FAIXA.length;
    FAIXA.forEach((cor, i) => {
      pdf.setFillColor(...hex(cor));
      pdf.rect(i * larguraFaixa, ALTURA - 4, larguraFaixa + 0.2, 4, 'F');
    });
    pdf.setFont(fonte, 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...hex(CINZA));
    // A nota à esquerda quebra em até duas linhas para nunca invadir o
    // "página N de M" à direita (com a Poppins, mais larga, invadia).
    const nota = pdf.splitTextToSize(
      'Gerado pelo app da ANA a partir do que foi preenchido no evento. O que não foi marcado no formulário não aparece.',
      LARGURA - MARGEM * 2 - 48,
    ) as string[];
    pdf.text(nota, MARGEM, ALTURA - 12);
    pdf.text(`app.anabrasil.org · página ${pagina} de ${total}`, LARGURA - MARGEM, ALTURA - 12, { align: 'right' });
  };

  const cabecalho = () => {
    let x = MARGEM;
    if (logo) {
      pdf.addImage(logo, 'PNG', MARGEM, MARGEM - 2, 8, 8);
      x += 10;
    }
    pdf.setFont(fonte, 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...hex(GRAFITE));
    pdf.text('anabrasil', x, MARGEM + 4);
    pdf.setFont(fonte, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...hex(CINZA));
    pdf.text(`Checklist do evento · gerado em ${geradoEm}`, LARGURA - MARGEM, MARGEM + 4, { align: 'right' });
  };

  // Primeira página: cabeçalho, título, linha do evento.
  cabecalho();
  let y = MARGEM + 16;
  pdf.setFont(fonte, 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(...hex(GRAFITE));
  const titulo = pdf.splitTextToSize(tituloEmTexto(e.title || 'Evento'), LARGURA - MARGEM * 2) as string[];
  pdf.text(titulo, MARGEM, y);
  y += titulo.length * 8 + 1;
  pdf.setFont(fonte, 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...hex(CINZA));
  const meta = pdf.splitTextToSize(linhaDoEvento(e), LARGURA - MARGEM * 2) as string[];
  pdf.text(meta, MARGEM, y);
  y += meta.length * 4.5 + 6;

  // Três colunas. Cada coluna corre até o rodapé; se estourar, nova página.
  const colunas: Array<{ titulo: string; itens: string[] }> = [
    { titulo: 'Antes do evento', itens: checklist.antes },
    { titulo: 'No dia', itens: checklist.noDia },
    { titulo: 'Depois', itens: checklist.depois },
  ];
  const espaco = 5;
  const larguraColuna = (LARGURA - MARGEM * 2 - espaco * 2) / 3;
  const limite = ALTURA - RODAPE - 4;
  const topoDasColunas = y;
  let paginas = 1;
  let maiorYNaPagina = topoDasColunas;

  const desenharColuna = (n: number, coluna: { titulo: string; itens: string[] }, yInicial: number) => {
    const x = MARGEM + n * (larguraColuna + espaco);
    let yy = yInicial;
    pdf.setFont(fonte, 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...hex(GRAFITE));
    pdf.text(coluna.titulo.toUpperCase(), x, yy);
    yy += 2;
    pdf.setDrawColor(...hex(FAIXA[n % FAIXA.length]));
    pdf.setLineWidth(0.8);
    pdf.line(x, yy, x + larguraColuna, yy);
    yy += 5;
    pdf.setFont(fonte, 'normal');
    pdf.setFontSize(9);
    if (coluna.itens.length === 0) {
      pdf.setTextColor(...hex(CINZA));
      pdf.text('— nada marcado', x, yy);
      return yy + 5;
    }
    for (const item of coluna.itens) {
      const linhas = pdf.splitTextToSize(item, larguraColuna - 7) as string[];
      const altura = linhas.length * 4.2 + 2.5;
      if (yy + altura > limite) {
        // Estourou: continua na próxima página, mesma coluna, sem título.
        pdf.addPage();
        paginas += 1;
        cabecalho();
        yy = MARGEM + 14;
      }
      pdf.setDrawColor(...hex(GRAFITE));
      pdf.setLineWidth(0.3);
      pdf.rect(x, yy - 3.2, 3.8, 3.8);
      pdf.setTextColor(...hex(GRAFITE));
      pdf.text(linhas, x + 6, yy);
      yy += altura;
    }
    return yy;
  };

  // Desenha as três colunas na página 1; quem estourar ganha página nova.
  // Para as colunas dividirem a mesma página 1, cada uma volta à página 1
  // antes de começar.
  for (let n = 0; n < colunas.length; n++) {
    pdf.setPage(1);
    const fim = desenharColuna(n, colunas[n], topoDasColunas);
    maiorYNaPagina = Math.max(maiorYNaPagina, fim);
  }

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    rodape(p, total);
  }

  const nome = nomeDoArquivo(e);
  if (salvar) {
    pdf.save(nome);
    return { nome, paginas: total, fonte };
  }
  // Sem salvar (teste): os bytes, para conferir o desenho.
  return { nome, paginas: total, fonte, bytes: pdf.output('arraybuffer') };
}

import { DIA_DO_EVENTO, TREINAMENTO } from './modelo';

/**
 * O comprovante da inscrição (23/10/2026), no lugar do "tire um print": uma
 * imagem JPEG leve (~200 KB) com a capa, o protocolo, o resumo, os dados do
 * treinamento e o lembrete do grupo do WhatsApp. No celular abre o menu de compartilhar, que salva na galeria
 * (no iPhone, o download comum iria para o app Arquivos); no computador, ou
 * onde não houver o menu, baixa o arquivo.
 */

export interface DadosDoComprovante {
  protocolo: string;
  /** [rótulo, valor], na ordem do resumo da tela. */
  linhas: ReadonlyArray<readonly [string, string]>;
}

const CAPA = '/voluntariado-natal-feliz-capa.webp';
const COR = { fundo: '#FFFCF6', vermelho: '#C8372D', vermelhoEsc: '#9E2A22', verde: '#1E4D3A', verde2: '#2F6B52', verdeClaro: '#EAF3EE', tinta: '#24201B', mut: '#6E655B', aDefinir: '#7C8A85' };
const LARGURA = 1080;
const MARGEM = 64;

/** Quebra o texto na largura e devolve a linha de base da última linha. */
function escrever(g: CanvasRenderingContext2D, txt: string, x: number, y: number, max: number, alt: number): number {
  let l = '';
  for (const p of txt.split(' ')) {
    const t = l ? `${l} ${p}` : p;
    if (g.measureText(t).width > max && l) { g.fillText(l, x, y); y += alt; l = p; } else l = t;
  }
  g.fillText(l, x, y);
  return y;
}

async function carregarImagem(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export async function desenharComprovante(d: DadosDoComprovante): Promise<Blob> {
  await Promise.all(['400 24px Poppins', '600 34px Poppins', '700 30px Poppins', '800 76px Poppins'].map((f) => document.fonts?.load(f).catch(() => null)));
  const rascunho = document.createElement('canvas');
  rascunho.width = LARGURA; rascunho.height = 2600;
  const g = rascunho.getContext('2d')!;
  g.fillStyle = COR.fundo; g.fillRect(0, 0, LARGURA, rascunho.height);

  const capa = await carregarImagem(CAPA);
  const alturaDaCapa = Math.round(LARGURA * 877 / 1793);
  g.drawImage(capa, 0, 0, LARGURA, alturaDaCapa);
  g.fillStyle = COR.vermelho; g.fillRect(0, alturaDaCapa, LARGURA, 80);
  g.fillStyle = '#fff'; g.font = '700 30px Poppins'; g.textBaseline = 'middle';
  g.fillText(`DIA DO VOLUNTARIADO  ·  ${DIA_DO_EVENTO}  ·  NATAL FELIZ`, MARGEM, alturaDaCapa + 41);
  g.textBaseline = 'alphabetic';

  let y = alturaDaCapa + 80 + 84;
  g.fillStyle = COR.verde2; g.font = '600 30px Poppins'; g.fillText('Comprovante de inscrição', MARGEM, y);
  y += 86; g.fillStyle = COR.vermelhoEsc; g.font = '800 76px Poppins'; g.fillText(d.protocolo, MARGEM, y);
  y += 24;
  for (const [rotulo, valor] of d.linhas) {
    y += 58; g.fillStyle = COR.mut; g.font = '400 24px Poppins'; g.fillText(rotulo.toUpperCase(), MARGEM, y);
    g.fillStyle = COR.tinta; g.font = '600 34px Poppins'; y = escrever(g, valor, MARGEM, y + 46, LARGURA - 2 * MARGEM, 46);
  }

  // O quadro do treinamento: mede o texto antes, para saber a altura.
  y += 56;
  const topo = y, folga = 40, x = MARGEM + folga - 8, larguraDoTexto = LARGURA - 2 * MARGEM - 2 * folga;
  const itens: Array<[string, string, boolean]> = [
    ['Data', TREINAMENTO.data, true],
    ['Horário', TREINAMENTO.horario || '[a confirmar]', !!TREINAMENTO.horario],
    ['Local', `${TREINAMENTO.local} · ${TREINAMENTO.endereco || '[endereço a definir]'}`, !!TREINAMENTO.endereco],
  ];
  const medida = document.createElement('canvas').getContext('2d')!;
  medida.font = '600 34px Poppins';
  let fim = topo + folga + 34;
  for (const [, v] of itens) fim = escrever(medida, v, 0, fim + 94, larguraDoTexto, 46);
  fim += folga;
  g.fillStyle = COR.verdeClaro; g.beginPath(); g.roundRect(MARGEM - 8, topo, LARGURA - 2 * MARGEM + 16, fim - topo, 28); g.fill();
  let yy = topo + folga + 34;
  g.fillStyle = COR.verde; g.font = '700 30px Poppins'; g.fillText('TREINAMENTO DE VOLUNTÁRIOS · OBRIGATÓRIO', x, yy);
  for (const [r, v, definido] of itens) {
    yy += 50; g.fillStyle = COR.verde2; g.font = '400 24px Poppins'; g.fillText(r.toUpperCase(), x, yy);
    g.fillStyle = definido ? COR.verde : COR.aDefinir; g.font = '600 34px Poppins'; yy = escrever(g, v, x, yy + 44, larguraDoTexto, 46);
  }
  // O grupo do WhatsApp (23/10/2026): o botão fica na tela; aqui, o lembrete de que a entrada é obrigatória.
  const t2 = fim + 36, h2 = 200;
  g.fillStyle = '#E7F8EE'; g.beginPath(); g.roundRect(MARGEM - 8, t2, LARGURA - 2 * MARGEM + 16, h2, 28); g.fill();
  g.strokeStyle = '#25D366'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#14532D'; g.font = '700 30px Poppins'; g.fillText('GRUPO DOS VOLUNTÁRIOS · ENTRADA OBRIGATÓRIA', x, t2 + folga + 30);
  g.font = '400 26px Poppins'; escrever(g, 'Entre pelo botão "Entrar no grupo do WhatsApp", na tela da inscrição.', x, t2 + folga + 74, larguraDoTexto, 36);
  y = t2 + h2 + 70;
  g.fillStyle = COR.mut; g.font = '400 24px Poppins'; g.fillText('ANA Brasil · Natal Feliz 2026', MARGEM, y);

  const final = document.createElement('canvas');
  final.width = LARGURA; final.height = y + 50;
  final.getContext('2d')!.drawImage(rascunho, 0, 0);
  return new Promise((ok, falha) => final.toBlob((b) => (b ? ok(b) : falha(new Error('comprovante_vazio'))), 'image/jpeg', 0.88));
}

/** Celular: menu de compartilhar (salva na galeria). Computador ou sem o menu: download. */
export async function salvarComprovante(d: DadosDoComprovante): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const blob = await desenharComprovante(d);
  const nome = `comprovante-${d.protocolo}.jpg`;
  const arquivo = new File([blob], nome, { type: 'image/jpeg' });
  const celular = window.matchMedia?.('(pointer: coarse)').matches;
  if (celular && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Comprovante · Dia do Voluntariado' });
      return 'compartilhado';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelado';
      // Outro erro do menu: cai no download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}

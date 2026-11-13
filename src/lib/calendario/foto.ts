/**
 * A foto da capa (13/11/2026). Foto de câmera tem 6000 px e 8 MB; no PDF a
 * capa ocupa 842 pt, e 2400 px já sobram para imprimir. Por isso a foto grande
 * é reduzida no navegador antes de subir: o PDF final fica leve.
 */
export type ExtensaoDaFoto = 'jpg' | 'png' | 'webp';

const LARGURA_MAXIMA = 2400;
const LIMITE_BRUTO = 25 * 1024 * 1024;

export function extensaoDaFoto(tipo: string): ExtensaoDaFoto | null {
  if (tipo === 'image/jpeg') return 'jpg';
  if (tipo === 'image/png') return 'png';
  if (tipo === 'image/webp') return 'webp';
  return null;
}

export async function prepararFotoDaCapa(arquivo: File): Promise<{ foto: Blob; extensao: ExtensaoDaFoto }> {
  const extensao = extensaoDaFoto(arquivo.type);
  if (!extensao) throw new Error('Use uma foto em JPG, PNG ou WebP.');
  if (arquivo.size > LIMITE_BRUTO) throw new Error('A foto passa de 25 MB. Use uma menor.');
  const bitmap = await createImageBitmap(arquivo);
  try {
    if (bitmap.width <= LARGURA_MAXIMA && arquivo.size <= 4 * 1024 * 1024) return { foto: arquivo, extensao };
    const escala = Math.min(1, LARGURA_MAXIMA / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const foto: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!foto) throw new Error('Não deu para preparar a foto.');
    return { foto, extensao: 'jpg' };
  } finally {
    bitmap.close();
  }
}

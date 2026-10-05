import { supabase } from '@/integrations/supabase/client';
import type { FotoMedida } from './pdfImagens';
import { caminhoDaFoto } from './caminhoDaFoto';

/**
 * Sobe os recortes das fotos e devolve as medidas com o endereço preenchido.
 *
 * Usa o mesmo balde e a mesma convenção de caminho que o envio manual do
 * Jornal (`ImageBlockField`): `event-attachments`, em `jornal/ano/mês/uuid.jpg`.
 * Nada de infraestrutura nova — se um dia as regras do balde mudarem, mudam
 * para os dois caminhos de uma vez.
 *
 * Falha de uma foto não derruba a importação: aquela peça fica sem imagem e a
 * diretora a coloca à mão, que era o comportamento anterior. Perder o jornal
 * inteiro por causa de um envio seria trocar um problema pequeno por um grande.
 */

/** Quantos envios ao mesmo tempo. Vinte de uma vez sufoca conexão de escola. */
const SIMULTANEOS = 4;

/** Sobe um JPEG e devolve o endereço público, ou null se o envio falhou. */
async function enviarJpeg(arquivo: Blob): Promise<string | null> {
  try {
    const caminho = caminhoDaFoto('jpg');
    const { error } = await supabase.storage
      .from('event-attachments')
      .upload(caminho, arquivo, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from('event-attachments').getPublicUrl(caminho);
    return data.publicUrl;
  } catch {
    return null;
  }
}

async function enviarUma(foto: FotoMedida): Promise<FotoMedida> {
  if (!foto.recorte) return foto;
  const url = await enviarJpeg(foto.recorte);
  return url ? { ...foto, url } : foto;
}

/**
 * Sobe os JPEGs de um esboço (05/10/2026), em lotes, na ordem dada. Cada
 * posição volta com o endereço, ou null para a foto que não subiu.
 * `deveParar` é olhado entre um lote e outro.
 */
export async function enviarJpegs(
  arquivos: Blob[],
  aoProgredir?: (enviadas: number, total: number) => void,
  deveParar?: () => boolean,
): Promise<Array<string | null>> {
  const enderecos: Array<string | null> = [];
  for (let i = 0; i < arquivos.length; i += SIMULTANEOS) {
    if (deveParar?.()) break;
    enderecos.push(...(await Promise.all(arquivos.slice(i, i + SIMULTANEOS).map(enviarJpeg))));
    aoProgredir?.(enderecos.length, arquivos.length);
  }
  return enderecos;
}

/**
 * Sobe todos os recortes, em lotes.
 *
 * A ordem da lista é preservada, porque é ela que casa cada foto com o seu
 * encaixe no jornal — ver `arranjarImagens`.
 */
export async function enviarRecortes(
  fotos: FotoMedida[],
  aoProgredir?: (enviadas: number, total: number) => void,
): Promise<FotoMedida[]> {
  const comRecorte = fotos.filter((f) => f.recorte).length;
  if (!comRecorte) return fotos;

  const resultado: FotoMedida[] = [];
  let enviadas = 0;

  for (let i = 0; i < fotos.length; i += SIMULTANEOS) {
    const lote = await Promise.all(fotos.slice(i, i + SIMULTANEOS).map(enviarUma));
    resultado.push(...lote);
    enviadas += lote.filter((f) => f.recorte).length;
    aoProgredir?.(Math.min(enviadas, comRecorte), comRecorte);
  }

  return resultado;
}

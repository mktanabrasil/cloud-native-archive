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

async function enviarUma(foto: FotoMedida): Promise<FotoMedida> {
  if (!foto.recorte) return foto;

  try {
    const caminho = caminhoDaFoto('jpg');
    const { error } = await supabase.storage
      .from('event-attachments')
      .upload(caminho, foto.recorte, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from('event-attachments').getPublicUrl(caminho);
    return { ...foto, url: data.publicUrl };
  } catch {
    return foto;
  }
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

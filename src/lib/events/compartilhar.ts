import type { AppEvent } from '@/types';
import { tituloEmTexto } from './titulo';
import { textoDaData, textoDoHorario } from './periodo';

/**
 * A mensagem que sai pelo botão do WhatsApp.
 *
 * Até 10/09/2026 ela levava só "Confira este evento: título" e o link. A data
 * e o local, que são o que a família quer saber, ficavam para depois do
 * clique. Agora vão na mensagem, uma informação por linha, e o link por
 * último — o WhatsApp monta o cartão a partir dele.
 */
type Evento = Pick<AppEvent, 'title' | 'start_datetime' | 'end_datetime' | 'location'>;

export function textoDoWhatsApp(evento: Evento, link: string): string {
  const linhas = [
    tituloEmTexto(evento.title),
    `${textoDaData(evento)} · ${textoDoHorario(evento)}`,
    evento.location?.trim() || null,
    link,
  ];
  return linhas.filter((l): l is string => !!l).join('\n');
}

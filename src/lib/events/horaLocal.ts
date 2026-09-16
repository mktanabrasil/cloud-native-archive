import { format } from 'date-fns';

/**
 * Converte a data do banco para o valor de um campo `datetime-local`.
 *
 * O campo fala hora **local**: "2025-07-31T08:00" quer dizer oito da manhã
 * onde a pessoa está. O banco fala UTC. Antes a conversão era
 * `toISOString().slice(0, 16)`, que devolve UTC — em Brasília, um evento das
 * 08:00 abria como 11:00. E, ao salvar, `new Date("…T11:00")` lia 11:00
 * local e gravava 14:00Z: **cada edição adiantava o evento em 3 horas**, sem
 * ninguém tocar nas datas. Reproduzido em 03/09/2026.
 *
 * Aqui a ida usa a hora local, que é a mesma que a volta (`new Date(valor)`)
 * vai ler. Abrir e salvar sem mexer devolve a mesma data.
 */
export function paraCampoDataHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/**
 * "GMT−3", "GMT+1", "GMT" — o fuso em que o campo está sendo lido.
 * (A tela mostra "Horário de Brasília" quando é GMT−3; ver EventFormDialog.)
 *
 * Aparece embaixo das datas para quem edita de outro estado (ou de outro
 * país) saber em que relógio o horário está.
 */
/**
 * A frase embaixo das datas. Em Brasília, que é onde a ANA está, ninguém
 * precisa ler "GMT−3": vira "Horário de Brasília.". Só quem preenche de outro
 * fuso vê o deslocamento (decisão da varredura de 16/09/2026).
 */
export function fraseDoFuso(data: Date = new Date()): string {
  const r = rotuloDoFuso(data);
  return r === 'GMT−3' ? 'Horário de Brasília.' : `Horários no fuso deste computador (${r}).`;
}

export function rotuloDoFuso(data: Date = new Date()): string {
  const minutos = -data.getTimezoneOffset();
  if (minutos === 0) return 'GMT';
  const sinal = minutos > 0 ? '+' : '−';
  const horas = Math.floor(Math.abs(minutos) / 60);
  const resto = Math.abs(minutos) % 60;
  return `GMT${sinal}${horas}${resto ? `:${String(resto).padStart(2, '0')}` : ''}`;
}

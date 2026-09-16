import type { EventType } from '@/types';

/**
 * O tipo do evento é gravado em minúsculo ("evento institucional"). Na tela,
 * só a primeira letra sobe: "Evento institucional", e não "Evento
 * Institucional" como fazia o `capitalize` do CSS (miudeza da varredura de
 * 16/09/2026). Vale para o seletor, o painel de detalhe e o selo público.
 */
export function rotuloDoTipo(tipo: EventType | string | null | undefined): string {
  if (!tipo) return '';
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

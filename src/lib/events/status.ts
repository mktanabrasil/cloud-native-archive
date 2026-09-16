import type { EventStatus } from '@/types';

/**
 * Um nome só para cada status, em todas as telas (varredura de 16/09/2026).
 * O valor gravado continua em minúsculo e sem acento (`concluido`); o que a
 * pessoa lê é isto. "pendente" vira "Aguardando aprovação" porque é o que ele
 * significa: o evento está na fila da administração geral.
 */
export const ROTULO_DO_STATUS: Record<EventStatus, string> = {
  pendente: 'Aguardando aprovação',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
};

/** Tolerante a valores fora da lista (dado antigo, filtro "todos"): devolve o próprio texto. */
export function rotuloDoStatus(status: string | null | undefined): string {
  if (!status) return '';
  return (ROTULO_DO_STATUS as Record<string, string>)[status] ?? status;
}

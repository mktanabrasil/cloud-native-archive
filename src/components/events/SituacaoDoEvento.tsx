import type { ReactNode } from 'react';
import { rotuloDoStatus } from '@/lib/events/status';
import { cn } from '@/lib/utils';

/**
 * Esboço V2: a situação do evento em texto com bolinha, no lugar da pílula
 * colorida de `getStatusBadgeClass`. As cores são tokens de TEXTO (≥4,5:1) e
 * têm par escuro. Com conflito, o que pesa é o conflito.
 */
function corDaSituacao(status: string, comConflito = false): string {
  if (comConflito) return 'text-destructive';
  switch (status) {
    case 'confirmado': return 'text-success';
    case 'pendente': return 'text-warning';
    case 'cancelado': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

interface Props {
  status: string;
  comConflito?: boolean;
  /** Texto no lugar do rótulo do status (ex.: "Com conflito"). */
  texto?: string;
  className?: string;
}

export function SituacaoDoEvento({ status, comConflito = false, texto, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold', corDaSituacao(status, comConflito), className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {texto ?? rotuloDoStatus(status)}
    </span>
  );
}

/** Texto com bolinha para qualquer situação que não seja o status do evento. */
export function TextoComBolinha({ cor = 'text-muted-foreground', className, children }: { cor?: string; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-semibold', cor, className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

export default SituacaoDoEvento;

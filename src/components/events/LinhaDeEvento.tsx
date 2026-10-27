import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { SituacaoDoEvento } from './SituacaoDoEvento';

/**
 * Esboço V2: uma linha de evento para as janelas de lista (conflitos,
 * filtrados, eventos da unidade). Data em destaque à esquerda, título, meta
 * com o ponto da unidade e a situação em texto com bolinha à direita. Vai
 * dentro de `ListaDeEventos`, que dá a caixa e as linhas divisórias.
 */
export function LinhaDeEvento({
  evento,
  onClick,
  meta,
  extra,
  comConflito = false,
}: {
  evento: AppEvent;
  onClick: () => void;
  /** O que vem depois da unidade na linha de baixo. Padrão: horário e local. */
  meta?: ReactNode;
  /** Uma terceira linha, opcional (marketing, parceiros). */
  extra?: ReactNode;
  comConflito?: boolean;
}) {
  const inicio = new Date(evento.start_datetime);
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-border/70 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:px-4"
    >
      <span className="grid justify-items-center self-start leading-none sm:self-center">
        <span className="font-display text-xl font-bold tabular-nums text-foreground">{format(inicio, 'dd')}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{format(inicio, 'MMM', { locale: ptBR }).replace('.', '')}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{evento.title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[evento.unit]}`} />
          <span className="truncate">
            {evento.unit} · {meta ?? <>{format(inicio, 'HH:mm')}–{format(new Date(evento.end_datetime), 'HH:mm')}{evento.location ? ` · ${evento.location}` : ''}</>}
          </span>
        </span>
        {extra}
      </span>
      <span className="col-start-2 sm:col-start-auto">
        <SituacaoDoEvento status={evento.status} comConflito={comConflito} />
      </span>
    </button>
  );
}

export function ListaDeEventos({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

export default LinhaDeEvento;

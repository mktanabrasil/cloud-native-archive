import { useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppEvent, UNIT_BG_COLORS, Unit, eventUnitLabel } from '@/types';
import { tituloEmTexto } from '@/lib/events/titulo';
import { Card } from '@/components/ui/card';

/**
 * O que as unidades enviaram e a administração geral ainda não revisou.
 *
 * Um pedido é um evento `pendente` com `submitted_at` — a gestora enviou. Um
 * `pendente` sem `submitted_at` é rascunho do próprio admin, e não entra.
 * A lista não olha o mês selecionado: o que falta aprovar falta hoje, seja
 * de quando for.
 */
export function pedidosPendentes(eventos: AppEvent[]): AppEvent[] {
  return eventos
    .filter(e => e.status === 'pendente' && !!e.submitted_at && !e.deleted_at)
    .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime());
}

interface Props {
  eventos: AppEvent[];
  onRevisar: (evento: AppEvent) => void;
}

export function AprovacoesPendentes({ eventos, onRevisar }: Props) {
  const pedidos = useMemo(() => pedidosPendentes(eventos), [eventos]);
  if (pedidos.length === 0) return null;

  /* Esboço V2: o bloco "Pede atenção". Título de bloco, a contagem em texto
     com bolinha, e uma linha por pedido com nome, motivo e o link "Revisar". */
  return (
    <Card className="overflow-hidden" data-testid="aprovacoes-pendentes">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <h2 className="text-[15px] font-semibold text-foreground">Pede atenção</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-warning">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          {pedidos.length === 1 ? '1 aguardando aprovação' : `${pedidos.length} aguardando aprovação`}
        </span>
      </div>

      <ul>
        {pedidos.map(e => (
          <li
            key={e.id}
            className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-b-0 sm:px-5 sm:py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{tituloEmTexto(e.title)}</p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground sm:text-[13px]">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[e.unit as Unit] ?? 'bg-muted-foreground'}`} />
                {eventUnitLabel(e.unit)} · {format(new Date(e.start_datetime), "d MMM, HH:mm", { locale: ptBR })} · enviado por{' '}
                {e.created_by || 'a unidade'}{' '}
                {formatDistanceToNow(new Date(e.submitted_at!), { locale: ptBR, addSuffix: true })}
              </p>
            </div>
            <button
              type="button"
              className="h-11 shrink-0 rounded-xl px-2 text-[13px] font-semibold text-[hsl(var(--sel))] transition-colors hover:bg-muted hover:underline hover:underline-offset-4 sm:h-8"
              onClick={() => onRevisar(e)}
            >
              Revisar
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default AprovacoesPendentes;

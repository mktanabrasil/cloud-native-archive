import { useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { AppEvent, eventUnitLabel } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

  return (
    <Card className="border-warning/50">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Aprovações pendentes</h2>
          </div>
          <Badge variant="outline" className="border-warning/60 bg-warning/15 text-foreground">
            {pedidos.length === 1 ? '1 aguardando aprovação' : `${pedidos.length} aguardando aprovação`}
          </Badge>
        </div>

        <ul className="space-y-1.5 sm:space-y-2">
          {pedidos.map(e => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-lg border border-border border-l-4 border-l-warning bg-card p-2.5 sm:p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground sm:text-sm">{e.title}</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  {eventUnitLabel(e.unit)} · {format(new Date(e.start_datetime), "d MMM, HH:mm", { locale: ptBR })} · enviado por{' '}
                  {e.created_by || 'a unidade'}{' '}
                  {formatDistanceToNow(new Date(e.submitted_at!), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
              <Button size="sm" className="h-8 shrink-0" onClick={() => onRevisar(e)}>
                Revisar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default AprovacoesPendentes;

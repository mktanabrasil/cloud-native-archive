import { useMemo } from 'react';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { rotuloDoStatus } from '@/lib/events/status';
import { AppEvent, Unit } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';


const unitBadgeColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic text-primary-foreground',
  'Nilópolis': 'bg-unit-nilopolis text-primary-foreground',
  'Santana': 'bg-unit-santana text-primary-foreground',
  'Administração': 'bg-unit-geral text-primary-foreground',
};

interface Props {
  unit: Unit | null;
  events: AppEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventClick: (event: AppEvent) => void;
}

export default function UnitEventsDialog({ unit, events, open, onOpenChange, onEventClick }: Props) {
  const unitEvents = useMemo(() => {
    if (!unit) return [];
    return events
      .filter(e => e.unit === unit)
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
  }, [events, unit]);

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className={unitBadgeColors[unit]}>{unit}</Badge>
            <span>Eventos ({unitEvents.length})</span>
          </DialogTitle>
        </DialogHeader>

        {unitEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento para esta unidade</p>
        ) : (
          <div className="space-y-2">
            {unitEvents.map(e => {
              const statusClass = getStatusBadgeClass(e.status, e.has_conflict);
              return (
                <button
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground truncate">{e.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      
                      <Badge variant="outline" className={`text-xs ${statusClass}`}>{rotuloDoStatus(e.status)}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(e.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {e.location}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

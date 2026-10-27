import { useMemo } from 'react';
import { AppEvent, UNIT_BG_COLORS, Unit } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LinhaDeEvento, ListaDeEventos } from '@/components/events/LinhaDeEvento';



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
          {/* Esboço V2: o ponto da unidade ao lado do nome, no lugar do selo colorido. */}
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[unit]}`} />
            <span>{unit}</span>
            <span className="font-normal text-muted-foreground">· Eventos <span className="tabular-nums">({unitEvents.length})</span></span>
          </DialogTitle>
        </DialogHeader>

        {unitEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento para esta unidade</p>
        ) : (
          <ListaDeEventos>
            {unitEvents.map(e => (
              <LinhaDeEvento
                key={e.id}
                evento={e}
                comConflito={e.has_conflict}
                onClick={() => onEventClick(e)}
                meta={<>{format(new Date(e.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}{e.location ? ` · ${e.location}` : ''}</>}
              />
            ))}
          </ListaDeEventos>
        )}
      </DialogContent>
    </Dialog>
  );
}

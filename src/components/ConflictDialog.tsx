import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppEvent, Unit } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LinhaDeEvento, ListaDeEventos } from '@/components/events/LinhaDeEvento';

const unitDotColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic',
  'Nilópolis': 'bg-unit-nilopolis',
  'Santana': 'bg-unit-santana',
  'Administração': 'bg-unit-geral',
};

interface Props {
  events: AppEvent[];
  selectedMonth: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventClick: (event: AppEvent) => void;
}

export default function ConflictDialog({ events, selectedMonth, open, onOpenChange, onEventClick }: Props) {
  const navigate = useNavigate();

  const conflictEvents = useMemo(() =>
    events.filter(e => e.has_conflict).sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()),
    [events]
  );

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const conflictDates = useMemo(() => {
    const dates = new Set<string>();
    conflictEvents.forEach(e => {
      dates.add(format(new Date(e.start_datetime), 'yyyy-MM-dd'));
    });
    return dates;
  }, [conflictEvents]);

  const getEventsForDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start_datetime), day));

  const handleOpenFullCalendar = () => {
    onOpenChange(false);
    navigate('/calendario?conflitos=true');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Eventos com Conflito <span className="tabular-nums text-destructive">({conflictEvents.length})</span>
          </DialogTitle>
        </DialogHeader>

        {/* Esboço V2: lista em linhas com a data em destaque, e o mês ao lado
            com os dias de conflito marcados. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-[15px] font-semibold text-foreground">Lista de Conflitos</h3>
            {conflictEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento com conflito</p>
            ) : (
              <ListaDeEventos className="max-h-[55vh] overflow-y-auto">
                {conflictEvents.map(e => (
                  <LinhaDeEvento
                    key={e.id}
                    evento={e}
                    comConflito={e.has_conflict}
                    onClick={() => onEventClick(e)}
                    meta={<>{format(new Date(e.start_datetime), 'HH:mm')}–{format(new Date(e.end_datetime), 'HH:mm')} · {e.visibility === 'publico' ? 'Público' : 'Interno'}{e.location ? ` · ${e.location}` : ''}</>}
                  />
                ))}
              </ListaDeEventos>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-foreground">
                Calendário — <span className="capitalize">{format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</span>
              </h3>
              <Button variant="outline" size="sm" className="text-xs" onClick={handleOpenFullCalendar}>
                Tela cheia
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid grid-cols-7 text-center">
                {dayNames.map((d, i) => (
                  <div key={d} className={`border-b border-border/70 p-1.5 text-[11px] font-semibold text-muted-foreground ${i > 0 ? 'border-l' : ''}`}>{d}</div>
                ))}
                {days.map((day, i) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, selectedMonth);
                  const isToday = isSameDay(day, new Date());
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const hasConflict = conflictDates.has(dateStr);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[60px] min-w-0 border-border/70 p-1 text-left ${i % 7 !== 0 ? 'border-l' : ''} ${i < days.length - 7 ? 'border-b' : ''} ${!isCurrentMonth ? 'bg-muted/40' : ''} ${hasConflict ? 'bg-destructive/[0.07] animate-conflict-pulse' : ''}`}
                    >
                      <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-0.5 text-[10px] font-semibold tabular-nums ${isToday ? 'bg-foreground text-background' : hasConflict ? 'text-destructive' : isCurrentMonth ? 'text-foreground' : 'text-[hsl(var(--fraco,0_0%_45%))]'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map(e => (
                          <div
                            key={e.id}
                            className={`flex items-center gap-0.5 rounded px-0.5 py-px text-[8px] leading-tight ${e.has_conflict ? 'bg-destructive/15' : ''}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unitDotColors[e.unit]}`} />
                            <span className={`truncate ${e.has_conflict ? 'text-destructive' : 'text-foreground'}`}>{e.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="block text-center text-[8px] text-muted-foreground">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

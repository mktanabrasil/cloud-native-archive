import { useMemo } from 'react';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { rotuloDoStatus } from '@/lib/events/status';
import { useNavigate } from 'react-router-dom';
import { AppEvent, Unit } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Maximize2, Globe, Lock } from 'lucide-react';

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
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Eventos com Conflito ({conflictEvents.length})
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Conflict list */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Lista de Conflitos</h3>
            {conflictEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento com conflito</p>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {conflictEvents.map(e => {
                  const statusClass = getStatusBadgeClass(e.status, e.has_conflict);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onEventClick(e)}
                      className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:bg-destructive/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${unitDotColors[e.unit]}`} />
                          {e.visibility === 'publico' ? (
                            <Globe className="h-3 w-3 text-info shrink-0" />
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <p className="font-medium text-foreground truncate">{e.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          <Badge variant="outline" className={`text-xs ${statusClass}`}>{rotuloDoStatus(e.status)}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(e.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {format(new Date(e.end_datetime), 'HH:mm')} · {e.unit}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.location}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Mini calendar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Calendário — <span className="capitalize">{format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</span>
              </h3>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpenFullCalendar}>
                <Maximize2 className="h-3.5 w-3.5" /> Tela cheia
              </Button>
            </div>
            <div className="rounded-lg border border-border p-2">
              <div className="grid grid-cols-7 text-center">
                {dayNames.map(d => (
                  <div key={d} className="p-1.5 text-[10px] font-semibold text-muted-foreground">{d}</div>
                ))}
                {days.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, selectedMonth);
                  const isToday = isSameDay(day, new Date());
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const hasConflict = conflictDates.has(dateStr);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[60px] border border-border p-1 ${!isCurrentMonth ? 'opacity-30' : ''} ${isToday ? 'bg-primary/5' : ''} ${hasConflict ? 'bg-destructive/10 border-destructive/30 animate-conflict-pulse' : ''}`}
                    >
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isToday ? 'bg-primary text-primary-foreground' : hasConflict ? 'bg-destructive text-destructive-foreground' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map(e => (
                          <div
                            key={e.id}
                            className={`flex items-center gap-0.5 rounded px-0.5 py-px text-[8px] leading-tight ${e.has_conflict ? 'bg-destructive/20 text-destructive' : ''}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unitDotColors[e.unit]}`} />
                            <span className="truncate text-foreground">{e.title}</span>
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

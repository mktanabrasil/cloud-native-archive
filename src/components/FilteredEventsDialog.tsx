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
  filterType: 'marketing' | 'partners' | 'confirmed' | 'pending';
  selectedMonth?: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventClick: (event: AppEvent) => void;
}

export default function FilteredEventsDialog({ events, filterType, selectedMonth, open, onOpenChange, onEventClick }: Props) {
  const navigate = useNavigate();
  const hasCalendar = filterType === 'confirmed' || filterType === 'pending';
  const month = selectedMonth || new Date();

  const filtered = useMemo(() => events
    .filter(e => {
      if (filterType === 'marketing') return e.marketing_request;
      if (filterType === 'partners') return e.partner_involved;
      if (filterType === 'confirmed') return e.status === 'confirmado';
      if (filterType === 'pending') return e.status === 'pendente';
      return false;
    })
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()),
    [events, filterType]
  );

  const config = {
    marketing: { title: 'Eventos com Cobertura de Marketing', color: 'text-foreground', bgColor: '', pulseClass: '' },
    partners: { title: 'Eventos com Parceiros', color: 'text-foreground', bgColor: '', pulseClass: '' },
    confirmed: { title: 'Eventos Confirmados', color: 'text-success', bgColor: 'bg-success/[0.07]', pulseClass: 'animate-confirmed-pulse' },
    pending: { title: 'Eventos Pendentes', color: 'text-warning', bgColor: 'bg-warning/[0.07]', pulseClass: 'animate-pending-pulse' },
  }[filterType];

  const { title, color, bgColor, pulseClass } = config;

  // Calendar data
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const highlightDates = useMemo(() => {
    const dates = new Set<string>();
    filtered.forEach(e => dates.add(format(new Date(e.start_datetime), 'yyyy-MM-dd')));
    return dates;
  }, [filtered]);

  const getEventsForDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start_datetime), day));

  const handleOpenFullCalendar = () => {
    onOpenChange(false);
    // A equipe usa o Calendário como aba do hub; a rota solta perdia as abas.
    navigate('/?tela=calendario');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={hasCalendar ? 'sm:max-w-4xl max-h-[85vh] overflow-y-auto' : 'sm:max-w-lg max-h-[85vh] overflow-y-auto'}>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {title} <span className={`tabular-nums ${filtered.length > 0 ? color : 'text-muted-foreground'}`}>({filtered.length})</span>
          </DialogTitle>
        </DialogHeader>

        {/* Esboço V2: lista em linhas com a data em destaque; nos confirmados e
            pendentes, o mês ao lado com os dias marcados. */}
        <div className={hasCalendar ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : ''}>
          <div>
            {hasCalendar && <h3 className="mb-3 text-[15px] font-semibold text-foreground">Lista de Eventos</h3>}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado</p>
            ) : (
              <ListaDeEventos className="max-h-[55vh] overflow-y-auto">
                {filtered.map(e => (
                  <LinhaDeEvento
                    key={e.id}
                    evento={e}
                    comConflito={e.has_conflict}
                    onClick={() => onEventClick(e)}
                    extra={(e.marketing_request || e.partner_involved) ? (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {e.marketing_request && <span className="font-semibold text-foreground">Marketing</span>}
                        {e.marketing_request && e.partner_involved && ' · '}
                        {e.partner_involved && (
                          <>
                            <span className="font-semibold text-foreground">Parceiros:</span>{' '}
                            {(e.partners || []).length > 0
                              ? e.partners.map(p => p.name).filter(Boolean).join(', ')
                              : e.partner_name || 'Parceiro'}
                          </>
                        )}
                      </span>
                    ) : undefined}
                  />
                ))}
              </ListaDeEventos>
            )}
          </div>

          {hasCalendar && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-foreground">
                  Calendário — <span className="capitalize">{format(month, 'MMMM yyyy', { locale: ptBR })}</span>
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
                    const isCurrentMonth = isSameMonth(day, month);
                    const isToday = isSameDay(day, new Date());
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isHighlighted = highlightDates.has(dateStr);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[60px] min-w-0 border-border/70 p-1 text-left ${i % 7 !== 0 ? 'border-l' : ''} ${i < days.length - 7 ? 'border-b' : ''} ${!isCurrentMonth ? 'bg-muted/40' : ''} ${isHighlighted ? `${bgColor} ${pulseClass}` : ''}`}
                      >
                        <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-0.5 text-[10px] font-semibold tabular-nums ${isToday ? 'bg-foreground text-background' : isHighlighted ? color : isCurrentMonth ? 'text-foreground' : 'text-[hsl(var(--fraco,0_0%_45%))]'}`}>
                          {format(day, 'd')}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayEvents.slice(0, 2).map(ev => (
                            <div
                              key={ev.id}
                              className="flex items-center gap-0.5 rounded px-0.5 py-px text-[8px] leading-tight"
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unitDotColors[ev.unit]}`} />
                              <span className={`truncate ${isHighlighted && (ev.status === (filterType === 'confirmed' ? 'confirmado' : 'pendente')) ? `font-semibold ${color}` : 'text-foreground'}`}>{ev.title}</span>
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

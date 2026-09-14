import { useMemo } from 'react';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { useNavigate } from 'react-router-dom';
import { AppEvent, PARTNER_TYPES, Unit } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Handshake, Users, CheckCircle2, Clock, Maximize2 } from 'lucide-react';

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
    marketing: { title: 'Eventos com Cobertura de Marketing', Icon: Camera, color: 'text-primary', bgColor: '', borderColor: '', pulseClass: '' },
    partners: { title: 'Eventos com Parceiros', Icon: Handshake, color: 'text-primary', bgColor: '', borderColor: '', pulseClass: '' },
    confirmed: { title: 'Eventos Confirmados', Icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30', pulseClass: 'animate-confirmed-pulse' },
    pending: { title: 'Eventos Pendentes', Icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30', pulseClass: 'animate-pending-pulse' },
  }[filterType];

  const { title, Icon, color, bgColor, borderColor, pulseClass } = config;

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
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className={`h-5 w-5 ${color}`} />
            {title} ({filtered.length})
          </DialogTitle>
        </DialogHeader>

        <div className={hasCalendar ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : ''}>
          {/* Event list */}
          <div className="space-y-2">
            {hasCalendar && <h3 className="text-sm font-semibold text-muted-foreground mb-3">Lista de Eventos</h3>}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado</p>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {filtered.map(e => {
                  const statusClass = getStatusBadgeClass(e.status, e.has_conflict);
                  const itemBorder = hasCalendar ? `${borderColor} ${bgColor}` : 'border-border';
                  return (
                    <button
                      key={e.id}
                      onClick={() => onEventClick(e)}
                      className={`w-full rounded-lg border ${itemBorder} p-3 text-left transition-colors hover:bg-accent`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${unitDotColors[e.unit]}`} />
                          <p className="font-medium text-foreground truncate">{e.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`capitalize text-xs ${statusClass}`}>{e.status}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(e.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {format(new Date(e.end_datetime), 'HH:mm')} · {e.unit}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        {e.marketing_request && (
                          <span className="flex items-center gap-1 text-[10px] text-primary">
                            <Camera className="h-3 w-3" /> Marketing
                          </span>
                        )}
                        {e.partner_involved && (
                          <span className="flex items-center gap-1 text-[10px] text-primary">
                            <Users className="h-3 w-3" />
                            {(e.partners || []).length > 0
                              ? e.partners.map(p => p.name).filter(Boolean).join(', ')
                              : e.partner_name || 'Parceiro'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Calendar sidebar for confirmed/pending */}
          {hasCalendar && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Calendário — <span className="capitalize">{format(month, 'MMMM yyyy', { locale: ptBR })}</span>
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
                    const isCurrentMonth = isSameMonth(day, month);
                    const isToday = isSameDay(day, new Date());
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isHighlighted = highlightDates.has(dateStr);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[60px] border border-border p-1 ${!isCurrentMonth ? 'opacity-30' : ''} ${isToday ? 'bg-primary/5' : ''} ${isHighlighted ? `${bgColor} ${borderColor} ${pulseClass}` : ''}`}
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isToday ? 'bg-primary text-primary-foreground' : isHighlighted ? (filterType === 'confirmed' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground') : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayEvents.slice(0, 2).map(ev => (
                            <div
                              key={ev.id}
                              className={`flex items-center gap-0.5 rounded px-0.5 py-px text-[8px] leading-tight ${isHighlighted && (ev.status === (filterType === 'confirmed' ? 'confirmado' : 'pendente')) ? `${bgColor}` : ''}`}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unitDotColors[ev.unit]}`} />
                              <span className="truncate text-foreground">{ev.title}</span>
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

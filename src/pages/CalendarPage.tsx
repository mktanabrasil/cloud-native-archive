import { useState, useMemo, useCallback, useEffect, useRef, DragEvent } from 'react';
import { toast } from 'sonner';
import { diasDoEvento, eDiaDeFim, eDiaDeInicio, ocorreNoDia } from '@/lib/events/diasDoEvento';
import { executarEmLote, textoDoLote, FRASES_LIXEIRA, frasesDeStatus } from '@/lib/events/lote';
import { tituloEmTexto } from '@/lib/events/titulo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSearchParams } from 'react-router-dom';
import { AppEvent, EventStatus, UNITS, EVENT_STATUSES, EVENT_TYPES, Unit } from '@/types';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, LayoutGrid, Search, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import EventFormDialog from '@/components/EventFormDialog';
import EventDetailPanel from '@/components/EventDetailPanel';
import BulkActionBar from '@/components/BulkActionBar';
import PageHeader from '@/components/PageHeader';
import { EsqueletoDoCalendario } from '@/components/events/EsqueletoDeEventos';
import PageGuide from '@/components/PageGuide';

const unitDotColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic',
  'Nilópolis': 'bg-unit-nilopolis',
  'Santana': 'bg-unit-santana',
  'Administração': 'bg-unit-geral',
};

const unitBorderColors: Record<Unit, string> = {
  'DIC': 'border-l-unit-dic',
  'Nilópolis': 'border-l-unit-nilopolis',
  'Santana': 'border-l-unit-santana',
  'Administração': 'border-l-unit-geral',
};

type View = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const { events: rawEvents, selectedMonth, setSelectedMonth, setSelectedEvent, deleteEvent, updateEvent, detectConflicts, loading, refetchEvents } = useApp();
  const events = useFilteredEvents();
  const { isAuthenticated } = useAuth();
  const { canEdit, canCreate, userName, unit } = useUserRole();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const hideTitle = searchParams.get('hideTitle') === 'true';
  const [view, setViewState] = useState<View>('month');
  /**
   * No celular a grade do mês são sete colunas de 48 px com texto de 8 px.
   * A Lista já existe e se lê: é a visão inicial abaixo de 768 px. Só até a
   * pessoa escolher outra — a escolha dela prevalece na sessão.
   */
  const escolheuVisao = useRef(false);
  const setView = (v: View) => { escolheuVisao.current = true; setViewState(v); };
  useEffect(() => {
    if (isMobile && !escolheuVisao.current) setViewState('list');
  }, [isMobile]);
  const [filterUnit, setFilterUnit] = useState<string>('all');

  // Sync filter unit with user unit when it changes (useful for test mode)
  useEffect(() => {
    if (unit && unit !== 'Administração') {
      setFilterUnit(unit);
    } else {
      setFilterUnit('all');
    }
  }, [unit]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [conflictOnly, setConflictOnly] = useState(false);
  const [highlightConflicts, setHighlightConflicts] = useState(false);

  useEffect(() => {
    if (searchParams.get('conflitos') === 'true') {
      setConflictOnly(true);
      setHighlightConflicts(true);
      setSearchParams({}, { replace: true });
      const timer = setTimeout(() => setHighlightConflicts(false), 30000);
      return () => clearTimeout(timer);
    }
  }, []);

  const [detailEvent, setDetailEvent] = useState<AppEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const toggleEventSelection = (id: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    const alvos = events.filter(e => selectedEvents.has(e.id));
    if (alvos.length > 0) setParaLixeira(alvos);
  };

  /**
   * As gravações rodam juntas e a lista recarrega uma vez. Antes eram N
   * chamadas sem `await` nem `catch`: rejeições soltas no console, N
   * refetches em paralelo, e a barra sumia como se tudo tivesse dado certo.
   */
  const handleBulkStatusChange = async (status: EventStatus) => {
    const alvos = events.filter(e => selectedEvents.has(e.id));
    const r = await executarEmLote(alvos.map(a => a.id), id => {
      const e = alvos.find(a => a.id === id)!;
      return updateEvent({ ...e, status, updated_at: new Date().toISOString(), updated_by: userName || 'Usuário' }, { emLote: true });
    });
    const t = textoDoLote(r, frasesDeStatus(status));
    (t.tudoRecusado ? toast.error : toast.success)(t.titulo, { description: t.descricao });
    setSelectedEvents(new Set(r.recusados));
    await refetchEvents();
  };

  const filtered = useMemo(() => {
    return events.filter(e => {
      // Lixeira fica de fora: para o admin o banco não filtra `deleted_at`.
      if (e.deleted_at) return false;
      if (filterUnit !== 'all' && e.unit !== filterUnit) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterType !== 'all' && e.event_type !== filterType) return false;
      if (conflictOnly && !e.has_conflict) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.location.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, filterUnit, filterStatus, filterType, conflictOnly, search]);

  const conflictDates = useMemo(() => {
    const dates = new Set<string>();
    events.filter(e => e.has_conflict && !e.deleted_at).forEach(e => {
      dates.add(format(new Date(e.start_datetime), 'yyyy-MM-dd'));
    });
    return dates;
  }, [events]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekStart = startOfWeek(selectedMonth, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedMonth, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleEventClick = (event: AppEvent) => {
    setDetailEvent(event);
    setShowDetail(true);
  };

  const handleEdit = (event: AppEvent) => {
    setShowDetail(false);
    setSelectedEvent(event);
    setEditingEvent(event);
    setShowForm(true);
  };

  /**
   * Excluir pergunta antes. A lixeira do painel de detalhe e o botão da barra
   * de seleção agiam no primeiro clique; "excluir" aqui é mover para a
   * lixeira, e o diálogo diz isso com as palavras certas.
   */
  const [paraLixeira, setParaLixeira] = useState<AppEvent[] | null>(null);
  const handleDelete = (id: string) => {
    const alvo = events.find(e => e.id === id);
    setShowDetail(false);
    if (alvo) setParaLixeira([alvo]);
  };
  const confirmarLixeira = async () => {
    const alvos = paraLixeira || [];
    setParaLixeira(null);
    if (alvos.length === 1) {
      try { await deleteEvent(alvos[0].id); } catch { /* o contexto já avisou */ }
      return;
    }
    const r = await executarEmLote(alvos.map(a => a.id), id => deleteEvent(id, { emLote: true }));
    const t = textoDoLote(r, FRASES_LIXEIRA);
    (t.tudoRecusado ? toast.error : toast.success)(t.titulo, { description: t.descricao });
    // o que o banco recusou fica selecionado, para a pessoa ver quais foram
    setSelectedEvents(new Set(r.recusados));
    await refetchEvents();
  };

  const handleDragStart = useCallback((e: DragEvent<HTMLElement>, event: AppEvent) => {
    e.dataTransfer.setData('text/plain', event.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLElement>, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    const eventId = e.dataTransfer.getData('text/plain');
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    const oldStart = new Date(event.start_datetime);
    const oldEnd = new Date(event.end_datetime);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(targetDate);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
    const newEnd = new Date(newStart.getTime() + durationMs);

    const updatedEvent: AppEvent = {
      ...event,
      start_datetime: newStart.toISOString(),
      end_datetime: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userName || 'Usuário'
    };

    updateEvent(updatedEvent);
  }, [events, updateEvent, userName]);

  const prev = () => setSelectedMonth(view === 'week'
    ? new Date(selectedMonth.getTime() - 7 * 86400000)
    : subMonths(selectedMonth, 1));
  const next = () => setSelectedMonth(view === 'week'
    ? new Date(selectedMonth.getTime() + 7 * 86400000)
    : addMonths(selectedMonth, 1));

  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Um evento de vários dias entra em cada dia que atravessa (ver diasDoEvento.ts).
  const getEventsForDay = (day: Date) => filtered.filter(e => ocorreNoDia(e, day));

  // Uma grade em branco parecia um mês sem eventos. O esqueleto (todos os
  // hooks já rodaram acima) diz que ainda está carregando.
  if (loading) return <EsqueletoDoCalendario />;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={hideTitle ? "" : "Calendário de Eventos"}
        description={hideTitle ? "" : "Visualize e gerencie a programação em formato de calendário"}
        hidden={hideTitle}
        className="mb-4"
        actions={
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 w-full">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 shadow-sm h-10">
                <button onClick={prev} aria-label={view === 'week' ? 'Semana anterior' : 'Mês anterior'} className="p-1 hover:bg-accent rounded transition-colors"><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-center gap-1.5 rounded px-2 py-0.5 hover:bg-accent transition-colors min-w-[120px] sm:min-w-[160px]">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium capitalize text-foreground">
                        {view === 'week'
                          ? `${format(weekStart, 'dd MMM', { locale: ptBR })} - ${format(weekEnd, 'dd MMM yyyy', { locale: ptBR })}`
                          : format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      defaultMonth={selectedMonth}
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <button onClick={next} aria-label={view === 'week' ? 'Próxima semana' : 'Próximo mês'} className="p-1 hover:bg-accent rounded transition-colors"><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedMonth(new Date())}
                className="h-10 px-3 shadow-sm border-muted-foreground/20 bg-background"
              >
                Hoje
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Tabs value={view} onValueChange={(v) => setView(v as View)} className="w-full sm:w-auto">
                <TabsList className="h-10">
                  <TabsTrigger value="month" className="gap-1.5 h-8">
                    <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Mês</span>
                  </TabsTrigger>
                  <TabsTrigger value="week" className="gap-1.5 h-8">
                    <CalendarIcon className="h-4 w-4" /> <span className="hidden sm:inline">Semana</span>
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-1.5 h-8">
                    <List className="h-4 w-4" /> <span className="hidden sm:inline">Lista</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex items-center gap-2">
                <Select value={filterUnit} onValueChange={setFilterUnit}>
                  <SelectTrigger className="h-10 w-[130px] shadow-sm bg-background"><SelectValue placeholder="Unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Unidades</SelectItem>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10 w-[110px] shadow-sm bg-background"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    {EVENT_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* O estado `filterType` existia e filtrava, mas não tinha controle
                    na tela — e os valores antigos (`externo`/`interno`) não batiam
                    com a lista. Agora tem, e os dados foram migrados. */}
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-10 w-[130px] shadow-sm bg-background"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Button 
                  variant={conflictOnly ? 'destructive' : 'outline'} 
                  size="default" 
                  onClick={() => setConflictOnly(!conflictOnly)} 
                  className={cn(
                    "h-10 shadow-sm whitespace-nowrap bg-background border-muted-foreground/20",
                    conflictOnly && "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive"
                  )}
                >
                  Conflitos
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="pl-9 h-10 shadow-sm border-muted-foreground/20 focus-visible:ring-primary bg-background" 
                />
              </div>

              {canCreate && (
                <Button 
                  onClick={() => setShowForm(true)} 
                  className="gap-2 h-10 shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Novo
                </Button>
              )}
            </div>
          </div>
        }
      />


      {view === 'month' && (
        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-7 text-center">
              {dayNames.map(d => (
                <div key={d} className="p-1 text-[10px] font-semibold text-muted-foreground sm:p-2 sm:text-xs">{d}</div>
              ))}
              {days.map(day => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, selectedMonth);
                const isToday = isSameDay(day, new Date());
                const dateStr = format(day, 'yyyy-MM-dd');
                const isDragOver = dragOverDate === dateStr;
                const hasConflict = conflictDates.has(dateStr);
                return (
                  <div
                    key={day.toISOString()}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                    className={cn(
                      "min-h-[80px] sm:min-h-[100px] border border-border p-0.5 sm:p-1 transition-colors relative",
                      !isCurrentMonth ? 'opacity-30 bg-muted/20' : '',
                      isToday ? 'bg-primary/5' : '',
                      isDragOver ? 'bg-accent/50 border-primary/50' : '',
                      hasConflict ? 'bg-muted/10 border-border/50' : '',
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:h-6 sm:w-6 sm:text-xs mb-1",
                      isToday ? 'bg-primary text-primary-foreground font-bold' : hasConflict ? 'bg-muted text-muted-foreground' : 'text-foreground'
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, isMobile ? 2 : 3).map(e => {
                        // Só o primeiro dia tem a borda colorida e aceita arrasto;
                        // os do meio mostram o título mais claro e abrem o mesmo detalhe.
                        const inicio = eDiaDeInicio(e, day);
                        return (
                        <button
                          key={e.id}
                          draggable={inicio}
                          data-continuacao={inicio ? undefined : 'sim'}
                          aria-label={inicio ? undefined : `${tituloEmTexto(e.title)} (continua)`}
                          onDragStart={inicio ? (ev) => handleDragStart(ev, e) : undefined}
                          onClick={() => handleEventClick(e)}
                          className={cn(
                            "flex w-full items-center gap-1 px-1 py-0.5 text-left text-[8px] sm:text-[10px] leading-tight hover:opacity-80 transition-opacity",
                            unitDotColors[e.unit], "bg-opacity-10",
                            inicio
                              ? cn("rounded cursor-grab active:cursor-grabbing border-l-2", unitBorderColors[e.unit])
                              : cn("cursor-pointer -mx-0.5 sm:-mx-1 pl-2 italic", eDiaDeFim(e, day) ? 'rounded-r' : 'rounded-none'),
                          )}
                        >
                          <span className={cn("truncate flex-1", inicio ? 'text-foreground' : 'text-muted-foreground')}>{e.title}</span>
                        </button>
                        );
                      })}
                      {dayEvents.length > (isMobile ? 2 : 3) && (
                        <span className="block text-center text-[8px] font-medium text-muted-foreground sm:text-[10px]">
                          +{dayEvents.length - (isMobile ? 2 : 3)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'week' && (
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-3">
              {weekDays.map(day => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const dateStr = format(day, 'yyyy-MM-dd');
                const isDragOver = dragOverDate === dateStr;
                return (
                  <div
                    key={day.toISOString()}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                    className={cn(
                      "rounded-lg border border-border transition-colors",
                      isToday ? 'bg-primary/5 border-primary/20' : '',
                      isDragOver ? 'bg-accent/50 border-primary/50' : '',
                      isMobile ? 'p-2' : 'p-3'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2 sm:flex-col sm:mb-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sm:text-xs sm:mb-2 text-center w-full">
                        {format(day, isMobile ? 'EEEE' : 'EEE', { locale: ptBR })}
                      </p>
                      <p className={cn(
                        "text-lg font-bold sm:text-xl text-center w-full",
                        isToday ? 'text-primary' : 'text-foreground'
                      )}>
                        {format(day, 'd')}
                      </p>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      {dayEvents.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2 sm:hidden">Sem eventos</p>
                      ) : (
                        dayEvents.map(e => { const inicio = eDiaDeInicio(e, day); return (
                          <button
                            key={e.id}
                            draggable={inicio}
                            data-continuacao={inicio ? undefined : 'sim'}
                            onDragStart={inicio ? (ev) => handleDragStart(ev, e) : undefined}
                            onClick={() => handleEventClick(e)}
                            className="w-full rounded-md border border-border p-2 text-left cursor-grab active:cursor-grabbing hover:bg-accent bg-card"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${unitDotColors[e.unit]}`} />
                              <span className="truncate text-[10px] font-medium text-foreground sm:text-xs">{e.title}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground sm:text-[10px]">
                              {inicio
                                ? `${format(new Date(e.start_datetime), 'HH:mm')} - ${format(new Date(e.end_datetime), 'HH:mm')}`
                                : `continua · até ${format(new Date(e.end_datetime), 'dd/MM')}`}
                            </p>
                          </button>
                        ); })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'list' && (
        <div className="space-y-2">
          {canEdit && (
            <BulkActionBar
              type="events"
              count={selectedEvents.size}
              onClearSelection={() => setSelectedEvents(new Set())}
              onDelete={handleBulkDelete}
              onChangeStatus={handleBulkStatusChange}
            />
          )}
          {filtered.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()).map(e => (
            <Card key={e.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                {canEdit && (
                  <Checkbox
                    checked={selectedEvents.has(e.id)}
                    onCheckedChange={() => toggleEventSelection(e.id)}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                )}
                <button onClick={() => handleEventClick(e)} className="flex flex-1 items-center gap-4 cursor-pointer">
                  <span className={`h-3 w-3 rounded-full ${unitDotColors[e.unit]}`} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-foreground truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.unit} · {e.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-foreground">
                      {diasDoEvento(e).length > 1
                        ? `${format(new Date(e.start_datetime), 'dd/MM')} a ${format(new Date(e.end_datetime), 'dd/MM/yyyy')}`
                        : format(new Date(e.start_datetime), 'dd/MM/yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.start_datetime), 'HH:mm')} - {format(new Date(e.end_datetime), 'HH:mm')}</p>
                  </div>
                  <Badge variant="outline" className={`capitalize shrink-0 ${getStatusBadgeClass(e.status)}`}>
                    {e.status}
                  </Badge>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventDetailPanel event={detailEvent} open={showDetail} onOpenChange={setShowDetail} onEdit={canEdit ? handleEdit : undefined} onDelete={canEdit ? handleDelete : undefined} />

      <AlertDialog open={!!paraLixeira} onOpenChange={(open) => !open && setParaLixeira(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paraLixeira?.length === 1
                ? `Mover "${tituloEmTexto(paraLixeira[0].title)}" para a lixeira?`
                : `Mover ${paraLixeira?.length ?? 0} eventos para a lixeira?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paraLixeira?.length === 1 ? 'Ele sai' : 'Eles saem'} da programação e do calendário. Dá para restaurar depois, na aba Lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarLixeira} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {paraLixeira?.length === 1 ? 'Mover para a lixeira' : `Mover ${paraLixeira?.length ?? 0} para a lixeira`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EventFormDialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) setEditingEvent(null); }} event={editingEvent} />
      <PageGuide activeTab={view} />
    </div>
  );
}

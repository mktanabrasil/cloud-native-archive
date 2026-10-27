import { useState, useMemo, useCallback, useEffect, useRef, DragEvent } from 'react';
import { toast } from 'sonner';
import { diasDoEvento, eDiaDeFim, eDiaDeInicio, ocorreNoDia } from '@/lib/events/diasDoEvento';
import { executarEmLote, textoDoLote, FRASES_LIXEIRA, frasesDeStatus } from '@/lib/events/lote';
import { tituloEmTexto } from '@/lib/events/titulo';
import { semAcento } from '@/lib/events/local';
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search } from 'lucide-react';
import { MarcaDaAgenda } from '@/components/events/AgendaDoEvento';
import { SituacaoDoEvento } from '@/components/events/SituacaoDoEvento';
import { rotuloDoStatus } from '@/lib/events/status';
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

/** A variável de cor de cada unidade, para os blocos translúcidos (como na semana da Visão Geral). */
const varDaUnidade: Record<Unit, string> = {
  'DIC': '--unit-dic',
  'Nilópolis': '--unit-nilopolis',
  'Santana': '--unit-santana',
  'Administração': '--unit-geral',
};

type View = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const { events: rawEvents, selectedMonth, setSelectedMonth, setSelectedEvent, deleteEvent, updateEvent, detectConflicts, loading, refetchEvents } = useApp();
  const events = useFilteredEvents();
  const { isAuthenticated } = useAuth();
  const { canEdit, userName, unit, isAdmin } = useUserRole();
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
      // Sem acento e cobrindo a descrição: o mesmo termo dava resultados
      // diferentes aqui e na Visão Geral (achado 16).
      const termo = semAcento(search);
      if (termo && !semAcento(e.title).includes(termo) && !semAcento(e.location || '').includes(termo) && !semAcento(e.description || '').includes(termo)) return false;
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
                  {/* Esboço V2: abas só com o nome, sem ícone. */}
                  <TabsTrigger value="month" className="h-8">Mês</TabsTrigger>
                  <TabsTrigger value="week" className="h-8">Semana</TabsTrigger>
                  <TabsTrigger value="list" className="h-8">Lista</TabsTrigger>
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
                    {EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{rotuloDoStatus(s)}</SelectItem>)}
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
              {/* O botão "Novo" mora no hub, ao lado das abas (22/09/2026). */}
            </div>
          </div>
        }
      />


      {/* Esboço V2: o mês em grade limpa, com cada evento como um bloco de
          borda esquerda na cor da unidade (o mesmo desenho da semana da
          Visão Geral). Arrastar, continuação e "+N" continuam iguais. */}
      {view === 'month' && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7">
            {dayNames.map((d, i) => (
              <div key={d} className={cn("border-b border-border/70 px-1 py-2 text-center text-[11px] font-semibold text-muted-foreground sm:text-xs", i > 0 && 'border-l')}>{d}</div>
            ))}
            {days.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, selectedMonth);
              const isToday = isSameDay(day, new Date());
              const dateStr = format(day, 'yyyy-MM-dd');
              const isDragOver = dragOverDate === dateStr;
              const hasConflict = conflictDates.has(dateStr);
              const limite = isMobile ? 2 : 3;
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                  className={cn(
                    "relative min-h-[84px] min-w-0 border-border/70 p-1 transition-colors sm:min-h-[116px] sm:p-1.5",
                    i % 7 !== 0 && 'border-l',
                    i < days.length - 7 && 'border-b',
                    !isCurrentMonth && 'bg-muted/40',
                    isDragOver && 'bg-accent',
                  )}
                >
                  <div className="mb-1 flex items-center gap-1 px-0.5">
                    <span className={cn(
                      "inline-flex h-6 min-w-[24px] items-center justify-center rounded-md px-1 text-[11px] font-semibold tabular-nums sm:text-xs",
                      isToday ? 'bg-foreground text-background' : isCurrentMonth ? 'text-foreground' : 'text-[hsl(var(--fraco))]'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {hasConflict && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" title="Dia com conflito" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayEvents.slice(0, limite).map(e => {
                      // Só o primeiro dia tem a borda colorida e aceita arrasto;
                      // os do meio mostram o título mais claro e abrem o mesmo detalhe.
                      const inicio = eDiaDeInicio(e, day);
                      const cor = varDaUnidade[e.unit];
                      return (
                      <button
                        key={e.id}
                        draggable={inicio}
                        data-continuacao={inicio ? undefined : 'sim'}
                        aria-label={inicio ? undefined : `${tituloEmTexto(e.title)} (continua)`}
                        onDragStart={inicio ? (ev) => handleDragStart(ev, e) : undefined}
                        onClick={() => handleEventClick(e)}
                        className={cn(
                          "block min-w-0 px-1.5 py-0.5 text-left text-[10px] leading-snug transition-opacity hover:opacity-80 sm:text-[11.5px]",
                          inicio
                            ? "w-full cursor-grab rounded-r-md border-l-[3px] font-semibold text-foreground active:cursor-grabbing"
                            : cn("-mx-1 cursor-pointer italic text-muted-foreground sm:-mx-1.5", eDiaDeFim(e, day) ? 'rounded-r-md' : 'rounded-none'),
                        )}
                        style={inicio
                          ? { background: `hsl(var(${cor}) / 0.16)`, borderColor: `hsl(var(${cor}))` }
                          : { background: `hsl(var(${cor}) / 0.08)` }}
                      >
                        <span className="block truncate">{e.title}</span>
                        {inicio && (
                          <span className="hidden truncate font-normal text-muted-foreground sm:block">{format(new Date(e.start_datetime), 'HH:mm')}</span>
                        )}
                      </button>
                      );
                    })}
                    {dayEvents.length > limite && (
                      <span className="block px-1 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                        +{dayEvents.length - limite}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Esboço V2: a semana em sete colunas (no celular, um dia embaixo do
          outro), com os mesmos blocos do mês. */}
      {view === 'week' && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-7">
            {weekDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const dateStr = format(day, 'yyyy-MM-dd');
              const isDragOver = dragOverDate === dateStr;
              const rotulo = format(day, isMobile ? 'EEEE, d' : 'EEE d', { locale: ptBR });
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                  className={cn(
                    "min-w-0 border-border/70 transition-colors",
                    i < weekDays.length - 1 && 'border-b sm:border-b-0',
                    i > 0 && 'sm:border-l',
                    isDragOver && 'bg-accent',
                  )}
                >
                  <div className="border-b border-border/70 px-3 py-2 text-left text-xs font-semibold capitalize text-muted-foreground sm:text-center">
                    {isToday ? (
                      <b className="rounded-md bg-foreground px-1.5 py-0.5 text-background">{rotulo}</b>
                    ) : (
                      rotulo
                    )}
                  </div>
                  <div className="space-y-1.5 p-2 sm:min-h-[280px]">
                    {dayEvents.length === 0 ? (
                      <p className="px-1 py-1 text-xs text-muted-foreground sm:hidden">Sem eventos</p>
                    ) : (
                      dayEvents.map(e => { const inicio = eDiaDeInicio(e, day); const cor = varDaUnidade[e.unit]; return (
                        <button
                          key={e.id}
                          draggable={inicio}
                          data-continuacao={inicio ? undefined : 'sim'}
                          onDragStart={inicio ? (ev) => handleDragStart(ev, e) : undefined}
                          onClick={() => handleEventClick(e)}
                          className={cn(
                            "block w-full rounded-r-lg border-l-[3px] px-2 py-1.5 text-left text-[12px] leading-snug transition-opacity hover:opacity-80",
                            inicio ? 'cursor-grab font-semibold text-foreground active:cursor-grabbing' : 'cursor-pointer italic text-muted-foreground',
                          )}
                          style={{ background: `hsl(var(${cor}) / ${inicio ? 0.16 : 0.08})`, borderColor: inicio ? `hsl(var(${cor}))` : 'transparent' }}
                        >
                          <span className="line-clamp-2">{e.title}</span>
                          <span className="block font-normal not-italic text-muted-foreground">
                            {inicio
                              ? `${format(new Date(e.start_datetime), 'HH:mm')} - ${format(new Date(e.end_datetime), 'HH:mm')}`
                              : `continua · até ${format(new Date(e.end_datetime), 'dd/MM')}`}
                          </span>
                        </button>
                      ); })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Esboço V2: a lista em linhas, com a data em destaque, como a lista
          das Programações; a situação em texto com bolinha. */}
      {view === 'list' && (
        <div className="space-y-3">
          {canEdit && (
            <BulkActionBar
              type="events"
              count={selectedEvents.size}
              onClearSelection={() => setSelectedEvents(new Set())}
              onDelete={handleBulkDelete}
              onChangeStatus={handleBulkStatusChange}
            />
          )}
          {filtered.length === 0 ? (
            <p className="rounded-[20px] border border-black/5 bg-card py-12 text-center text-sm text-muted-foreground dark:border-white/5">Nenhum evento encontrado</p>
          ) : (
          <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
          {[...filtered].sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()).map(e => {
            const inicio = new Date(e.start_datetime);
            return (
            <div key={e.id} className="flex items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40 sm:gap-4 sm:px-5">
              {canEdit && (
                <Checkbox
                  checked={selectedEvents.has(e.id)}
                  onCheckedChange={() => toggleEventSelection(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                />
              )}
              <button onClick={() => handleEventClick(e)} className="grid min-w-0 flex-1 cursor-pointer grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-left sm:grid-cols-[48px_minmax(0,1fr)_auto_160px]">
                <span className="grid justify-items-center self-start leading-none sm:self-center">
                  <span className="font-display text-[22px] font-bold tabular-nums text-foreground">{format(inicio, 'dd')}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{format(inicio, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{e.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${unitDotColors[e.unit]}`} />
                    <span className="truncate">{e.unit} · {e.location}</span>
                    <MarcaDaAgenda event={e} />
                  </span>
                </span>
                <span className="col-start-2 text-[13px] tabular-nums text-muted-foreground sm:col-start-auto sm:text-right">
                  <span className="block text-foreground">
                    {diasDoEvento(e).length > 1
                      ? `${format(new Date(e.start_datetime), 'dd/MM')} a ${format(new Date(e.end_datetime), 'dd/MM/yyyy')}`
                      : format(new Date(e.start_datetime), 'dd/MM/yyyy')}
                  </span>
                  <span className="block">{format(new Date(e.start_datetime), 'HH:mm')} - {format(new Date(e.end_datetime), 'HH:mm')}</span>
                </span>
                <span className="col-start-2 sm:col-start-auto">
                  <SituacaoDoEvento status={e.status} />
                </span>
              </button>
            </div>
            );
          })}
          </div>
          )}
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
              {paraLixeira?.length === 1 ? 'Ele sai' : 'Eles saem'} da programação e do calendário. {isAdmin ? 'Dá para restaurar depois, na aba Lixeira.' : 'Se precisar de volta, peça à administração geral, que pode restaurar.'}
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

import { Fragment, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppEvent, EventStatus, UNITS, EVENT_STATUSES, EVENT_TYPES, Unit } from '@/types';
import { CalendarDays, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Camera, Handshake, Search, LayoutGrid, List, Calendar as CalendarIcon, Globe, Lock } from 'lucide-react';
import { MarcaDaAgenda } from '@/components/events/AgendaDoEvento';
import { rotuloDoStatus } from '@/lib/events/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import EventFormDialog from '@/components/EventFormDialog';
import { AprovacoesPendentes } from '@/components/events/AprovacoesPendentes';
import EventDetailPanel from '@/components/EventDetailPanel';
import ConflictDialog from '@/components/ConflictDialog';
import FilteredEventsDialog from '@/components/FilteredEventsDialog';
import PageHeader from '@/components/PageHeader';
import PageGuide from '@/components/PageGuide';

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, subDays, addDays, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const unitDotColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic',
  'Nilópolis': 'bg-unit-nilopolis',
  'Santana': 'bg-unit-santana',
  'Administração': 'bg-unit-geral',
};
const varDaUnidade: Record<Unit, string> = {
  'DIC': '--unit-dic',
  'Nilópolis': '--unit-nilopolis',
  'Santana': '--unit-santana',
  'Administração': '--unit-geral',
};


export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const hideTitle = searchParams.get('hideTitle') === 'true';
  const { events: rawEvents, selectedMonth, setSelectedMonth, setSelectedEvent, deleteEvent, updateEvent } = useApp();
  const events = useFilteredEvents();
  const { isAuthenticated } = useAuth();
  const { canEdit, unit, isMarketing } = useUserRole();
  const isMobile = useIsMobile();
  const [detailEvent, setDetailEvent] = useState<AppEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  /** O formulário abriu a partir de "Aprovações pendentes". */
  const [revisando, setRevisando] = useState(false);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [conflictOnly, setConflictOnly] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showFiltered, setShowFiltered] = useState<'marketing' | 'partners' | 'confirmed' | 'pending' | null>(null);

  // Sync filter unit with user unit when it changes (useful for test mode)
  useEffect(() => {
    if (unit && unit !== 'Administração') {
      setFilterUnit(unit);
    } else {
      setFilterUnit('all');
    }
  }, [unit]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  const diasDaSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)), []);
  const threeDaysAgo = useMemo(() => subDays(new Date(), 3), []);

  const filtered = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();
    const searchWords = searchTerm.split(/\s+/);

    return events.filter(e => {
      // 0. Lixeira não é programação. Para o admin, a política do banco não
      //    filtra `deleted_at`, então a tela precisa filtrar.
      if (e.deleted_at) return false;

      // 1. Unit filter
      if (filterUnit !== 'all' && e.unit !== filterUnit) return false;
      
      // 2. Status filter
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;

      // 2b. Tipo
      if (filterType !== 'all' && e.event_type !== filterType) return false;
      
      // 3. Conflict filter
      if (conflictOnly && !e.has_conflict) return false;
      
      // 4. Search filter (multi-word support)
      if (searchTerm) {
        const title = e.title.toLowerCase();
        const location = (e.location || '').toLowerCase();
        const description = (e.description || '').toLowerCase();
        
        return searchWords.every(word => 
          title.includes(word) || location.includes(word) || description.includes(word)
        );
      }
      
      return true;
    });
  }, [events, filterUnit, filterStatus, filterType, conflictOnly, search]);

  const monthEvents = useMemo(() => filtered.filter(e => {
    const d = new Date(e.start_datetime);
    return d >= monthStart && d <= monthEnd;
  }), [filtered, monthStart, monthEnd]);

  const activeEvents = useMemo(() => filtered.filter(e => {
    const d = new Date(e.start_datetime);
    return d >= threeDaysAgo;
  }), [filtered, threeDaysAgo]);

  const weekEvents = useMemo(() => filtered.filter(e => {
    const d = new Date(e.start_datetime);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [filtered, weekStart, weekEnd]);

  const stats = useMemo(() => {
    return monthEvents.reduce((acc, e) => {
      acc.total++;
      if (e.status === 'confirmado') acc.confirmed++;
      if (e.status === 'pendente') acc.pending++;
      if (e.has_conflict) acc.conflict++;
      if (e.marketing_request) acc.marketing++;
      if (e.partner_involved) acc.partners++;
      return acc;
    }, { total: 0, confirmed: 0, pending: 0, conflict: 0, marketing: 0, partners: 0 });
  }, [monthEvents]);


  const prevMonth = () => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  const nextMonth = () => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));

  const handleEventClick = (event: AppEvent) => {
    setDetailEvent(event);
    setShowDetail(true);
  };

  const handleEdit = (event: AppEvent) => {
    setShowDetail(false);
    setSelectedEvent(event);
    setEditingEvent(event);
    setShowEdit(true);
  };

  const handleDelete = (id: string) => {
    deleteEvent(id);
    setShowDetail(false);
  };

  const handleRevisar = (event: AppEvent) => {
    setSelectedEvent(event);
    setEditingEvent(event);
    setRevisando(true);
    setShowEdit(true);
  };

  const handleConflictEventClick = (event: AppEvent) => {
    setShowConflicts(false);
    setTimeout(() => handleEventClick(event), 200);
  };


  const statCards = [
    { label: 'Total de Eventos', value: stats.total, icon: CalendarDays, color: 'text-info', onClick: undefined },
    { label: 'Confirmados', value: stats.confirmed, icon: CheckCircle2, color: 'text-success', onClick: () => setShowFiltered('confirmed') },
    { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-warning', onClick: () => setShowFiltered('pending') },
    { label: 'Com Conflito', value: stats.conflict, icon: AlertCircle, color: 'text-destructive', onClick: () => setShowConflicts(true) },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <PageHeader
        title={hideTitle ? "" : "Visão Geral"}
        description={hideTitle ? "" : unit && unit !== 'Administração' ? `Programação da unidade ${unit}` : "Programação institucional de todas as unidades"}
        hidden={hideTitle}
        className="mb-4"
        actions={
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 w-full">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 shadow-sm h-10">
                <button onClick={prevMonth} className="p-1 hover:bg-accent rounded transition-colors"><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-center gap-1.5 rounded px-2 py-0.5 hover:bg-accent transition-colors min-w-[120px] sm:min-w-[160px]">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium capitalize text-foreground">
                        {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
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
                <button onClick={nextMonth} className="p-1 hover:bg-accent rounded transition-colors"><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
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

      {/* Esboço V2: os quatro cartões viram uma faixa de vidro; cor só no número que pede ação */}
      <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] lg:grid-cols-4">
        {statCards.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "border-black/10 p-4 transition-colors dark:border-white/10 sm:px-5",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t lg:border-t-0",
              i === 2 && "lg:border-l",
              s.onClick ? 'cursor-pointer hover:bg-[hsl(var(--ativo))]' : ''
            )}
            onClick={s.onClick}
          >
            <div>
              <p className={cn("font-display text-3xl font-bold tabular-nums", s.label === 'Total de Eventos' ? 'text-foreground' : s.value > 0 ? s.color : 'text-foreground')}>{s.value}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{s.label}</p>
              {s.label === 'Total de Eventos' && (
                <div className="mt-2 flex items-center gap-3 border-t border-border pt-2 sm:mt-3 sm:gap-4 sm:pt-3">
                  <button
                    className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                    title="Solicitações de Marketing"
                    onClick={(ev) => { ev.stopPropagation(); setShowFiltered('marketing'); }}
                  >
                    <Camera className="h-3.5 w-3.5 text-info sm:h-4 sm:w-4" />
                    <span className="text-xs font-semibold text-foreground sm:text-sm">{stats.marketing}</span>
                  </button>
                  <button
                    className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                    title="Padrinhos, doadores e empresas"
                    onClick={(ev) => { ev.stopPropagation(); setShowFiltered('partners'); }}
                  >
                    <Handshake className="h-3.5 w-3.5 text-info sm:h-4 sm:w-4" />
                    <span className="text-xs font-semibold text-foreground sm:text-sm">{stats.partners}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>


      {/* O que as unidades enviaram e ainda espera a administração geral.
          Sai de `rawEvents`: não depende do mês nem dos filtros da tela. */}
      {isMarketing && <AprovacoesPendentes eventos={rawEvents} onRevisar={handleRevisar} />}

      {/* Esboço V2: a semana de verdade, uma linha por unidade e cada evento no
          dia dele. No celular, a lista da semana. */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
          <h2 className="text-[15px] font-semibold text-foreground">
            Semana de {format(weekStart, "d 'de' MMMM", { locale: ptBR })}
          </h2>
          <span className="text-xs text-muted-foreground">
            {weekEvents.length === 1 ? '1 evento' : `${weekEvents.length} eventos`}
          </span>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <div className="grid min-w-[760px] grid-cols-[136px_repeat(7,minmax(0,1fr))]">
            <span className="border-b border-border/70" />
            {diasDaSemana.map(d => (
              <span key={d.toISOString()} className="border-b border-border/70 px-2 py-2 text-center text-xs font-semibold capitalize text-muted-foreground">
                {isToday(d) ? (
                  <b className="whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-background">{format(d, 'EEE d', { locale: ptBR })}</b>
                ) : (
                  format(d, 'EEE d', { locale: ptBR })
                )}
              </span>
            ))}
            {UNITS.map(u => (
              <Fragment key={u}>
                <span className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-[13px] font-semibold text-foreground">
                  <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${unitDotColors[u]}`} />
                  {u}
                </span>
                {diasDaSemana.map(d => {
                  const doDia = weekEvents.filter(e => e.unit === u && isSameDay(new Date(e.start_datetime), d));
                  return (
                    <div key={d.toISOString()} className="min-h-[58px] space-y-1 border-b border-l border-border/70 p-1.5">
                      {doDia.map(e => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => handleEventClick(e)}
                          className="block w-full rounded-r-lg border-l-[3px] px-2 py-1 text-left text-[11.5px] font-semibold leading-snug text-foreground transition-opacity hover:opacity-80"
                          style={{ background: `hsl(var(${varDaUnidade[u]}) / 0.16)`, borderColor: `hsl(var(${varDaUnidade[u]}))` }}
                        >
                          <span className="line-clamp-2">{e.title}</span>
                          <span className="block font-normal text-muted-foreground">
                            {format(new Date(e.start_datetime), 'HH:mm')} · {rotuloDoStatus(e.status)}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="md:hidden">
          {weekEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento nesta semana</p>
          ) : (
            weekEvents.slice(0, 8).map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => handleEventClick(e)}
                className="grid w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-3 border-b border-border/70 px-4 py-3 text-left last:border-b-0"
              >
                <span className="grid justify-items-center leading-none">
                  <span className="font-display text-xl font-bold tabular-nums">{format(new Date(e.start_datetime), 'dd')}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{format(new Date(e.start_datetime), 'EEE', { locale: ptBR }).replace('.', '')}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{e.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${unitDotColors[e.unit]}`} />
                    {e.unit} · {format(new Date(e.start_datetime), 'HH:mm')} · {rotuloDoStatus(e.status)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </Card>


      <EventFormDialog
        open={showEdit}
        onOpenChange={(v) => { setShowEdit(v); if (!v) { setEditingEvent(null); setRevisando(false); } }}
        event={editingEvent}
        revisao={revisando}
      />
      <EventDetailPanel event={detailEvent} open={showDetail} onOpenChange={setShowDetail} onEdit={canEdit ? handleEdit : undefined} onDelete={canEdit ? handleDelete : undefined} />
      <ConflictDialog events={monthEvents} selectedMonth={selectedMonth} open={showConflicts} onOpenChange={setShowConflicts} onEventClick={handleConflictEventClick} />
      {showFiltered && (
        <FilteredEventsDialog
          events={monthEvents}
          filterType={showFiltered}
          selectedMonth={selectedMonth}
          open={!!showFiltered}
          onOpenChange={(v) => { if (!v) setShowFiltered(null); }}
          onEventClick={(e) => { setShowFiltered(null); setTimeout(() => handleEventClick(e), 200); }}
        />
      )}
      <PageGuide />
    </div>
  );
}

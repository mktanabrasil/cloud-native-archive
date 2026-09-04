import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppEvent, EventStatus, UNITS, EVENT_STATUSES, Unit } from '@/types';
import { CalendarDays, CheckCircle2, Clock, AlertCircle, Plus, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Camera, Handshake, Search, LayoutGrid, List, Calendar as CalendarIcon, Globe, Lock } from 'lucide-react';
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

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const unitDotColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic',
  'Nilópolis': 'bg-unit-nilopolis',
  'Santana': 'bg-unit-santana',
  'Administração': 'bg-unit-geral',
};


export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const hideTitle = searchParams.get('hideTitle') === 'true';
  const { events: rawEvents, selectedMonth, setSelectedMonth, setSelectedEvent, deleteEvent, updateEvent } = useApp();
  const events = useFilteredEvents();
  const { isAuthenticated } = useAuth();
  const { canEdit, canCreate, unit, isMarketing } = useUserRole();
  const isMobile = useIsMobile();
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [detailEvent, setDetailEvent] = useState<AppEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  /** O formulário abriu a partir de "Aprovações pendentes". */
  const [revisando, setRevisando] = useState(false);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
  }, [events, filterUnit, filterStatus, conflictOnly, search]);

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
        description={hideTitle ? "" : "Programação institucional de todas as unidades"}
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
                  {EVENT_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
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
                  onClick={() => setShowNewEvent(true)} 
                  className="gap-2 h-10 shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Novo
                </Button>
              )}
            </div>
          </div>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {statCards.map(s => (
          <Card
            key={s.label}
            className={cn(
              "transition-shadow hover:shadow-md",
              s.onClick ? 'cursor-pointer' : ''
            )}
            onClick={s.onClick}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs uppercase tracking-wider">{s.label}</p>
                <s.icon className={`h-5 w-5 ${s.color} opacity-70 shrink-0 sm:h-6 sm:w-6`} />
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground sm:mt-2 sm:text-3xl">{s.value}</p>
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
                    title="Parceiros Envolvidos"
                    onClick={(ev) => { ev.stopPropagation(); setShowFiltered('partners'); }}
                  >
                    <Handshake className="h-3.5 w-3.5 text-info sm:h-4 sm:w-4" />
                    <span className="text-xs font-semibold text-foreground sm:text-sm">{stats.partners}</span>
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>


      {/* O que as unidades enviaram e ainda espera a administração geral.
          Sai de `rawEvents`: não depende do mês nem dos filtros da tela. */}
      {isMarketing && <AprovacoesPendentes eventos={rawEvents} onRevisar={handleRevisar} />}

      {/* Timeline da Semana */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Timeline da Semana</h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {UNITS.map(u => (
                <div key={u} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${unitDotColors[u]} shrink-0 sm:h-2.5 sm:w-2.5`} />
                  <span className="text-[10px] text-muted-foreground sm:text-xs">{u === 'Administração' ? 'Geral' : u}</span>
                </div>
              ))}
            </div>
          </div>
          {weekEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento nesta semana</p>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {weekEvents.slice(0, 6).map(e => (
                <div key={e.id} className="flex w-full items-center gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-accent sm:gap-3 sm:p-3">
                  <button onClick={() => handleEventClick(e)} className="flex flex-1 items-center gap-2 text-left sm:gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`h-2 w-2 rounded-full ${unitDotColors[e.unit]} shrink-0 sm:h-2.5 sm:w-2.5`} />
                      {e.visibility === 'publico' ? (
                        <Globe className="h-3 w-3 text-info shrink-0" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 text-xs font-medium text-foreground line-clamp-1 sm:text-sm">{e.title}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap sm:text-xs">
                        {format(new Date(e.start_datetime), 'dd/MM HH:mm')}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 capitalize sm:text-xs sm:px-2.5 sm:py-0.5", getStatusBadgeClass(e.status))}>
                        {e.status}
                      </Badge>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      <EventFormDialog open={showNewEvent} onOpenChange={setShowNewEvent} />
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
          events={showFiltered === 'marketing' || showFiltered === 'partners' ? activeEvents : monthEvents}
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

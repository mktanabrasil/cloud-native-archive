import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useUserRole } from '@/hooks/useUserRole';
import { useApp } from '@/contexts/AppContext';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { CalendarDays, MapPin, Clock, Search, ExternalLink, ChevronLeft, ChevronRight, LayoutPanelTop, Eye, EyeOff, Globe, CheckCircle2, AlertCircle, Camera, Handshake, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PageHeader from '@/components/PageHeader';
import logoImg from '@/assets/logo.png';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EventDetailDialog } from '@/components/EventDetailDialog';
import EventFormDialog from '@/components/EventFormDialog';
import { BannerMissingDialog } from '@/components/BannerMissingDialog';
import ConflictDialog from '@/components/ConflictDialog';
import FilteredEventsDialog from '@/components/FilteredEventsDialog';
import EventDetailPanel from '@/components/EventDetailPanel';
import { useUserRole as _ur } from '@/hooks/useUserRole';
import { useUIVersions } from '@/hooks/useUIVersions';

export default function PublicEventsPage() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<AppEvent | null>(null);
  const [showBannerMissingDialog, setShowBannerMissingDialog] = useState(false);
  const [eventToToggleBanner, setEventToToggleBanner] = useState<AppEvent | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showFiltered, setShowFiltered] = useState<'marketing' | 'partners' | 'confirmed' | 'pending' | null>(null);
  const [detailEvent, setDetailEvent] = useState<AppEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const { isAdmin, canEdit } = useUserRole();
  const { updateEvent, setSelectedEvent, selectedEvent, deleteEvent } = useApp();
  const { showBetaUI } = useUIVersions();
  
  const [showTrash, setShowTrash] = useState(false);
  const allEvents = useFilteredEvents(false, showTrash);
  const events = useFilteredEvents(true, false); // Public view never shows trash


  const stats = useMemo(() => {
    return allEvents.reduce((acc, e) => {
      acc.total++;
      if (e.status === 'confirmado') acc.confirmed++;
      if (e.status === 'pendente') acc.pending++;
      if (e.has_conflict) acc.conflict++;
      if (e.marketing_request) acc.marketing++;
      if (e.partner_involved) acc.partners++;
      return acc;
    }, { total: 0, confirmed: 0, pending: 0, conflict: 0, marketing: 0, partners: 0 });
  }, [allEvents]);


  const filtered = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();
    if (!searchTerm) return events;

    return events.filter(e => 
      e.title.toLowerCase().includes(searchTerm) || 
      (e.location || '').toLowerCase().includes(searchTerm) ||
      (e.description || '').toLowerCase().includes(searchTerm)
    );
  }, [events, search]);

  // Sort by date (nearest first)
  const sortedEvents = useMemo(() => {
    return [...filtered].sort((a, b) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
  }, [filtered]);

  const bannerEvents = useMemo(() => {
    // Show confirmed events that are in banner, sorted by start date
    // For regular users, only show those with show_in_banner = true AND not yet passed
    // For admins, show ALL but push disabled or passed ones to the end
    const confirmedEvents = events;
    const now = new Date();
    // For the banner, hide events starting tomorrow (00:00 of the next day)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    
    if (isAdmin) {
      return [...confirmedEvents].sort((a, b) => {
        const aStart = new Date(a.start_datetime);
        const bStart = new Date(b.start_datetime);
        const aPassed = aStart > endOfToday; // Wait, requirement says "if today is 01, stay until 23:59 of 01"
        // Correct logic: hide if start_datetime is on a previous day.
        
        // Let's use start of today for comparison
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const aIsPast = aStart < startOfToday;
        const bIsPast = bStart < startOfToday;

        // First priority: show_in_banner status AND not past
        const aActive = a.show_in_banner && !aIsPast;
        const bActive = b.show_in_banner && !bIsPast;

        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        
        // Second priority: start date
        return aStart.getTime() - bStart.getTime();
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // DEBUG: console.log("bannerEvents calc start", confirmedEvents.length);
    const result = confirmedEvents
      .filter(e => {
        const isBanner = e.show_in_banner;
        const eventDate = new Date(e.start_datetime);
        const isNotPast = eventDate >= startOfToday;
        // console.log(`Event ${e.title}: isBanner=${isBanner}, date=${e.start_datetime}, isNotPast=${isNotPast}`);
        return isBanner && isNotPast;
      })
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
    
    // console.log("Banner Events (Public) final:", result);
    return result;
  }, [events, isAdmin]);

  const handleToggleBanner = (event: AppEvent) => {
    // If we are ENABLING the banner and missing desktop image, show warning FIRST
    // and DO NOT open the editor yet.
    if (!event.show_in_banner && !event.banner_image_desktop) {
      setEventToToggleBanner(event);
      setShowBannerMissingDialog(true);
      return;
    }

    const updated = { ...event, show_in_banner: !event.show_in_banner };
    updateEvent(updated);
    toast.success(updated.show_in_banner ? 'Evento adicionado ao banner' : 'Evento removido do banner');
  };

  const confirmBannerToggle = () => {
    if (eventToToggleBanner) {
      const updated = { ...eventToToggleBanner, show_in_banner: true };
      updateEvent(updated);
      toast.success('Evento adicionado ao banner');
      setShowBannerMissingDialog(false);
      setEventToToggleBanner(null);
    }
  };

  const handleAddImage = () => {
    if (eventToToggleBanner) {
      setSelectedEvent(eventToToggleBanner);
      setShowBannerMissingDialog(false);
      setEventToToggleBanner(null);
    }
  };

  useEffect(() => {
    const slug = searchParams.get('slug');
    if (slug && events.length > 0) {
      const found = events.find(e => e.slug === slug || e.id === slug);
      if (found) {
        if (isAuthenticated && isAdmin) {
          setSelectedEvent(found);
        } else {
          setSelectedEventForDetail(found);
        }
      }
    }
  }, [searchParams, events, isAuthenticated, isAdmin, setSelectedEvent]);

  useEffect(() => {
    if (bannerEvents.length <= 1) return;
    
    // Use dynamic display time for current slide
    const currentEvent = bannerEvents[currentSlide];
    const displayTime = (currentEvent?.banner_display_time || 5) * 1000;

    const timeout = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerEvents.length);
    }, displayTime);

    return () => clearTimeout(timeout);
  }, [bannerEvents, currentSlide]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % bannerEvents.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + bannerEvents.length) % bannerEvents.length);

  const handleCardClick = (event: AppEvent) => {
    if (showTrash) return; // Don't open detail for trash items, or we could add a restore action
    if (isAuthenticated && isAdmin) {
      setSelectedEvent(event);
    } else {
      setSelectedEventForDetail(event);
      // Update URL without full refresh to support sharing the specific open state
      setSearchParams({ slug: event.slug || event.id });
    }
  };

  const closeDetail = () => {
    setSelectedEventForDetail(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('slug');
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen bg-background">


      {bannerEvents.length > 0 && (
        <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden bg-slate-900">
          {bannerEvents.map((event, index) => (
            <div 
              key={event.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
            >
              {/* Desktop Banner (21:9 preferencial, fallback para capa 16:9) */}
              {(event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile) ? (
                <>
                  <img 
                    src={event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile} 
                    alt={event.title}
                    className="hidden md:block w-full h-full object-cover opacity-60"
                  />
                  {/* Mobile Banner (9:16 preferencial, fallback para capa 4:3) */}
                  <img 
                    src={event.banner_image_mobile || event.banner_url_mobile || event.banner_url_desktop} 
                    alt={event.title}
                    className="block md:hidden w-full h-full object-cover opacity-60"
                  />
                </>
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center px-8 md:px-16"
                  style={{ backgroundColor: event.custom_color || '#1e293b' }}
                >
                  {/* Fallback content if no image */}
                </div>
              )}
              
              {event.show_banner_overlay !== false && (
                <div className="absolute inset-0 bg-slate-900/40 z-[5]" />
              )}
              
              {event.show_banner_fade !== false && (
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-[10]" />
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 max-w-7xl mx-auto flex flex-col items-start justify-end h-full z-[20]">
                <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                  <Badge className={`${UNIT_BG_COLORS[event.unit]} text-white border-none shadow-lg`}>
                    {event.unit}
                  </Badge>
                  {!event.show_in_banner && isAdmin && (
                    <Badge variant="outline" className="bg-slate-900/80 text-slate-200 border-slate-700 backdrop-blur-sm">
                      Oculto para o Público
                    </Badge>
                  )}
                </div>
                
                {event.use_logo_as_title && event.event_logo_url ? (
                  <div className={`mb-6 animate-in slide-in-from-left duration-700 w-full flex items-center justify-start ${event.full_height_title ? 'h-1/2' : 'h-24 md:h-40'}`}>
                    <img 
                      src={event.event_logo_url} 
                      alt={event.title} 
                      className={`object-contain object-left h-full max-w-full filter drop-shadow-2xl`} 
                    />
                  </div>
                ) : (
                  <h2 
                    className={`font-bold text-white mb-4 leading-tight drop-shadow-lg ${event.full_height_title ? 'text-4xl md:text-8xl lg:text-9xl max-w-5xl' : 'text-3xl md:text-6xl max-w-3xl'}`}
                    dangerouslySetInnerHTML={{ 
                      __html: event.title.replace(/<br\s*\/?>/gi, (match) => {
                        return '<span class="hidden md:inline"><br/></span>';
                      }) 
                    }}
                  />
                )}
                <div className="flex flex-wrap gap-4 text-slate-200 text-sm md:text-base mb-6">


                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    <span>{format(new Date(event.start_datetime), "dd 'de' MMMM", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <span>{event.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <Button 
                    size="lg" 
                    className="rounded-full px-8 shadow-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(event);
                    }}
                  >
                    Saber mais
                  </Button>
                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      size="lg"
                      className={`rounded-full backdrop-blur-md border-white/30 ${event.show_in_banner ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleBanner(event);
                      }}
                    >
                      {event.show_in_banner ? (
                        <>
                          <EyeOff className="h-5 w-5 mr-2" /> Ocultar Banner
                        </>
                      ) : (
                        <>
                          <Eye className="h-5 w-5 mr-2" /> Ativar Banner
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {bannerEvents.length > 1 && (
            <>
              <button 
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all z-20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button 
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all z-20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              
              {/* Acima de oito slides os pontinhos deixam de funcionar como
                  navegação — viram uma fileira ilegível. Aí só o contador. */}
              {bannerEvents.length > 8 ? (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 rounded-full bg-black/40 px-3 py-1 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
                  {currentSlide + 1} / {bannerEvents.length}
                </div>
              ) : (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex z-20">
                  {bannerEvents.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      aria-label={`Ir para o slide ${i + 1} de ${bannerEvents.length}`}
                      aria-current={i === currentSlide}
                      /* O ponto continua com 6px; quem cresce é o alvo, que
                         chega a 44px pelo padding e fica invisível. */
                      className="group grid h-11 w-11 place-items-center"
                    >
                      <span
                        className={`h-1.5 block transition-all rounded-full ${i === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/30 group-hover:bg-white/60'}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* A 320px, cinco pílulas com flex-1 ficavam com 33px cada e o rótulo
            sumia. Abaixo de sm viram faixa rolável com largura natural. */}
        {(isAuthenticated && isAdmin) && (
          <div className="w-full mb-8 -mx-6 px-6 flex items-center gap-2 overflow-x-auto pb-1 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <div className="shrink-0 sm:flex-1 sm:min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-info text-info-foreground border border-info/20 text-[10px] sm:text-xs font-medium justify-center whitespace-nowrap">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Eventos: <span className="font-bold">{stats.total}</span></span>
            </div>
            
            <button 
              onClick={() => setShowFiltered('confirmed')}
              className="shrink-0 sm:flex-1 sm:min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-success text-success-foreground border border-success/20 text-[10px] sm:text-xs font-medium hover:opacity-90 transition-opacity justify-center whitespace-nowrap"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Confirmados: <span className="font-bold">{stats.confirmed}</span></span>
            </button>

            <button 
              onClick={() => setShowFiltered('pending')}
              className="shrink-0 sm:flex-1 sm:min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-warning text-warning-foreground border border-warning/20 text-[10px] sm:text-xs font-medium hover:opacity-90 transition-opacity justify-center whitespace-nowrap"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Pendentes: <span className="font-bold">{stats.pending}</span></span>
            </button>

            <button 
              onClick={() => setShowConflicts(true)}
              className="shrink-0 sm:flex-1 sm:min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-destructive text-destructive-foreground border border-destructive/20 text-[10px] sm:text-xs font-medium hover:opacity-90 transition-opacity justify-center whitespace-nowrap"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Conflitos: <span className="font-bold">{stats.conflict}</span></span>
            </button>

            <button 
              onClick={() => setShowFiltered('marketing')}
              className="shrink-0 sm:flex-1 sm:min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-info text-info-foreground border border-info/20 text-[10px] sm:text-xs font-medium hover:opacity-90 transition-opacity justify-center whitespace-nowrap"
            >
              <Camera className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Marketing: <span className="font-bold">{stats.marketing}</span></span>
            </button>

            <button 
              onClick={() => setShowFiltered('partners')}
              className="shrink-0 sm:flex-1 sm:min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-info text-info-foreground border border-info/20 text-[10px] sm:text-xs font-medium hover:opacity-90 transition-opacity justify-center whitespace-nowrap"
            >
              <Handshake className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Parceiros: <span className="font-bold">{stats.partners}</span></span>
            </button>
          </div>
        )}



        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex-1 min-w-0">
              <PageHeader 
                title={showTrash ? "Lixeira de Eventos" : "Programação de Eventos"} 
                description={showTrash ? "Eventos excluídos que podem ser recuperados ou removidos permanentemente." : "Confira os próximos eventos confirmados em todas as nossas unidades."}
                className="mb-0"
              />
            </div>
            {isAuthenticated && isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={showTrash ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowTrash(!showTrash)}
                  className="rounded-full gap-2"
                >
                  <Eye className="h-4 w-4" />
                  {showTrash ? "Ver Eventos Ativos" : "Ver Lixeira"}
                </Button>
              </div>
            )}
          </div>
          
          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por título, local ou descrição..." 
              className="pl-10 h-12 shadow-sm border-border focus-visible:ring-primary bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>




        {sortedEvents.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Nenhum evento encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar sua busca ou volte mais tarde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedEvents.map(event => (
              <Card 
                key={event.id} 
                className="overflow-hidden border-border hover:shadow-lg transition-shadow bg-card flex flex-col group cursor-pointer"
                onClick={() => handleCardClick(event)}
              >

                <div className="relative aspect-video overflow-hidden bg-muted">
                  {event.banner_url_desktop || event.banner_url_mobile ? (
                    <img 
                      src={event.banner_url_desktop || event.banner_url_mobile} 
                      alt={event.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-start p-6 text-left overflow-hidden"
                      style={{ backgroundColor: event.custom_color || '#94a3b8' }}
                    >
                      <span 
                        className="font-bold text-white leading-[1.1] break-words uppercase select-none"
                        style={{ 
                          fontSize: event.title.length < 15 ? '2.5rem' : event.title.length < 30 ? '1.75rem' : event.title.length < 50 ? '1.25rem' : '1rem',
                        }}
                      >
                        {event.title}
                      </span>
                    </div>
                  )}
                  <div className={`absolute top-0 left-0 h-1 w-full ${UNIT_BG_COLORS[event.unit]}`} />
                  <Badge className={`absolute top-3 left-3 ${UNIT_BG_COLORS[event.unit]} text-white border-none shadow-sm`}>
                    {event.unit}
                  </Badge>
                  
                  {isAdmin && isAuthenticated && (
                    <div className="absolute top-3 right-3 flex gap-2.5">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleBanner(event);
                        }}
                        className={`p-2.5 sm:p-1.5 rounded-full shadow-lg backdrop-blur-md transition-colors ${event.show_in_banner ? 'bg-primary text-white' : 'bg-white/80 text-muted-foreground hover:bg-white'}`}
                        title={event.show_in_banner ? "Remover do banner" : "Adicionar ao banner"}
                      >
                        {event.show_in_banner ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                      {isAuthenticated && (
                        <>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[10px]">
                            Confirmado
                          </Badge>
                          {event.show_in_banner && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-medium text-[10px] flex items-center gap-1">
                              <LayoutPanelTop className="h-2 w-2" /> Banner Ativo
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl line-clamp-2 leading-tight group-hover:text-primary transition-colors text-foreground">
                    {event.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{format(new Date(event.start_datetime), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>
                        {format(new Date(event.start_datetime), 'HH:mm')} às {format(new Date(event.end_datetime), 'HH:mm')}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 italic border-t border-border pt-4">
                      "{event.description}"
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {!isAuthenticated && (
        <footer className="bg-card border-t border-border py-12 px-6 mt-12">
          <div className="max-w-7xl mx-auto text-center">
            <img src={logoImg} alt="anabrasil" className="h-8 w-8 rounded-lg mx-auto mb-4 opacity-50 grayscale" />
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} anabrasil. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      )}
      <EventDetailDialog 
        open={!!selectedEventForDetail} 
        onOpenChange={(open) => !open && closeDetail()} 
        event={selectedEventForDetail} 
      />

      <EventFormDialog 
        open={!!selectedEvent} 
        onOpenChange={(open) => !open && setSelectedEvent(null)} 
        event={selectedEvent} 
      />

      <BannerMissingDialog 
        open={showBannerMissingDialog}
        onOpenChange={setShowBannerMissingDialog}
        onConfirm={confirmBannerToggle}
        onAddImage={handleAddImage}
      />

      <ConflictDialog
        events={allEvents}
        selectedMonth={new Date()}
        open={showConflicts}
        onOpenChange={setShowConflicts}
        onEventClick={(e) => { setShowConflicts(false); setTimeout(() => { setDetailEvent(e); setShowDetail(true); }, 200); }}
      />

      {showFiltered && (
        <FilteredEventsDialog
          events={allEvents}
          filterType={showFiltered}
          selectedMonth={new Date()}
          open={!!showFiltered}
          onOpenChange={(v) => { if (!v) setShowFiltered(null); }}
          onEventClick={(e) => { setShowFiltered(null); setTimeout(() => { setDetailEvent(e); setShowDetail(true); }, 200); }}
        />
      )}

      <EventDetailPanel
        event={detailEvent}
        open={showDetail}
        onOpenChange={setShowDetail}
        onEdit={canEdit ? (e) => { setShowDetail(false); setSelectedEvent(e); } : undefined}
        onDelete={canEdit ? (id) => { deleteEvent(id); setShowDetail(false); } : undefined}
      />
    </div>
  );
}


import { useMemo, useState, useEffect, type KeyboardEvent } from 'react';
import { useReduzMovimento } from '@/hooks/useReduzMovimento';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useIsEmbedded } from '@/hooks/useIsEmbedded';
import { useAuth } from '@/contexts/AuthContext';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useUserRole } from '@/hooks/useUserRole';
import { useApp } from '@/contexts/AppContext';
import { AppEvent, UNIT_BG_COLORS, type Unit } from '@/types';
import { rotuloDoTipo } from '@/lib/events/tipo';
import { anoQuandoPreciso } from '@/lib/events/periodo';
import { CalendarDays, MapPin, Clock, Search, ChevronLeft, ChevronRight, LayoutPanelTop, Eye, EyeOff, Pencil, Users, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PageHeader from '@/components/PageHeader';
import { EsqueletoDaVitrine, ErroAoCarregar } from '@/components/events/EsqueletoDeEventos';
import { CapaDaUnidade } from '@/components/events/CapaDaUnidade';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EventDetailDialog } from '@/components/EventDetailDialog';
import { TituloDoEvento } from '@/components/events/TituloDoEvento';
import { tituloEmTexto } from '@/lib/events/titulo';
import { abaInicial, jaAconteceu, lerAba, separarPorData, type Aba } from '@/lib/events/proximosEPassados';
import { textoDaData, textoDoHorario } from '@/lib/events/periodo';
import { enderecoDoLocal, semAcento } from '@/lib/events/local';
import EventFormDialog from '@/components/EventFormDialog';
import { BannerMissingDialog } from '@/components/BannerMissingDialog';
import { VitrineVazia } from '@/components/events/VitrineVazia';
import { RodapePublico } from '@/components/events/RodapePublico';
import { useUiV2 } from '@/lib/uiV2';
import PublicEventsPageClassica from '@/classico/PublicEventsPage';

/**
 * A página pública de eventos — a vitrine que a família vê.
 *
 * Ela é a mesma tela para dois públicos. O visitante sem sessão recebe só a
 * vitrine: herói, grade, detalhe, compartilhar. A equipe logada ganha por
 * cima o **modo equipe**: eventos ocultos no herói com selo, botões de banner
 * e de edição nos cards, selos de status, "Editar evento" dentro do detalhe.
 *
 * Até 08/09/2026 não havia como a equipe ver a página como o visitante sem
 * sair da conta — e o clique no card abria o formulário de edição, não o
 * detalhe. Agora há o interruptor "Ver como visitante" (`?como=visitante`,
 * só na URL: recarregar volta para equipe), o clique abre o detalhe para
 * todo mundo, e a edição é um botão explícito. As pílulas de estatística e a
 * lixeira saíram daqui: as pílulas já existem na Visão Geral, uma aba ao
 * lado; a lixeira virou aba do hub.
 */
/** As unidades que viram chip. A Administração fica de fora, de propósito. */
const UNIDADES_DO_FILTRO: Unit[] = ['DIC', 'Nilópolis', 'Santana'];

/**
 * Fora do app (embed no site, telas limpas), a Programação continua exatamente
 * como era: o site já a incorpora (pedido de 26/10/2026). Dentro do app, a V2.
 */
export default function PublicEventsPage() {
  return useUiV2() ? <ProgramacaoV2 /> : <PublicEventsPageClassica />;
}

function ProgramacaoV2() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<AppEvent | null>(null);
  const [showBannerMissingDialog, setShowBannerMissingDialog] = useState(false);
  const [eventToToggleBanner, setEventToToggleBanner] = useState<AppEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  /** Mouse em cima ou foco dentro do carrossel: ele para de girar. */
  const [carrosselPausado, setCarrosselPausado] = useState(false);
  const reduzMovimento = useReduzMovimento();
  const { isAdmin, canEdit } = useUserRole();
  const { updateEvent, setSelectedEvent, selectedEvent, loading, erroAoCarregar, refetchEvents } = useApp();
  // A aba do navegador dizia "ANA Brasil" em toda a aplicação: duas abas com
  // eventos diferentes eram indistinguíveis. Com o detalhe aberto, é o evento.
  useTituloDaAba(selectedEventForDetail ? `${tituloEmTexto(selectedEventForDetail.title)} · ANA Brasil` : 'Programação de Eventos · ANA Brasil');

  /**
   * Embutida no site institucional (iframe, ou `?embed=true` como o layout
   * já reconhece): sem rodapé e sem os convites para conhecer a ANA — a
   * pessoa já está no site da ANA, e o rodapé do WordPress vem logo abaixo.
   */
  const embutida = useIsEmbedded() || searchParams.get('embed') === 'true';

  // Embutida no site, que é claro, a vitrine fica sempre clara, mesmo com o
  // celular em modo noturno. Antes ela seguia o aparelho e virava um bloco
  // escuro na página branca (varredura de 25/09/2026). É a mesma marca do
  // Mercado: o ThemeProvider lê `temaForcado` e não a sobrescreve.
  useEffect(() => {
    if (!embutida) return;
    const root = document.documentElement;
    root.dataset.temaForcado = 'light';
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
    return () => {
      delete root.dataset.temaForcado;
    };
  }, [embutida]);
  const comoVisitante = searchParams.get('como') === 'visitante';
  /** Logado e sem o interruptor ligado: vê e faz o que é da equipe. */
  const equipe = isAuthenticated && !comoVisitante;
  const alternarVisitante = (ligar: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (ligar) params.set('como', 'visitante');
    else params.delete('como');
    setSearchParams(params, { replace: true });
  };

  /** A vitrine: só confirmado e público, o que qualquer visitante vê. */
  const events = useFilteredEvents(true, false);
  /**
   * Sem evento nenhum, a página muda de figura: sem busca, sem abas, um painel só.
   * Mas só depois de a lista chegar: enquanto `loading`, o esqueleto ocupa o
   * lugar (ver `EsqueletoDaVitrine`) — antes, a mensagem "programação sendo
   * montada" piscava em toda visita. E se a busca falhou, é erro, não vazio.
   */
  const vitrineVazia = !loading && !erroAoCarregar && events.length === 0;

  /**
   * Filtro por unidade, uma por vez, na URL (`?unidade=Santana`). Uma mãe de
   * Santana não precisa ler todos os cards para achar os da unidade dela.
   * A Administração não vira chip: os eventos dela aparecem em "todas".
   * Decisão de 10/09/2026.
   */
  const unidadeNaUrl = searchParams.get('unidade');
  const unidadeFiltro: Unit | null = (UNIDADES_DO_FILTRO as string[]).includes(unidadeNaUrl ?? '') ? (unidadeNaUrl as Unit) : null;
  const filtrarUnidade = (unidade: Unit | null) => {
    const params = new URLSearchParams(searchParams);
    if (unidade) params.set('unidade', unidade);
    else params.delete('unidade');
    setSearchParams(params, { replace: true });
  };

  const filtered = useMemo(() => {
    // "pascoa" acha "Páscoa": termo e campos sem acento (achado 16, 11/09/2026).
    const searchTerm = semAcento(search);
    const daUnidade = unidadeFiltro ? events.filter(e => e.unit === unidadeFiltro) : events;
    if (!searchTerm) return daUnidade;

    return daUnidade.filter(e =>
      semAcento(e.title).includes(searchTerm) ||
      semAcento(e.location || '').includes(searchTerm) ||
      semAcento(e.description || '').includes(searchTerm)
    );
  }, [events, search, unidadeFiltro]);

  /**
   * "Próximos" e "Já aconteceram", em duas abas.
   *
   * A grade ordenava tudo por data crescente e não olhava o dia: em setembro,
   * um evento de março abria a página, embaixo do texto que promete "os
   * próximos eventos". Agora quem já terminou antes de hoje começar vai para
   * a segunda aba (regra em `proximosEPassados.ts`).
   *
   * A aba escolhida fica na URL (`?aba=passados`) para o link poder ser
   * compartilhado já aberto. Sem escolha, abre em "Próximos" — salvo quando só
   * há passados, porque aí "Próximos" seria uma grade vazia com a programação
   * inteira escondida ao lado.
   */
  const { proximos, passados } = useMemo(() => separarPorData(filtered), [filtered]);
  // A aba padrão olha a vitrine inteira, não o resultado da busca: se
  // olhasse a busca, digitar "páscoa" pularia de aba sozinho e apagar o
  // termo pularia de volta. Quem avisa do resultado na outra aba é a linha
  // abaixo das abas.
  const padrao = useMemo(() => {
    const { proximos: p, passados: q } = separarPorData(events);
    return abaInicial(p.length, q.length);
  }, [events]);
  const abaEscolhida = lerAba(searchParams.get('aba'));
  const aba: Aba = abaEscolhida ?? padrao;
  const trocarAba = (nova: Aba) => {
    const params = new URLSearchParams(searchParams);
    params.set('aba', nova);
    setSearchParams(params, { replace: true });
  };
  const sortedEvents = aba === 'passados' ? passados : proximos;
  const outraAba: Aba = aba === 'passados' ? 'proximos' : 'passados';
  const naOutraAba = (aba === 'passados' ? proximos : passados).length;

  /**
   * O herói usa a mesma régua de "já passou" da grade: `jaAconteceu`, pelo
   * término. Até 10/09/2026 ele olhava o início — um retiro de sexta a
   * domingo, no sábado, estava em "Próximos" na grade e tinha sumido do herói.
   */
  const bannerEvents = useMemo(() => {
    const porInicio = (a: AppEvent, b: AppEvent) =>
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();

    // Para o admin no modo equipe, o herói mostra todos da vitrine: os ativos
    // e em cartaz primeiro, os ocultos ou passados depois, com selo. Assim ele
    // vê o que está fora do ar sem sair da página.
    if (equipe && isAdmin) {
      const ativo = (e: AppEvent) => e.show_in_banner && !jaAconteceu(e);
      return [...events].sort((a, b) => {
        if (ativo(a) && !ativo(b)) return -1;
        if (!ativo(a) && ativo(b)) return 1;
        return porInicio(a, b);
      });
    }

    // Para todo o resto: só o que está no banner e ainda não terminou. Um
    // evento de hoje fica até 23:59; um de vários dias, até o último dia.
    return events.filter(e => e.show_in_banner && !jaAconteceu(e)).sort(porInicio);
  }, [events, equipe, isAdmin]);

  const handleToggleBanner = (event: AppEvent) => {
    // Ligar o banner sem imagem 21:9 pede confirmação antes; o editor não
    // abre ainda.
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

  // O link com `?slug=` abre o detalhe para todo mundo. Para o admin ele
  // abria a edição: quem testava o link que ia enviar via outra coisa.
  //
  // Se nenhum evento da vitrine casa com o slug (voltou a pendente, virou
  // interno, foi para a lixeira, ou o endereço veio errado), a página avisa
  // em vez de abrir como se nada tivesse acontecido. Só depois que a lista
  // carregou: antes disso, a vitrine vazia não diz nada.
  // O slug é gravado em minúsculas; a URL pode chegar capitalizada pelo
  // WhatsApp ou digitada. Compara em minúsculas, para não dizer "não está
  // mais disponível" a um evento que existe (achado 17).
  const slugNaUrl = searchParams.get('slug')?.toLowerCase() ?? null;
  const slugInvalido = !!slugNaUrl && !loading && !events.some(e => e.slug === slugNaUrl || e.id === slugNaUrl);
  useEffect(() => {
    if (slugNaUrl && events.length > 0) {
      const found = events.find(e => e.slug === slugNaUrl || e.id === slugNaUrl);
      if (found) setSelectedEventForDetail(found);
    }
  }, [slugNaUrl, events]);

  const fecharAviso = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('slug');
    setSearchParams(params, { replace: true });
  };

  // O giro automático para com o mouse em cima, com foco dentro (quem navega
  // por teclado não perde o slide que estava lendo) e para quem pediu menos
  // movimento ao sistema. As setas e os pontinhos continuam funcionando.
  useEffect(() => {
    if (bannerEvents.length <= 1 || carrosselPausado || reduzMovimento) return;

    const currentEvent = bannerEvents[currentSlide];
    const displayTime = (currentEvent?.banner_display_time || 5) * 1000;

    const timeout = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerEvents.length);
    }, displayTime);

    return () => clearTimeout(timeout);
  }, [bannerEvents, currentSlide, carrosselPausado, reduzMovimento]);

  /**
   * Só o slide atual e os dois vizinhos carregam imagem. Antes todos os slides
   * carregavam de uma vez, no primeiro segundo — e o balde aceita até 25 MB
   * por arquivo.
   */
  const carregaImagem = (index: number) => {
    const n = bannerEvents.length;
    return n <= 3 || index === currentSlide || index === (currentSlide + 1) % n || index === (currentSlide - 1 + n) % n;
  };

  /** Enter ou Espaço no card abrem o detalhe, como o clique. */
  const teclaNoCard = (e: KeyboardEvent<HTMLDivElement>, event: AppEvent) => {
    // Só quando a tecla cai no card em si: nos botões de dentro (lápis, olho)
    // o Enter já é o clique deles, e não deve abrir o detalhe também.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(event);
    }
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % bannerEvents.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + bannerEvents.length) % bannerEvents.length);

  const handleCardClick = (event: AppEvent) => {
    setSelectedEventForDetail(event);
    // O slug vai para a URL para o estado aberto poder ser compartilhado.
    // Substitui a entrada em vez de empilhar, como as abas: abrir e fechar
    // três eventos deixava seis estados no histórico, e o botão de voltar
    // do navegador reabria detalhes já fechados (10/09/2026).
    const params = new URLSearchParams(searchParams);
    params.set('slug', event.slug || event.id);
    setSearchParams(params, { replace: true });
  };

  const editar = (event: AppEvent) => {
    setSelectedEventForDetail(null);
    setSelectedEvent(event);
  };

  const closeDetail = () => {
    setSelectedEventForDetail(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('slug');
    setSearchParams(newParams, { replace: true });
  };

  /** Setas trocam de aba e levam o foco, como um leitor de tela espera de abas. */
  const teclaNaAba = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    trocarAba(outraAba);
    document.getElementById(`aba-${outraAba}`)?.focus();
  };

  return (
    <div className="min-h-screen">
      {/* O h1 da página, só para leitor de tela: o herói vem antes com um h2
          por slide, e o título visível "Programação de Eventos" é um h2. Assim
          a ordem dos títulos faz sentido para quem navega por eles. */}
      <h1 className="sr-only">Programação de Eventos</h1>
      {/* A faixa da equipe: diz o modo e traz o interruptor. Só para quem está
          logado; o visitante anônimo nunca a vê. */}
      {isAuthenticated && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card text-sm ${
              comoVisitante ? 'px-4 py-2' : 'px-4 py-3'
            }`}
          >
            <div className="flex items-center gap-2.5 text-muted-foreground">
              {comoVisitante ? <Eye className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}
              {comoVisitante ? (
                <span>Vendo como <b className="font-semibold text-foreground">visitante</b>. É isto que a família vê.</span>
              ) : (
                <span>
                  Você está vendo a página como <b className="font-semibold text-foreground">equipe</b>: eventos ocultos, botões de banner e edição aparecem.
                </span>
              )}
            </div>
            <label className="flex items-center gap-2.5 font-medium text-foreground cursor-pointer shrink-0">
              <Switch checked={comoVisitante} onCheckedChange={alternarVisitante} aria-label="Ver como visitante" />
              Ver como visitante
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <EsqueletoDaVitrine />
      ) : (
      <>
      {bannerEvents.length > 0 && (
        <section
          role="region"
          aria-roledescription="carrossel"
          aria-label="Eventos em destaque"
          onMouseEnter={() => setCarrosselPausado(true)}
          onMouseLeave={() => setCarrosselPausado(false)}
          onFocus={() => setCarrosselPausado(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCarrosselPausado(false); }}
          className={`relative mx-auto h-[400px] w-[calc(100%-2rem)] max-w-7xl overflow-hidden rounded-[20px] rounded-br-[48px] bg-slate-900 md:h-[460px] md:w-[calc(100%-3rem)] ${isAuthenticated ? 'mt-5' : 'mt-4'}`}
        >
          {bannerEvents.map((event, index) => (
            <div
              key={event.id}
              aria-hidden={index !== currentSlide}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              {/* Desktop Banner (21:9 preferencial, fallback para capa 16:9) */}
              {(event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile) && carregaImagem(index) ? (
                /* Uma <img> só. Antes eram duas alternadas por classe (hidden
                   md:block / md:hidden), e display:none não impede o download:
                   o celular baixava as 21:9 de desktop que nunca veria. O
                   <source> deixa o navegador escolher antes de baixar.
                   Celular: 9:16, depois capa 4:3, 16:9 e por fim o 21:9. */
                <picture>
                  <source
                    media="(min-width: 768px)"
                    srcSet={event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile || event.banner_image_mobile}
                  />
                  <img
                    src={event.banner_image_mobile || event.banner_url_mobile || event.banner_url_desktop || event.banner_image_desktop}
                    alt={tituloEmTexto(event.title)}
                    className="w-full h-full object-cover opacity-60"
                  />
                </picture>
              ) : (
                /* Sem imagem: a foto da unidade, ou a cor do evento quando não há foto */
                <CapaDaUnidade evento={event} comTitulo={false} prioridade />
              )}

              {event.show_banner_overlay !== false && (
                <div className="absolute inset-0 bg-slate-900/40 z-[5]" />
              )}

              {event.show_banner_fade !== false && (
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-[10]" />
              )}

              <div className="glass-photo absolute bottom-4 left-4 right-4 z-[20] flex max-h-[calc(100%-2rem)] flex-col items-start rounded-[20px] p-5 md:bottom-8 md:left-8 md:right-auto md:max-w-[580px] md:p-7">
                <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                  <Badge className={`${UNIT_BG_COLORS[event.unit]} text-slate-900 border-none shadow-lg`}>
                    {event.unit}
                  </Badge>
                  {/* Os dois motivos de a família não ver este slide. Sem o
                      segundo, um evento passado com banner ligado ficava no
                      carrossel do admin como se estivesse no ar. */}
                  {equipe && isAdmin && !event.show_in_banner && (
                    <Badge variant="outline" className="bg-slate-900/80 text-slate-200 border-slate-700 backdrop-blur-sm">
                      Oculto para o Público
                    </Badge>
                  )}
                  {equipe && isAdmin && jaAconteceu(event) && (
                    <Badge variant="outline" className="bg-slate-900/80 text-slate-200 border-slate-700 backdrop-blur-sm">
                      Já aconteceu
                    </Badge>
                  )}
                </div>

                {event.use_logo_as_title && event.event_logo_url ? (
                  <div className={`mb-6 animate-in slide-in-from-left duration-700 w-full flex items-center justify-start ${event.full_height_title ? 'h-1/2' : 'h-24 md:h-40'}`}>
                    <img
                      src={event.event_logo_url}
                      alt={tituloEmTexto(event.title)}
                      className={`object-contain object-left h-full max-w-full filter drop-shadow-2xl`}
                    />
                  </div>
                ) : (
                  <h2
                    className={`font-bold text-white mb-4 leading-tight drop-shadow-lg ${event.full_height_title ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl'}`}
                  >
                    <TituloDoEvento texto={event.title} apenasNoDesktop />
                  </h2>
                )}
                <div className="flex flex-wrap gap-4 text-slate-200 text-sm md:text-base mb-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    <span>{textoDaData(event, anoQuandoPreciso(event))}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-start gap-2" data-testid="local-heroi">
                      <MapPin className="h-5 w-5 shrink-0" />
                      <span>
                        {event.location}
                        {event.visibility === 'publico' && enderecoDoLocal(event.location) && (
                          <span className="block text-xs md:text-sm text-slate-300" data-testid="endereco-heroi">{enderecoDoLocal(event.location)}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="rounded-xl bg-white px-6 text-[#1F2322] hover:bg-white/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(event);
                    }}
                  >
                    Saber mais
                  </Button>
                  {equipe && isAdmin && (
                    <Button
                      variant="outline"
                      size="lg"
                      className={`rounded-xl border-white/40 bg-transparent text-white backdrop-blur-md hover:bg-white/15 hover:text-white ${event.show_in_banner ? '' : 'border-[#81e2cf] text-[#81e2cf]'}`}
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
                aria-label="Slide anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all z-20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextSlide}
                aria-label="Próximo slide"
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
        {slugInvalido && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Este evento não está mais disponível</p>
              <p>Ele pode ter sido remarcado ou fechado ao público. Veja abaixo a programação atual.</p>
              {equipe && <p className="mt-1 opacity-80">Se ele existe, está pendente, interno ou na lixeira.</p>}
            </div>
            <button type="button" onClick={fecharAviso} aria-label="Fechar aviso" className="rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="mb-8">
          <PageHeader
            title="Programação de Eventos"
            description="Confira os próximos eventos confirmados em todas as nossas unidades."
            className="mb-0"
            nivel={2}
          />

          {/* A busca só aparece quando há o que buscar. */}
          {!vitrineVazia && (
          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {/* `bg-card`, e não `bg-white`: o campo precisa se destacar do fundo
                da página, e era isso que o branco fazia — só que no escuro ele
                continuava branco, com o texto claro por cima. Medido a 1,06:1:
                a pessoa digitava sem ver. O token faz as duas coisas — quase
                branco no claro, superfície escura no escuro. */}
            <Input
              placeholder="Buscar por título, local ou descrição..."
              aria-label="Buscar eventos por título, local ou descrição"
              type="search"
              className="pl-10 h-12 shadow-sm border-border bg-card focus-visible:ring-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          )}
        </div>

        {(proximos.length > 0 || passados.length > 0) && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {/* 44 px de altura (h-11 / h-9 por dentro): no celular o dedo errava a aba
                e acertava o chip ao lado. Mesma fonte, mais espaço interno. */}
            <div role="tablist" aria-label="Período" className="inline-flex h-11 items-center rounded-full bg-muted p-1 text-muted-foreground">
              {([
                ['proximos', 'Próximos', proximos.length],
                ['passados', 'Já aconteceram', passados.length],
              ] as [Aba, string, number][]).map(([valor, rotulo, total]) => (
                <button
                  key={valor}
                  id={`aba-${valor}`}
                  type="button"
                  role="tab"
                  aria-selected={aba === valor}
                  aria-controls="painel-da-aba"
                  tabIndex={aba === valor ? 0 : -1}
                  onKeyDown={teclaNaAba}
                  onClick={() => trocarAba(valor)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                    aba === valor ? 'bg-card text-foreground shadow-sm' : 'hover:text-foreground'
                  }`}
                >
                  {rotulo}
                  <span className={`text-xs tabular-nums ${aba === valor ? 'text-muted-foreground' : ''}`}>{total}</span>
                </button>
              ))}
            </div>
            <div className="hidden sm:block h-6 w-px bg-border" aria-hidden />
            <div role="group" aria-label="Filtrar por unidade" className="flex flex-wrap items-center gap-1.5">
              {UNIDADES_DO_FILTRO.map(unidade => {
                const ligado = unidadeFiltro === unidade;
                return (
                  <button
                    key={unidade}
                    type="button"
                    aria-pressed={ligado}
                    onClick={() => filtrarUnidade(ligado ? null : unidade)}
                    className={`inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                      ligado ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${UNIT_BG_COLORS[unidade]} ${ligado ? 'ring-2 ring-background' : ''}`} />
                    {unidade}
                    {ligado && <span aria-hidden className="opacity-70">×</span>}
                  </button>
                );
              })}
            </div>
            {/* Quem busca "Páscoa" em setembro quer o evento de março, que está
                na outra aba. Em vez de trocar de aba sozinho, avisa. */}
            {search && sortedEvents.length === 0 && naOutraAba > 0 && (
              <button
                type="button"
                onClick={() => trocarAba(outraAba)}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {naOutraAba === 1 ? '1 resultado' : `${naOutraAba} resultados`} em {outraAba === 'passados' ? 'Já aconteceram' : 'Próximos'}
              </button>
            )}
          </div>
        )}

        <div id="painel-da-aba" role={vitrineVazia ? undefined : 'tabpanel'} aria-labelledby={vitrineVazia ? undefined : `aba-${aba}`}>
        {erroAoCarregar && events.length === 0 ? (
          <ErroAoCarregar oQue="a programação" onTentar={refetchEvents} />
        ) : vitrineVazia ? (
          <VitrineVazia onCriar={equipe && canEdit ? () => setShowNewEvent(true) : undefined} semConvites={embutida} />
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            {!search && unidadeFiltro ? (
              <>
                <h3 className="text-lg font-medium text-foreground">
                  Nenhum evento de {unidadeFiltro} {aba === 'passados' ? 'entre os que já aconteceram' : 'nos próximos'}
                </h3>
                <p className="text-muted-foreground">
                  <button type="button" onClick={() => filtrarUnidade(null)} className="font-medium text-foreground underline underline-offset-4">
                    Ver todas as unidades
                  </button>
                </p>
              </>
            ) : !search && aba === 'proximos' && passados.length > 0 ? (
              <>
                <h3 className="text-lg font-medium text-foreground">Nenhum evento agendado no momento</h3>
                <p className="text-muted-foreground">
                  A próxima programação está sendo montada. Enquanto isso, veja{' '}
                  <button type="button" onClick={() => trocarAba('passados')} className="font-medium text-foreground underline underline-offset-4">
                    o que já aconteceu
                  </button>.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-foreground">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground">Tente ajustar sua busca ou volte mais tarde.</p>
              </>
            )}
          </div>
        ) : (
          /* Esboço V2: os eventos em lista, com a data em destaque, no lugar da
             grade de cartões. Mesmo papel de botão, mesmo título (h3), mesma
             capa e o mesmo endereço; só o arranjo mudou. */
          <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
            {sortedEvents.map(event => {
              const inicio = new Date(event.start_datetime);
              return (
                <div
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver detalhes de ${tituloEmTexto(event.title)}`}
                  onKeyDown={(e) => teclaNoCard(e, event)}
                  onClick={() => handleCardClick(event)}
                  className={`group grid cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[56px_minmax(0,1fr)_auto_136px] sm:px-5 ${
                    aba === 'passados' ? 'opacity-75 [&_img]:saturate-50 [&_.capa-sem-imagem]:saturate-50' : ''
                  }`}
                >
                  <div className="grid justify-items-center self-start pt-0.5 leading-none sm:self-center sm:pt-0">
                    <span className="font-display text-[26px] font-bold tabular-nums text-foreground">{format(inicio, 'dd')}</span>
                    <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{format(inicio, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                  </div>

                  <div className="min-w-0">
                    {(jaAconteceu(event) || (equipe && (event.event_type || event.show_in_banner))) && (
                      <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1">
                        {jaAconteceu(event) && <Badge variant="secondary" className="text-[11px]">Já aconteceu</Badge>}
                        {/* Na vitrine todo evento é confirmado: o selo não dizia nada.
                            O tipo, que só a equipe recebe, diz. */}
                        {equipe && event.event_type && <Badge variant="secondary" className="text-[11px]">{rotuloDoTipo(event.event_type)}</Badge>}
                        {equipe && event.show_in_banner && <Badge className="text-[11px] text-[hsl(var(--sel,168_80%_27%))]">Banner Ativo</Badge>}
                      </div>
                    )}
                    <h3 className="font-display text-base font-semibold leading-snug text-foreground line-clamp-2 sm:text-[17px]">
                      <TituloDoEvento texto={event.title} />
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-0.5 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[event.unit]}`} />
                        {event.unit}
                      </span>
                      <span>{textoDaData(event)}</span>
                      <span>{textoDoHorario(event)}</span>
                      {event.location && (
                        <span className="min-w-0">
                          {event.location}
                          {/* Evento público mostra o endereço inteiro da unidade
                              (22/09/2026): quem vem de fora precisa saber onde é. */}
                          {event.visibility === 'publico' && enderecoDoLocal(event.location) && (
                            <span className="block text-xs text-[hsl(var(--fraco,0_0%_45%))] line-clamp-1" data-testid="endereco-card">{enderecoDoLocal(event.location)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Os botões da equipe: o lápis edita direto (o clique na linha
                      abre o detalhe, como para o visitante); o olho liga e
                      desliga o banner. */}
                  <div className="col-start-2 flex gap-1.5 sm:col-start-auto">
                    {equipe && canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          editar(event);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Editar evento"
                        aria-label="Editar evento"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {equipe && isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleBanner(event);
                        }}
                        className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${event.show_in_banner ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        title={event.show_in_banner ? 'Remover do banner' : 'Adicionar ao banner'}
                        aria-label={event.show_in_banner ? 'Remover do banner' : 'Adicionar ao banner'}
                      >
                        {event.show_in_banner ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  <div className="relative hidden aspect-video overflow-hidden rounded-xl bg-muted sm:block">
                    {/* Capa 16:9, depois 4:3, e por último o banner 21:9. */}
                    {event.banner_url_desktop || event.banner_url_mobile || event.banner_image_desktop ? (
                      <img
                        src={event.banner_url_desktop || event.banner_url_mobile || event.banner_image_desktop}
                        alt={tituloEmTexto(event.title)}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      /* Sem arte: a foto da unidade com a cor dela por cima. */
                      <CapaDaUnidade evento={event} comTitulo={false} className="select-none" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>

      {/* O rodapé é do visitante — e de quem está vendo como visitante. */}
      {!equipe && !embutida && <RodapePublico />}
      </>
      )}

      <EventDetailDialog
        open={!!selectedEventForDetail}
        onOpenChange={(open) => !open && closeDetail()}
        event={selectedEventForDetail}
        comoVisitante={!equipe}
        onEditar={equipe && canEdit ? editar : undefined}
        onAlternarBanner={equipe && isAdmin ? handleToggleBanner : undefined}
      />

      <EventFormDialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
        event={selectedEvent}
      />
      {/* Evento novo, a partir do painel de vitrine vazia. */}
      <EventFormDialog open={showNewEvent} onOpenChange={setShowNewEvent} />

      <BannerMissingDialog
        open={showBannerMissingDialog}
        onOpenChange={setShowBannerMissingDialog}
        onConfirm={confirmBannerToggle}
        onAddImage={handleAddImage}
      />
    </div>
  );
}

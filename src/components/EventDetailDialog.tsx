import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, MapPin, Clock, Share2, X, Instagram, MessageCircle, Copy, Megaphone, CheckCircle2 } from 'lucide-react';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { linkPublicoDoEvento } from '@/lib/events/linkPublico';
import { motivoDoApoio, resumoDoTransporte } from '@/lib/events/transporte';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AppEvent | null;
}

export function EventDetailDialog({ open, onOpenChange, event }: Props) {
  const { user } = useAuth();
  const { activePersona } = useTestView();
  const isInternalView = activePersona ? activePersona.id !== 'test-nao-logado' : !!user;
  if (!event) return null;

  const eventUrl = linkPublicoDoEvento(event.slug || event.id);

  const shareOnWhatsApp = () => {
    const text = `Confira este evento: ${event.title}\n${eventUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(eventUrl);
    toast.success('Link copiado para a área de transferência!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-none sm:rounded-2xl shadow-2xl">
        <div className="relative aspect-[21/9] md:aspect-[3/1] bg-slate-900 overflow-hidden">
          {(event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile) ? (
            <img 
              src={event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile} 
              alt={event.title}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-start p-8 text-left overflow-hidden"
              style={{ backgroundColor: event.custom_color || '#1e293b' }}
            >
              <span 
                className="font-bold text-white leading-[1.1] break-words uppercase select-none"
                style={{ 
                  fontSize: event.title.length < 15 ? '4rem' : event.title.length < 30 ? '3rem' : event.title.length < 50 ? '2rem' : '1.5rem',
                }}
              >
                {event.title}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 md:p-10 -mt-12 relative z-10">
          <Badge className={`${UNIT_BG_COLORS[event.unit]} text-white border-none mb-4 shadow-lg text-sm px-4 py-1`}>
            {event.unit}
          </Badge>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
                {event.title}
              </h2>
              
              <div className="flex flex-wrap gap-6 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Data</p>
                    <p className="font-medium">{format(new Date(event.start_datetime), "dd 'de' MMMM", { locale: ptBR })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Horário</p>
                    <p className="font-medium">
                      {format(new Date(event.start_datetime), 'HH:mm')} - {format(new Date(event.end_datetime), 'HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Local</p>
                    <p className="font-medium">{event.location}</p>
                  </div>
                </div>
              </div>

              <div className="prose prose-slate max-w-none pt-6 border-t border-border">
                <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">
                  {event.description || 'Nenhuma descrição detalhada disponível para este evento.'}
                </p>
              </div>

              {/* Logística é combinação da equipe: quem leva o som, quem cuida
                  do lanche. Só o bloco de marketing era interno; este ficou de
                  fora da regra e aparecia para qualquer visitante. Hoje os campos
                  estão vazios nos eventos públicos, então ninguém viu nada — mas
                  bastava alguém preencher "Alimentação". */}
              {isInternalView &&
                (event.target_audience || event.support_team || event.food_logistics || event.equipment_needed || event.printed_materials || event.transport_needed) && (
                <div className="pt-6 border-t border-border space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Logística e Apoio</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {event.target_audience && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Público-Alvo</p>
                        <p className="text-foreground">{event.target_audience}</p>
                      </div>
                    )}
                    {event.support_team && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Equipe de Apoio</p>
                        <p className="text-foreground">{event.support_team}</p>
                      </div>
                    )}
                    {event.food_logistics && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Alimentação</p>
                        <p className="text-foreground whitespace-pre-wrap">{event.food_logistics}</p>
                      </div>
                    )}
                    {event.equipment_needed && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Equipamentos</p>
                        <p className="text-foreground">{event.equipment_needed}</p>
                      </div>
                    )}
                    {event.printed_materials && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Materiais Impressos</p>
                        <p className="text-foreground">{event.printed_materials}</p>
                      </div>
                    )}
                    {(() => {
                      const t = resumoDoTransporte(event);
                      if (!t) return null;
                      const apoio = motivoDoApoio(t);
                      return (
                        <div className="col-span-1 md:col-span-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Transporte</p>
                          <p className="text-foreground">{t.texto}</p>
                          {apoio && <p className="text-xs font-medium text-destructive">{apoio}</p>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              {event.has_unit_collaboration && (
                <div className="pt-6 border-t border-border space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Parcerias e Colaborações</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {event.collaborating_units.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Unidades Internas</p>
                        <p className="text-foreground">{event.collaborating_units.join(', ')}</p>
                      </div>
                    )}
                    {event.external_collaborators.length > 0 && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Instituições Externas</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                          {event.external_collaborators.map((ext, idx) => (
                            <div key={idx} className="bg-muted/50 rounded-lg p-3 border border-border">
                              <p className="font-bold text-foreground text-sm">
                                {typeof ext === 'string' ? ext : ext.name}
                              </p>
                              {typeof ext !== 'string' && ext.details && (
                                <p className="text-xs text-muted-foreground mt-0.5">{ext.details}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {event.marketing_request && isInternalView && (
                <div className="pt-6 border-t border-border space-y-4">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-blue-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-500">Solicitação de Marketing</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {(event.marketing_coverage || (event.marketing_items && event.marketing_items.length > 0)) && (
                      <div className="space-y-6">
                        {/* Cobertura */}
                        {event.marketing_coverage && (
                          <div className="space-y-3">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-blue-500" /> Cobertura do Evento Solicitada
                            </p>
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                              <p className="text-blue-900 text-sm font-medium italic opacity-80">
                                Foi solicitada a cobertura fotográfica e de vídeo para este evento.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Demanda Gráfica */}
                        {event.marketing_items.some(i => i.type === 'demanda_grafica') && (
                          <div className="space-y-3">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Demanda Gráfica (Arte/Impressão)</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {event.marketing_items.filter(i => i.type === 'demanda_grafica').map((item, idx) => (
                                <div key={idx} className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-tighter mb-1">{item.item}</p>
                                  <p className="text-indigo-900 text-sm whitespace-pre-wrap leading-relaxed opacity-80">{item.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* O que já está pronto, para o marketing não refazer. Aparece
                        junto do pedido, seja qual for o pedido. `marketing_info`
                        saiu: nunca teve campo nem dado. */}
                    {event.printed_materials && (
                      <div className="bg-muted/50 rounded-xl p-4 border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter mb-1">Materiais impressos já existentes</p>
                        <p className="text-foreground text-sm break-all">{event.printed_materials}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:w-72 space-y-6">
              <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Share2 className="h-4 w-4" /> Compartilhar
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-auto py-3 gap-2 border-border hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                    onClick={shareOnWhatsApp}
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">WhatsApp</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex flex-col h-auto py-3 gap-2 border-border hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200"
                  >
                    <Instagram className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase">Instagram</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="col-span-2 flex items-center justify-center gap-2 border-border"
                    onClick={copyLink}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="text-xs">Copiar Link</span>
                  </Button>
                </div>
              </div>

              <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                <p className="text-xs text-primary font-bold uppercase tracking-widest mb-2">Informação</p>
                <p className="text-sm text-muted-foreground">
                  Este evento é {event.visibility === 'publico' ? 'público e aberto a todos' : 'interno para colaboradores'}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

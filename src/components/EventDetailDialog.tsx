import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Clock, Share2, X, MessageCircle, Copy, Megaphone, CheckCircle2, Pencil, Eye, EyeOff } from 'lucide-react';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { linkPublicoDoEvento } from '@/lib/events/linkPublico';
import { motivoDoApoio, resumoDoTransporte } from '@/lib/events/transporte';
import { ROTULO_DA_COBERTURA, estadoDaCobertura } from '@/lib/events/cobertura';
import { ResumoDeItens } from './events/ResumoDeItens';
import { TextoComLinks } from './events/TextoComLinks';
import { TituloDoEvento } from './events/TituloDoEvento';
import { tituloEmTexto } from '@/lib/events/titulo';
import { textoDaData, textoDoHorario } from '@/lib/events/periodo';
import { jaAconteceu } from '@/lib/events/proximosEPassados';
import { textoDoWhatsApp } from '@/lib/events/compartilhar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AppEvent | null;
  /**
   * Quem está logado mas ligou "Ver como visitante" quer ver exatamente o
   * que a família vê: sem logística, sem marketing, sem botões da equipe.
   */
  comoVisitante?: boolean;
  /** Presente só para quem pode editar, no modo equipe: mostra "Editar evento". */
  onEditar?: (evento: AppEvent) => void;
  /** Presente só para admin, no modo equipe: liga e desliga o banner daqui. */
  onAlternarBanner?: (evento: AppEvent) => void;
}

export function EventDetailDialog({ open, onOpenChange, event, comoVisitante = false, onEditar, onAlternarBanner }: Props) {
  const { user } = useAuth();
  const { activePersona } = useTestView();
  const isInternalView = !comoVisitante && (activePersona ? activePersona.id !== 'test-nao-logado' : !!user);
  /**
   * Quando a área de transferência recusa (iframe do site, conexão sem HTTPS,
   * permissão negada), o link aparece num campo para a pessoa copiar à mão.
   * Antes o botão dizia "copiado" sem esperar a resposta — e não tinha copiado.
   */
  const [linkParaCopiar, setLinkParaCopiar] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setLinkParaCopiar(null);
  }, [open, event?.id]);
  if (!event) return null;

  const eventUrl = linkPublicoDoEvento(event.slug || event.id);

  const shareOnWhatsApp = () => {
    // Título, data com horário, local e o link: a família decide sem clicar.
    const text = textoDoWhatsApp(event, eventUrl);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sem área de transferência');
      await navigator.clipboard.writeText(eventUrl);
      setLinkParaCopiar(null);
      toast.success('Link copiado para a área de transferência!');
    } catch {
      setLinkParaCopiar(eventUrl);
      toast.error('Não deu para copiar sozinho. Selecione o link abaixo e copie.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `semFechar`: o detalhe tem o próprio X, sobre a imagem. Com o padrão
          por baixo eram dois X sobrepostos, um deles em inglês. */}
      <DialogContent semFechar className="max-w-4xl p-0 overflow-hidden bg-background border-none sm:rounded-2xl shadow-2xl">
        <div className="relative aspect-[21/9] md:aspect-[3/1] bg-slate-900 overflow-hidden">
          {(event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile) ? (
            <img 
              src={event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile} 
              alt={tituloEmTexto(event.title)}
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
                <TituloDoEvento texto={event.title} />
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <button 
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 md:p-10 -mt-12 relative z-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className={`${UNIT_BG_COLORS[event.unit]} text-slate-900 border-none shadow-lg text-sm px-4 py-1`}>
              {event.unit}
            </Badge>
            {/* O card da aba "Já aconteceram" tem o selo; o detalhe que abre a
                partir dele, ou de um link antigo, não tinha. */}
            {jaAconteceu(event) && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-sm px-3 py-1">
                Encerrado
              </Badge>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              {/* O h2 é o nome do diálogo: `asChild` faz o DialogTitle do Radix
                  usar este mesmo elemento, sem um segundo título. */}
              <DialogTitle asChild>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
                <TituloDoEvento texto={event.title} />
              </h2>
              </DialogTitle>
              
              <div className="flex flex-wrap gap-6 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Data</p>
                    <p className="font-medium">{textoDaData(event, { comAno: false })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Horário</p>
                    <p className="font-medium">{textoDoHorario(event, { separador: ' - ' })}</p>
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
                {/* Endereços de inscrição ou de mapa colados na descrição viram
                    links; o resto continua texto. */}
                <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">
                  {event.description ? <TextoComLinks texto={event.description} /> : 'Nenhuma descrição detalhada disponível para este evento.'}
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
                    {event.food_items && event.food_items.length > 0 ? (
                      <div className="col-span-1 md:col-span-2"><ResumoDeItens titulo="Alimentação" itens={event.food_items} copiar /></div>
                    ) : event.food_logistics && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Alimentação</p>
                        <p className="text-foreground whitespace-pre-wrap">{event.food_logistics}</p>
                      </div>
                    )}
                    {event.food_details && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Observações gerais da alimentação</p>
                        <p className="text-foreground whitespace-pre-wrap">{event.food_details}</p>
                      </div>
                    )}
                    {event.equipment_items && event.equipment_items.length > 0 ? (
                      <div className="col-span-1 md:col-span-2"><ResumoDeItens titulo="Equipamentos" itens={event.equipment_items} copiar /></div>
                    ) : event.equipment_needed && (
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
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-2">
                              <p className="text-blue-900 text-sm font-medium">
                                Cobertura fotográfica e/ou vídeo solicitada pela unidade.
                              </p>
                              {(() => {
                                const estado = estadoDaCobertura(event);
                                if (estado === 'nao-pedida') return null;
                                const classe = estado === 'confirmada'
                                  ? 'bg-success/15 text-success border-success/40'
                                  : estado === 'sem-marketing'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-white text-muted-foreground border-border';
                                return <Badge variant="outline" className={`text-[11px] font-medium ${classe}`}>{ROTULO_DA_COBERTURA[estado]}</Badge>;
                              })()}
                              <p className="text-[11px] text-blue-900/80">
                                Em todo caso, a unidade registra o evento (fotos e vídeos pelo celular) e envia o material ao marketing.
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
              {/* O clique no card abre este detalhe para todo mundo; a edição,
                  que antes vinha direto para o admin, fica aqui, explícita. */}
              {(onEditar || onAlternarBanner) && (
                <div className="bg-muted/50 rounded-2xl p-6 border border-border space-y-3">
                  {onEditar && (
                    <Button className="w-full gap-2" onClick={() => onEditar(event)}>
                      <Pencil className="h-4 w-4" /> Editar evento
                    </Button>
                  )}
                  {onAlternarBanner && (
                    <Button variant="outline" className="w-full gap-2 border-border" onClick={() => onAlternarBanner(event)}>
                      {event.show_in_banner ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {event.show_in_banner ? 'Remover do banner' : 'Adicionar ao banner'}
                    </Button>
                  )}
                </div>
              )}
              <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Share2 className="h-4 w-4" /> Compartilhar
                </h3>
                {/* Havia um botão "Instagram" aqui, sem ação nenhuma: o
                    Instagram não aceita compartilhar link pela web. Saiu em
                    08/09/2026; ficam os dois que funcionam. */}
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2 border-border hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                    onClick={shareOnWhatsApp}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">WhatsApp</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2 border-border"
                    onClick={copyLink}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="text-xs">Copiar Link</span>
                  </Button>
                  {linkParaCopiar && (
                    <input
                      readOnly
                      aria-label="Link do evento para copiar"
                      value={linkParaCopiar}
                      onFocus={e => e.currentTarget.select()}
                      onClick={e => e.currentTarget.select()}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                    />
                  )}
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

import { useEffect, useState, type ReactNode } from 'react';
import { X, MessageCircle, Copy, Pencil, Eye, EyeOff } from 'lucide-react';
import { useIsEmbedded } from '@/hooks/useIsEmbedded';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { linkPublicoDoEvento } from '@/lib/events/linkPublico';
import { enderecoDoLocal } from '@/lib/events/local';
import { motivoDoApoio, resumoDoTransporte } from '@/lib/events/transporte';
import { ROTULO_DA_COBERTURA, estadoDaCobertura } from '@/lib/events/cobertura';
import { ResumoDeItens } from './events/ResumoDeItens';
import { TextoComLinks } from './events/TextoComLinks';
import { TituloDoEvento } from './events/TituloDoEvento';
import { CapaDaUnidade } from './events/CapaDaUnidade';
import { ResumoDoPedidoDeArte } from './events/ResumoDoPedidoDeArte';
import { temArte } from '@/lib/events/arte';
import { gerarChecklistPdf } from '@/lib/events/checklistPdf';
import { ClipboardList } from 'lucide-react';
import { tituloEmTexto } from '@/lib/events/titulo';
import { anoQuandoPreciso, textoDaData, textoDoHorario } from '@/lib/events/periodo';
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
   * Esboço V2: no app o detalhe é uma folha lateral. Embutido no site
   * (iframe ou `?embed=true`) fica a janela central de sempre: lá a altura
   * da tela é a do iframe, e uma folha da altura dele não faria sentido.
   */
  const embutido = useIsEmbedded();
  const lateral = !embutido && !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true');
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

  const temArteDeCapa = !!(event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `semFechar`: o detalhe tem o próprio X, sobre a imagem. Com o padrão
          por baixo eram dois X sobrepostos, um deles em inglês.
          Esboço V2: dentro do app o detalhe abre numa folha lateral, como o
          formulário; embutido no site (iframe), continua a janela central. */}
      <DialogContent
        semFechar
        className={lateral
          ? 'folha-lateral left-auto right-0 top-0 h-[100svh] max-h-[100svh] w-full translate-x-0 translate-y-0 content-start gap-0 overflow-y-auto rounded-none border-none p-0 sm:right-3 sm:top-3 sm:h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-1.5rem)] sm:max-w-[720px] sm:rounded-[22px]'
          : 'max-w-4xl gap-0 p-0 overflow-hidden bg-background border-none sm:rounded-2xl shadow-2xl'}
      >
        <div className={`relative overflow-hidden bg-slate-900 ${lateral ? 'aspect-[21/9]' : 'aspect-[21/9] md:aspect-[3/1]'}`}>
          {temArteDeCapa ? (
            <img
              src={event.banner_image_desktop || event.banner_url_desktop || event.banner_url_mobile}
              alt={tituloEmTexto(event.title)}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Sem arte: a foto da unidade com a cor dela por cima (22/09/2026).
               Sem título na capa: o h2 logo abaixo já o escreve (varredura de 25/09). */
            <CapaDaUnidade evento={event} comTitulo={false} prioridade className="select-none" />
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`space-y-6 p-5 sm:p-7 ${lateral ? '' : 'md:p-10'}`}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[event.unit]}`} />
                {event.unit}
              </span>
              {/* O card da aba "Já aconteceram" tem o selo; o detalhe que abre a
                  partir dele, ou de um link antigo, não tinha. */}
              {jaAconteceu(event) && <Badge variant="secondary" className="text-[13px]">Já aconteceu</Badge>}
            </div>

            {/* O h2 é o nome do diálogo: `asChild` faz o DialogTitle do Radix
                usar este mesmo elemento, sem um segundo título. */}
            <DialogTitle asChild>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
              <TituloDoEvento texto={event.title} />
            </h2>
            </DialogTitle>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-[13px] text-muted-foreground">Data</dt>
              <dd className="font-medium text-foreground">{textoDaData(event, anoQuandoPreciso(event))}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[13px] text-muted-foreground">Horário</dt>
              <dd className="font-medium text-foreground">{textoDoHorario(event, { separador: ' - ' })}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[13px] text-muted-foreground">Local</dt>
              <dd className="font-medium text-foreground">{event.location}</dd>
              {event.visibility === 'publico' && enderecoDoLocal(event.location) && (
                <dd className="text-xs text-muted-foreground" data-testid="endereco-detalhe">{enderecoDoLocal(event.location)}</dd>
              )}
            </div>
          </dl>

          {/* O clique no card abre este detalhe para todo mundo; a edição,
              que antes vinha direto para o admin, fica aqui, explícita.
              Editar é o único botão forte. */}
          {(onEditar || onAlternarBanner || isInternalView) && (
            <div className="flex flex-wrap gap-2">
              {onEditar && (
                <Button className="gap-2" onClick={() => onEditar(event)}>
                  <Pencil className="h-4 w-4" /> Editar evento
                </Button>
              )}
              {/* O checklist do evento, para baixar de novo depois do
                  pop-up (22/09/2026). Acompanha as edições: é montado
                  do evento como está agora. */}
              {isInternalView && (
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="baixar-checklist"
                  onClick={async () => {
                    try {
                      const { nome } = await gerarChecklistPdf(event);
                      toast.success('Checklist baixado', { description: nome });
                    } catch (erro) {
                      toast.error('Não deu para gerar o PDF', { description: erro instanceof Error ? erro.message : 'Tente de novo.' });
                    }
                  }}
                >
                  <ClipboardList className="h-4 w-4" /> Baixar checklist (PDF)
                </Button>
              )}
              {onAlternarBanner && (
                <Button variant="outline" className="gap-2" onClick={() => onAlternarBanner(event)}>
                  {event.show_in_banner ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {event.show_in_banner ? 'Remover do banner' : 'Adicionar ao banner'}
                </Button>
              )}
            </div>
          )}

          <div className="max-w-none">
            {/* Endereços de inscrição ou de mapa colados na descrição viram
                links; o resto continua texto. */}
            <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap md:text-lg">
              {event.description ? <TextoComLinks texto={event.description} /> : 'Nenhuma descrição detalhada disponível para este evento.'}
            </p>
          </div>

          {/* Logística é combinação da equipe: quem leva o som, quem cuida
              do lanche. Só o bloco de marketing era interno; este ficou de
              fora da regra e aparecia para qualquer visitante. */}
          {isInternalView &&
            (event.target_audience || event.support_team || event.food_logistics || event.equipment_needed || event.printed_materials || event.transport_needed) && (
            <Bloco titulo="Logística">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {event.target_audience && <Campo rotulo="Para quem">{event.target_audience}</Campo>}
                {event.support_team && <Campo rotulo="Quem ajuda no dia">{event.support_team}</Campo>}
                {event.food_items && event.food_items.length > 0 ? (
                  <div className="col-span-1 md:col-span-2"><ResumoDeItens titulo="Alimentação" itens={event.food_items} copiar /></div>
                ) : event.food_logistics && (
                  <Campo rotulo="Alimentação" largo preformatado>{event.food_logistics}</Campo>
                )}
                {event.food_details && <Campo rotulo="Restrições e avisos sobre a comida" largo preformatado>{event.food_details}</Campo>}
                {event.equipment_items && event.equipment_items.length > 0 ? (
                  <div className="col-span-1 md:col-span-2"><ResumoDeItens titulo="Equipamentos" itens={event.equipment_items} copiar /></div>
                ) : event.equipment_needed && (
                  <Campo rotulo="Equipamentos">{event.equipment_needed}</Campo>
                )}
                {event.printed_materials && <Campo rotulo="Materiais Impressos">{event.printed_materials}</Campo>}
                {(() => {
                  const t = resumoDoTransporte(event);
                  if (!t) return null;
                  const apoio = motivoDoApoio(t);
                  return (
                    <Campo rotulo="Transporte" largo>
                      {t.texto}
                      {apoio && (
                        <span className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-destructive">
                          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{apoio}
                        </span>
                      )}
                    </Campo>
                  );
                })()}
              </div>
            </Bloco>
          )}

          {event.has_unit_collaboration && (
            <Bloco titulo="Parcerias e Colaborações">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {event.collaborating_units.length > 0 && (
                  <Campo rotulo="Unidades da ANA">{event.collaborating_units.join(', ')}</Campo>
                )}
                {event.external_collaborators.length > 0 && (
                  <div className="col-span-1 md:col-span-2">
                    <p className="text-[13px] text-muted-foreground">Instituições</p>
                    <div className="mt-1.5 overflow-hidden rounded-2xl border border-border bg-card">
                      {event.external_collaborators.map((ext, idx) => (
                        <div key={idx} className="border-b border-border/70 px-4 py-2.5 last:border-b-0">
                          <p className="text-sm font-semibold text-foreground">
                            {typeof ext === 'string' ? ext : ext.name}
                          </p>
                          {typeof ext !== 'string' && ext.details && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{ext.details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Bloco>
          )}

          {event.marketing_request && isInternalView && (
            <Bloco titulo="Pedido ao marketing">
              {/* Cobertura */}
              {event.marketing_coverage && (
                <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-semibold text-foreground">Cobertura do Evento Solicitada</p>
                  <p className="text-sm text-foreground">
                    Cobertura fotográfica e/ou vídeo solicitada pela unidade.
                  </p>
                  {(() => {
                    const estado = estadoDaCobertura(event);
                    if (estado === 'nao-pedida') return null;
                    const cor = estado === 'confirmada' ? 'text-success' : estado === 'sem-marketing' ? 'text-warning' : 'text-muted-foreground';
                    return (
                      <p className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${cor}`}>
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        {ROTULO_DA_COBERTURA[estado]}
                      </p>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">
                    Em todo caso, a unidade registra o evento (fotos e vídeos pelo celular) e envia o material ao marketing.
                  </p>
                </div>
              )}

              {/* Demanda Gráfica */}
              {temArte(event.marketing_items) && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Arte ou material impresso</p>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <ResumoDoPedidoDeArte itens={event.marketing_items} />
                  </div>
                </div>
              )}

              {/* O que já está pronto, para o marketing não refazer. Aparece
                  junto do pedido, seja qual for o pedido. */}
              {event.printed_materials && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-1 text-[13px] text-muted-foreground">Já existe pronto</p>
                  <p className="text-sm text-foreground break-all">{event.printed_materials}</p>
                </div>
              )}
            </Bloco>
          )}

          <Bloco titulo="Compartilhar">
            {/* Havia um botão "Instagram" aqui, sem ação nenhuma: o
                Instagram não aceita compartilhar link pela web. Saiu em
                08/09/2026; ficam os dois que funcionam. */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={shareOnWhatsApp}>
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </Button>
              <Button variant="outline" className="gap-2" onClick={copyLink}>
                <Copy className="h-4 w-4" />
                <span>Copiar Link</span>
              </Button>
            </div>
            {linkParaCopiar && (
              <input
                readOnly
                aria-label="Link do evento para copiar"
                value={linkParaCopiar}
                onFocus={e => e.currentTarget.select()}
                onClick={e => e.currentTarget.select()}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
              />
            )}
            <p className="text-[13px] text-muted-foreground">
              Este evento é {event.visibility === 'publico' ? 'público e aberto a todos' : 'interno para colaboradores'}.
            </p>
          </Bloco>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Esboço V2: um bloco do detalhe, com título de bloco no lugar do rótulo em caixa alta. */
function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border/70 pt-5">
      <h3 className="text-[15px] font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({ rotulo, largo = false, preformatado = false, children }: { rotulo: string; largo?: boolean; preformatado?: boolean; children: ReactNode }) {
  return (
    <div className={largo ? 'col-span-1 md:col-span-2' : ''}>
      <p className="text-[13px] text-muted-foreground">{rotulo}</p>
      <p className={`text-foreground ${preformatado ? 'whitespace-pre-wrap' : ''}`}>{children}</p>
    </div>
  );
}

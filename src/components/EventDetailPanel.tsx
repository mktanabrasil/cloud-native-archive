import type { ReactNode } from 'react';
import { AppEvent, PARTNER_TYPES, Unit } from '@/types';
import { categoriaDoAnexo, normalizarAnexo, rotuloDoTamanho } from '@/lib/events/anexos';
import { useUserRole } from '@/hooks/useUserRole';
import { rotuloDoTipo } from '@/lib/events/tipo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Paperclip, Globe, Lock, AlertTriangle, Clock } from 'lucide-react';
import { motivoDoApoio, resumoDoTransporte } from '@/lib/events/transporte';
import { ROTULO_DA_COBERTURA, estadoDaCobertura } from '@/lib/events/cobertura';
import { ResumoDeItens } from './events/ResumoDeItens';
import { ResumoDoPedidoDeArte } from './events/ResumoDoPedidoDeArte';
import { AvisosDoEvento } from './events/AvisosDoEvento';
import { SituacaoDoEvento } from './events/SituacaoDoEvento';

/** Esboço V2: a unidade é um ponto de cor ao lado do nome, não mais um selo. */
const unitDotColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic',
  'Nilópolis': 'bg-unit-nilopolis',
  'Santana': 'bg-unit-santana',
  'Administração': 'bg-unit-geral',
};

interface Props {
  event: AppEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: AppEvent) => void;
  onDelete?: (id: string) => void;
}

export default function EventDetailPanel({ event, open, onOpenChange, onEdit, onDelete }: Props) {
  const { canEdit } = useUserRole();
  if (!event) return null;

  const corDaCobertura = (estado: ReturnType<typeof estadoDaCobertura>) =>
    estado === 'confirmada' ? 'text-success' : estado === 'sem-marketing' ? 'text-warning' : 'text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Esboço V2: o detalhe abre numa folha lateral, como o formulário, com
          a tela de trás visível. Seções com título de bloco; a situação em
          texto com bolinha; Editar é o único botão forte. */}
      <DialogContent className="folha-lateral left-auto right-0 top-0 h-[100svh] max-h-[100svh] w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-5 sm:right-3 sm:top-3 sm:h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-1.5rem)] sm:max-w-[560px] sm:rounded-[22px] sm:p-6">
        <DialogHeader className="space-y-2 pr-8 text-left">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${unitDotColors[event.unit]}`} />
              {event.unit}
            </span>
            <SituacaoDoEvento status={event.status} comConflito={event.has_conflict} />
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {event.visibility === 'publico' ? <Globe className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
              {event.visibility === 'publico' ? 'Público' : 'Interno'}
            </span>
          </p>
          <DialogTitle className="text-2xl font-bold leading-tight tracking-tight">{event.title}</DialogTitle>
          <p className="text-[13px] text-muted-foreground">Detalhes do evento · {rotuloDoTipo(event.event_type)}</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Onde o evento está na aprovação (varredura de 16/09/2026): a gestora
              abre aqui primeiro, então é aqui que ela precisa ler "enviado" e a
              observação de uma devolução, não só dentro do formulário. */}
          {event.status === 'pendente' && event.submitted_at && !event.review_note && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-3" data-testid="onde-esta">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="text-[13px]">
                <p className="font-semibold text-foreground">Enviado por {event.created_by} em {format(new Date(event.submitted_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                <p className="text-muted-foreground">Aguardando a administração geral revisar e confirmar.</p>
              </div>
            </div>
          )}
          {event.review_note && event.status !== 'confirmado' && event.status !== 'concluido' && (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3" data-testid="onde-esta">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="text-[13px]">
                <p className="font-semibold text-foreground">Devolvido{event.reviewed_by ? ` por ${event.reviewed_by}` : ''}{event.reviewed_at ? ` em ${format(new Date(event.reviewed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}` : ''}</p>
                <p className="text-muted-foreground">“{event.review_note}”</p>
                <p className="mt-1 text-muted-foreground">Edite e salve: volta para a fila com a versão nova.</p>
              </div>
            </div>
          )}

          <Secao titulo="Quando e onde">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow
                label="Início"
                value={format(new Date(event.start_datetime), "dd MMM yyyy, HH:mm", { locale: ptBR })}
              />
              <DetailRow
                label="Término"
                value={format(new Date(event.end_datetime), "dd MMM yyyy, HH:mm", { locale: ptBR })}
              />
              <div className="sm:col-span-2"><DetailRow label="Local" value={event.location} /></div>
              {canEdit ? (
                <>
                  <DetailRow label="Criado por" value={event.created_by} />
                  {event.updated_by && <DetailRow label="Editado por" value={event.updated_by} />}
                </>
              ) : (
                <DetailRow label="Responsável" value={event.created_by} />
              )}
            </div>
          </Secao>

          {(event.description || event.notes) && (
            <Secao titulo="Sobre o evento">
              {event.description && (
                <div>
                  <p className="text-[13px] text-muted-foreground">Descrição</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
              {event.notes && (
                <div>
                  <p className="text-[13px] text-muted-foreground">Observações</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}
            </Secao>
          )}

          {(() => {
            const t = resumoDoTransporte(event);
            if (!t) return null;
            const apoio = motivoDoApoio(t);
            return (
              <Secao titulo="Transporte">
                <p className="text-sm text-foreground">{t.texto}</p>
                {apoio && (
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-destructive">
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> {apoio}
                  </p>
                )}
              </Secao>
            );
          })()}

          {(event.target_audience || event.support_team || event.food_logistics || event.equipment_needed || event.printed_materials) && (
            <Secao titulo="Logística">
              <div className="grid grid-cols-1 gap-3">
                {event.target_audience && <DetailRow label="Para quem" value={event.target_audience} />}
                {event.support_team && <DetailRow label="Quem ajuda no dia" value={event.support_team} />}
                {/* Por item, com detalhe, quando o evento tem a lista (desde
                    08/09/2026); a string antiga é o fallback. */}
                {event.food_items && event.food_items.length > 0 ? (
                  <ResumoDeItens titulo="Alimentação" itens={event.food_items} copiar />
                ) : event.food_logistics && (
                  <div>
                    <p className="text-[13px] text-muted-foreground">Alimentação</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{event.food_logistics}</p>
                  </div>
                )}
                {event.food_details && <DetailRow label="Restrições e avisos sobre a comida" value={event.food_details} />}
                {event.equipment_items && event.equipment_items.length > 0 ? (
                  <ResumoDeItens titulo="Equipamentos" itens={event.equipment_items} copiar />
                ) : event.equipment_needed && <DetailRow label="Equipamentos" value={event.equipment_needed} />}
                {event.printed_materials && <DetailRow label="Materiais Impressos" value={event.printed_materials} />}
              </div>
            </Secao>
          )}

          {event.marketing_request && (
            <Secao titulo="Pedido ao marketing">
              {event.marketing_coverage && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground">
                  Cobertura solicitada
                  {(() => {
                    const estado = estadoDaCobertura(event);
                    if (estado === 'nao-pedida') return null;
                    return (
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${corDaCobertura(estado)}`}>
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        {ROTULO_DA_COBERTURA[estado]}
                      </span>
                    );
                  })()}
                </p>
              )}
              <ResumoDoPedidoDeArte itens={event.marketing_items} compacto />
              {event.printed_materials && (
                <p className="text-[13px] text-muted-foreground">
                  Já existe: <span className="font-medium text-foreground break-all">{event.printed_materials}</span>
                </p>
              )}
            </Secao>
          )}

          {event.partner_involved && (
            <Secao titulo="Padrinhos, doadores e empresas">
              {(event.partners || []).filter(p => p.name).map((p, idx) => (
                <p key={idx} className="text-[13px] text-muted-foreground">
                  {PARTNER_TYPES.find(pt => pt.value === p.type)?.label || p.type}: <span className="font-medium text-foreground">{p.name}</span>
                </p>
              ))}
              {/* Fallback for legacy single partner */}
              {(!event.partners || event.partners.length === 0) && event.partner_name && (
                <p className="text-[13px] text-muted-foreground">
                  {PARTNER_TYPES.find(pt => pt.value === event.partner_type)?.label || event.partner_type}: <span className="font-medium text-foreground">{event.partner_name}</span>
                </p>
              )}
            </Secao>
          )}

          {/* Unit collaboration */}
          {event.has_unit_collaboration && (
            <Secao titulo="Unidades da ANA e instituições participantes">
              {event.collaborating_units.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  Unidades: <span className="font-medium text-foreground">{event.collaborating_units.join(', ')}</span>
                </p>
              )}
              {event.external_collaborators.length > 0 && (
                <div>
                  <p className="mb-1 text-[13px] text-muted-foreground">Instituições</p>
                  <div className="space-y-1.5">
                    {event.external_collaborators.map((ext, idx) => (
                      <div key={idx} className="text-[13px]">
                        <span className="font-semibold text-foreground">
                          {typeof ext === 'string' ? ext : ext.name}
                        </span>
                        {typeof ext !== 'string' && ext.details && (
                          <span className="block text-muted-foreground">
                             {ext.details}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Secao>
          )}

          {event.attachments && event.attachments.length > 0 && (
            <Secao titulo="Anexos">
              <div className="flex flex-wrap gap-2">
                {event.attachments.map(normalizarAnexo).map(a => (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${categoriaDoAnexo(a)}${rotuloDoTamanho(a.size) ? ` · ${rotuloDoTamanho(a.size)}` : ''}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:bg-muted"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-[200px] truncate text-foreground">{a.name}</span>
                    {rotuloDoTamanho(a.size) && <span className="text-muted-foreground">{rotuloDoTamanho(a.size)}</span>}
                  </a>
                ))}
              </div>
            </Secao>
          )}

          {/* O e-mail que saiu (ou falhou) quando este evento foi confirmado,
              cancelado ou mudou de data. Só a equipe vê este painel. */}
          <div className="space-y-2">
            <AvisosDoEvento eventId={event.id} event={event} />
          </div>

          {(onEdit || onDelete) && (
            <div className="sticky bottom-0 -mx-1 flex gap-2 rounded-2xl bg-card/95 px-1 pb-1 pt-3 backdrop-blur">
              {onEdit && (
                <Button className="flex-1 gap-2" onClick={() => onEdit(event)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mover para a lixeira"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    onDelete(event.id);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Esboço V2: um bloco do detalhe, com título de bloco no lugar do rótulo em caixa alta. */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-border/70 pt-4">
      <h3 className="text-[15px] font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value, capitalize: cap }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground break-words ${cap ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}

import { AppEvent, PARTNER_TYPES, Unit } from '@/types';
import { categoriaDoAnexo, normalizarAnexo, rotuloDoTamanho } from '@/lib/events/anexos';
import { useUserRole } from '@/hooks/useUserRole';
import { getStatusBadgeClass } from '@/lib/statusColors';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Megaphone, Users, Paperclip, Globe, Lock, Truck, AlertTriangle } from 'lucide-react';
import { motivoDoApoio, resumoDoTransporte } from '@/lib/events/transporte';

const unitBadgeColors: Record<Unit, string> = {
  'DIC': 'bg-unit-dic text-primary-foreground',
  'Nilópolis': 'bg-unit-nilopolis text-primary-foreground',
  'Santana': 'bg-unit-santana text-primary-foreground',
  'Administração': 'bg-unit-geral text-primary-foreground',
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

  const statusClass = getStatusBadgeClass(event.status, event.has_conflict);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalhes do Evento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={unitBadgeColors[event.unit]}>{event.unit}</Badge>
            <Badge variant="outline" className={`capitalize ${statusClass}`}>{event.status}</Badge>
            <Badge variant="secondary" className="gap-1.5 py-0.5">
              {event.visibility === 'publico' ? (
                <>
                  <Globe className="h-3 w-3" /> Público
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" /> Interno
                </>
              )}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <DetailRow label="Título" value={event.title} />
            <DetailRow label="Tipo" value={event.event_type} capitalize />
            {canEdit && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Criado por</p>
                  <Badge variant="secondary" className="font-medium">{event.created_by}</Badge>
                </div>
                {event.updated_by && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Editado por</p>
                    <Badge variant="outline" className="font-medium">{event.updated_by}</Badge>
                  </div>
                )}
              </div>
            )}
            {!canEdit && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Responsável</p>
                <Badge variant="secondary" className="font-medium">{event.created_by}</Badge>
              </div>
            )}
            <DetailRow label="Local" value={event.location} />
            <DetailRow
              label="Início"
              value={format(new Date(event.start_datetime), "dd MMM yyyy, HH:mm", { locale: ptBR })}
            />
            <DetailRow
              label="Término"
              value={format(new Date(event.end_datetime), "dd MMM yyyy, HH:mm", { locale: ptBR })}
            />
            {event.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Descrição</p>
                <p className="text-sm text-muted-foreground">{event.description}</p>
              </div>
            )}
            {event.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Observações</p>
                <p className="text-sm text-muted-foreground">{event.notes}</p>
              </div>
            )}
            {(() => {
              const t = resumoDoTransporte(event);
              if (!t) return null;
              const apoio = motivoDoApoio(t);
              return (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Transporte</p>
                  <p className="text-sm text-foreground">{t.texto}</p>
                  {apoio && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> {apoio}</p>
                  )}
                </div>
              );
            })()}
            {(event.target_audience || event.support_team || event.food_logistics || event.equipment_needed || event.printed_materials) && (
              <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/10">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                   Detalhes Logísticos
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {event.target_audience && <DetailRow label="Público-Alvo" value={event.target_audience} />}
                  {event.support_team && <DetailRow label="Equipe de Apoio" value={event.support_team} />}
                  {event.food_logistics && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Logística de Alimentação</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{event.food_logistics}</p>
                    </div>
                  )}
                  {event.equipment_needed && <DetailRow label="Equipamentos" value={event.equipment_needed} />}
                  {event.printed_materials && <DetailRow label="Materiais Impressos" value={event.printed_materials} />}
                </div>
              </div>
            )}
            {event.marketing_request && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Solicitação de Marketing</span>
                </div>
                {event.marketing_coverage && (
                  <p className="text-xs text-blue-900">Cobertura fotográfica e/ou vídeo solicitada.</p>
                )}
                {event.marketing_items && event.marketing_items.length > 0 && (
                  <div className="space-y-2">
                    {event.marketing_items.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-blue-100 bg-blue-50/30 p-2 text-[11px] text-blue-900">
                        <p className="font-bold mb-0.5">{item.item}</p>
                        <p className="whitespace-pre-wrap opacity-80">{item.description}</p>
                      </div>
                    ))}
                  </div>
                )}
                {event.printed_materials && (
                  <p className="text-xs text-muted-foreground">
                    Já existe: <span className="font-medium text-foreground break-all">{event.printed_materials}</span>
                  </p>
                )}
              </div>
            )}
            {event.partner_involved && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Parceiros Envolvidos</span>
                </div>
                {(event.partners || []).filter(p => p.name).map((p, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    {PARTNER_TYPES.find(pt => pt.value === p.type)?.label || p.type}: <span className="font-medium text-foreground">{p.name}</span>
                  </p>
                ))}
                {/* Fallback for legacy single partner */}
                {(!event.partners || event.partners.length === 0) && event.partner_name && (
                  <p className="text-xs text-muted-foreground">
                    {PARTNER_TYPES.find(pt => pt.value === event.partner_type)?.label || event.partner_type}: <span className="font-medium text-foreground">{event.partner_name}</span>
                  </p>
                )}
              </div>
            )}

            {/* Unit collaboration */}
            {event.has_unit_collaboration && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Parceria com Unidades/Instituições</p>
                {event.collaborating_units.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Unidades: <span className="font-medium text-foreground">{event.collaborating_units.join(', ')}</span>
                  </p>
                )}
                {event.external_collaborators.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Instituições Externas:</p>
                    <div className="space-y-1.5">
                      {event.external_collaborators.map((ext, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-bold text-foreground">
                            {typeof ext === 'string' ? ext : ext.name}
                          </span>
                          {typeof ext !== 'string' && ext.details && (
                            <span className="text-muted-foreground block">
                               {ext.details}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {event.attachments && event.attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Anexos</p>
                <div className="flex flex-wrap gap-2">
                  {event.attachments.map(normalizarAnexo).map(a => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${categoriaDoAnexo(a)}${rotuloDoTamanho(a.size) ? ` · ${rotuloDoTamanho(a.size)}` : ''}`}
                      className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[200px] truncate text-foreground">{a.name}</span>
                      {rotuloDoTamanho(a.size) && <span className="text-muted-foreground">{rotuloDoTamanho(a.size)}</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>

          {(onEdit || onDelete) && (
            <div className="flex gap-3">
              {onEdit && (
                <Button className="flex-1 gap-2" onClick={() => onEdit(event)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="icon"
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

function DetailRow({ label, value, capitalize: cap }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground ${cap ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}

import { format } from 'date-fns';
import { AlertTriangle, CalendarCheck, CalendarX, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppEvent } from '@/types';
import type { AvisoDeEvento } from '@/lib/events/avisos';
import { ROTULO_DA_AGENDA, leituraDaAgenda } from '@/lib/events/agenda';

interface Props {
  event: AppEvent;
  ultimo: AvisoDeEvento | null;
  reenviando: boolean;
  reenviar: (avisoId: string) => void;
}

/**
 * O bloco "Agenda do Google" do painel de detalhe, abaixo do aviso por
 * e-mail e no mesmo formato (mockup aprovado em 15/09/2026). Sincronizado
 * com link; aguardando com "Sincronizar agora"; falhou com o erro e "Tentar
 * de novo"; removido quando um confirmado foi cancelado. Nada, se o evento
 * nunca chegou perto do Google.
 */
export function AgendaDoEvento({ event, ultimo, reenviando, reenviar }: Props) {
  const leitura = leituraDaAgenda(event, ultimo);
  if (!leitura) return null;

  const quando = leitura.quando ? ' · ' + format(new Date(leitura.quando), "dd/MM 'às' HH:mm") : '';
  const girando = reenviando ? 'animate-spin' : '';
  const abrir = leitura.link ? <a href={leitura.link} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">Abrir no Google</a> : null;

  if (leitura.estado === 'sincronizado') {
    return (
      <div className="space-y-1 rounded-lg border border-primary/40 bg-primary/10 p-3" data-testid="agenda-do-evento">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <CalendarCheck className="h-3.5 w-3.5 text-primary" />
          {ROTULO_DA_AGENDA.sincronizado}{quando}
        </p>
        <p className="text-[11px] text-muted-foreground">
          ANA · Eventos, só para a equipe{abrir && <> · {abrir}</>}
        </p>
      </div>
    );
  }

  if (leitura.estado === 'falhou') {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3" data-testid="agenda-do-evento">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-foreground">{ROTULO_DA_AGENDA.falhou}{quando}</p>
          <p className="break-words text-[11px] text-muted-foreground">{leitura.erro || 'Sem detalhe do erro.'}</p>
        </div>
        {ultimo && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={reenviando} onClick={() => reenviar(ultimo.id)}>
            <RefreshCw className={`h-3.5 w-3.5 ${girando}`} /> Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  if (leitura.estado === 'removido') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="agenda-do-evento">
        <CalendarX className="h-3.5 w-3.5" /> {ROTULO_DA_AGENDA.removido}{quando}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3" data-testid="agenda-do-evento">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> {ROTULO_DA_AGENDA.aguardando}{quando}
      </p>
      {ultimo && (
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled={reenviando} onClick={() => reenviar(ultimo.id)}>
          <RefreshCw className={`h-3.5 w-3.5 ${girando}`} /> Sincronizar agora
        </Button>
      )}
    </div>
  );
}

/** A marca discreta do cartão: só quando o evento está no Google. */
export function MarcaDaAgenda({ event, className = '' }: { event: Pick<AppEvent, 'google_event_id'>; className?: string }) {
  if (!event.google_event_id) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground ${className}`} title="Na agenda do Google" aria-label="Na agenda do Google">
      <CalendarCheck className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

import { format } from 'date-fns';
import { Mail, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAvisosDoEvento } from '@/hooks/useAvisosDoEvento';
import { ROTULO_DO_TIPO, textoDeEnviado } from '@/lib/events/avisos';
import type { AppEvent } from '@/types';
import { AgendaDoEvento } from './AgendaDoEvento';

/**
 * O último aviso por e-mail de um evento, no painel de detalhe da equipe.
 *
 * "Aviso enviado a 7 endereços · 10/09 às 16:17", com a lista; ou o erro,
 * com "Reenviar". Sem isso, um envio que falhou some em silêncio e todo
 * mundo confia numa agenda que não recebeu nada. Um evento pendente, que
 * nunca gerou aviso, não mostra nada.
 *
 * Com `event`, mostra abaixo o bloco "Agenda do Google" (mesmo hook, mesma
 * fila): o aviso de e-mail "ignorado" (só agenda, ou carga inicial) não
 * aparece como e-mail, mas conta para a agenda.
 */
export function AvisosDoEvento({ eventId, event }: { eventId: string; event?: AppEvent }) {
  const { ultimo, reenviando, reenviar } = useAvisosDoEvento(eventId);
  const agenda = event ? <AgendaDoEvento event={event} ultimo={ultimo} reenviando={reenviando} reenviar={reenviar} /> : null;
  if (!ultimo || ultimo.status === 'ignorado') return agenda;

  return (
    <>
      <BlocoDoEmail ultimo={ultimo} reenviando={reenviando} reenviar={reenviar} />
      {agenda}
    </>
  );
}

function BlocoDoEmail({ ultimo, reenviando, reenviar }: { ultimo: NonNullable<ReturnType<typeof useAvisosDoEvento>['ultimo']>; reenviando: boolean; reenviar: (id: string) => void }) {
  const quando = format(new Date(ultimo.enviado_em || ultimo.criado_em), "dd/MM 'às' HH:mm");

  if (ultimo.status === 'enviado') {
    return (
      <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3" data-testid="aviso-do-evento">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Mail className="h-3.5 w-3.5 text-primary" />
          {textoDeEnviado(ultimo.destinatarios.length)} · {quando}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {ROTULO_DO_TIPO[ultimo.tipo]} · {ultimo.destinatarios.join(' · ')}
        </p>
      </div>
    );
  }

  if (ultimo.status === 'falhou') {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3" data-testid="aviso-do-evento">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-foreground">Falhou o envio do aviso · {quando}</p>
          <p className="break-words text-[11px] text-muted-foreground">{ultimo.erro || 'Sem detalhe do erro.'}</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={reenviando} onClick={() => reenviar(ultimo.id)}>
          <RefreshCw className={`h-3.5 w-3.5 ${reenviando ? 'animate-spin' : ''}`} /> Reenviar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3" data-testid="aviso-do-evento">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Aviso por e-mail aguardando envio · {quando}
      </p>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled={reenviando} onClick={() => reenviar(ultimo.id)}>
        <RefreshCw className={`h-3.5 w-3.5 ${reenviando ? 'animate-spin' : ''}`} /> Enviar agora
      </Button>
    </div>
  );
}

import { format } from 'date-fns';
import { Mail, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAvisosDoEvento } from '@/hooks/useAvisosDoEvento';
import { ROTULO_DO_TIPO, textoDeEnviado, type AvisoDeEvento } from '@/lib/events/avisos';
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
  const { ultimo, daEquipe, reenviando, reenviar } = useAvisosDoEvento(eventId);
  const agenda = event ? <AgendaDoEvento event={event} ultimo={ultimo} reenviando={reenviando} reenviar={reenviar} /> : null;
  const equipe = daEquipe.filter(a => a.status !== 'ignorado');
  const blocoDaEquipe = equipe.length > 0 ? <AvisosDaEquipe avisos={equipe} reenviando={reenviando} reenviar={reenviar} /> : null;
  if (!ultimo || ultimo.status === 'ignorado') return <>{blocoDaEquipe}{agenda}</>;

  return (
    <>
      <BlocoDoEmail ultimo={ultimo} reenviando={reenviando} reenviar={reenviar} />
      {blocoDaEquipe}
      {agenda}
    </>
  );
}

/**
 * Os e-mails da equipe do dia (RH e Voluntariado, 18/11/2026): uma linha por
 * setor, com o último envio; falhou ou aguardando, com o botão.
 */
function AvisosDaEquipe({ avisos, reenviando, reenviar }: { avisos: AvisoDeEvento[]; reenviando: boolean; reenviar: (id: string) => void }) {
  return (
    <ul className="space-y-1 rounded-xl border border-border bg-muted/40 p-3" data-testid="avisos-da-equipe" aria-label="E-mails da equipe do dia">
      {avisos.map(a => {
        const quando = format(new Date(a.enviado_em || a.criado_em), "dd/MM 'às' HH:mm");
        const setor = a.tipo === 'equipe_rh' ? 'RH' : a.tipo === 'financeiro' ? 'Financeiro' : 'Voluntariado';
        // O Financeiro recebe as compras do evento, não a equipe (19/11/2026).
        const oQue = a.tipo === 'financeiro' ? { enviado: 'Compras enviadas ao', falhou: 'Falhou o e-mail das compras para o', pendente: 'E-mail das compras para o' } : { enviado: 'Equipe do dia enviada ao', falhou: 'Falhou o e-mail da equipe para o', pendente: 'E-mail da equipe para o' };
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {a.status === 'enviado' && <><Mail className="h-3.5 w-3.5 text-success" /><span className="font-semibold text-foreground">{oQue.enviado} {setor}</span><span className="text-muted-foreground">· {quando} · {a.destinatarios.join(' · ')}</span></>}
            {a.status === 'falhou' && <><AlertTriangle className="h-3.5 w-3.5 text-destructive" /><span className="font-semibold text-foreground">{oQue.falhou} {setor}</span><span className="break-words text-muted-foreground">· {a.erro || 'sem detalhe'}</span></>}
            {a.status === 'pendente' && <><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{oQue.pendente} {setor} aguardando envio · {quando}</span></>}
            {a.status !== 'enviado' && (
              <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1.5 text-[11px]" disabled={reenviando} onClick={() => reenviar(a.id)}>
                <RefreshCw className={`h-3 w-3 ${reenviando ? 'animate-spin' : ''}`} /> {a.status === 'falhou' ? 'Reenviar' : 'Enviar agora'}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BlocoDoEmail({ ultimo, reenviando, reenviar }: { ultimo: NonNullable<ReturnType<typeof useAvisosDoEvento>['ultimo']>; reenviando: boolean; reenviar: (id: string) => void }) {
  const quando = format(new Date(ultimo.enviado_em || ultimo.criado_em), "dd/MM 'às' HH:mm");

  if (ultimo.status === 'enviado') {
    return (
      <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3" data-testid="aviso-do-evento">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Mail className="h-3.5 w-3.5 text-success" />
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
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3" data-testid="aviso-do-evento">
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3" data-testid="aviso-do-evento">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Aviso por e-mail aguardando envio · {quando}
      </p>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled={reenviando} onClick={() => reenviar(ultimo.id)}>
        <RefreshCw className={`h-3.5 w-3.5 ${reenviando ? 'animate-spin' : ''}`} /> Enviar agora
      </Button>
    </div>
  );
}

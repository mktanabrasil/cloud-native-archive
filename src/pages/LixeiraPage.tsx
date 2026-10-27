import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { CapaDaUnidade } from '@/components/events/CapaDaUnidade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import PageHeader from '@/components/PageHeader';
import { TituloDoEvento } from '@/components/events/TituloDoEvento';
import { tituloEmTexto } from '@/lib/events/titulo';
import { EsqueletoDaLixeira, ErroAoCarregar } from '@/components/events/EsqueletoDeEventos';

/**
 * A lixeira dos eventos.
 *
 * Até 08/09/2026 ela morava dentro da página pública, atrás de um botão
 * "Ver Lixeira" que trocava o título e a lista. É a única tela do app que
 * apaga linha de verdade, e não fazia sentido viver na vitrine que a família
 * vê. Agora é uma aba do hub, só para admin.
 *
 * Uma lista só, sem Próximos e Passados: aqui a data não diz nada sobre o
 * evento. A ordem é a de início, crescente.
 */
export default function LixeiraPage() {
  const { deleteEvent, restoreEvent, loading, erroAoCarregar, refetchEvents } = useApp();
  const trashEvents = useFilteredEvents(false, true);
  const [search, setSearch] = useState('');
  const [pendingPurge, setPendingPurge] = useState<AppEvent | null>(null);

  const eventos = useMemo(() => {
    const termo = search.toLowerCase().trim();
    const base = termo
      ? trashEvents.filter(e =>
          e.title.toLowerCase().includes(termo) ||
          (e.location || '').toLowerCase().includes(termo) ||
          (e.description || '').toLowerCase().includes(termo),
        )
      : trashEvents;
    return [...base].sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
  }, [trashEvents, search]);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Lixeira de Eventos"
          description="Eventos excluídos que podem ser recuperados ou removidos permanentemente."
          className="mb-0"
        />
        <div className="mt-5 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, local ou descrição..."
            className="pl-10 h-11 border-border bg-card focus-visible:ring-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <EsqueletoDaLixeira />
      ) : erroAoCarregar && trashEvents.length === 0 ? (
        <ErroAoCarregar oQue="a lixeira" onTentar={refetchEvents} />
      ) : eventos.length === 0 ? (
        <div className="rounded-[20px] border border-black/5 bg-card px-6 py-16 text-center dark:border-white/5">
          <h3 className="text-lg font-semibold text-foreground">
            {search ? 'Nada na lixeira com esse termo' : 'A lixeira está vazia'}
          </h3>
          <p className="mt-1 text-muted-foreground">
            {search ? 'Tente outra busca.' : 'Nada aguardando restauração.'}
          </p>
        </div>
      ) : (
        /* Esboço V2: a lixeira em linhas, como a lista das Programações — data
           em destaque, título, meta com o ponto da unidade, quando foi
           excluído, as duas saídas e a miniatura da capa. */
        <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
          {eventos.map(event => {
            const inicio = new Date(event.start_datetime);
            return (
              <div
                key={event.id}
                className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[56px_minmax(0,1fr)_auto_136px] sm:px-5"
              >
                <div className="grid justify-items-center self-start pt-0.5 leading-none sm:self-center sm:pt-0">
                  <span className="font-display text-[26px] font-bold tabular-nums text-foreground">{format(inicio, 'dd')}</span>
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{format(inicio, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                </div>

                <div className="min-w-0">
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-destructive">
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    {event.deleted_at
                      ? `Excluído em ${format(new Date(event.deleted_at), "dd/MM/yyyy 'às' HH:mm")}`
                      : 'Excluído'}
                  </p>
                  <h3 className="font-display text-base font-semibold leading-snug text-foreground line-clamp-2 sm:text-[17px]">
                    <TituloDoEvento texto={event.title} />
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-0.5 text-[13px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[event.unit]}`} />
                      {event.unit}
                    </span>
                    <span>{format(inicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    <span>
                      {format(inicio, 'HH:mm')} às {format(new Date(event.end_datetime), 'HH:mm')}
                    </span>
                    {event.location && <span className="min-w-0 line-clamp-1">{event.location}</span>}
                  </div>
                </div>

                {/* As duas saídas da lixeira: voltar, ou acabar de vez. */}
                <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => restoreEvent(event.id)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingPurge(event)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir de vez
                  </Button>
                </div>

                <div className="relative hidden aspect-video overflow-hidden rounded-xl bg-muted sm:block">
                  {/* A mesma capa da vitrine: a arte (capa, banner) ou a foto da
                      unidade (varredura de 25/09/2026). */}
                  {event.banner_url_desktop || event.banner_url_mobile || event.banner_image_desktop ? (
                    <img
                      src={event.banner_url_desktop || event.banner_url_mobile || event.banner_image_desktop}
                      alt={tituloEmTexto(event.title)}
                      loading="lazy"
                      className="h-full w-full object-cover saturate-50"
                    />
                  ) : (
                    <CapaDaUnidade evento={event} comTitulo={false} className="select-none saturate-50" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aqui a linha some do banco. É a única tela do app que faz isso com
          evento, e por isso ela pergunta, mostrando qual. */}
      <AlertDialog open={!!pendingPurge} onOpenChange={(open) => !open && setPendingPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este evento definitivamente?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium text-foreground">{pendingPurge ? tituloEmTexto(pendingPurge.title) : ''}</p>
                  <p className="mt-1 text-muted-foreground">
                    {pendingPurge?.unit}
                    {pendingPurge?.start_datetime
                      ? ` · ${format(new Date(pendingPurge.start_datetime), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                      : ''}
                  </p>
                </div>
                <p>Ele sai do banco de vez. Não há como restaurá-lo depois.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingPurge) deleteEvent(pendingPurge.id);
                setPendingPurge(null);
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

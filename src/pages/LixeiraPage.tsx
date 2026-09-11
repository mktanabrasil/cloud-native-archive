import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, MapPin, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { AppEvent, UNIT_BG_COLORS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <PageHeader
            title="Lixeira de Eventos"
            description="Eventos excluídos que podem ser recuperados ou removidos permanentemente."
            className="mb-0"
          />
          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, local ou descrição..."
              className="pl-10 h-12 shadow-sm border-border bg-card focus-visible:ring-primary"
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
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {search ? 'Nada na lixeira com esse termo' : 'A lixeira está vazia'}
            </h3>
            <p className="text-muted-foreground">
              {search ? 'Tente outra busca.' : 'Nenhum evento foi excluído.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventos.map(event => (
              <Card key={event.id} className="overflow-hidden border-border bg-card flex flex-col">
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {event.banner_url_desktop || event.banner_url_mobile ? (
                    <img
                      src={event.banner_url_desktop || event.banner_url_mobile}
                      alt={tituloEmTexto(event.title)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-start p-6 text-left overflow-hidden"
                      style={{ backgroundColor: event.custom_color || '#94a3b8' }}
                    >
                      <span
                        className="font-bold text-white leading-[1.1] break-words uppercase select-none"
                        style={{
                          fontSize: event.title.length < 15 ? '2.5rem' : event.title.length < 30 ? '1.75rem' : event.title.length < 50 ? '1.25rem' : '1rem',
                        }}
                      >
                        <TituloDoEvento texto={event.title} />
                      </span>
                    </div>
                  )}
                  <div className={`absolute top-0 left-0 h-1 w-full ${UNIT_BG_COLORS[event.unit]}`} />
                  <Badge className={`absolute top-3 left-3 ${UNIT_BG_COLORS[event.unit]} text-white border-none shadow-sm`}>
                    {event.unit}
                  </Badge>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex gap-2 mb-2">
                    <Badge variant="outline" className="border-destructive/20 bg-destructive/10 font-medium text-[10px] text-destructive">
                      {event.deleted_at
                        ? `Excluído em ${format(new Date(event.deleted_at), "dd/MM/yyyy 'às' HH:mm")}`
                        : 'Excluído'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl line-clamp-2 leading-tight text-foreground">
                    <TituloDoEvento texto={event.title} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>{format(new Date(event.start_datetime), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        {format(new Date(event.start_datetime), 'HH:mm')} às {format(new Date(event.end_datetime), 'HH:mm')}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* As duas saídas da lixeira: voltar, ou acabar de vez. */}
                <div className="flex items-center gap-2 border-t border-border p-4">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => restoreEvent(event.id)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingPurge(event)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Aqui a linha some do banco. É a única tela do app que faz isso com
          evento, e por isso ela pergunta, mostrando qual. */}
      <AlertDialog open={!!pendingPurge} onOpenChange={(open) => !open && setPendingPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este evento definitivamente?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
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

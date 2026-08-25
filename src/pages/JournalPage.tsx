import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Trash2, Pencil, Lock, Loader2, Newspaper, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useJournals } from '@/hooks/useJournals';
import { JournalEditor } from '@/components/journal/JournalEditor';
import { JournalPageView, A4_W, A4_H } from '@/components/journal/JournalPageView';
import { UnitBadge } from '@/components/journal/UnitBadge';
import {
  newsUnitName,
  newsUnitForProfileUnit,
  profileUnitForNewsUnit,
  findNewsUnit,
} from '@/lib/news/units';
import {
  JOURNAL_MODELS,
  findJournalModel,
  type JournalModelKey,
} from '@/lib/journal/templates';
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type JournalRecord,
} from '@/lib/journal/types';
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

type JournalStatus = JournalRecord['status'];

const COUNTER_ORDER: JournalStatus[] = ['rascunho', 'finalizado', 'arquivado'];
const COUNTER_LABELS: Record<JournalStatus, string> = {
  rascunho: 'Rascunhos',
  finalizado: 'Finalizados',
  arquivado: 'Arquivados',
};

const THUMB_W = 260;
const THUMB_SCALE = THUMB_W / A4_W;


/** Data relativa curta ("há 2 dias"), com fallback para data absoluta. */
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function suggestName(unitId: string | null, month: string): string {
  const short = findNewsUnit(unitId)?.short ?? 'ANA';
  return `Jornal ${short}${month ? ` — ${month}` : ''}`;
}

export default function JournalPage() {
  const { isMarketing, loading: roleLoading, unit: profileUnit, userName } = useUserRole();
  const { journals, loading, saving, savedAt, create, save, remove, duplicate } = useJournals();

  const defaultUnitId = useMemo(
    () => newsUnitForProfileUnit(profileUnit)?.id ?? null,
    [profileUnit],
  );
  const [activeUnitId, setActiveUnitId] = useState<string | null>(defaultUnitId);
  useEffect(() => setActiveUnitId(defaultUnitId), [defaultUnitId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** Edição aguardando confirmação de exclusão — nada é removido antes do "sim". */
  const [pendingDelete, setPendingDelete] = useState<JournalRecord | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JournalStatus | 'todos'>('todos');
  const [monthFilter, setMonthFilter] = useState<string>('todos');
  const [form, setForm] = useState<{
    name: string;
    unitId: string | null;
    referenceMonth: string;
    model: JournalModelKey;
  }>({ name: '', unitId: null, referenceMonth: '', model: 'padrao' });


  const editing = useMemo(
    () => journals.find((journal) => journal.id === editingId) ?? null,
    [journals, editingId],
  );

  /** Jornais da unidade selecionada — base para contadores e filtros. */
  const unitJournals = useMemo(
    () => journals.filter((journal) => (journal.unit_id ?? null) === activeUnitId),
    [journals, activeUnitId],
  );

  const counters = useMemo(() => {
    const base: Record<JournalStatus, number> = { rascunho: 0, finalizado: 0, arquivado: 0 };
    unitJournals.forEach((journal) => {
      base[journal.status] = (base[journal.status] ?? 0) + 1;
    });
    return base;
  }, [unitJournals]);

  const months = useMemo(
    () => Array.from(new Set(unitJournals.map((j) => j.reference_month).filter(Boolean) as string[])),
    [unitJournals],
  );

  const filtered = useMemo(
    () =>
      unitJournals.filter((journal) => {
        const matchesSearch = journal.name.toLowerCase().includes(search.trim().toLowerCase());
        const matchesStatus = statusFilter === 'todos' || journal.status === statusFilter;
        const matchesMonth = monthFilter === 'todos' || journal.reference_month === monthFilter;
        return matchesSearch && matchesStatus && matchesMonth;
      }),
    [unitJournals, search, statusFilter, monthFilter],
  );

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'todos' || monthFilter !== 'todos';

  if (roleLoading) return null;

  if (!isMarketing) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Área da comunicação</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é da equipe de comunicação da sua unidade. Fale com a coordenação para liberar
          seu acesso.
        </p>
      </div>
    );
  }

  const openCreate = () => {
    setForm({
      name: suggestName(activeUnitId, ''),
      unitId: activeUnitId,
      referenceMonth: '',
      model: 'padrao',
    });
    setCreating(true);
  };

  const handleCreate = async () => {
    const created = await create({
      name: form.name || suggestName(form.unitId, form.referenceMonth),
      unitId: form.unitId,
      profileUnit: form.unitId ? profileUnitForNewsUnit(form.unitId) : null,
      referenceMonth: form.referenceMonth || null,
      status: 'rascunho',
      pages: findJournalModel(form.model).build(),

    });
    setCreating(false);
    if (created) setEditingId(created.id);
  };

  if (editing) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
        <JournalEditor
          journal={editing as JournalRecord}
          saving={saving}
          savedAt={savedAt}
          onBack={() => setEditingId(null)}
          onSave={save}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Olá{userName ? `, ${userName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Aqui ficam os jornais da sua unidade.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> Criar jornal da unidade
        </Button>
      </header>

      <UnitBadge
        variant="banner"
        unitId={activeUnitId}
        label="Minha unidade"
        hint="Todos os jornais desta página pertencem a esta unidade."
        onChangeUnit={setActiveUnitId}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {COUNTER_ORDER.map((status) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(active ? 'todos' : status)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent/50',
              )}
              aria-pressed={active}
            >
              {counters[status]} {COUNTER_LABELS[status]}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar edição…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as JournalStatus | 'todos')}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {COUNTER_ORDER.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Mês / Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Seus jornais
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando jornais…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <Newspaper className="h-10 w-10 text-muted-foreground" />
          {hasActiveFilters ? (
            <>
              <p className="text-sm font-semibold text-foreground">Nenhuma edição encontrada</p>
              <p className="text-xs text-muted-foreground">Ajuste a busca ou os filtros aplicados.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('todos');
                  setMonthFilter('todos');
                }}
              >
                Limpar busca
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">
                Nenhum jornal criado para esta unidade
              </p>
              <p className="text-xs text-muted-foreground">
                Comece o primeiro jornal de
                <br />
                <span className="font-medium text-foreground">
                  {newsUnitName(activeUnitId) || 'Institucional geral'}
                </span>
              </p>
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" /> Criar jornal da unidade
              </Button>
              <p className="text-[11px] text-muted-foreground">
                A unidade já está definida — é só dar um nome à edição.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((journal) => {
            const cover = journal.pages?.[0];
            return (
              <article
                key={journal.id}
                className="overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setEditingId(journal.id)}
                  className="block w-full bg-muted/40 p-3 text-left"
                  aria-label={`Abrir ${journal.name}`}
                >
                  <div
                    className="mx-auto overflow-hidden rounded-sm border border-border bg-news-paper"
                    style={{ width: THUMB_W, height: A4_H * THUMB_SCALE }}
                  >
                    {cover && (
                      <div style={{ transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left' }}>
                        <JournalPageView
                          page={cover}
                          index={0}
                          total={journal.pages?.length ?? 1}
                          edition={journal.reference_month || ''}
                          unitName={newsUnitName(journal.unit_id)}
                          unitId={journal.unit_id}
                        />
                      </div>
                    )}
                  </div>
                </button>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                      {journal.name}
                    </h3>
                    <Badge className={STATUS_BADGE_CLASSES[journal.status]} variant="secondary">
                      {STATUS_LABELS[journal.status]}
                    </Badge>
                  </div>
                  <div className="mt-1">
                    <UnitBadge variant="chip" unitId={journal.unit_id} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {journal.pages?.length ?? 0} páginas · {relativeDate(journal.updated_at)}
                    {journal.reference_month ? ` · ${journal.reference_month}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => setEditingId(journal.id)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Abrir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => duplicate(journal)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setPendingDelete(journal)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta edição?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium text-foreground">{pendingDelete?.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {pendingDelete?.pages?.length ?? 0} páginas
                    {pendingDelete?.reference_month ? ` · ${pendingDelete.reference_month}` : ''}
                    {' · '}
                    {STATUS_LABELS[pendingDelete?.status ?? 'rascunho']}
                  </p>
                </div>
                <p>A edição sai da lista do Jornal, e não há como restaurá-la por aqui.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) remove(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar jornal da unidade</DialogTitle>
            <DialogDescription>Sua edição já nasce vinculada à sua unidade.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <UnitBadge
              variant="banner"
              unitId={form.unitId}
              label="Unidade"
              hint="preenchida automaticamente"
              onChangeUnit={(unitId) =>
                setForm((prev) => ({
                  ...prev,
                  unitId,
                  name: suggestName(unitId, prev.referenceMonth),
                }))
              }
            />

            <div className="space-y-1.5">
              <Label>Nome da edição</Label>
              <Input
                value={form.name}
                placeholder="Jornal ANA — Julho/2026"
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mês/Ano de referência</Label>
              <Input
                value={form.referenceMonth}
                placeholder="Julho/2026"
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    referenceMonth: event.target.value,
                    name: suggestName(prev.unitId, event.target.value),
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Modelo do jornal</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {JOURNAL_MODELS.map((model) => {
                  const active = form.model === model.key;
                  return (
                    <button
                      key={model.key}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, model: model.key }))}
                      aria-pressed={active}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-primary bg-accent'
                          : 'border-border bg-card hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{model.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {model.pageLabels.length}{' '}
                          {model.pageLabels.length === 1 ? 'página' : 'páginas'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {model.pageLabels.map((label, index) => (
                          <span
                            key={`${model.key}-${index}`}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar jornal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useCallback, useMemo, useState, type HTMLAttributes } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/PageHeader';
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
import { UnitBadge, PontoDaUnidade } from '@/components/journal/UnitBadge';
import { JournalImportDialog } from '@/components/journal/JournalImportDialog';
import { JournalEsbocoDialog } from '@/components/journal/JournalEsbocoDialog';
import { SeletorDeMes } from '@/components/journal/SeletorDeMes';
import { formatarMes, mesAtual, ordenarMeses } from '@/lib/journal/mesDaEdicao';
import { resumirImportacao } from '@/lib/journal/importar';
import { JournalTutorial } from '@/components/journal/JournalTutorial';
import { useTutoriaisVistos } from '@/hooks/useTutoriaisVistos';
import {
  newsUnitName,
  newsUnitForProfileUnit,
  profileUnitForNewsUnit,
  findNewsUnit,
} from '@/lib/news/units';
import { PARAMETRO_UNIDADE, escreverUnidadeNaUrl, lerUnidadeDaUrl } from '@/lib/news/unidadeNaUrl';
import {
  JOURNAL_MODELS,
  findJournalModel,
  type JournalModelKey,
} from '@/lib/journal/templates';
import {
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

/** Esboço V2: a situação é texto com bolinha, não pílula colorida. */
const COR_DA_SITUACAO: Record<JournalStatus, string> = {
  rascunho: 'text-warning',
  finalizado: 'text-success',
  arquivado: 'text-muted-foreground',
};

function Situacao({ status, ...rest }: { status: JournalStatus } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold', COR_DA_SITUACAO[status])}
      {...rest}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const THUMB_W = 260;
const THUMB_SCALE = THUMB_W / A4_W;

/**
 * A importação por arquivo está fechada de propósito.
 *
 * Ela funciona na parte das fotos — o recorte, a fileira e a proporção saem
 * certos —, mas a leitura do texto ficou instável: o mesmo arquivo, lido duas
 * vezes, ora devolve títulos e parágrafos, ora só as imagens. Enquanto isso não
 * estiver resolvido, a ferramenta não vai para as diretoras: um botão que às
 * vezes entrega meio jornal ensina a não confiar nele.
 *
 * Nada foi removido. Voltar a abrir é trocar este `false` por `true`.
 */
const IMPORTACAO_LIBERADA = false;


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
  const { canAccessJournal, isMarketing, loading: roleLoading, unit: profileUnit, userName } = useUserRole();
  const { journals, loading, saving, savedAt, erroDeLista, erroDeCriacao, refresh, create, save, remove, duplicate } = useJournals();

  const defaultUnitId = useMemo(
    () => newsUnitForProfileUnit(profileUnit)?.id ?? null,
    [profileUnit],
  );
  /**
   * A unidade em exibição vive na URL (`?unidade=`), não na memória da página.
   *
   * Na memória, qualquer remontagem ou recarregamento devolvia a pessoa para a
   * unidade dela — era a segunda brecha relatada em 08/09/2026. Na URL, a
   * escolha sobrevive ao F5 e vira link direto. Sem parâmetro (ou com um id
   * desconhecido), vale a unidade do perfil.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const unidadeNaUrl = lerUnidadeDaUrl(searchParams.get(PARAMETRO_UNIDADE));
  const activeUnitId = unidadeNaUrl === undefined ? defaultUnitId : unidadeNaUrl;
  const setActiveUnitId = useCallback(
    (unitId: string | null) => {
      const params = new URLSearchParams(searchParams);
      params.set(PARAMETRO_UNIDADE, escreverUnidadeNaUrl(unitId));
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /**
   * De quem é o jornal. A comunicação edita todos; a gestão, só os da unidade
   * dela. A garantia é a RLS — isto aqui é para a tela dizer a verdade antes
   * de o banco recusar.
   */
  /** É da unidade dela (ou ela é marketing): pode duplicar, excluir, arquivar. */
  const ehDela = useCallback(
    (journal: JournalRecord) =>
      isMarketing || (!!profileUnit && journal.profile_unit === profileUnit),
    [isMarketing, profileUnit],
  );
  /** Edita só o que é dela e não está arquivado: arquivado abre em leitura, com "Desarquivar". */
  const podeEditar = useCallback(
    (journal: JournalRecord) => ehDela(journal) && journal.status !== 'arquivado',
    [ehDela],
  );

  /** Arquivar e desarquivar: um clique, com Desfazer, como o finalizar. */
  const arquivar = async (journal: JournalRecord) => {
    const ok = await save(journal.id, { status: 'arquivado' });
    if (!ok) { toast.error('Não consegui arquivar. Confira a conexão e tente de novo.'); return; }
    toast.success('Jornal arquivado', {
      description: 'Ele sai da lista principal. Para vê-lo, filtre por “Arquivado”.',
      action: { label: 'Desfazer', onClick: () => { void save(journal.id, { status: 'finalizado' }); } },
    });
  };
  const desarquivar = async (journal: JournalRecord) => {
    const ok = await save(journal.id, { status: 'finalizado' });
    if (!ok) { toast.error('Não consegui desarquivar. Confira a conexão e tente de novo.'); return; }
    toast.success('Jornal de volta como finalizado');
  };

  /** A unidade em que ela pode criar: a dela. */
  const minhaUnidade = { unitId: defaultUnitId, profileUnit: profileUnit ?? null };
  const naMinhaUnidade = isMarketing || activeUnitId === defaultUnitId;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** Diálogo de criar a partir de um arquivo da unidade. */
  const [importing, setImporting] = useState(false);
  const [deEsboco, setDeEsboco] = useState(false);
  /** Tutorial da listagem: abre sozinho no primeiro acesso, e pelo botão depois. */
  const [tutorial, setTutorial] = useState(false);
  const tutoriais = useTutoriaisVistos();
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
    () => ordenarMeses(Array.from(new Set(unitJournals.map((j) => j.reference_month).filter(Boolean) as string[]))),
    [unitJournals],
  );

  const filtered = useMemo(
    () =>
      unitJournals.filter((journal) => {
        const matchesSearch = journal.name.toLowerCase().includes(search.trim().toLowerCase());
        // "Todas as situações" é a lista de trabalho: arquivados só aparecem filtrando por eles.
        const matchesStatus = statusFilter === 'todos' ? journal.status !== 'arquivado' : journal.status === statusFilter;
        const matchesMonth = monthFilter === 'todos' || journal.reference_month === monthFilter;
        return matchesSearch && matchesStatus && matchesMonth;
      }),
    [unitJournals, search, statusFilter, monthFilter],
  );

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'todos' || monthFilter !== 'todos';

  /**
   * Primeiro acesso: o tutorial da lista abre sozinho.
   *
   * Fica antes dos retornos antecipados porque hook não pode ser condicional —
   * as guardas de permissão vêm logo abaixo. O `jaViu` é que decide, e ele
   * responde falso enquanto o papel ainda está carregando, o que evitaria abrir
   * na tela vazia: por isso o efeito espera `roleLoading` terminar.
   */
  //
  // A marca vale por conta e chega do banco: o efeito também espera
  // `tutoriais.carregado`. E marca já ao abrir sozinho, não só ao fechar —
  // "primeiro acesso" é literalmente uma vez; se ela sair no meio, não reabre.
  useEffect(() => {
    if (roleLoading || !canAccessJournal || !tutoriais.carregado) return;
    if (!tutoriais.jaViu('listagem')) {
      setTutorial(true);
      tutoriais.marcarVisto('listagem');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o primeiro carregamento decide
  }, [roleLoading, canAccessJournal, tutoriais.carregado]);

  // Enquanto descobre quem é a pessoa: esqueleto, não tela branca.
  if (roleLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8" aria-busy="true" aria-label="Carregando o Jornal">
        <div className="space-y-3">
          <Skeleton className="h-8 w-56 rounded-[12px]" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-[20px]" />
          <Skeleton className="h-64 rounded-[20px]" />
          <Skeleton className="h-64 rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (!canAccessJournal) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Área da comunicação</h1>
        <p className="text-sm text-muted-foreground">
          O Jornal é da equipe de comunicação e da gestão de cada unidade. Fale com a coordenação
          para liberar seu acesso.
        </p>
      </div>
    );
  }

  const openCreate = () => {
    setForm({
      name: suggestName(activeUnitId, formatarMes(mesAtual())),
      unitId: activeUnitId,
      referenceMonth: formatarMes(mesAtual()),
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
    // Falhou: o diálogo fica aberto e mostra o motivo (antes fechava calado).
    if (!created) return;
    setCreating(false);
    setEditingId(created.id);
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
          somenteLeitura={!podeEditar(editing as JournalRecord)}
          podeTrocarUnidade={isMarketing}
          onDesarquivar={ehDela(editing as JournalRecord) && editing.status === 'arquivado' ? () => void desarquivar(editing as JournalRecord) : undefined}
          onDuplicarParaMinhaUnidade={
            defaultUnitId
              ? async () => {
                  await duplicate(editing as JournalRecord, minhaUnidade);
                  setEditingId(null);
                  setActiveUnitId(defaultUnitId);
                  toast.success('Cópia criada na sua unidade, como rascunho.');
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 lg:px-8">
      <PageHeader
        className="mb-0"
        title={`Olá${userName ? `, ${userName.split(' ')[0]}` : ''}`}
        description="Aqui ficam os jornais da sua unidade."
        actions={
          /* Criar fora da própria unidade seria recusado pela RLS. */
          naMinhaUnidade ? (
            <>
              {IMPORTACAO_LIBERADA && (
                <Button variant="outline" onClick={() => setImporting(true)}>
                  Começar de um arquivo
                </Button>
              )}
              {/* Só a comunicação: o esboço sai da pasta "Jornal - Esboço" do marketing (05/10/2026). */}
              {isMarketing && (
                <Button variant="outline" onClick={() => setDeEsboco(true)}>
                  Criar a partir de esboço
                </Button>
              )}
              <Button variant="ghost" onClick={() => setTutorial(true)} data-tutorial="ajuda">
                Como usar
              </Button>
              <Button onClick={openCreate} data-tutorial="criar">
                Criar jornal da unidade
              </Button>
            </>
          ) : undefined
        }
      />

      <UnitBadge
        data-tutorial="unidade"
        variant="banner"
        unitId={activeUnitId}
        label={naMinhaUnidade ? 'Minha unidade' : 'Vendo outra unidade'}
        hint={
          naMinhaUnidade
            ? 'Todos os jornais desta página pertencem a esta unidade.'
            : 'Somente leitura: dá para abrir, exportar e duplicar para a sua unidade.'
        }
        onChangeUnit={setActiveUnitId}
        modo={isMarketing ? 'mover' : 'ver'}
      />

      {/* Situação em abas segmentadas, com a contagem; "Todos" é a lista de
          trabalho (sem os arquivados), como era o "Todas as situações". */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label="Filtrar por situação"
          className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1"
        >
          {(['todos', ...COUNTER_ORDER] as const).map((status) => {
            const active = statusFilter === status;
            const rotulo = status === 'todos' ? 'Todos' : COUNTER_LABELS[status];
            const contagem = status === 'todos' ? counters.rascunho + counters.finalizado : counters[status];
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status === 'todos' || active ? 'todos' : status)}
                className={cn(
                  'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors sm:min-h-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]'
                    : 'font-medium text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={active}
                aria-label={`${contagem} ${rotulo}`}
              >
                {rotulo}
                <span className="tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">{contagem}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:w-[440px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Label htmlFor="busca-de-jornal" className="sr-only">Buscar jornal</Label>
            <Input
              id="busca-de-jornal"
              className="pl-9"
              placeholder="Buscar jornal…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger aria-label="Mês da edição">
              <SelectValue placeholder="Mês da edição" />
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
      </div>

      <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-foreground">
        Seus jornais
        {!loading && filtered.length > 0 && (
          <span className="ml-2 font-normal tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">{filtered.length}</span>
        )}
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando jornais…
        </div>
      ) : erroDeLista && journals.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-destructive/40 py-16 text-center" data-testid="erro-da-lista">
          <p className="text-base font-semibold text-destructive">Não consegui carregar os jornais</p>
          <p className="text-sm text-muted-foreground">Confira a conexão. Nada foi perdido.</p>
          <Button variant="outline" onClick={() => void refresh()}>Tentar de novo</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border px-4 py-20 text-center">
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
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <PontoDaUnidade unitId={activeUnitId} />
                  {newsUnitName(activeUnitId) || 'Institucional geral'}
                </span>
              </p>
              {/* O botão forte já está no cabeçalho; aqui ele repete em contorno. */}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={openCreate}>
                  Criar jornal da unidade
                </Button>
                {IMPORTACAO_LIBERADA && (
                  <Button variant="outline" onClick={() => setImporting(true)}>
                    Começar de um arquivo
                  </Button>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">
                A unidade já está definida — é só dar um nome à edição.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tutorial="lista">
          {filtered.map((journal) => {
            const cover = journal.pages?.[0];
            return (
              <article
                key={journal.id}
                className="overflow-hidden rounded-[20px] border border-black/5 bg-card transition-colors hover:border-black/10 dark:border-white/5 dark:hover:border-white/10"
              >
                <button
                  type="button"
                  onClick={() => setEditingId(journal.id)}
                  className="block w-full bg-muted/50 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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

                <div className="border-t border-border/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate text-[15px] font-semibold leading-snug text-foreground">
                      {journal.name}
                    </h3>
                    <Situacao status={journal.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[hsl(var(--fraco,0_0%_45%))]">
                    <UnitBadge variant="chip" unitId={journal.unit_id} />
                    <span className="tabular-nums">
                      · {journal.pages?.length ?? 0} páginas · {relativeDate(journal.updated_at)}
                      {journal.reference_month ? ` · ${journal.reference_month}` : ''}
                    </span>
                  </div>
                  {/* Ações discretas: o botão forte da tela é "Criar jornal da unidade". */}
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => setEditingId(journal.id)}>
                      Abrir
                    </Button>
                    {ehDela(journal) ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => duplicate(journal)}>
                          Duplicar
                        </Button>
                        {/* Só finalizado arquiva: rascunho ainda está em uso (decisão de 16/09). */}
                        {journal.status === 'finalizado' && (
                          <Button size="sm" variant="ghost" onClick={() => void arquivar(journal)}>
                            Arquivar
                          </Button>
                        )}
                        {journal.status === 'arquivado' && (
                          <Button size="sm" variant="ghost" onClick={() => void desarquivar(journal)}>
                            Desarquivar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(journal)}
                        >
                          Excluir
                        </Button>
                      </>
                    ) : (
                      defaultUnitId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await duplicate(journal, minhaUnidade);
                            setActiveUnitId(defaultUnitId);
                            toast.success('Cópia criada na sua unidade, como rascunho.');
                          }}
                        >
                          Duplicar para minha unidade
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </section>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este jornal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-[16px] border border-border bg-muted/40 p-3 text-sm">
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
              <Label htmlFor="mes-da-edicao">Mês da edição</Label>
              <SeletorDeMes
                value={form.referenceMonth}
                onChange={(texto) =>
                  setForm((prev) => ({
                    ...prev,
                    referenceMonth: texto,
                    // o nome sugerido acompanha, a menos que a pessoa já o tenha mudado
                    name: prev.name === suggestName(prev.unitId, prev.referenceMonth) ? suggestName(prev.unitId, texto) : prev.name,
                  }))
                }
              />
              <p className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">Aparece no cabeçalho de todas as páginas.</p>
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
                        'rounded-[16px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-[hsl(var(--sel,168_80%_27%))] bg-card ring-1 ring-[hsl(var(--sel,168_80%_27%))]'
                          : 'border-border bg-card hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{model.name}</span>
                        <span className="text-xs tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">
                          {model.pageLabels.length}{' '}
                          {model.pageLabels.length === 1 ? 'página' : 'páginas'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {model.pageLabels.map((label, index) => (
                          <span
                            key={`${model.key}-${index}`}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
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

          {erroDeCriacao && (
            <p role="alert" className="rounded-[12px] border border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground" data-testid="erro-de-criacao">
              <strong>Não consegui criar o jornal.</strong> Confira a conexão e tente de novo. Se continuar, pode ser a sessão: saia e entre de novo.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>{erroDeCriacao ? 'Tentar de novo' : 'Criar jornal'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JournalTutorial
        percurso="listagem"
        aberto={tutorial}
        onFechar={() => setTutorial(false)}
        onVisto={tutoriais.marcarVisto}
      />

      {isMarketing && (
        <JournalEsbocoDialog
          aberto={deEsboco}
          onAberto={setDeEsboco}
          sugerirNome={suggestName}
          onCriar={async (dados) => {
            const criado = await create({
              name: dados.name,
              unitId: dados.unitId,
              profileUnit: profileUnitForNewsUnit(dados.unitId),
              referenceMonth: dados.referenceMonth,
              status: 'rascunho',
              pages: dados.pages,
            });
            if (!criado) return null;
            // O fundo não entra na criação; vai logo em seguida, como o editor faz.
            if (dados.paper !== 'off_white') await save(criado.id, { paper: dados.paper });
            return criado.id;
          }}
          onPronto={(journalId) => setEditingId(journalId)}
        />
      )}

      <JournalImportDialog
        aberto={importing}
        onAberto={setImporting}
        unitId={activeUnitId}
        sugerirNome={suggestName}
        podeTrocarUnidade={isMarketing}
        onCriar={async (dados) => {
          const criado = await create({
            name: dados.name,
            unitId: dados.unitId,
            profileUnit: dados.unitId ? profileUnitForNewsUnit(dados.unitId) : null,
            referenceMonth: dados.referenceMonth || null,
            status: 'rascunho',
            pages: dados.pages,
          });
          return criado?.id ?? null;
        }}
        onPronto={(journalId, resultado) => {
          setEditingId(journalId);
          toast.success('Pronto — confira antes de gerar o PDF', {
            description: resumirImportacao(resultado),
            duration: 8000,
          });
          // O que a leitura achou ambíguo vem separado: é ela quem decide o que
          // fazer, e um aviso enfiado no resumo passaria batido.
          if (resultado.observacoes) {
            toast.warning('Confira este trecho', {
              description: resultado.observacoes,
              duration: 12000,
            });
          }
        }}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Download, Newspaper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { JournalEditor } from '@/components/journal/JournalEditor';
import { JournalPageView, A4_H, A4_W } from '@/components/journal/JournalPageView';
import { PontoDaUnidade } from '@/components/journal/UnitBadge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { cn } from '@/lib/utils';
import { interpretarMes } from '@/lib/journal/mesDaEdicao';
import { JORNAL_UNIT_GROUPS, ehUnidadeDoJornal, findNewsUnit, newsUnitName } from '@/lib/news/units';
import type { JournalRecord } from '@/lib/journal/types';

/** Os parâmetros do endereço: a unidade do filtro e o jornal aberto. */
const PARAMETRO_UNIDADE = 'unidade';
const PARAMETRO_LER = 'ler';

/** Mês da edição como número, para ordenar; sem mês reconhecível, vai para o fim. */
const ordemDoMes = (j: JournalRecord) => {
  const m = interpretarMes(j.reference_month);
  return m ? m.ano * 12 + m.mes : -1;
};

/** Do mais novo para o mais antigo: pelo mês da edição, depois pela última gravação. */
function ordenarFinalizados(jornais: JournalRecord[]): JournalRecord[] {
  return [...jornais].sort((a, b) => ordemDoMes(b) - ordemDoMes(a) || b.updated_at.localeCompare(a.updated_at));
}

const diaEMes = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/**
 * Jornais das unidades (16/11/2026): o feed da Educação. Os jornais que os CEIs
 * e o GOE marcaram como finalizados, do mais novo para o mais antigo, para ler
 * e baixar. Ninguém edita aqui: quem cuida do jornal de uma unidade continua
 * no Jornal Institucional.
 *
 * Quem vê é quem entra no Jornal (`JournalRoute`): a comunicação, a
 * administração e a gestão da Educação. A RLS de `journals` já deixa a gestão
 * ler os finalizados das outras unidades; o Social não entra.
 */
export default function JornaisDasUnidadesPage() {
  useTituloDaAba('Jornais das unidades · ANA Brasil');
  const celular = useIsMobile();
  const [params, setParams] = useSearchParams();
  const [jornais, setJornais] = useState<JournalRecord[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** "Baixar PDF" abre o jornal com o menu do PDF já aberto. */
  const [comMenuDoPdf, setComMenuDoPdf] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('journals')
      .select('*')
      .eq('status', 'finalizado')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) setErro(error.message);
    else {
      setErro(null);
      // Só os das unidades da Educação: a Institucional geral e o que sobrou
      // de outra unidade não são "jornal de unidade".
      setJornais(ordenarFinalizados(((data ?? []) as unknown as JournalRecord[]).filter((j) => ehUnidadeDoJornal(j.unit_id))));
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // As unidades do filtro: só as que já têm jornal finalizado, na ordem do catálogo.
  const unidades = useMemo(() => {
    const comJornal = new Set(jornais.map((j) => j.unit_id));
    return JORNAL_UNIT_GROUPS.flatMap((g) => g.units).filter((u) => comJornal.has(u.id));
  }, [jornais]);

  const pedida = params.get(PARAMETRO_UNIDADE);
  const unidade = unidades.some((u) => u.id === pedida) ? pedida : null;
  const visiveis = unidade ? jornais.filter((j) => j.unit_id === unidade) : jornais;
  const aberto = jornais.find((j) => j.id === params.get(PARAMETRO_LER)) ?? null;

  const mudar = (chave: string, valor: string | null) => {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    setParams(novos);
  };
  const ler = (j: JournalRecord, pdf = false) => {
    setComMenuDoPdf(pdf);
    mudar(PARAMETRO_LER, j.id);
  };

  if (aberto) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
        <JournalEditor
          key={aberto.id}
          journal={aberto}
          saving={false}
          savedAt={null}
          onBack={() => mudar(PARAMETRO_LER, null)}
          onSave={async () => false}
          somenteLeitura
          abrirMenuDoPdf={comMenuDoPdf}
        />
      </div>
    );
  }

  const larguraDaMiniatura = celular ? 120 : 180;
  const escala = larguraDaMiniatura / A4_W;

  return (
    <div className="mx-auto w-full max-w-app space-y-5 px-4 py-6 lg:px-8">
      <PageHeader
        className="mb-0"
        title="Jornais das unidades"
        description="Os jornais que cada unidade da Educação marcou como finalizados, do mais novo para o mais antigo. Só para ler e baixar."
      />

      {unidades.length > 1 && (
        <div role="group" aria-label="Filtrar por unidade" className={cn('-mx-4 flex gap-1.5 px-4', celular ? 'overflow-x-auto [scrollbar-width:none]' : 'flex-wrap')}>
          {[{ id: null as string | null, rotulo: 'Todas as unidades' }, ...unidades.map((u) => ({ id: u.id as string | null, rotulo: u.short }))].map((f) => {
            const ligado = unidade === f.id;
            return (
              <button
                key={f.id ?? 'todas'}
                type="button"
                aria-pressed={ligado}
                onClick={() => mudar(PARAMETRO_UNIDADE, f.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                  ligado
                    ? 'border-transparent bg-foreground font-semibold text-background'
                    : 'border-black/10 bg-white/55 text-foreground/80 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10',
                )}
              >
                {f.rotulo}
              </button>
            );
          })}
        </div>
      )}

      {carregando ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-[20px]" />)}
        </div>
      ) : erro ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-destructive/40 px-4 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">Não consegui carregar os jornais.</p>
          <p className="text-xs text-muted-foreground">Confira a conexão e tente de novo.</p>
          <Button size="sm" variant="outline" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border px-4 py-20 text-center">
          <Newspaper className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Nenhum jornal finalizado ainda</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Quando uma unidade marcar o jornal dela como finalizado, no Jornal Institucional, ele aparece aqui para todas lerem.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {visiveis.map((j) => {
            const capa = j.pages?.[0];
            const curto = findNewsUnit(j.unit_id)?.short ?? newsUnitName(j.unit_id);
            return (
              <li key={j.id} className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
                <button
                  type="button"
                  onClick={() => ler(j)}
                  className="block w-full bg-muted/50 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
                  aria-label={`Ler ${j.name}`}
                >
                  <div
                    className="mx-auto overflow-hidden rounded-sm border border-border bg-news-paper"
                    style={{ width: larguraDaMiniatura, height: A4_H * escala }}
                  >
                    {capa && (
                      <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left' }} aria-hidden>
                        <JournalPageView
                          page={capa}
                          index={0}
                          total={j.pages.length}
                          edition={j.reference_month || ''}
                          unitName={newsUnitName(j.unit_id)}
                          unitId={j.unit_id}
                        />
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex flex-1 flex-col gap-1 border-t border-border/70 p-3 sm:p-4">
                  <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
                    <PontoDaUnidade unitId={j.unit_id} />
                    <span className="truncate">{curto}</span>
                  </p>
                  <h2 className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground sm:text-[15px]">{j.name}</h2>
                  <p className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">
                    {/* O nome sugerido já traz o mês ("Jornal Calmon — Novembro 2026"): só repete se não trouxer. */}
                    {j.reference_month && !j.name.includes(j.reference_month) ? `${j.reference_month} · ` : ''}
                    <span className="tabular-nums">
                      {j.pages.length} {j.pages.length === 1 ? 'página' : 'páginas'} · atualizado em {diaEMes(j.updated_at)}
                    </span>
                  </p>
                  <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:flex-row">
                    <Button size="sm" variant="outline" className="sm:flex-1" onClick={() => ler(j)}>
                      <BookOpen className="mr-1.5 h-4 w-4" /> Ler
                    </Button>
                    <Button size="sm" variant="ghost" className="sm:flex-1" onClick={() => ler(j, true)}>
                      <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

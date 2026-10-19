import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AREAS, ROTULO_DA_AREA, type Area } from '@/lib/vagas/modelo';
import { COLUNAS_DO_QUADRO, DIAS_PARADO, montarPainel, type Painel } from '@/lib/vagas/rh';

/**
 * O Painel do RH (passo 2 do roteiro, mockup aprovado em 19/10/2026): a
 * primeira aba de quem é RH. Números do período, candidatos por etapa e o que
 * pede atenção (novos, parados há 10+ dias, vagas sem candidatura). Cada
 * linha leva à vaga já filtrada. Só volumes, nada por pessoa.
 */

const PERIODOS: Array<[number | null, string]> = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [null, 'Tudo']];
const COR: Record<string, string> = { recebida: '#01ADFF', analise: '#FBCE00', entrevista: '#81E2CF', aprovado: '#0E6B58', nao_selecionado: 'hsl(var(--muted-foreground) / 0.35)', retiradas: 'hsl(var(--muted-foreground) / 0.2)' };

export function PainelDoRh() {
  const [dias, setDias] = useState<number | null>(30);
  const [area, setArea] = useState<Area | null>(null);
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setErro(false);
    montarPainel(dias, area).then(setP).catch(() => setErro(true));
  }, [dias, area]);

  const etapas: Array<[string, string]> = [...COLUNAS_DO_QUADRO, ['retiradas', 'Retiradas']];
  const max = p ? Math.max(1, ...etapas.map(([k]) => p.porColuna[k as keyof Painel['porColuna']])) : 1;
  const kpis: Array<[string, string | number, string, boolean]> = p ? [
    ['Vagas abertas', p.vagasAbertas, Object.entries(p.porArea).map(([a, n]) => `${n} ${ROTULO_DA_AREA[a as Area] ?? a}`).join(' · ') || '—', false],
    ['Candidaturas', p.candidaturas, 'no período', false],
    ['Para triar', p.paraTriar, 'ninguém abriu ainda', p.paraTriar > 0],
    ['Em entrevista', p.emEntrevista, 'agora', false],
    ['Aprovados', p.aprovados, 'no período', false],
  ] : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Painel do RH</h1>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período e área">
          {PERIODOS.map(([d, r]) => <Button key={r} size="sm" variant={dias === d ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setDias(d)}>{r}</Button>)}
          <span className="w-2" />
          <Button size="sm" variant={area === null ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setArea(null)}>Todas as áreas</Button>
          {AREAS.map((a) => <Button key={a} size="sm" variant={area === a ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setArea(a)}>{ROTULO_DA_AREA[a]}</Button>)}
        </div>
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui montar o painel. Recarregue a página.</p>}
      {!p && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {p && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {kpis.map(([r, n, sub, alerta]) => (
              <div key={r} className={`flex flex-col gap-0.5 rounded-2xl p-4 ${alerta ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted/60'}`} data-testid={`kpi-${r}`}>
                <small className="text-[11px] uppercase tracking-wider text-muted-foreground">{r}</small>
                <b className={`text-3xl tabular-nums ${alerta ? 'text-red-800 dark:text-red-300' : ''}`}>{n}</b>
                <span className="truncate text-xs text-muted-foreground">{sub}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-4" aria-label="Candidatos por etapa">
              <b className="text-sm">Candidatos por etapa · todas as vagas</b>
              {etapas.map(([k, r]) => {
                const n = p.porColuna[k as keyof Painel['porColuna']];
                return (
                  <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)_40px] items-center gap-2.5 text-sm">
                    <span>{r}</span>
                    <span className="h-3.5 rounded-full bg-background"><span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: COR[k] }} /></span>
                    <b className="text-right tabular-nums">{n}</b>
                  </div>
                );
              })}
            </section>

            <section className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4" aria-label="Pede atenção">
              <b className="text-sm">Pede atenção</b>
              {p.atencao.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendente.</p> : (
                <ul className="flex flex-col gap-1.5">
                  {p.atencao.slice(0, 8).map((a) => (
                    <li key={`${a.vaga.id}-${a.tipo}`}>
                      <Link to={a.tipo === 'sem_candidatos' ? `/vagas/${a.vaga.slug}` : `/vagas/${a.vaga.slug}/candidatos?ver=${a.tipo}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-background px-3 py-2.5 text-sm hover:bg-background/70">
                        <span className="min-w-0"><b className="block truncate">{a.vaga.titulo}</b><span className="text-xs text-muted-foreground">{a.detalhe}</span></span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.tipo === 'novos' ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'}`}>
                          {a.tipo === 'novos' ? `${a.quantidade} ${a.quantidade === 1 ? 'novo' : 'novos'}` : a.tipo === 'parados' ? 'parados' : 'sem candidatos'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <p className="text-xs text-muted-foreground">“Parados” = {DIAS_PARADO} dias ou mais sem mudar de etapa. Vagas sem candidatura aparecem a partir de 14 dias abertas.</p>
        </>
      )}
    </div>
  );
}

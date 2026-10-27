import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

// Esboço V2: abas segmentadas (o mesmo desenho dos filtros de Processos).
const SEGMENTO = 'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-muted p-1';
const opcao = (ativa: boolean) => `inline-flex shrink-0 items-center whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${ativa ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`;

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Painel do RH</h1>
          <p className="text-sm text-muted-foreground">Trabalhe Conosco · números do período</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período e área">
        <div className={SEGMENTO}>
          {PERIODOS.map(([d, r]) => (
            <button key={r} type="button" aria-pressed={dias === d} className={opcao(dias === d)} onClick={() => setDias(d)}>{r}</button>
          ))}
        </div>
        <div className={SEGMENTO}>
          <button type="button" aria-pressed={area === null} className={opcao(area === null)} onClick={() => setArea(null)}>Todas as áreas</button>
          {AREAS.map((a) => (
            <button key={a} type="button" aria-pressed={area === a} className={opcao(area === a)} onClick={() => setArea(a)}>{ROTULO_DA_AREA[a]}</button>
          ))}
        </div>
      </div>

      {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui montar o painel. Recarregue a página.</p>}
      {!p && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {p && (
        <>
          {/* faixa de números (padrão do Dashboard): cor só no número que pede ação */}
          <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] md:grid-cols-5">
            {kpis.map(([r, n, sub, alerta], i) => (
              <div
                key={r}
                data-testid={`kpi-${r}`}
                className={[
                  'flex min-w-0 flex-col border-black/10 p-4 dark:border-white/10 sm:px-5',
                  i % 2 === 1 ? 'border-l' : '',
                  i >= 2 ? 'border-t md:border-t-0' : '',
                  i > 0 ? 'md:border-l' : '',
                  i === 4 ? 'col-span-2 md:col-span-1' : '',
                ].join(' ')}
              >
                <b className={`font-display text-3xl font-bold tabular-nums ${alerta ? 'text-destructive' : 'text-foreground'}`}>{n}</b>
                <span className="mt-0.5 text-[13px] text-muted-foreground">{r}</span>
                <span className="truncate text-xs text-[hsl(var(--fraco,0_0%_45%))]">{sub}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-3 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5" aria-label="Candidatos por etapa">
              <h2 className="text-[15px] font-semibold">Candidatos por etapa · todas as vagas</h2>
              {etapas.map(([k, r]) => {
                const n = p.porColuna[k as keyof Painel['porColuna']];
                return (
                  <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)_36px] items-center gap-2.5 text-sm">
                    <span className="text-muted-foreground">{r}</span>
                    <span className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: COR[k] }} /></span>
                    <b className="text-right font-semibold tabular-nums">{n}</b>
                  </div>
                );
              })}
            </section>

            <section className="flex flex-col overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5" aria-label="Pede atenção">
              <h2 className="px-5 pb-2 pt-5 text-[15px] font-semibold">Pede atenção</h2>
              {p.atencao.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nada pendente.</p> : (
                <ul className="flex flex-col">
                  {p.atencao.slice(0, 8).map((a) => (
                    <li key={`${a.vaga.id}-${a.tipo}`} className="border-t border-border/70">
                      <Link to={a.tipo === 'sem_candidatos' ? `/vagas/${a.vaga.slug}` : `/vagas/${a.vaga.slug}/candidatos?ver=${a.tipo}`}
                        className="grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/40">
                        <span className="min-w-0"><b className="block truncate font-semibold">{a.vaga.titulo}</b><span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{a.detalhe}</span></span>
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${a.tipo === 'respostas' ? 'text-info' : a.tipo === 'novos' ? 'text-destructive' : 'text-warning'}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {a.tipo === 'respostas' ? 'respondeu' : a.tipo === 'novos' ? `${a.quantidade} ${a.quantidade === 1 ? 'novo' : 'novos'}` : a.tipo === 'parados' ? 'parados' : 'sem candidatos'}
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

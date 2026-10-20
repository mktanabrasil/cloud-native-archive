import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { AREAS, ROTULO_DA_AREA, type Area } from '@/lib/vagas/modelo';
import { ROTULO_DA_SITUACAO_NO_RELATORIO, csvDoRelatorio, emDias, montarRelatorio, type Relatorio, type SituacaoNoRelatorio } from '@/lib/vagas/relatorios';

/**
 * Vagas › Relatórios (passo 6 do roteiro, mockup aprovado em 20/10/2026):
 * como andam os processos, em volumes e tempos, nunca por pessoa. Só o RH.
 */

const PERIODOS: Array<[number | null, string]> = [[30, '30 dias'], [90, '90 dias'], [365, '12 meses'], [null, 'Tudo']];
const COR_DA_SITUACAO: Record<SituacaoNoRelatorio, string> = {
  no_prazo: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  triagem_lenta: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  sem_responsavel: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  prazo_vencido: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  fechada: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
};
/** Acima disso a barra do tempo fica coral. */
const DIAS_DE_ALERTA = 7;

/** "▲ 18% vs. período anterior" para quantidades; para tempos, menor é melhor. */
function comparar(agora: number | null, antes: number | null, tipo: 'quantidade' | 'tempo'): { texto: string; bom: boolean } | null {
  if (agora === null || antes === null) return null;
  if (tipo === 'tempo') return { texto: `era ${emDias(antes)}`, bom: agora <= antes };
  if (antes === 0) return agora ? { texto: 'novo no período', bom: true } : null;
  const pct = Math.round(((agora - antes) / antes) * 100);
  return { texto: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs. período anterior`, bom: pct >= 0 };
}

export function RelatoriosDoRh() {
  const [dias, setDias] = useState<number | null>(90);
  const [area, setArea] = useState<Area | null>(null);
  const [r, setR] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    montarRelatorio({ dias, area, vaga: null }).then((x) => { if (vivo) setR(x); }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [dias, area]);

  const maxSemana = useMemo(() => Math.max(1, ...(r?.semanas.map((s) => s.n) ?? [1])), [r]);
  const maxTempo = useMemo(() => Math.max(DIAS_DE_ALERTA * 1.5, ...(r?.tempos.map((x) => x.dias ?? 0) ?? [0])), [r]);

  const kpis: Array<[string, string, ReturnType<typeof comparar> | { texto: string; bom: null }]> = r ? [
    ['Candidaturas', String(r.candidaturas), comparar(r.candidaturas, r.candidaturasAntes, 'quantidade')],
    ['1ª olhada do RH', emDias(r.primeiraOlhada), r.primeiraOlhada === null ? null : { texto: 'mediana', bom: null }],
    ['Até o resultado', emDias(r.ateResultado), r.ateResultado === null ? null : { texto: 'mediana', bom: null }],
    ['Aprovados', String(r.aprovados), { texto: `${r.vagasFechadas} ${r.vagasFechadas === 1 ? 'vaga fechada' : 'vagas fechadas'}`, bom: null }],
  ] : [];
  // A comparação dos tempos, quando há período anterior.
  if (r && kpis.length) {
    const o = comparar(r.primeiraOlhada, r.primeiraOlhadaAntes, 'tempo'); if (o) kpis[1][2] = { texto: `mediana · ${o.texto}`, bom: o.bom };
    const a = comparar(r.ateResultado, r.ateResultadoAntes, 'tempo'); if (a) kpis[2][2] = { texto: `mediana · ${a.texto}`, bom: a.bom };
  }
  const funil: Array<[string, number, boolean]> = r ? [
    ['Recebidas', r.funil.recebidas, false], ['Análise', r.funil.analise, false], ['Entrevista', r.funil.entrevista, false],
    ['Aprovadas', r.funil.aprovadas, false], ['Retiradas', r.funil.retiradas, true],
  ] : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Período e área">
          {PERIODOS.map(([d, rot]) => <Button key={rot} size="sm" variant={dias === d ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setDias(d)}>{rot}</Button>)}
          <span className="w-2" />
          <Button size="sm" variant={area === null ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setArea(null)}>Todas as áreas</Button>
          {AREAS.map((a) => <Button key={a} size="sm" variant={area === a ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setArea(a)}>{ROTULO_DA_AREA[a]}</Button>)}
          <span className="w-2" />
          <Button size="sm" variant="outline" className="h-8" disabled={!r?.porVaga.length} onClick={() => r && baixarArquivo(csvDoRelatorio(r), 'relatorio-vagas.csv')}><Download className="h-4 w-4" /> Planilha</Button>
        </div>
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui montar o relatório. Recarregue a página.</p>}
      {!r && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {kpis.map(([rot, valor, sub]) => (
              <div key={rot} className="flex flex-col gap-0.5 rounded-2xl bg-muted/60 p-4" data-testid={`kpi-${rot}`}>
                <small className="text-[11px] uppercase tracking-wider text-muted-foreground">{rot}</small>
                <b className="text-3xl tabular-nums">{valor}</b>
                {sub && <span className={`truncate text-xs font-semibold ${sub.bom === null ? 'text-muted-foreground' : sub.bom ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{sub.texto}</span>}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4" aria-label="Funil">
              <b className="text-sm">Funil · quantos chegaram a cada etapa</b>
              {funil.map(([rot, n, apagado]) => (
                <div key={rot} className={`grid grid-cols-[100px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm ${apagado ? 'text-muted-foreground' : ''}`}>
                  <span>{rot}</span>
                  <span className="h-5 rounded-md bg-background"><span className="block h-full rounded-md" style={{ width: `${r.funil.recebidas ? (n / r.funil.recebidas) * 100 : 0}%`, background: apagado ? 'hsl(var(--muted-foreground) / 0.25)' : '#0E6B58' }} /></span>
                  <b className="text-right tabular-nums">{n}</b>
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4" aria-label="Tempo em cada etapa">
              <b className="text-sm">Tempo em cada etapa <span className="font-normal text-muted-foreground">(mediana)</span></b>
              {r.tempos.map((x) => (
                <div key={x.rotulo} className="grid grid-cols-[140px_minmax(0,1fr)_52px] items-center gap-2.5 text-sm">
                  <span>{x.rotulo}</span>
                  <span className="h-2.5 rounded-full bg-background"><span className="block h-full rounded-full" style={{ width: `${((x.dias ?? 0) / maxTempo) * 100}%`, background: (x.dias ?? 0) > DIAS_DE_ALERTA ? '#F26B4F' : '#0E6B58' }} /></span>
                  <b className="text-right tabular-nums">{emDias(x.dias)}</b>
                </div>
              ))}
              <span className="text-[11px] text-muted-foreground">Barra coral: passou de {DIAS_DE_ALERTA} dias.</span>
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4" aria-label="Candidaturas por semana">
              <b className="text-sm">Candidaturas por semana</b>
              <div className="flex h-28 items-end gap-1">
                {r.semanas.map((s) => (
                  <span key={s.inicio} title={`${s.n} na semana de ${new Date(s.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    className="min-w-0 flex-1 rounded-t-md bg-[#81E2CF] dark:bg-[#2F6F62]" style={{ height: `${Math.max(3, (s.n / maxSemana) * 100)}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[10.5px] text-muted-foreground">
                <span>{new Date(r.semanas[0].inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span><span>hoje</span>
              </div>
            </section>

            <section className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4" aria-label="Como ficaram sabendo">
              <b className="text-sm">Como ficaram sabendo</b>
              {r.origem.length === 0 ? <p className="text-sm text-muted-foreground">Sem candidaturas no período.</p> : r.origem.map((o) => (
                <div key={o.rotulo} className="grid grid-cols-[120px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm">
                  <span className="truncate">{o.rotulo}</span>
                  <span className="h-2.5 rounded-full bg-background"><span className="block h-full rounded-full bg-[#01ADFF]" style={{ width: `${(o.n / r.origem[0].n) * 100}%` }} /></span>
                  <b className="text-right tabular-nums">{o.pct}%</b>
                </div>
              ))}
            </section>
          </div>

          <section className="flex flex-col gap-2" aria-label="Por vaga">
            <b className="text-sm">Por vaga</b>
            {r.porVaga.length === 0 ? <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhuma vaga no período.</p> : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="p-3">Vaga</th><th className="p-3">Candidaturas</th><th className="p-3">Em aberto</th><th className="p-3">1ª olhada</th><th className="p-3">Até o resultado</th><th className="p-3">Responsável</th><th className="p-3">Situação</th></tr>
                  </thead>
                  <tbody>
                    {r.porVaga.map((l) => (
                      <tr key={l.vaga.id} className="border-t border-border" data-testid="linha-vaga">
                        <td className="p-3"><Link to={`/vagas/${l.vaga.slug}/candidatos`} className="font-semibold hover:underline">{l.vaga.titulo}</Link><span className="block text-xs text-muted-foreground">{l.vaga.codigo}</span></td>
                        <td className="p-3 tabular-nums">{l.candidaturas}</td>
                        <td className="p-3 tabular-nums">{l.emAberto}</td>
                        <td className="p-3 tabular-nums">{emDias(l.primeiraOlhada)}</td>
                        <td className="p-3 tabular-nums">{emDias(l.ateResultado)}</td>
                        <td className="p-3">{l.responsavel ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_DA_SITUACAO[l.situacao]}`}>{ROTULO_DA_SITUACAO_NO_RELATORIO[l.situacao]}{l.situacao === 'fechada' && l.aprovados ? ` · ${l.aprovados} ${l.aprovados === 1 ? 'aprovado' : 'aprovados'}` : ''}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="text-xs text-muted-foreground">Quantidades e tempos, nunca quem é o candidato, e sem separar por idade, gênero, cor ou bairro. A planilha também só tem números.</p>
        </>
      )}
    </div>
  );
}

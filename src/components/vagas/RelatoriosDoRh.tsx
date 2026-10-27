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
// Esboço V2: a situação vira texto com bolinha, na cor de texto legível.
const COR_DA_SITUACAO: Record<SituacaoNoRelatorio, string> = {
  no_prazo: 'text-success',
  triagem_lenta: 'text-warning',
  sem_responsavel: 'text-destructive',
  prazo_vencido: 'text-destructive',
  fechada: 'text-info',
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

  // Esboço V2: abas segmentadas, faixa de números, blocos sólidos e situação em texto com bolinha.
  const segmento = 'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-muted p-1';
  const opcao = (ativa: boolean) => `inline-flex shrink-0 items-center whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${ativa ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`;
  const bloco = 'flex flex-col gap-3 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5';
  const situacao = (l: Relatorio['porVaga'][number]) => (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${COR_DA_SITUACAO[l.situacao]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {ROTULO_DA_SITUACAO_NO_RELATORIO[l.situacao]}{l.situacao === 'fechada' && l.aprovados ? ` · ${l.aprovados} ${l.aprovados === 1 ? 'aprovado' : 'aprovados'}` : ''}
    </span>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Trabalhe Conosco · volumes e tempos, nunca por pessoa</p>
        </div>
        <Button variant="outline" disabled={!r?.porVaga.length} onClick={() => r && baixarArquivo(csvDoRelatorio(r), 'relatorio-vagas.csv')}><Download className="h-4 w-4" /> Planilha</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período e área">
        <div className={segmento}>
          {PERIODOS.map(([d, rot]) => <button key={rot} type="button" aria-pressed={dias === d} className={opcao(dias === d)} onClick={() => setDias(d)}>{rot}</button>)}
        </div>
        <div className={segmento}>
          <button type="button" aria-pressed={area === null} className={opcao(area === null)} onClick={() => setArea(null)}>Todas as áreas</button>
          {AREAS.map((a) => <button key={a} type="button" aria-pressed={area === a} className={opcao(area === a)} onClick={() => setArea(a)}>{ROTULO_DA_AREA[a]}</button>)}
        </div>
      </div>

      {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui montar o relatório. Recarregue a página.</p>}
      {!r && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {r && (
        <>
          {/* faixa de números (padrão do Dashboard) */}
          <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] lg:grid-cols-4">
            {kpis.map(([rot, valor, sub], i) => (
              <div
                key={rot}
                data-testid={`kpi-${rot}`}
                className={[
                  'flex min-w-0 flex-col border-black/10 p-4 dark:border-white/10 sm:px-5',
                  i % 2 === 1 ? 'border-l' : '',
                  i >= 2 ? 'border-t lg:border-t-0' : '',
                  i === 2 ? 'lg:border-l' : '',
                ].join(' ')}
              >
                <b className="font-display text-3xl font-bold tabular-nums text-foreground">{valor}</b>
                <span className="mt-0.5 text-[13px] text-muted-foreground">{rot}</span>
                {sub && <span className={`truncate text-xs font-semibold ${sub.bom === null ? 'text-[hsl(var(--fraco,0_0%_45%))]' : sub.bom ? 'text-success' : 'text-destructive'}`}>{sub.texto}</span>}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className={bloco} aria-label="Funil">
              <h2 className="text-[15px] font-semibold">Funil · quantos chegaram a cada etapa</h2>
              {funil.map(([rot, n, apagado]) => (
                <div key={rot} className={`grid grid-cols-[100px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm ${apagado ? 'text-muted-foreground' : ''}`}>
                  <span className="text-muted-foreground">{rot}</span>
                  <span className="h-4 rounded-[6px] bg-muted"><span className="block h-full rounded-[6px]" style={{ width: `${r.funil.recebidas ? (n / r.funil.recebidas) * 100 : 0}%`, background: apagado ? 'hsl(var(--muted-foreground) / 0.25)' : '#0E6B58' }} /></span>
                  <b className="text-right font-semibold tabular-nums">{n}</b>
                </div>
              ))}
            </section>

            <section className={bloco} aria-label="Tempo em cada etapa">
              <h2 className="text-[15px] font-semibold">Tempo em cada etapa <span className="font-normal text-muted-foreground">(mediana)</span></h2>
              {r.tempos.map((x) => (
                <div key={x.rotulo} className="grid grid-cols-[140px_minmax(0,1fr)_52px] items-center gap-2.5 text-sm">
                  <span className="text-muted-foreground">{x.rotulo}</span>
                  <span className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${((x.dias ?? 0) / maxTempo) * 100}%`, background: (x.dias ?? 0) > DIAS_DE_ALERTA ? '#F26B4F' : '#0E6B58' }} /></span>
                  <b className="text-right font-semibold tabular-nums">{emDias(x.dias)}</b>
                </div>
              ))}
              <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">Barra coral: passou de {DIAS_DE_ALERTA} dias.</span>
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className={bloco} aria-label="Candidaturas por semana">
              <h2 className="text-[15px] font-semibold">Candidaturas por semana</h2>
              <div className="flex h-28 items-end gap-1">
                {r.semanas.map((s) => (
                  <span key={s.inicio} title={`${s.n} na semana de ${new Date(s.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    className="min-w-0 flex-1 rounded-t-[4px] bg-[#81E2CF] dark:bg-[#2F6F62]" style={{ height: `${Math.max(3, (s.n / maxSemana) * 100)}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-[hsl(var(--fraco,0_0%_45%))]">
                <span>{new Date(r.semanas[0].inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span><span>hoje</span>
              </div>
            </section>

            <section className={bloco} aria-label="Como ficaram sabendo">
              <h2 className="text-[15px] font-semibold">Como ficaram sabendo</h2>
              {r.origem.length === 0 ? <p className="text-sm text-muted-foreground">Sem candidaturas no período.</p> : r.origem.map((o) => (
                <div key={o.rotulo} className="grid grid-cols-[120px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm">
                  <span className="truncate text-muted-foreground">{o.rotulo}</span>
                  <span className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-[#01ADFF]" style={{ width: `${(o.n / r.origem[0].n) * 100}%` }} /></span>
                  <b className="text-right font-semibold tabular-nums">{o.pct}%</b>
                </div>
              ))}
            </section>
          </div>

          <section className="flex flex-col gap-3" aria-label="Por vaga">
            <h2 className="text-[15px] font-semibold">Por vaga</h2>
            {r.porVaga.length === 0 ? <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhuma vaga no período.</p> : (
              <>
                {/* computador: a tabela */}
                <div className="hidden overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:block">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="text-left text-xs font-semibold text-muted-foreground">
                      <tr className="border-b border-border"><th className="px-4 py-3">Vaga</th><th className="px-4 py-3">Candidaturas</th><th className="px-4 py-3">Em aberto</th><th className="px-4 py-3">1ª olhada</th><th className="px-4 py-3">Até o resultado</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Situação</th></tr>
                    </thead>
                    <tbody>
                      {r.porVaga.map((l) => (
                        <tr key={l.vaga.id} className="border-t border-border/70 transition-colors hover:bg-muted/40" data-testid="linha-vaga">
                          <td className="px-4 py-3"><Link to={`/vagas/${l.vaga.slug}/candidatos`} className="font-semibold hover:underline">{l.vaga.titulo}</Link><span className="block text-xs text-[hsl(var(--fraco,0_0%_45%))]">{l.vaga.codigo}</span></td>
                          <td className="px-4 py-3 tabular-nums">{l.candidaturas}</td>
                          <td className="px-4 py-3 tabular-nums">{l.emAberto}</td>
                          <td className="px-4 py-3 tabular-nums">{emDias(l.primeiraOlhada)}</td>
                          <td className="px-4 py-3 tabular-nums">{emDias(l.ateResultado)}</td>
                          <td className="px-4 py-3">{l.responsavel ?? <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3">{situacao(l)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* celular: cada vaga numa linha empilhada, sem rolar para o lado */}
                <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:hidden">
                  {r.porVaga.map((l) => (
                    <div key={l.vaga.id} className="grid gap-1.5 border-b border-border/70 px-4 py-3.5 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link to={`/vagas/${l.vaga.slug}/candidatos`} className="block font-semibold leading-snug">{l.vaga.titulo}</Link>
                          <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{l.vaga.codigo}{l.responsavel ? ` · ${l.responsavel}` : ''}</span>
                        </div>
                        {situacao(l)}
                      </div>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {l.candidaturas} {l.candidaturas === 1 ? 'candidatura' : 'candidaturas'} · {l.emAberto} em aberto · 1ª olhada {emDias(l.primeiraOlhada)} · resultado {emDias(l.ateResultado)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <p className="text-xs text-muted-foreground">Quantidades e tempos, nunca quem é o candidato, e sem separar por idade, gênero, cor ou bairro. A planilha também só tem números.</p>
        </>
      )}
    </div>
  );
}

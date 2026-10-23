import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, Download, Lock } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { ATUALIZA_A_CADA_MS, calcularPainel, corDaUnidade, grupoDe, haQuanto, lerAcompanhamento, type Acompanhamento, type Painel } from '@/lib/voluntariado/aoVivo';
import { caminhoDoAoVivo, parceirosPorExtenso, TREINAMENTO } from '@/lib/voluntariado/modelo';

/**
 * /voluntariado/natalfeliz26/acompanhar/:codigo — o painel ao vivo da gestão.
 * Link com código secreto, como o acompanhamento da enquete; só lê.
 *
 * Desde 23/10/2026 (mockup aprovado): tudo numa tela só, sem carrossel, na
 * ordem do que importa — quantos somos e onde falta gente (metas por área),
 * depois quem são, horários, unidades, o ritmo por dia e as últimas
 * inscrições. Busca a cada 3 minutos. O "Baixar resumo" gera um PDF A4
 * paisagem para apresentação (src/lib/voluntariado/resumoPdf.ts).
 */

const META = '#2F6B52';
const RESERVA = '#A9D3C2';
/** Quem são: paleta validada (dataviz) para três séries, sempre com rótulo ao lado. */
const VINCULO = [
  { chave: 'funcionario', rotulo: 'Funcionários ANA', cor: '#0088CC' },
  { chave: 'alcance', rotulo: 'Alcance JNI', cor: '#E8604A' },
  { chave: 'comunidade', rotulo: 'Voluntários de fora', cor: '#1F9D6B' },
] as const;

function Numero({ rotulo, children, sub, testId }: { rotulo: string; children: React.ReactNode; sub: React.ReactNode; testId: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card p-4" data-testid={testId}>
      <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
      <b className="text-4xl font-extrabold leading-none tabular-nums">{children}</b>
      <span className="text-[13px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function Bloco({ titulo, sub, children, className = '' }: { titulo: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl bg-card p-5 ${className}`}>
      <h2 className="text-lg font-bold leading-tight">{titulo}{sub && <small className="mt-0.5 block text-[12.5px] font-normal text-muted-foreground">{sub}</small>}</h2>
      {children}
    </section>
  );
}

/** Uma barra horizontal simples, com o número no fim. */
function Linha({ rotulo, n, max, cor, testId }: { rotulo: React.ReactNode; n: number; max: number; cor?: string; testId?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)_32px] items-center gap-2.5 text-[13.5px]" data-testid={testId}>
      <span className="flex min-w-0 items-center gap-2">{cor && <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />}<span className="truncate">{rotulo}</span></span>
      <span className="h-3 rounded bg-muted"><i className="block h-full rounded transition-[width] duration-700" style={{ width: `${(n / Math.max(1, max)) * 100}%`, background: META }} /></span>
      <b className="text-right tabular-nums">{n}</b>
    </div>
  );
}

function MetasPorArea({ p }: { p: Painel }) {
  const esc = Math.max(1, ...p.porArea.map((a) => Math.max(a.meta ?? 0, a.primeira + a.segunda))) * 1.08;
  return (
    <>
      <div className="flex flex-col">
        {p.porArea.map((a) => (
          <div key={a.chave} className="grid grid-cols-1 items-center gap-1.5 border-t border-border py-2 first:border-t-0 sm:grid-cols-[170px_minmax(0,1fr)_150px] sm:gap-3" data-testid="area"
            title={`${a.rotulo}: ${a.primeira} na 1ª opção${a.meta ? `, meta ${a.meta}` : ''}, ${a.segunda} na reserva`}>
            <span className="min-w-0"><b className="block truncate text-[14.5px]">{a.rotulo}</b><small className="text-xs text-muted-foreground">{a.segunda ? `${a.segunda} na reserva` : 'ninguém na reserva'}</small></span>
            <span className="relative h-[18px] rounded bg-muted">
              <s className="absolute inset-y-0 left-0 rounded no-underline transition-[width] duration-700" style={{ width: `${((a.primeira + a.segunda) / esc) * 100}%`, background: RESERVA }} />
              <i className="absolute inset-y-0 left-0 rounded transition-[width] duration-700" style={{ width: `${(a.primeira / esc) * 100}%`, background: META }} />
              {a.meta && <u className="absolute -bottom-1 -top-1 w-0.5 bg-foreground no-underline" style={{ left: `${(a.meta / esc) * 100}%` }} />}
            </span>
            <span className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
              <b className="text-base tabular-nums">{a.primeira}<small className="text-[13px] font-medium text-muted-foreground">{a.meta ? ` de ${a.meta}` : ' inscritos'}</small></b>
              {!a.meta ? <span className="rounded-md bg-muted px-2 text-xs font-bold text-muted-foreground">sem meta</span>
                : a.lotada ? <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"><Check className="h-3 w-3" />Lotada{a.primeira > a.meta ? ` · +${a.primeira - a.meta}` : ''}</span>
                : <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"><AlertTriangle className="h-3 w-3" />Faltam {a.meta - a.primeira}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-3.5 rounded-sm" style={{ background: META }} />1ª opção</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-3.5 rounded-sm" style={{ background: RESERVA }} />2ª opção (reserva)</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-0.5 bg-foreground" />meta</span>
      </div>
    </>
  );
}

/** O primeiro endereço do painel (/voluntariado/acompanhar/<código>) leva ao novo, com o mesmo código (21/10/2026). */
export function AoVivoNoEnderecoNovo() {
  const { codigo = '' } = useParams();
  return <Navigate to={caminhoDoAoVivo(codigo)} replace />;
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export default function VoluntariadoAoVivoPage() {
  const { codigo = '' } = useParams();
  useTituloDaAba('Dia do Voluntariado · ao vivo');
  const [dados, setDados] = useState<Acompanhamento | null>(null);
  const [erro, setErro] = useState<'codigo' | 'rede' | null>(null);
  const [lidoEm, setLidoEm] = useState(Date.now());
  const [agora, setAgora] = useState(Date.now());
  const [chegou, setChegou] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const vistos = useRef<Set<string> | null>(null);

  const buscar = useCallback(async () => {
    try {
      const a = await lerAcompanhamento(codigo);
      // Quem é novo desde a última leitura (na primeira, ninguém).
      const chaves = a.inscricoes.map((i) => `${i.created_at}|${i.nome}`);
      if (vistos.current) {
        const novos = a.inscricoes.filter((i) => !vistos.current!.has(`${i.created_at}|${i.nome}`));
        if (novos.length) {
          const u = novos[novos.length - 1];
          setChegou(novos.length === 1 ? `Nova inscrição: ${u.nome} · ${grupoDe(u)}` : `${novos.length} novas inscrições`);
          window.setTimeout(() => setChegou(null), 6000);
        }
      }
      vistos.current = new Set(chaves);
      setDados(a); setErro(null); setLidoEm(Date.now());
    } catch (e) {
      setErro(/codigo_invalido/.test(String((e as { message?: string })?.message ?? e)) ? 'codigo' : 'rede');
    }
  }, [codigo]);

  useEffect(() => {
    buscar();
    const t = window.setInterval(buscar, ATUALIZA_A_CADA_MS);
    return () => window.clearInterval(t);
  }, [buscar]);

  // O relógio do "há quanto" das últimas inscrições.
  useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const p = useMemo(() => (dados ? calcularPainel(dados, agora) : null), [dados, agora]);

  async function baixar() {
    if (!p) return;
    setBaixando(true);
    try {
      const { baixarResumo } = await import('@/lib/voluntariado/resumoPdf');
      await baixarResumo(p, lidoEm);
    } finally {
      setBaixando(false);
    }
  }

  if (erro === 'codigo') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">Este link não vale mais</h1>
        <p className="max-w-md text-muted-foreground">O endereço do painel ao vivo foi trocado ou está incompleto. Peça o link novo à comunicação.</p>
      </div>
    );
  }

  const unidades = p?.porUnidade.filter((u) => u.unidade) ?? [];
  const semNinguem = unidades.filter((u) => u.n === 0);
  const diasAteHoje = p?.porDia.filter((d) => !d.futuro) ?? [];
  const maxDia = Math.max(1, ...diasAteHoje.map((d) => d.n));

  return (
    <div className="min-h-screen bg-muted/70 px-4 py-5 text-foreground">
      <div className="mx-auto grid max-w-[1400px] gap-3.5">
        {/* Topo: a capa da campanha, o selo "ao vivo" e o Baixar resumo. */}
        <header className="grid items-center gap-x-5 gap-y-3 overflow-hidden rounded-2xl bg-[#1E4D3A] pb-4 text-[#F6EEDF] md:grid-cols-[auto_minmax(0,1fr)_auto] md:pb-0">
          <img src="/voluntariado-natal-feliz-capa.webp" alt="Natal Feliz, ANA Brasil: crianças sorrindo com presentes" width={1793} height={877} className="block aspect-[1793/877] w-full object-cover md:h-[124px] md:w-auto" data-testid="capa" />
          <div className="px-5 md:px-0">
            <h1 className="text-2xl font-extrabold leading-tight">Dia do Voluntariado · Natal Feliz 2026</h1>
            <small className="block text-[13px] opacity-85">08/12 no {TREINAMENTO.local} · em parceria com {parceirosPorExtenso()} · inscrições até 15/11</small>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-5 md:flex-col md:items-end md:pl-0 md:pr-5">
            <span className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-[12.5px]" data-testid="ao-vivo">
              <i className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#7CF0A8]" />
              {erro === 'rede' ? 'Sem conexão · tentando de novo' : `Ao vivo · atualizado às ${hora(lidoEm)} · a cada ${ATUALIZA_A_CADA_MS / 60_000} min`}
            </span>
            <button type="button" onClick={baixar} disabled={!p || baixando}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFFCF6] px-4 py-2 text-sm font-bold text-[#1E4D3A] disabled:opacity-60">
              <Download className="h-4 w-4" />{baixando ? 'Gerando o PDF…' : 'Baixar resumo'}
            </button>
          </div>
        </header>

        {!p ? <p className="text-muted-foreground">Carregando…</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Numero rotulo="Voluntários inscritos" testId="kpi-Inscritos" sub={<span className={p.hoje ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''}>+{p.hoje} hoje</span>}>
                {p.total}{p.meta ? <small className="text-xl font-semibold text-muted-foreground" data-testid="meta"> / meta {p.meta}</small> : null}
              </Numero>
              <Numero rotulo="Vagas das metas preenchidas" testId="kpi-Vagas" sub={p.vagas.total ? `${Math.round((p.vagas.preenchidas / p.vagas.total) * 100)}% · faltam ${p.vagas.total - p.vagas.preenchidas} vagas` : 'Defina as metas no painel do Marketing'}>
                {p.vagas.total ? <>{p.vagas.preenchidas}<small className="text-xl font-semibold text-muted-foreground"> / {p.vagas.total}</small></> : '—'}
                {p.vagas.total > 0 && <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (p.vagas.preenchidas / p.vagas.total) * 100)}%`, background: META }} /></span>}
              </Numero>
              <Numero rotulo="Áreas que ainda precisam de gente" testId="kpi-Precisam" sub={p.precisam.length ? p.precisam.map((x) => x.rotulo).join(', ') : p.vagas.total ? 'todas as metas batidas' : 'sem metas definidas'}>
                {p.precisam.length}<small className="text-xl font-semibold text-muted-foreground"> de {p.porArea.filter((a) => a.meta).length} com meta</small>
              </Numero>
              <Numero rotulo="Faltam para encerrar" testId="kpi-Faltam" sub={`inscrições até 15/11 · média de ${p.mediaPorDia.toLocaleString('pt-BR')} por dia`}>
                {p.faltamDias ? <>{p.faltamDias}<small className="text-xl font-semibold text-muted-foreground"> {p.faltamDias === 1 ? 'dia' : 'dias'}</small></> : 'Encerrado'}
              </Numero>
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="grid gap-3">
                <Bloco titulo="Metas por área" sub="Quem escolheu a área como 1ª opção conta para a meta. A 2ª opção é a reserva para desistências.">
                  <MetasPorArea p={p} />
                </Bloco>
                <Bloco titulo="Inscrições por dia" sub="do primeiro dia até hoje · a barra escura é hoje">
                  <div className="flex h-40 items-end gap-1 pt-4" data-testid="por-dia">
                    {diasAteHoje.map((d) => (
                      <div key={d.dia} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.rotulo}: ${d.n}`}>
                        <b className="text-[11px] tabular-nums">{d.n}</b>
                        <i className="block w-full rounded-t transition-[height] duration-700" style={{ height: `${Math.max(2, (d.n / maxDia) * 110)}px`, background: d.hoje ? META : RESERVA }} />
                        <em className="truncate text-[10px] not-italic text-muted-foreground">{d.hoje ? 'hoje' : d.rotulo.slice(0, 2)}</em>
                      </div>
                    ))}
                  </div>
                </Bloco>
              </div>

              <div className="grid gap-3">
                <Bloco titulo="Quem são os voluntários">
                  <div className="flex h-7 gap-0.5 overflow-hidden rounded-md bg-muted" data-testid="quem-sao">
                    {VINCULO.filter((v) => p.porVinculo[v.chave]).map((v) => <i key={v.chave} className="block h-full" style={{ flex: p.porVinculo[v.chave], background: v.cor }} title={`${v.rotulo}: ${p.porVinculo[v.chave]}`} />)}
                  </div>
                  <div className="grid gap-1.5">
                    {VINCULO.map((v) => (
                      <div key={v.chave} className="grid grid-cols-[12px_minmax(0,1fr)_auto_44px] items-center gap-2.5 text-sm">
                        <i className="h-3 w-3 rounded-sm" style={{ background: v.cor }} /><span>{v.rotulo}</span><b className="text-base tabular-nums">{p.porVinculo[v.chave]}</b>
                        <small className="text-right text-muted-foreground">{p.total ? Math.round((p.porVinculo[v.chave] / p.total) * 100) : 0}%</small>
                      </div>
                    ))}
                  </div>
                </Bloco>
                <Bloco titulo="Por horário" sub="com as cores da planilha da coordenação">
                  <div className="grid gap-2" data-testid="por-horario">
                    {p.porHorario.map((h) => <Linha key={h.chave} rotulo={h.detalhe ? `${h.rotulo} · ${h.detalhe}` : h.rotulo} n={h.n} max={Math.max(...p.porHorario.map((x) => x.n))} cor={h.cor} />)}
                  </div>
                </Bloco>
                <Bloco titulo="Funcionários por unidade" sub="só a Educação (GOE e CEIs)">
                  <div className="grid gap-1.5">
                    {unidades.filter((u) => u.n > 0).map((u) => <Linha key={u.nome} rotulo={u.nome.replace('CEI Bem Querer ', 'CEI ')} n={u.n} max={Math.max(...unidades.map((x) => x.n))} cor={corDaUnidade(u.nome)} testId="unidade" />)}
                  </div>
                  {semNinguem.length > 0 && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" data-testid="sem-inscritos">
                      Ainda sem inscritos: {semNinguem.map((u) => u.nome.replace('CEI Bem Querer ', 'CEI ')).join(', ')}.
                    </p>
                  )}
                </Bloco>
              </div>
            </div>

            <Bloco titulo="Últimas inscrições" sub="nome, de onde vem e as áreas · sem telefone">
              {p.ultimas.length === 0 ? <p className="text-muted-foreground">Ninguém se inscreveu ainda.</p> : (
                <div className="grid gap-2 md:grid-cols-3" data-testid="ultimas">
                  {p.ultimas.map((i) => (
                    <div key={`${i.created_at}-${i.nome}`} className="border-l-[3px] px-3 py-1 text-[13px]" style={{ borderColor: corDaUnidade(i.quem) }}>
                      <b className="block text-sm">{i.nome}</b>{i.quem}<br /><small className="text-muted-foreground">{i.areas} · {haQuanto(i.created_at, agora)}</small>
                    </div>
                  ))}
                </div>
              )}
            </Bloco>

            <footer className="px-1 text-xs text-muted-foreground">Feito no app da ANA Brasil · este link só mostra o andamento, sem telefones</footer>
          </>
        )}
      </div>
      <div role="status" aria-live="polite"
        className={`fixed bottom-5 right-5 rounded-xl px-4 py-3 text-sm text-white shadow-lg transition-all duration-500 ${chegou ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'}`}
        style={{ background: META }} data-testid="aviso">{chegou}</div>
    </div>
  );
}

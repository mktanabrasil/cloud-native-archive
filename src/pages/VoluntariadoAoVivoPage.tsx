import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import {
  ATUALIZA_A_CADA_MS, TROCA_DE_BLOCO_MS, calcularPainel, corDaUnidade, grupoDe, haQuanto, lerAcompanhamento,
  type Acompanhamento, type Painel,
} from '@/lib/voluntariado/aoVivo';
import { caminhoDoAoVivo, parceirosPorExtenso } from '@/lib/voluntariado/modelo';

/**
 * /voluntariado/natalfeliz26/acompanhar/:codigo — o painel ao vivo da gestão (mockup
 * aprovado e decisões de 21/10/2026). Link com código secreto, como o
 * acompanhamento da enquete; só lê. Faixa e números fixos no topo; embaixo,
 * os blocos passam sozinhos a cada 10 s, deslizando de lado (o mouse por
 * cima pausa). Busca de novo a cada 30 s e avisa quem acabou de chegar.
 * Feita para o computador ou uma TV. Desde 23/10/2026, com a capa da
 * campanha no topo, o vínculo de cada um (unidade, Alcance JNI ou
 * voluntário de fora) e a meta de cada área.
 */

const VERDE = '#2F6B52';

function Kpi({ rotulo, valor, sub, tom, destaca }: { rotulo: string; valor: React.ReactNode; sub: string; tom?: 'bom' | 'ruim'; destaca?: boolean }) {
  return (
    <div className={`rounded-xl bg-card p-3.5 transition-shadow ${destaca ? 'shadow-[0_0_0_3px_#81E2CF]' : ''}`} data-testid={`kpi-${rotulo}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotulo}</span>
      <b className="block text-3xl leading-tight tabular-nums">{valor}</b>
      <small className={`text-xs font-semibold ${tom === 'bom' ? 'text-emerald-700 dark:text-emerald-400' : tom === 'ruim' ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>{sub}</small>
    </div>
  );
}

function PorDia({ p }: { p: Painel }) {
  const max = Math.max(1, ...p.porDia.map((d) => d.n));
  const pct = p.meta ? Math.min(100, Math.round((p.total / p.meta) * 100)) : 0;
  return (
    <>
      <div className="flex h-64 items-end gap-1.5 pt-2">
        {p.porDia.map((d) => (
          <div key={d.dia} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {!d.futuro && <b className="text-xs tabular-nums">{d.n}</b>}
            <i className="block w-full rounded-t-md transition-[height] duration-700" style={{ height: d.futuro ? 0 : `${Math.max(2, (d.n / max) * 200)}px`, background: d.hoje ? VERDE : '#81E2CF' }} />
            <em className="truncate text-[10px] not-italic text-muted-foreground">{d.rotulo}</em>
          </div>
        ))}
      </div>
      {p.meta && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="meta">
          <span>Rumo à meta de {p.meta} voluntários</span>
          <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted"><i className="block h-full transition-[width] duration-700" style={{ width: `${pct}%`, background: VERDE }} /></span>
          <b className="text-foreground">{pct}%</b>
        </div>
      )}
    </>
  );
}

/** O primeiro endereço do painel (/voluntariado/acompanhar/<código>) leva ao novo, com o mesmo código (21/10/2026). */
export function AoVivoNoEnderecoNovo() {
  const { codigo = '' } = useParams();
  return <Navigate to={caminhoDoAoVivo(codigo)} replace />;
}

export default function VoluntariadoAoVivoPage() {
  const { codigo = '' } = useParams();
  useTituloDaAba('Dia do Voluntariado · ao vivo');
  const [dados, setDados] = useState<Acompanhamento | null>(null);
  const [erro, setErro] = useState<'codigo' | 'rede' | null>(null);
  const [lidoEm, setLidoEm] = useState(Date.now());
  const [agora, setAgora] = useState(Date.now());
  const [chegou, setChegou] = useState<string | null>(null);
  const [bloco, setBloco] = useState(0);
  const pausado = useRef(false);
  const inicioDoBloco = useRef(Date.now());
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
          window.setTimeout(() => setChegou(null), 4000);
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

  // Relógio do "atualizado há" e da troca de bloco.
  useEffect(() => {
    const t = window.setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (!pausado.current && n - inicioDoBloco.current >= TROCA_DE_BLOCO_MS) { inicioDoBloco.current = n; setBloco((b) => b + 1); }
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  const p = useMemo(() => (dados ? calcularPainel(dados, agora) : null), [dados, agora]);
  const blocos = ['Por dia', 'Últimas inscrições', 'Por área', 'Por unidade', 'Unidade × área'];
  const atual = ((bloco % blocos.length) + blocos.length) % blocos.length;
  const ir = (i: number) => { inicioDoBloco.current = Date.now(); setBloco(i); };
  const progresso = pausado.current ? null : Math.min(100, ((agora - inicioDoBloco.current) / TROCA_DE_BLOCO_MS) * 100);

  if (erro === 'codigo') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">Este link não vale mais</h1>
        <p className="max-w-md text-muted-foreground">O endereço do painel ao vivo foi trocado ou está incompleto. Peça o link novo à comunicação.</p>
      </div>
    );
  }

  const segundos = Math.round((agora - lidoEm) / 1000);
  return (
    <div className="min-h-screen bg-muted/70 px-4 py-5 text-foreground">
      <div className="mx-auto grid max-w-[1400px] gap-3.5">
        {/* A capa da campanha (23/10/2026): no topo no celular, à esquerda no computador e na TV. */}
        <header className="grid items-center gap-x-5 gap-y-3 overflow-hidden rounded-2xl pb-4 text-[#F6EEDF] md:grid-cols-[auto_minmax(0,1fr)_auto] md:pb-0" style={{ background: 'repeating-linear-gradient(135deg,#1E4D3A 0 16px,#2F6B52 16px 32px)' }}>
          <img src="/voluntariado-natal-feliz-capa.webp" alt="Natal Feliz, ANA Brasil: crianças sorrindo com presentes" width={1793} height={877} className="block aspect-[1793/877] w-full object-cover md:h-[136px] md:w-auto" data-testid="capa" />
          <div className="px-5 md:px-0">
            <b className="text-2xl font-extrabold">Dia do Voluntariado · Natal Feliz 2026</b>
            <small className="block text-[13px] opacity-85">08/12 no Recanto Maanaim · em parceria com {parceirosPorExtenso()} · inscrições até 15/11</small>
          </div>
          <span className="mx-5 flex w-fit items-center gap-2 rounded-full bg-black/25 px-3.5 py-1.5 text-[13px] md:ml-0" data-testid="ao-vivo">
            <i className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#7CF0A8]" />
            {erro === 'rede' ? 'Sem conexão · tentando de novo' : segundos < 3 ? 'Ao vivo · atualizado agora' : `Ao vivo · atualizado há ${segundos} s`}
          </span>
        </header>

        {!p ? <p className="text-muted-foreground">Carregando…</p> : (
          <>
            <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-6">
              <Kpi rotulo="Inscritos" valor={p.total} sub={`+${p.hoje} hoje · ${p.porVinculo.funcionario} da ANA`} tom={p.hoje ? 'bom' : undefined} destaca={!!chegou} />
              <Kpi rotulo="Unidades com inscritos" valor={<>{p.unidades.comInscritos}<small className="text-base"> /{p.unidades.total}</small></>}
                sub={p.unidades.total - p.unidades.comInscritos ? `${p.unidades.total - p.unidades.comInscritos} sem ninguém` : 'todas participando'} tom={p.unidades.total - p.unidades.comInscritos ? 'ruim' : 'bom'} />
              <Kpi rotulo="Áreas cobertas" valor={<>{p.areas.cobertas}<small className="text-base"> /{p.areas.total}</small></>}
                sub={p.vazias.length ? `${p.vazias.length} sem ninguém` : 'todas cobertas'} tom={p.vazias.length ? 'ruim' : 'bom'} />
              <Kpi rotulo="Com 2ª opção" valor={`${p.total ? Math.round((p.comSegunda / p.total) * 100) : 0}%`} sub={`${p.comSegunda} ${p.comSegunda === 1 ? 'pessoa' : 'pessoas'}`} />
              <Kpi rotulo="Média por dia" valor={p.mediaPorDia.toLocaleString('pt-BR')} sub="últimos 7 dias" />
              <Kpi rotulo="Faltam" valor={p.faltamDias ? `${p.faltamDias} ${p.faltamDias === 1 ? 'dia' : 'dias'}` : 'Encerrado'} sub="para 15/11" />
            </div>

            <section className="relative overflow-hidden rounded-2xl bg-card" onMouseEnter={() => { pausado.current = true; }} onMouseLeave={() => { pausado.current = false; inicioDoBloco.current = Date.now(); }} aria-roledescription="carrossel">
              <div className="flex transition-transform duration-[900ms] ease-[cubic-bezier(.65,0,.35,1)] motion-reduce:transition-none" style={{ transform: `translateX(-${atual * 100}%)` }} data-testid="trilho">
                <div className="grid min-h-[440px] flex-[0_0_100%] content-start gap-3.5 px-6 py-5" aria-hidden={atual !== 0}>
                  <h2 className="text-xl font-bold">Inscrições por dia <span className="text-sm font-normal text-muted-foreground">até 15/11</span></h2>
                  <PorDia p={p} />
                </div>

                <div className="grid min-h-[440px] flex-[0_0_100%] content-start gap-3.5 px-6 py-5" aria-hidden={atual !== 1}>
                  <h2 className="text-xl font-bold">Últimas inscrições <span className="text-sm font-normal text-muted-foreground">nome, unidade (ou vínculo) e áreas</span></h2>
                  {p.ultimas.length === 0 ? <p className="text-muted-foreground">Ninguém se inscreveu ainda.</p> : (
                    <div className="grid gap-2" data-testid="ultimas">
                      {p.ultimas.map((i, k) => (
                        <div key={`${i.created_at}-${i.nome}`} className={`grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl px-3.5 py-2.5 ${k === 0 && haQuanto(i.created_at, agora) === 'agora' ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-muted/60'}`}>
                          <span className="h-3.5 w-3.5 rounded-full" style={{ background: corDaUnidade(i.quem) }} />
                          <span className="min-w-0"><b className="block truncate text-base">{i.nome}</b><small className="text-[13px] text-muted-foreground">{i.quem} · {i.areas}</small></span>
                          <span className="text-xs text-muted-foreground">{haQuanto(i.created_at, agora)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid min-h-[440px] flex-[0_0_100%] content-start gap-2.5 px-6 py-5" aria-hidden={atual !== 2}>
                  <h2 className="text-xl font-bold">Por área <span className="text-sm font-normal text-muted-foreground">1ª opção /meta · <b className="text-[#5BBFA7]">+2ª</b> em verde-claro</span></h2>
                  {(() => { const max = Math.max(1, ...p.porArea.map((x) => x.primeira + x.segunda)); return p.porArea.map((x) => (
                    <div key={x.chave} className={`grid grid-cols-[220px_minmax(0,1fr)_90px] items-center gap-3 text-sm ${x.primeira === 0 ? 'text-red-700 dark:text-red-400' : ''}`} data-testid="area">
                      <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{x.rotulo}</span>{x.lotada && <b className="shrink-0 rounded bg-amber-100 px-1.5 text-[10px] uppercase text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">lotada</b>}</span>
                      <span className="relative h-4 overflow-hidden rounded-full bg-muted">
                        <s className="absolute inset-y-0 left-0 rounded-full bg-[#81E2CF] no-underline transition-[width] duration-700" style={{ width: `${((x.primeira + x.segunda) / max) * 100}%` }} />
                        <i className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${(x.primeira / max) * 100}%`, background: VERDE }} />
                      </span>
                      <em className="text-right font-bold not-italic">{x.primeira}{x.meta ? <small className="font-normal text-muted-foreground">/{x.meta}</small> : null}{x.segunda ? <small className="font-normal text-muted-foreground"> +{x.segunda}</small> : null}</em>
                    </div>
                  )); })()}
                  {p.vazias.length > 0 && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"><b>Sem ninguém na 1ª opção:</b> {p.vazias.join(', ')}.</p>}
                </div>

                <div className="grid min-h-[440px] flex-[0_0_100%] content-start gap-3 px-6 py-5" aria-hidden={atual !== 3}>
                  <h2 className="text-xl font-bold">Por unidade e vínculo <span className="text-sm font-normal text-muted-foreground">na cor da planilha</span></h2>
                  <div className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">
                    {p.porUnidade.map((u) => (
                      <div key={u.nome} className={`grid grid-cols-[16px_minmax(0,1fr)_40px] items-center gap-2.5 py-0.5 text-sm ${u.n ? '' : 'text-muted-foreground'}`} data-testid="unidade">
                        <i className="h-4 w-4 rounded" style={{ background: u.cor }} />
                        <span className="truncate">{u.nome}</span>
                        <em className="text-right font-bold not-italic">{u.n}</em>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid min-h-[440px] flex-[0_0_100%] content-start gap-3 px-6 py-5" aria-hidden={atual !== 4}>
                  <h2 className="text-xl font-bold">Unidade × área <span className="text-sm font-normal text-muted-foreground">1ª opção · quanto mais escuro, mais gente</span></h2>
                  {p.matriz.linhas.length === 0 ? <p className="text-muted-foreground">Ninguém se inscreveu ainda.</p> : (
                    <div className="max-h-[380px] overflow-auto">
                      <table className="w-full border-separate border-spacing-[3px] text-[13px]" data-testid="matriz">
                        <thead><tr><th />{p.matriz.colunas.map((c) => <th key={c.chave} className="px-1 text-[11px] font-semibold text-muted-foreground">{c.rotulo}</th>)}</tr></thead>
                        <tbody>
                          {p.matriz.linhas.map((l) => (
                            <tr key={l.nome}>
                              <td className="whitespace-nowrap pr-2 text-left"><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.cor }} />{l.nome}</td>
                              {l.valores.map((n, k) => {
                                const [bg, fg] = n >= 4 ? [VERDE, '#fff'] : n === 3 ? ['#5C9A80', '#fff'] : n === 2 ? ['#A9D3C2', '#1F2322'] : n === 1 ? ['#D4EBE1', '#1F2322'] : ['transparent', 'inherit'];
                                return <td key={k} className="rounded-md px-1 py-1.5 text-center font-bold" style={{ background: bg, color: fg }}>{n || ''}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <nav className="flex items-center justify-between gap-3 px-5 pb-3.5 pt-2" aria-label="Blocos">
                <div className="flex flex-wrap gap-2">
                  {blocos.map((b, i) => (
                    <button key={b} type="button" onClick={() => ir(i)} aria-current={i === atual ? 'true' : undefined}
                      className={`relative overflow-hidden rounded-full px-3 py-1.5 text-xs font-semibold ${i === atual ? 'bg-[#2F6B52] text-white' : 'bg-muted text-muted-foreground'}`}>
                      {b}
                      {i === atual && progresso !== null && <span className="absolute bottom-0 left-0 h-[3px] bg-[#81E2CF]" style={{ width: `${progresso}%` }} />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" aria-label="Anterior" onClick={() => ir(atual - 1)} className="grid h-9 w-9 place-items-center rounded-full bg-muted"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" aria-label="Próximo" onClick={() => ir(atual + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-muted"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </nav>
            </section>

            <footer className="flex flex-wrap justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span>Feito no app da ANA Brasil · este link só mostra o andamento, sem WhatsApp</span>
              <span>{p.ultimas[0] ? `Última inscrição ${haQuanto(p.ultimas[0].created_at, agora)}` : ''} · atualiza a cada {ATUALIZA_A_CADA_MS / 1000} s</span>
            </footer>
          </>
        )}
      </div>
      <div role="status" aria-live="polite"
        className={`fixed bottom-5 right-5 rounded-xl px-4 py-3 text-sm text-white shadow-lg transition-all duration-500 ${chegou ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'}`}
        style={{ background: VERDE }} data-testid="aviso">{chegou}</div>
    </div>
  );
}

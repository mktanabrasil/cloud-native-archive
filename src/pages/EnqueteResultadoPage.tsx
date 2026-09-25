import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import { baixarArquivo, csvDosVotos, nomeDaPlanilha } from '@/lib/enquetes/planilha';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { CartaoDeOpcao, FioDaMarca, Marca, tomDaCor } from '@/components/enquetes/PecasDaEnquete';
import type { Enquete, ResultadoDaEnquete } from '@/lib/enquetes/modelo';
import { estaAberta, lider, ordenarPorVotos, percentual, tempoRestante } from '@/lib/enquetes/modelo';
import { buscarEnquete, resultado as buscarResultado } from '@/lib/enquetes/api';
import { textoDoPrazo } from './EnquetePublicaPage';

/**
 * /enquete/:slug/resultado — o link de acompanhamento (23/09/2026).
 *
 * Público, só leitura, ao vivo (a cada 10 s). É o que vai para a chefia:
 * total, percentuais, opções por ordem, quem votou (nome e fim do número)
 * e os votos por hora. Quem abre não conta como voto. Ao encerrar, vira
 * "Encerrada · resultado final".
 */

const INTERVALO_MS = 10_000;

/** "há 2 min" · "há 1 h" · "ontem" */
function haQuanto(iso: string, agora: Date): string {
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
}

/** Votos por hora, das últimas 8 horas com voto até agora. */
export function votosPorHora(votantes: ResultadoDaEnquete['votantes'], agora: Date): Array<{ rotulo: string; n: number }> {
  const horas: Array<{ rotulo: string; n: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const h = new Date(agora); h.setMinutes(0, 0, 0); h.setHours(agora.getHours() - i);
    const n = votantes.filter(v => { const d = new Date(v.em); return d.getHours() === h.getHours() && d.toDateString() === h.toDateString(); }).length;
    horas.push({ rotulo: i === 0 ? 'agora' : `${h.getHours()}h`, n });
  }
  return horas;
}

export default function EnqueteResultadoPage() {
  const { slug = '' } = useParams();
  const [enquete, setEnquete] = useState<Enquete | null | undefined>(undefined);
  const [res, setRes] = useState<(ResultadoDaEnquete & { oculto: boolean }) | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [verTodos, setVerTodos] = useState(false);

  useTituloDaAba(enquete ? `Resultado · ${enquete.pergunta}` : 'Resultado da enquete · ANA Brasil');

  const atualizar = useCallback(async () => {
    try { setRes(await buscarResultado(slug, true)); setAgora(new Date()); } catch { /* fica o último */ }
  }, [slug]);

  useEffect(() => {
    let vivo = true;
    buscarEnquete(slug).then(e => { if (vivo) { setEnquete(e); if (e) void atualizar(); } }).catch(() => vivo && setEnquete(null));
    return () => { vivo = false; };
  }, [slug, atualizar]);

  useEffect(() => {
    if (!enquete) return;
    const r = setInterval(atualizar, INTERVALO_MS);
    return () => clearInterval(r);
  }, [enquete, atualizar]);

  const aberta = enquete ? estaAberta(enquete, agora) : false;
  const ordenadas = useMemo(() => (enquete && res ? ordenarPorVotos(enquete.opcoes, res.por_opcao) : []), [enquete, res]);
  const lideranca = enquete && res ? lider(enquete.opcoes, res.por_opcao) : null;
  const porHora = useMemo(() => (res ? votosPorHora(res.votantes, agora) : []), [res, agora]);
  const maxHora = Math.max(1, ...porHora.map(h => h.n));

  if (enquete === undefined) return <div className="min-h-screen bg-background" aria-busy="true" />;
  if (enquete === null) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10"><Marca /><h1 className="text-xl font-bold">Enquete não encontrada</h1></main>
      </div>
    );
  }

  const votantes = res?.votantes ?? [];
  const lista = verTodos ? votantes : votantes.slice(0, 8);
  const opcaoDe = (id: string) => enquete.opcoes.find(o => o.id === id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 pb-8 pt-5">
        <div className="overflow-hidden rounded-3xl border border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <Marca />
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {aberta ? (
                <>
                  <span className="rounded-full bg-[#E4F8F3] px-2.5 py-0.5 font-semibold text-[#0E6B58] dark:bg-[#153A32] dark:text-[#8FE3CF]">Aberta</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#0E6B58] dark:text-[#8FE3CF]"><span className="h-[7px] w-[7px] rounded-full bg-[#81E2CF] shadow-[0_0_0_3px_#E4F8F3] dark:shadow-none" />ao vivo</span>
                  {enquete.encerra_em && <span className="text-muted-foreground">encerra <b className="text-foreground">{textoDoPrazo(enquete.encerra_em, agora)}</b> · {tempoRestante(enquete.encerra_em, agora)}</span>}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> Encerrada · resultado final</span>
              )}
            </div>
          </div>

          <div className="grid gap-7 px-5 py-6 md:grid-cols-[1.6fr_1fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
                Enquete · {format(new Date(enquete.created_at || Date.now()), 'MMMM yyyy', { locale: ptBR })}{enquete.criada_por ? ` · criada por ${enquete.criada_por}` : ''}
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight [text-wrap:balance] md:text-3xl">{enquete.pergunta}</h1>

              <div className="my-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="kpis">
                <div className="flex flex-col rounded-xl bg-muted/60 p-3"><b className="text-[26px] leading-none tabular-nums">{res?.total ?? 0}</b><span className="text-[11px] text-muted-foreground">{(res?.total ?? 0) === 1 ? 'voto' : 'votos'}</span></div>
                {ordenadas.slice(0, 2).map(o => (
                  <div key={o.id} className="flex flex-col rounded-xl bg-muted/60 p-3">
                    <b className={`text-[26px] leading-none tabular-nums ${tomDaCor(o.cor).ink}`}>{percentual(res?.por_opcao[o.id] ?? 0, res?.total ?? 0)}%</b>
                    <span className="truncate text-[11px] text-muted-foreground">{o.titulo}</span>
                  </div>
                ))}
                <div className="flex flex-col rounded-xl bg-muted/60 p-3">
                  <b className="text-[20px] leading-none">{aberta ? (enquete.encerra_em ? tempoRestante(enquete.encerra_em, agora)?.replace('faltam ', '') : '—') : 'final'}</b>
                  <span className="text-[11px] text-muted-foreground">{aberta ? (enquete.encerra_em ? 'para encerrar' : 'sem prazo') : lideranca ? `venceu: ${lideranca.titulo}` : 'empate'}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5" data-testid="opcoes-resultado">
                {ordenadas.map(o => (
                  <CartaoDeOpcao key={o.id} opcao={o} votada={!aberta && lideranca?.id === o.id} votos={res?.por_opcao[o.id] ?? 0} total={res?.total ?? 0} />
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">{aberta ? 'Ordem: mais votada primeiro. Resultado parcial até o encerramento.' : 'Resultado final. O link continua valendo como registro.'}</p>
            </div>

            <aside className="rounded-2xl bg-muted/60 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{enquete.identificar ? 'Quem votou' : 'Votos'}</p>
              {enquete.identificar ? (
                votantes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ninguém votou ainda.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-[12.5px]" data-testid="votantes">
                    {lista.map((v, i) => {
                      const o = opcaoDe(v.opcao_id);
                      return (
                        <li key={`${v.fim}-${i}`} className="flex flex-wrap items-center gap-x-1.5">
                          {o && <span className={`inline-block h-[9px] w-[9px] rounded-full ${tomDaCor(o.cor).forte}`} aria-hidden="true" />}
                          <b>{v.nome || 'Sem nome'}</b>
                          <small className="text-muted-foreground tabular-nums">•••-{v.fim}</small>
                          <span>· {(v as { trocou?: boolean }).trocou ? 'trocou para ' : ''}{o?.titulo ?? '—'}</span>
                          <small className="ml-auto text-muted-foreground">{haQuanto(v.em, agora)}</small>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Enquete anônima: só a contagem.</p>
              )}
              {votantes.length > 8 && (
                <button type="button" className="mt-2 text-xs underline" onClick={() => setVerTodos(v => !v)}>{verTodos ? 'Ver menos' : `Ver todos (${votantes.length})`}</button>
              )}
              {enquete.identificar && <p className="mt-2 text-[11px] text-muted-foreground">Nome e fim do número: dá para saber quem votou e cobrar quem falta, sem expor o número inteiro.</p>}
              {/* A lista em planilha, para cobrar quem falta (25/09/2026). Aqui
                  o número sai só com o fim, como na tela. */}
              {enquete.identificar && votantes.length > 0 && (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  data-testid="baixar-planilha-publica"
                  onClick={() => baixarArquivo(
                    csvDosVotos(enquete, votantes.map(v => ({ nome: v.nome, telefone: `•••-${v.fim}`, opcao_id: v.opcao_id, em: v.em, trocou: !!(v as { trocou?: boolean }).trocou })), 'Final do número'),
                    nomeDaPlanilha(enquete.slug),
                  )}
                >
                  <Download className="h-3.5 w-3.5" /> Baixar a lista em planilha
                </button>
              )}

              {votantes.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Votos por hora</p>
                  <div className="flex h-20 items-end gap-1.5 px-0.5" aria-hidden="true">
                    {porHora.map((h, i) => (
                      <div key={i} className={`flex-1 rounded-t ${i === porHora.length - 1 ? 'bg-[#01ADFF]' : 'bg-[#81E2CF]'} opacity-90`} style={{ height: `${Math.max(3, (h.n / maxHora) * 80)}px` }} title={`${h.rotulo}: ${h.n}`} />
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">{porHora.map((h, i) => <span key={i} className="flex-1 text-center">{i % 2 === 1 || i === porHora.length - 1 ? h.rotulo : ''}</span>)}</div>
                </>
              )}
            </aside>
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-5 py-3.5 text-[11px] text-muted-foreground">
            <span>Feito no app da ANA Brasil · este link só mostra o resultado{res?.ultimo_voto_em ? ` · último voto ${haQuanto(res.ultimo_voto_em, agora)}` : ''}</span>
            <FioDaMarca />
          </div>
        </div>
      </main>
    </div>
  );
}

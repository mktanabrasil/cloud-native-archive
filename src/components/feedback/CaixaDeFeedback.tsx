import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, ExternalLink, Image as ImageIcon, Loader2, Mail, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FeedbackMudou, avisarQuemMandou, lerCaixaDeFeedback, linkDoPrint, marcarComoLido, salvarFeedback } from '@/lib/feedback/api';
import {
  LIMITE_DO_TEXTO, SITUACOES_DO_FEEDBACK, TIPOS_DE_FEEDBACK, contarPorSituacao, filtrarCaixa, naoLidos, nomeDoTipo, ondeFoi, quandoCurto, setoresDaCaixa,
  type FeedbackDaCaixa, type FiltroDaCaixa, type SituacaoDoFeedback, type TipoDeFeedback,
} from '@/lib/feedback/regras';
import { COR_DA_SITUACAO, VISUAL_DO_TIPO } from './DarFeedback';

const SITUACOES = Object.keys(SITUACOES_DO_FEEDBACK) as SituacaoDoFeedback[];

function IconeDoTipo({ tipo, grande = false }: { tipo: TipoDeFeedback; grande?: boolean }) {
  const { Icone, cor } = VISUAL_DO_TIPO[tipo] ?? VISUAL_DO_TIPO.ideia;
  return <span className={cn('grid shrink-0 place-items-center', grande ? 'h-10 w-10 rounded-[11px]' : 'h-9 w-9 rounded-[10px]', cor)} aria-hidden><Icone className={grande ? 'h-5 w-5' : 'h-[18px] w-[18px]'} /></span>;
}
function Selo({ situacao }: { situacao: SituacaoDoFeedback }) {
  return <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', COR_DA_SITUACAO[situacao])}>{SITUACOES_DO_FEEDBACK[situacao]}</span>;
}
/** Só endereço do próprio app vira link ("/social/…"); o resto é texto (quem manda escreve o que quiser). */
export const caminhoDoApp = (c: string | null | undefined): c is string => !!c && /^\/(?!\/)/.test(c) && !/[\s\\]/.test(c);

const pilula = (ativo: boolean) => cn('whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] transition-colors',
  ativo ? 'border-transparent bg-foreground font-semibold text-background' : 'border-black/10 bg-card/60 hover:bg-card dark:border-white/10');

/** Uma linha da lista. */
function Linha({ f, aberta, onAbrir }: { f: FeedbackDaCaixa; aberta: boolean; onAbrir: () => void }) {
  const novo = !f.lido_em;
  return (
    <li>
      <button
        type="button" onClick={onAbrir} aria-current={aberta ? 'true' : undefined}
        className={cn('grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border p-3 text-left transition-colors',
          aberta ? 'border-foreground bg-card shadow-sm' : 'border-black/10 bg-card/55 hover:bg-card dark:border-white/10',
          novo && !aberta && 'border-l-4 border-l-[hsl(var(--info))]')}
      >
        <IconeDoTipo tipo={f.tipo} />
        <span className="min-w-0">
          <span className={cn('block truncate text-[13.5px]', novo && 'font-semibold')}>{f.texto}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
            <span>{ondeFoi(f)}</span>·<span>{f.autor_nome}</span>·<span>{quandoCurto(f.criado_em)}</span>
            {f.aparelho === 'celular' ? <Smartphone className="h-3.5 w-3.5" aria-label="Celular" /> : f.aparelho === 'computador' ? <Monitor className="h-3.5 w-3.5" aria-label="Computador" /> : null}
            {f.print_path && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3.5 w-3.5" aria-hidden />print</span>}
            {novo && <span className="sr-only">não lido</span>}
          </span>
        </span>
        <Selo situacao={f.situacao} />
      </button>
    </li>
  );
}

/** O feedback aberto: o texto, o print, de onde veio, a situação e a resposta. */
function Detalhe({ f, onVoltar, onSalvo, onMudou }: { f: FeedbackDaCaixa; onVoltar: () => void; onSalvo: (mudou: boolean) => void; onMudou: () => void }) {
  const [situacao, setSituacao] = useState<SituacaoDoFeedback>(f.situacao);
  const [resposta, setResposta] = useState(f.resposta ?? '');
  const [avisar, setAvisar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [print, setPrint] = useState<string | null>(null);
  const [erroDoPrint, setErroDoPrint] = useState(false);

  // Troca de feedback: começa do que está salvo. Recarregar o mesmo (depois de
  // salvar, ou porque outra pessoa salvou) não apaga o que está sendo escrito.
  useEffect(() => {
    setSituacao(f.situacao); setResposta(f.resposta ?? ''); setAvisar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id]);
  useEffect(() => {
    setPrint(null); setErroDoPrint(false);
    if (!f.print_path) return;
    let vivo = true;
    linkDoPrint(f.print_path).then(u => { if (vivo) setPrint(u); }, () => { if (vivo) setErroDoPrint(true); });
    return () => { vivo = false; };
  }, [f.print_path]);
  // O endereço do print vale 10 minutos: abrir em tamanho real pede um novo.
  const abrirPrint = async () => {
    if (!f.print_path) return;
    const janela = window.open('', '_blank');
    try {
      const u = await linkDoPrint(f.print_path);
      if (janela) janela.location.href = u; else window.location.href = u;
    } catch {
      janela?.close();
      toast.error('Não consegui abrir o print.');
    }
  };

  const mudou = situacao !== f.situacao || resposta.trim() !== (f.resposta ?? '').trim();
  const primeiroNome = f.autor_nome.trim() || 'quem mandou';
  const salvar = async () => {
    setSalvando(true);
    try {
      const houve = await salvarFeedback(f.id, situacao, resposta, f.atualizado_em);
      if (houve && avisar) {
        void avisarQuemMandou(f.id).then(ok => { if (!ok) toast.error(`O e-mail para ${primeiroNome} não saiu`, { description: 'A situação e a resposta ficaram salvas; a pessoa vê no app.' }); });
        toast.success('Salvo', { description: `${primeiroNome} recebe um e-mail com a situação${resposta.trim() ? ' e a resposta' : ''}.` });
      } else {
        toast.success(houve ? 'Salvo, sem e-mail.' : 'Nada mudou.');
      }
      onSalvo(houve);
    } catch (e) {
      // Outra pessoa salvou antes: recarrega a caixa, e o que estava escrito aqui fica na tela.
      if (e instanceof FeedbackMudou) onMudou();
      toast.error('Não foi possível salvar', { description: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section aria-label="Feedback aberto" className="space-y-4 rounded-[22px] border border-black/5 bg-card p-5 dark:border-white/5">
      <button type="button" onClick={onVoltar} className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground lg:hidden"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar à lista</button>
      <div className="flex items-start gap-3">
        <IconeDoTipo tipo={f.tipo} grande />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{nomeDoTipo(f.tipo)}</p>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{f.texto}</p>
        </div>
      </div>
      {f.print_path && (
        erroDoPrint ? <p className="text-[12.5px] text-destructive">Não consegui abrir o print.</p>
          : print ? (
            <button type="button" onClick={() => void abrirPrint()} className="block w-full overflow-hidden rounded-[14px] border border-black/10 dark:border-white/10" title="Abrir o print em tamanho real">
              <img src={print} alt="Print anexado ao feedback" className="max-h-[320px] w-full bg-muted object-contain" />
            </button>
          ) : <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Carregando o print…</p>
      )}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-[14px] bg-muted/50 p-3 text-[12.5px] sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Quem</dt><dd className="break-words font-medium">{f.autor_nome}{f.autor_email ? <> · <a className="underline-offset-2 hover:underline" href={`mailto:${f.autor_email}`}>{f.autor_email}</a></> : null}</dd></div>
        <div><dt className="text-muted-foreground">Quando</dt><dd className="font-medium">{quandoCurto(f.criado_em)}</dd></div>
        <div><dt className="text-muted-foreground">Onde</dt><dd className="font-medium">{ondeFoi(f)}{caminhoDoApp(f.caminho) && <a href={f.caminho} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground" aria-label="Abrir a página de onde veio"><ExternalLink className="h-3.5 w-3.5" /></a>}</dd></div>
        <div><dt className="text-muted-foreground">Aparelho</dt><dd className="font-medium">{[f.aparelho === 'celular' ? 'Celular' : f.aparelho === 'computador' ? 'Computador' : null, f.navegador].filter(Boolean).join(' · ') || 'Não informado'}</dd></div>
      </dl>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold" id={`situacao-${f.id}`}>Situação</p>
        <div role="radiogroup" aria-labelledby={`situacao-${f.id}`} className="flex flex-wrap gap-1.5">
          {SITUACOES.map(s => (
            <button key={s} type="button" role="radio" aria-checked={situacao === s} onClick={() => setSituacao(s)}
              className={cn('rounded-full border px-3 py-1.5 text-[12.5px]', situacao === s ? 'border-foreground bg-background font-semibold shadow-sm' : 'border-black/10 bg-card/50 hover:bg-background dark:border-white/10')}>
              {SITUACOES_DO_FEEDBACK[s]}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Resposta para {primeiroNome} <span className="font-normal text-muted-foreground">(opcional)</span></span>
        <Textarea value={resposta} onChange={e => setResposta(e.target.value)} maxLength={LIMITE_DO_TEXTO} rows={3} className="min-h-[70px] text-[13px]" placeholder="A pessoa vê a resposta no app, no botão “Dar feedback”." />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <input type="checkbox" checked={avisar} onChange={e => setAvisar(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          <Mail className="h-4 w-4" aria-hidden />Avisar {primeiroNome} por e-mail
        </label>
        <Button onClick={() => void salvar()} disabled={salvando || !mudou} className="gap-1.5">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Salvar
        </Button>
      </div>
      <ul className="space-y-1 border-t border-border pt-3 text-[12px] text-muted-foreground" aria-label="Histórico">
        <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />{quandoCurto(f.criado_em)} · chegou</li>
        {f.lido_em && <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />{quandoCurto(f.lido_em)} · o marketing abriu</li>}
        {f.respondido_em && <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />{quandoCurto(f.respondido_em)} · {f.respondido_por ?? 'Marketing'} respondeu</li>}
        {f.atualizado_em !== f.criado_em && <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />{quandoCurto(f.atualizado_em)} · última mudança</li>}
      </ul>
    </section>
  );
}

/**
 * A caixa de feedback do app, no Painel (PR 2, 23/11/2026, mockup aprovado):
 * tudo o que as equipes mandaram pelo "Dar feedback". Abrir marca como lido;
 * a situação e a resposta vão para quem mandou (no app e por e-mail).
 */
export function CaixaDeFeedback({ onNaoLidos }: { onNaoLidos?: (n: number) => void }) {
  const [lista, setLista] = useState<FeedbackDaCaixa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDaCaixa>({ situacao: 'todos', setor: 'todos', tipo: 'todos' });
  const [abertoId, setAbertoId] = useState<string | null>(null);

  // Recarregar com a caixa já na tela e falhar: a caixa fica, e o aviso sai no canto.
  const temLista = useRef(false);
  const carregar = useCallback(async () => {
    try {
      const l = await lerCaixaDeFeedback(); temLista.current = true; setLista(l); setErro(null);
    } catch (e) {
      if (temLista.current) toast.error('Não consegui atualizar a caixa', { description: (e as Error).message });
      else setErro((e as Error).message);
    }
  }, []);
  // No celular a lista some quando um feedback abre: o aberto vai para o topo,
  // e "Voltar" devolve a lista onde estava.
  const detalhe = useRef<HTMLDivElement>(null);
  const rolagem = useRef(0);
  const ehEstreito = () => typeof window !== 'undefined' && !window.matchMedia?.('(min-width: 1024px)')?.matches;
  useEffect(() => {
    if (abertoId && ehEstreito()) detalhe.current?.scrollIntoView?.({ block: 'start' });
  }, [abertoId]);
  const voltar = () => {
    setAbertoId(null);
    if (ehEstreito()) requestAnimationFrame(() => window.scrollTo?.({ top: rolagem.current }));
  };
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (lista) onNaoLidos?.(naoLidos(lista)); }, [lista, onNaoLidos]);

  const abrir = (f: FeedbackDaCaixa) => {
    if (!abertoId) rolagem.current = window.scrollY;
    setAbertoId(f.id);
    if (!f.lido_em) {
      const agora = new Date().toISOString();
      setLista(l => l?.map(x => (x.id === f.id ? { ...x, lido_em: agora } : x)) ?? l);
      marcarComoLido(f.id).catch(() => { /* fica como lido na tela; o banco marca na próxima vez */ });
    }
  };

  const visiveis = useMemo(() => (lista ? filtrarCaixa(lista, filtro) : []), [lista, filtro]);
  const contas = useMemo(() => contarPorSituacao(lista ?? []), [lista]);
  const setores = useMemo(() => setoresDaCaixa(lista ?? []), [lista]);
  const aberto = lista?.find(f => f.id === abertoId) ?? null;

  return (
    <section aria-labelledby="titulo-feedback" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="titulo-feedback" className="text-[17px] font-semibold">Feedback do app</h2>
          <p className="text-[13px] text-muted-foreground">Tudo o que as equipes mandaram pelo botão “Dar feedback”, de todos os setores.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void carregar()}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Atualizar</Button>
      </div>

      {erro ? (
        <p role="alert" className="text-[13px] text-destructive">Não consegui ler os feedbacks ({erro}). <button type="button" className="underline" onClick={() => void carregar()}>Tentar de novo</button></p>
      ) : lista === null ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">Nenhum feedback ainda. Quando alguém usar o botão “Dar feedback”, ele aparece aqui e chega por e-mail.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por situação">
            <button type="button" aria-pressed={filtro.situacao === 'todos'} className={pilula(filtro.situacao === 'todos')} onClick={() => setFiltro(f => ({ ...f, situacao: 'todos' }))}>Todos <b className="ml-0.5">{contas.todos}</b></button>
            {SITUACOES.map(s => (
              <button key={s} type="button" aria-pressed={filtro.situacao === s} className={pilula(filtro.situacao === s)} onClick={() => setFiltro(f => ({ ...f, situacao: s }))}>
                {SITUACOES_DO_FEEDBACK[s]} <b className="ml-0.5">{contas[s]}</b>
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <select aria-label="Filtrar por setor" value={filtro.setor} onChange={e => setFiltro(f => ({ ...f, setor: e.target.value }))} className="rounded-full border border-black/10 bg-card/60 px-3 py-1.5 text-[13px] dark:border-white/10">
              <option value="todos">Todos os setores</option>
              {setores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Filtrar por tipo" value={filtro.tipo} onChange={e => setFiltro(f => ({ ...f, tipo: e.target.value as FiltroDaCaixa['tipo'] }))} className="rounded-full border border-black/10 bg-card/60 px-3 py-1.5 text-[13px] dark:border-white/10">
              <option value="todos">Todos os tipos</option>
              {TIPOS_DE_FEEDBACK.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div className={cn('grid gap-5', aberto && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]')}>
            <div className={cn(aberto && 'max-lg:hidden')}>
              {visiveis.length === 0 ? (
                <p className="rounded-[16px] border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">Nenhum feedback com esse filtro.</p>
              ) : (
                <ul className="space-y-2" aria-label="Feedbacks">
                  {visiveis.map(f => <Linha key={f.id} f={f} aberta={f.id === abertoId} onAbrir={() => abrir(f)} />)}
                </ul>
              )}
            </div>
            {aberto && (
              <div ref={detalhe} className="scroll-mt-32 lg:sticky lg:top-4 lg:self-start">
                <Detalhe f={aberto} onVoltar={voltar} onSalvo={(mudou) => { if (mudou) void carregar(); }} onMudou={() => void carregar()} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

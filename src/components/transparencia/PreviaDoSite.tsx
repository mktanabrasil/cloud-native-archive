import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Code2, Download, ExternalLink, FileText, Folder, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ENDERECO_DA_API } from '@/lib/transparencia/api';

/**
 * "Como o site mostra" (24/11/2026): a prévia do Portal Transparência com os
 * dados reais da API pública — as unidades, as pastas e os documentos como o
 * visitante vê, e a busca que a barra de pesquisa do site usa. Só no painel.
 */

export interface DocumentoDaApi { nome: string; tipo: string; tamanho: number | null; atualizado_em: string | null; chave: string; endereco: string }
export interface PastaDaApi { nome: string; pastas: PastaDaApi[]; documentos: DocumentoDaApi[] }
export interface UnidadeDaApi { slug: string; nome: string; grupo: 'social' | 'educacao' | 'outros'; finalizada: boolean; documentos: number; pastas: number; atualizado_em: string | null }
export interface ResultadoDaBusca extends DocumentoDaApi { caminho: string[]; unidade: { slug: string; nome: string } }

const GRUPOS: [UnidadeDaApi['grupo'], string][] = [['social', 'Social'], ['educacao', 'Educação'], ['outros', 'Outros']];
const grupoDe = (u: UnidadeDaApi): UnidadeDaApi['grupo'] => (GRUPOS.some(([g]) => g === u.grupo) ? u.grupo : 'outros');
const tamanho = (b: number | null) => b == null ? '' : b >= 1_000_000 ? `${(b / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1000))} KB`;
const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const semAcento = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

async function lerJson<T>(url: string, sinal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal: sinal });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `A API respondeu ${r.status}`);
  return j as T;
}

function Destaque({ texto: original, termo }: { texto: string; termo: string }) {
  const texto = original.normalize('NFC');
  const palavra = semAcento(termo).split(/\s+/).find((w) => w.length >= 2);
  const i = palavra ? semAcento(texto).indexOf(palavra) : -1;
  if (!palavra || i < 0) return <>{texto}</>;
  return <>{texto.slice(0, i)}<mark className="rounded bg-[#fbce00] px-0.5 text-[#1f2322]">{texto.slice(i, i + palavra.length)}</mark>{texto.slice(i + palavra.length)}</>;
}

function Acoes({ d }: { d: DocumentoDaApi }) {
  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-[12.5px]" asChild>
        <a href={d.endereco} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Abrir</a>
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
        <a href={`${d.endereco}?baixar=1`} aria-label={`Baixar ${d.nome}`}><Download className="h-3.5 w-3.5" /></a>
      </Button>
    </>
  );
}

function Documento({ d }: { d: DocumentoDaApi }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-muted/50" data-testid="documento-da-previa">
      <FileText className="h-4 w-4 shrink-0 text-[#e0795f]" />
      <span className="min-w-0 flex-1 truncate text-[13.5px]">{d.nome}</span>
      <span className="hidden shrink-0 text-[12px] tabular-nums text-muted-foreground sm:inline">{[d.tipo.toUpperCase(), tamanho(d.tamanho), dataCurta(d.atualizado_em)].filter(Boolean).join(' · ')}</span>
      <Acoes d={d} />
    </div>
  );
}

function PastaDaArvore({ p }: { p: PastaDaApi }) {
  const [aberta, setAberta] = useState(false);
  const itens = p.pastas.length + p.documentos.length;
  return (
    <div>
      <button type="button" onClick={() => setAberta((a) => !a)} aria-expanded={aberta}
        className={cn('flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[14px] hover:bg-muted/50', aberta && 'bg-muted/40 font-semibold')}>
        {aberta ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Folder className="h-4 w-4 shrink-0 text-[#d4a72c]" />
        <span className="min-w-0 flex-1 truncate">{p.nome}</span>
        <span className="shrink-0 text-[12px] font-normal text-muted-foreground">{itens} {itens === 1 ? 'item' : 'itens'}</span>
      </button>
      {aberta && (
        <div className="ml-5 border-l border-border/70 pl-2">
          {itens === 0 && <p className="px-2 py-1.5 text-[12.5px] text-muted-foreground">Pasta vazia.</p>}
          {p.pastas.map((s, i) => <PastaDaArvore key={`${i}-${s.nome}`} p={s} />)}
          {p.documentos.map((d) => <Documento key={d.chave} d={d} />)}
        </div>
      )}
    </div>
  );
}

export function PreviaDoSite({ aberta, onOpenChange, base = ENDERECO_DA_API }: { aberta: boolean; onOpenChange: (v: boolean) => void; base?: string }) {
  const [unidades, setUnidades] = useState<UnidadeDaApi[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [arvores, setArvores] = useState<Record<string, { pastas: PastaDaApi[]; documentos: DocumentoDaApi[]; atualizado_em: string | null } | 'erro'>>({});
  const [termo, setTermo] = useState('');
  const [onde, setOnde] = useState<'unidade' | 'todas'>('todas');
  const [busca, setBusca] = useState<{ chave: string; termo: string; total: number; resultados: ResultadoDaBusca[] } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // As unidades, ao abrir.
  useEffect(() => {
    if (!aberta) return;
    const c = new AbortController();
    setErro(null);
    setArvores({});
    lerJson<{ unidades: UnidadeDaApi[] }>(base, c.signal)
      .then((j) => { setUnidades(j.unidades); setEscolhida((e) => e ?? j.unidades[0]?.slug ?? null); })
      .catch((e) => { if (!c.signal.aborted) setErro((e as Error).message); });
    return () => c.abort();
  }, [aberta, base]);

  // A árvore da unidade escolhida (uma vez por unidade).
  useEffect(() => {
    if (!aberta || !escolhida || arvores[escolhida]) return;
    const c = new AbortController();
    lerJson<{ pastas: PastaDaApi[]; documentos: DocumentoDaApi[]; atualizado_em: string | null }>(`${base}/unidade/${escolhida}`, c.signal)
      .then((j) => setArvores((a) => ({ ...a, [escolhida]: j })))
      .catch(() => { if (!c.signal.aborted) setArvores((a) => ({ ...a, [escolhida]: 'erro' })); });
    return () => c.abort();
  }, [aberta, escolhida, arvores, base]);

  // A busca, como a barra de pesquisa do site (espera a pessoa parar de digitar).
  const q = termo.trim();
  const unidadeDaBusca = onde === 'unidade' ? escolhida : null;
  const chaveDaBusca = `${q}|${unidadeDaBusca ?? ''}`;
  useEffect(() => {
    if (!aberta || q.length < 2) { setBusca(null); setBuscando(false); return; }
    const c = new AbortController();
    const t = setTimeout(() => {
      setBuscando(true);
      const filtro = unidadeDaBusca ? `&unidade=${encodeURIComponent(unidadeDaBusca)}` : '';
      lerJson<{ total: number; resultados: ResultadoDaBusca[] }>(`${base}/busca?q=${encodeURIComponent(q)}${filtro}&limite=50`, c.signal)
        .then((j) => { setBusca({ chave: chaveDaBusca, termo: q, total: j.total, resultados: j.resultados }); setMostrarTodos(false); })
        .catch(() => { if (!c.signal.aborted) setBusca({ chave: chaveDaBusca, termo: q, total: -1, resultados: [] }); })
        .finally(() => { if (!c.signal.aborted) setBuscando(false); });
    }, 300);
    return () => { clearTimeout(t); c.abort(); setBuscando(false); };
  }, [aberta, q, unidadeDaBusca, chaveDaBusca, base]);

  const u = unidades?.find((x) => x.slug === escolhida);
  const arvore = escolhida ? arvores[escolhida] : undefined;
  const totalDocs = useMemo(() => unidades?.reduce((t, x) => t + x.documentos, 0) ?? 0, [unidades]);
  const buscaAtual = busca && busca.chave === chaveDaBusca ? busca : null;
  const visiveis = buscaAtual ? (mostrarTodos ? buscaAtual.resultados : buscaAtual.resultados.slice(0, 20)) : [];
  // Uma só região que o leitor de tela acompanha: quantos acharam, nenhum ou erro.
  const anuncio = !buscaAtual ? '' : buscaAtual.total === -1 ? 'Não foi possível pesquisar agora.' : buscaAtual.total === 0 ? `Nenhum documento com ${buscaAtual.termo}.` : `${buscaAtual.total} documentos com ${buscaAtual.termo}.`;

  return (
    <Dialog open={aberta} onOpenChange={onOpenChange}>
      <DialogContent semFechar className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[1120px] flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <DialogTitle className="text-[18px]">Como o site mostra</DialogTitle>
            <DialogDescription className="text-[13px]">
              {unidades ? `Dados reais da API · ${unidades.length} unidades · ${totalDocs.toLocaleString('pt-BR')} documentos` : 'Carregando os dados reais da API…'}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
              <a href={base} target="_blank" rel="noreferrer"><Code2 className="h-4 w-4" /><span className="hidden sm:inline">Ver o texto técnico (JSON)</span><span className="sm:hidden">JSON</span></a>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Fechar" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {erro ? (
          <p className="p-6 text-[14px] text-muted-foreground" role="alert">Não foi possível ler a API agora: {erro}</p>
        ) : !unidades ? (
          <p className="flex items-center gap-2 p-6 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
            {/* Unidades: lista no computador, seletor no celular */}
            <div className="border-b border-border/70 p-3 md:hidden">
              <select aria-label="Unidade" value={escolhida ?? ''} onChange={(e) => setEscolhida(e.target.value)}
                className="w-full rounded-[12px] border border-border bg-card px-3 py-2.5 text-[14px]">
                {GRUPOS.map(([g, rot]) => {
                  const doGrupo = unidades.filter((x) => grupoDe(x) === g);
                  return doGrupo.length ? (
                    <optgroup key={g} label={rot}>
                      {doGrupo.map((x) => <option key={x.slug} value={x.slug}>{x.nome} · {x.documentos} docs</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </div>
            <nav className="hidden min-h-0 space-y-3 overflow-auto border-r border-border/70 p-3 md:block" aria-label="Unidades">
              {GRUPOS.map(([g, rot]) => {
                const doGrupo = unidades.filter((x) => grupoDe(x) === g);
                if (!doGrupo.length) return null;
                return (
                  <div key={g}>
                    <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{rot}</p>
                    {doGrupo.map((x) => (
                      <button key={x.slug} type="button" onClick={() => setEscolhida(x.slug)} aria-current={x.slug === escolhida}
                        className={cn('flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]', x.slug === escolhida ? 'bg-foreground font-semibold text-background' : 'hover:bg-muted/50')}>
                        <span className="min-w-0 flex-1 truncate">{x.nome}</span>
                        {x.finalizada && <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">finalizada</span>}
                        <span className={cn('tabular-nums text-[12px]', x.slug === escolhida ? 'text-background/80' : 'text-muted-foreground')}>{x.documentos}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>

            {/* A unidade escolhida e a busca */}
            <div className="min-h-0 min-w-0 space-y-3 overflow-auto p-4">
              {u && (
                <div>
                  <h2 className="font-display text-[22px] font-semibold leading-tight">{u.nome}</h2>
                  <p className="text-[13px] text-muted-foreground">{u.documentos.toLocaleString('pt-BR')} documentos em {u.pastas} pastas{u.atualizado_em ? ` · lista lida às ${hora(u.atualizado_em)}` : ''}</p>
                </div>
              )}
              <div className={cn('flex items-center gap-2 rounded-[12px] border bg-card px-3 py-2', termo ? 'border-foreground/70' : 'border-border')}>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Procurar documento (ex.: balanço 2024)" aria-label="Procurar documento"
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
                {buscando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {termo && <button type="button" aria-label="Limpar a busca" onClick={() => setTermo('')}><X className="h-4 w-4 text-muted-foreground" /></button>}
              </div>

              {termo.trim().length >= 2 ? (
                <div className="space-y-3">
                  <p className="sr-only" aria-live="polite">{anuncio}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    {(['todas', 'unidade'] as const).map((o) => (
                      <button key={o} type="button" onClick={() => setOnde(o)} aria-pressed={onde === o}
                        className={cn('rounded-full px-3 py-1', onde === o ? 'bg-foreground font-semibold text-background' : 'border border-border text-muted-foreground')}>
                        {o === 'todas' ? 'Em todas as unidades' : 'Nesta unidade'}
                      </button>
                    ))}
                    {buscaAtual && buscaAtual.total >= 0 && (
                      <span className="ml-auto text-muted-foreground"><b className="text-foreground">{buscaAtual.total.toLocaleString('pt-BR')} documento{buscaAtual.total === 1 ? '' : 's'}</b> com “{buscaAtual.termo}”</span>
                    )}
                  </div>
                  {buscaAtual?.total === -1 && <p className="text-[13px] text-muted-foreground" role="alert">Não foi possível pesquisar agora. Tente de novo em instantes.</p>}
                  {buscaAtual && buscaAtual.total === 0 && <p className="text-[13px] text-muted-foreground">Nenhum documento com “{buscaAtual.termo}”. Tente outras palavras ou só o ano.</p>}
                  {visiveis.length > 0 && (
                    <div className="divide-y divide-border/60 rounded-[14px] border border-border/70 bg-card">
                      {visiveis.map((d) => (
                        <div key={`${d.unidade.slug}-${d.chave}`} className="flex items-center gap-2.5 px-3 py-2" data-testid="resultado-da-busca">
                          <FileText className="h-4 w-4 shrink-0 text-[#e0795f]" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-medium"><Destaque texto={d.nome} termo={buscaAtual!.termo} /></p>
                            <p className="truncate text-[12px] text-muted-foreground">{[onde === 'todas' ? d.unidade.nome : null, ...d.caminho].filter(Boolean).join(' › ')}{d.tamanho ? ` · ${tamanho(d.tamanho)}` : ''}</p>
                          </div>
                          <Acoes d={d} />
                        </div>
                      ))}
                      {!mostrarTodos && buscaAtual!.resultados.length > 20 && (
                        <button type="button" className="w-full px-3 py-2 text-center text-[12.5px] font-semibold text-foreground/80 hover:bg-muted/40" onClick={() => setMostrarTodos(true)}>
                          Mostrar mais {buscaAtual!.resultados.length - 20}
                        </button>
                      )}
                      {mostrarTodos && buscaAtual!.total > buscaAtual!.resultados.length && (
                        <p className="px-3 py-2 text-center text-[12.5px] text-muted-foreground">Mostrando os {buscaAtual!.resultados.length} mais relevantes de {buscaAtual!.total.toLocaleString('pt-BR')}. Acrescente palavras para achar mais rápido.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : arvore === 'erro' ? (
                <p className="text-[13px] text-muted-foreground" role="alert">Não foi possível carregar esta unidade agora. <button type="button" className="font-semibold text-foreground underline" onClick={() => setArvores(({ [escolhida!]: _, ...resto }) => resto)}>Tentar de novo</button></p>
              ) : !arvore ? (
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando as pastas…</p>
              ) : (
                <div className="space-y-0.5">
                  {arvore.pastas.map((p, i) => <PastaDaArvore key={`${i}-${p.nome}`} p={p} />)}
                  {arvore.documentos.map((d) => <Documento key={d.chave} d={d} />)}
                  {!arvore.pastas.length && !arvore.documentos.length && <p className="text-[13px] text-muted-foreground">Nenhum documento nesta unidade.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

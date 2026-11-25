import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Image as ImageIcon, Loader2, Pencil, Pin, Plus, Search, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COR_DA_UNIDADE, dataBR, listaDoPainel, nomeDaUnidade, semAcento, type NoticiaNaLista } from '@/lib/noticias/painel';

const POR_VEZ = 48;

export function EtiquetaDaUnidade({ slug, className }: { slug: string | null; className?: string }) {
  if (!slug) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[11.5px] font-semibold text-[#1f2322] shadow-sm', className)}>
      <span className="h-2 w-2 rounded-full" style={{ background: COR_DA_UNIDADE[slug] ?? '#ccc' }} />
      {nomeDaUnidade(slug)}
    </span>
  );
}

function Cartao({ n, abrir }: { n: NoticiaNaLista; abrir: () => void }) {
  return (
    <button type="button" onClick={abrir} className="group overflow-hidden rounded-[18px] border border-border/60 bg-card text-left transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative aspect-[4/3] bg-muted">
        {n.capa
          ? <img src={n.capa} alt="" loading="lazy" className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>}
        <EtiquetaDaUnidade slug={n.unidade} className="absolute left-2 top-2" />
        <span className="absolute right-2 top-2 flex gap-1">
          {n.fixada && <span className="inline-flex items-center gap-1 rounded-full bg-[#fbce00] px-2 py-0.5 text-[11px] font-semibold text-[#1f2322]"><Pin className="h-3 w-3" />Destaque</span>}
          {!n.publicado && <span className="rounded-full bg-[#1f2322] px-2 py-0.5 text-[11px] font-semibold text-white">Rascunho</span>}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="text-[12px] text-muted-foreground">{dataBR(n.data)}{!n.na_lista && n.publicado ? ' · fora da lista do site' : ''}</p>
        <h3 className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-foreground">{n.titulo}</h3>
        <div className="flex items-center gap-3 pt-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{n.fotos} foto{n.fotos === 1 ? '' : 's'}</span>
          {n.videos > 0 && <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />{n.videos} vídeo{n.videos > 1 ? 's' : ''}</span>}
          {n.erro && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />erro ao ler</span>}
          {n.lendo && <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" />lendo</span>}
          <Pencil className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
        </div>
      </div>
    </button>
  );
}

export function ListaDeNoticias({ abrir }: { abrir: (pasta: string) => void }) {
  const [todas, setTodas] = useState<NoticiaNaLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ano, setAno] = useState('');
  const [aba, setAba] = useState<'publicadas' | 'rascunhos'>('publicadas');
  const [unidade, setUnidade] = useState('');
  const [quantas, setQuantas] = useState(POR_VEZ);

  useEffect(() => {
    let vivo = true;
    listaDoPainel().then((r) => vivo && setTodas(r.noticias)).catch((e) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => { vivo = false; };
  }, []);
  useEffect(() => { setQuantas(POR_VEZ); }, [q, ano, aba, unidade]);

  const daAba = useMemo(() => (todas ?? []).filter((n) => (aba === 'publicadas' ? n.publicado : !n.publicado)), [todas, aba]);
  const rascunhos = (todas ?? []).filter((n) => !n.publicado).length;
  const anos = useMemo(() => [...new Set((todas ?? []).map((n) => n.data?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(), [todas]);
  const palavras = semAcento(q).split(/\s+/).filter(Boolean);
  const semUnidade = daAba.filter((n) => (!ano || n.data?.startsWith(ano)) && palavras.every((p) => semAcento(n.titulo).includes(p)));
  const porUnidade = new Map<string, number>();
  for (const n of semUnidade) for (const u of n.unidades) porUnidade.set(u, (porUnidade.get(u) ?? 0) + 1);
  const filtradas = unidade ? semUnidade.filter((n) => n.unidades.includes(unidade)) : semUnidade;
  const publicadas = (todas ?? []).length - rascunhos;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-foreground">Notícias</h1>
          <p className="text-[14px] text-muted-foreground">
            Os posts do blog do site{todas ? ` · ${publicadas} publicada${publicadas === 1 ? '' : 's'}` : ''}. Fotos e vídeos ficam no Drive (Setor Marketing › Blog ANA Brasil).
          </p>
        </div>
        <Button className="h-10 gap-2 self-start" onClick={() => abrir('nova')}><Plus className="h-4 w-4" />Nova notícia</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-2 text-[13.5px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar notícia…" aria-label="Procurar notícia" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
        <select value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano" className="h-[38px] rounded-[12px] border border-border bg-card px-3 text-[13.5px] text-foreground">
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div role="tablist" aria-label="Situação" className="inline-flex items-center gap-1 rounded-[12px] border border-border bg-card p-1 text-[13px]">
          {(['publicadas', 'rascunhos'] as const).map((a) => (
            <button key={a} role="tab" aria-selected={aba === a} type="button" onClick={() => setAba(a)}
              className={cn('rounded-[9px] px-2.5 py-1', aba === a ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground hover:text-foreground')}>
              {a === 'publicadas' ? 'Publicadas' : `Rascunhos${rascunhos ? ` ${rascunhos}` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {todas && (
        <div role="group" className="flex flex-wrap gap-1.5" aria-label="Unidades">
          <button type="button" onClick={() => setUnidade('')} aria-pressed={!unidade}
            className={cn('rounded-full px-3 py-1.5 text-[13px]', !unidade ? 'bg-foreground font-semibold text-background' : 'border border-border bg-card text-foreground/80')}>
            Todas {semUnidade.length}
          </button>
          {[...porUnidade.entries()].sort((a, b) => b[1] - a[1]).map(([u, total]) => (
            <button key={u} type="button" onClick={() => setUnidade(unidade === u ? '' : u)} aria-pressed={unidade === u}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]', unidade === u ? 'bg-foreground font-semibold text-background' : 'border border-border bg-card text-foreground/80')}>
              <span className="h-2 w-2 rounded-full" style={{ background: COR_DA_UNIDADE[u] ?? '#ccc' }} />
              {nomeDaUnidade(u)} <b className={cn('font-semibold', unidade === u ? '' : 'text-muted-foreground')}>{total}</b>
            </button>
          ))}
        </div>
      )}

      {erro && <p className="rounded-[14px] border border-destructive/40 bg-destructive/10 p-3 text-[13.5px] text-destructive">Não consegui abrir as notícias: {erro}</p>}
      {!todas && !erro && <p className="flex items-center gap-2 py-10 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Abrindo as notícias…</p>}
      {todas && !filtradas.length && (
        <p className="py-10 text-center text-[14px] text-muted-foreground">
          {aba === 'rascunhos' && !rascunhos ? 'Nenhum rascunho. Uma notícia salva sem publicar fica aqui.' : 'Nenhuma notícia com esses filtros.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {filtradas.slice(0, quantas).map((n) => <Cartao key={n.pasta_id} n={n} abrir={() => abrir(n.pasta_id)} />)}
      </div>
      {filtradas.length > quantas && (
        <div className="flex justify-center"><Button variant="outline" onClick={() => setQuantas((x) => x + POR_VEZ)}>Mostrar mais ({filtradas.length - quantas})</Button></div>
      )}
    </div>
  );
}

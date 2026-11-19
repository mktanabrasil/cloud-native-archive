import { useState } from 'react';
import { Check, Download, Eye, FilePlus2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apagarFolhaExtra, criarFolhaExtra, salvarFolhaExtra } from '@/lib/calendario/api';
import {
  LIMITE_DA_FOLHA_EXTRA, MESES, UNIDADES_DO_CALENDARIO, diaEMes, folhasNaOrdem, lugarDaFolha, rotuloDasUnidades,
  type AnoDoCalendario, type FolhaExtra, type ItemDoCalendario,
} from '@/lib/calendario/regras';

/**
 * As folhas extras do fichário (19/11/2026, mockup aprovado): uma folha a
 * mais no mesmo padrão do calendário, com título, texto e pauta, depois do mês
 * escolhido (ou no fim). Entra no calendário inteiro nesse lugar e pode ser
 * baixada sozinha.
 */

/** Baixa uma folha extra sozinha, sem a marca de prévia, com a data no pé. */
export async function baixarFolhaExtra(ano: AnoDoCalendario, itens: ItemDoCalendario[], f: FolhaExtra) {
  try {
    const { gerarPdfDoCalendario } = await import('@/lib/calendario/pdf/gerar');
    const r = await gerarPdfDoCalendario(ano, itens, {
      previa: false, partes: { capa: false, textos: false, meses: [], anotacoes: false, fim: false }, extras: [f], atualizadaEm: new Date().toISOString(),
    });
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Calendário Anual ${ano.ano} · folha extra · ${f.titulo.trim().replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success(r.paginas === 1 ? 'Folha baixada' : `${r.paginas} folhas baixadas (o texto continuou na seguinte)`);
  } catch (e) { toast.error((e as Error).message || 'Não deu para montar a folha agora.'); }
}

/** O cartão do início: a lista das folhas extras e o botão de criar. */
export function CartaoDasFolhasExtras({ ano, itens, folhas, podeCriar, podeMexer, onAbrir }: {
  ano: AnoDoCalendario;
  itens: ItemDoCalendario[];
  folhas: FolhaExtra[];
  podeCriar: boolean;
  podeMexer: (f: FolhaExtra) => boolean;
  /** Abre o editor: uma folha, ou "nova". */
  onAbrir: (id: string | 'nova') => void;
}) {
  const [baixando, setBaixando] = useState<string | null>(null);
  const baixar = async (f: FolhaExtra) => { setBaixando(f.id); await baixarFolhaExtra(ano, itens, f); setBaixando(null); };
  return (
    <section className="glass-2 rounded-[22px] p-5 sm:col-span-2" data-testid="folhas-extras" data-tutorial="cal-folhas">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><FilePlus2 className="h-5 w-5" /></span>
        {folhas.length > 0 && <span className="inline-flex items-center rounded-full bg-[hsl(201_80%_93%)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[hsl(var(--info))] dark:bg-[hsl(201_40%_18%)]">{folhas.length} {folhas.length === 1 ? 'folha extra' : 'folhas extras'}</span>}
      </div>
      <h2 className="mt-3 text-[17px] font-semibold">5. Folhas extras</h2>
      <p className="mt-1 max-w-[70ch] text-[13.5px] leading-relaxed text-muted-foreground">Uma folha a mais no fichário, no mesmo padrão: o cabeçalho do calendário, um título e o texto que vocês escreverem. Fica depois do mês que escolherem e entra no calendário inteiro.</p>
      {folhas.length > 0 && (
        <ul className="mt-3 divide-y divide-black/[.07] rounded-[14px] bg-white/70 dark:divide-white/10 dark:bg-white/5">
          {folhasNaOrdem(folhas).map(f => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13.5px]">
              <span className="min-w-0"><b className="font-semibold">{f.titulo}</b>
                <span className="block text-[12px] text-muted-foreground">{lugarDaFolha(f)} · {rotuloDasUnidades(f.unidades)}{f.criado_por_nome ? ` · ${f.criado_por_nome}` : ''}{f.criado_em ? ` · ${diaEMes(f.alterado_em ?? f.criado_em)}` : ''}</span></span>
              <span className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-8" onClick={() => onAbrir(f.id)}>{podeMexer(f) ? 'Editar' : 'Ver'}</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={baixando === f.id} onClick={() => void baixar(f)}>
                  {baixando === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Só esta folha
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {podeCriar && <Button variant="outline" className="mt-3 gap-2" onClick={() => onAbrir('nova')}><Plus className="h-4 w-4" /> Nova folha extra</Button>}
    </section>
  );
}

/** O editor de uma folha (nova ou existente). */
export function EditorDaFolhaExtra({ ano, itens, folha, podeMexer, unidadePadrao, onSalva, onApagada, onPrevia }: {
  ano: AnoDoCalendario;
  itens: ItemDoCalendario[];
  /** null = nova. */
  folha: FolhaExtra | null;
  podeMexer: boolean;
  /** A unidade de quem cria (a folha nova já vem dela). */
  unidadePadrao: string | null;
  onSalva: (f: FolhaExtra) => void;
  onApagada: (id: string) => void;
  onPrevia: (f: FolhaExtra) => void;
}) {
  const [titulo, setTitulo] = useState(folha?.titulo ?? '');
  const [mes, setMes] = useState<number | null>(folha ? folha.depois_do_mes : (new Date().getFullYear() === ano.ano ? new Date().getMonth() + 1 : 1));
  const [unidades, setUnidades] = useState<string[]>(folha?.unidades ?? (unidadePadrao ? [unidadePadrao] : []));
  const [texto, setTexto] = useState(folha?.texto ?? '');
  const [pauta, setPauta] = useState(folha?.pauta ?? true);
  const [indo, setIndo] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const campos = { titulo: titulo.trim(), depois_do_mes: mes, unidades: unidades.length === UNIDADES_DO_CALENDARIO.length ? [] : unidades, texto: texto.trim(), pauta };
  const comoEsta: FolhaExtra = { ...(folha ?? { id: 'nova', ano: ano.ano }), ...campos, titulo: campos.titulo || 'Sem título' };
  const mudou = !folha || JSON.stringify([folha.titulo, folha.depois_do_mes, folha.unidades, folha.texto, folha.pauta]) !== JSON.stringify([campos.titulo, campos.depois_do_mes, campos.unidades, campos.texto, campos.pauta]);

  const salvar = async () => {
    if (!campos.titulo) { toast.error('Dê um título à folha'); return; }
    setIndo(true);
    try {
      const f = folha ? await salvarFolhaExtra(folha.id, campos) : await criarFolhaExtra(ano.ano, campos);
      onSalva(f); toast.success('Folha salva');
    } catch (e) { toast.error((e as Error).message || 'Não deu para salvar a folha agora.'); }
    finally { setIndo(false); }
  };
  const confirmarApagar = async () => {
    if (!folha || apagando) return;
    setApagando(true);
    try { await apagarFolhaExtra(folha.id); onApagada(folha.id); toast.success('Folha apagada'); }
    catch (e) { toast.error((e as Error).message || 'Não deu para apagar agora.'); }
    finally { setApagando(false); setApagar(false); }
  };
  // Sempre na ordem DIC, Nilópolis, Santana: marcar e desmarcar de novo não conta como mudança.
  const alternar = (u: string) => setUnidades(us => UNIDADES_DO_CALENDARIO.filter(x => (x === u ? !us.includes(u) : us.includes(x))));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 lg:px-6">
      <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-[28px]">{folha ? (podeMexer ? 'Folha extra' : folha.titulo) : 'Nova folha extra'}</h1>
      {folha?.criado_por_nome && <p className="mt-1 text-[13px] text-muted-foreground">Por {folha.criado_por_nome}{folha.criado_em ? ` · ${diaEMes(folha.criado_em)}` : ''}{folha.alterado_por_nome && folha.alterado_em ? ` · editada por ${folha.alterado_por_nome} · ${diaEMes(folha.alterado_em)}` : ''}{!podeMexer ? '. Só quem criou (ou o marketing) muda esta folha.' : ''}</p>}
      <section className="glass-2 mt-4 space-y-4 rounded-[22px] p-5">
        <div><label htmlFor="folha-titulo" className="text-[12.5px] font-semibold">Título</label>
          <Input id="folha-titulo" className="mt-1" value={titulo} maxLength={80} disabled={!podeMexer} placeholder="Ex.: Festa da Família · roteiro" onChange={e => setTitulo(e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="folha-lugar" className="text-[12.5px] font-semibold">Fica no fichário</label>
            <select id="folha-lugar" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-[14px]" disabled={!podeMexer} value={mes ?? 'fim'} onChange={e => setMes(e.target.value === 'fim' ? null : Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>depois de {m}</option>)}
              <option value="fim">no fim do fichário</option>
            </select></div>
          <div><p className="text-[12.5px] font-semibold">De quais unidades</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Unidades">
              <button type="button" aria-pressed={unidades.length === 0} disabled={!podeMexer} onClick={() => setUnidades([])} className={`rounded-full border px-2.5 py-1 text-[12px] ${unidades.length === 0 ? 'border-foreground/40 bg-accent font-semibold' : 'border-black/10 bg-card dark:border-white/10'}`}>Todas</button>
              {UNIDADES_DO_CALENDARIO.map(u => <button key={u} type="button" aria-pressed={unidades.includes(u)} disabled={!podeMexer} onClick={() => alternar(u)} className={`rounded-full border px-2.5 py-1 text-[12px] ${unidades.includes(u) ? 'border-foreground/40 bg-accent font-semibold' : 'border-black/10 bg-card dark:border-white/10'}`}>{u}</button>)}
            </div></div>
        </div>
        <div><label htmlFor="folha-texto" className="text-[12.5px] font-semibold">Texto</label>
          <Textarea id="folha-texto" className="mt-1 min-h-[220px] text-[13.5px]" value={texto} maxLength={LIMITE_DA_FOLHA_EXTRA} disabled={!podeMexer} onChange={e => setTexto(e.target.value)}
            placeholder={'**Quando:** sábado, 27 de março, das 9h às 13h.\n\n**Antes:**\n- Convite às famílias no grupo.\n- Lista de doações para o café.'} />
          <p className="mt-1 text-[11.5px] text-muted-foreground">**negrito** e “- ” no começo da linha para lista, como nos textos do projeto. {texto.length}/{LIMITE_DA_FOLHA_EXTRA}</p></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={pauta} disabled={!podeMexer} onChange={e => setPauta(e.target.checked)} /> Linhas para escrever à mão no resto da folha</label>
        <div className="flex flex-wrap gap-2 pt-1">
          {podeMexer && <Button className="gap-2" disabled={indo || !mudou} onClick={() => void salvar()}>{indo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar</Button>}
          <Button variant="outline" className="gap-2" onClick={() => onPrevia(comoEsta)}><Eye className="h-4 w-4" /> Ver a folha</Button>
          {folha && <Button variant="outline" className="gap-2" disabled={mudou && podeMexer} title={mudou && podeMexer ? 'Salve antes de baixar' : undefined} onClick={() => void baixarFolhaExtra(ano, itens, folha)}><Download className="h-4 w-4" /> Baixar só esta folha</Button>}
          {folha && podeMexer && <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={() => setApagar(true)}><Trash2 className="h-4 w-4" /> Apagar</Button>}
        </div>
      </section>
      <AlertDialog open={apagar} onOpenChange={setApagar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a folha “{folha?.titulo}”?</AlertDialogTitle>
            <AlertDialogDescription>Ela sai do fichário digital e do calendário inteiro. A folha que já foi impressa continua no papel.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Não apagar</AlertDialogCancel>
            <AlertDialogAction disabled={apagando} onClick={e => { e.preventDefault(); void confirmarApagar(); }}>{apagando ? 'Apagando…' : 'Apagar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

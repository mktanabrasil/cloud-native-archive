import { useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  COLUNAS_DO_QUADRO, colunaDe, colunaPedeConfirmacao, destinoDaColuna, escolaridadeDe, estaParado, lugarDe, moverCandidatura, nomeDoCandidato,
  type CandidaturaRh, type Coluna,
} from '@/lib/vagas/rh';

/**
 * O quadro em colunas de uma vaga (passo 2 do roteiro, 19/10/2026; padrão ao
 * abrir a vaga). Arrastar o cartão é o mesmo que "Mover para…" na ficha:
 * grava o histórico e avisa o candidato quando avança. Soltar em Aprovado ou
 * Não selecionado pede confirmação (notícia definitiva). No celular, onde não
 * há arrastar, cada cartão tem "Mover para". Retiradas ficam fora do quadro.
 */
export function QuadroDeCandidatos({ slug, lista, desde, aoMudar, podeFechar = true }: { slug: string; lista: CandidaturaRh[]; desde: Map<string, string>; aoMudar: () => void; podeFechar?: boolean }) {
  const navigate = useNavigate();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Coluna | null>(null);
  const [pendente, setPendente] = useState<{ c: CandidaturaRh; col: Coluna } | null>(null);
  const ativas = lista.filter((c) => !c.retirada_em);

  async function mover(c: CandidaturaRh, col: Coluna) {
    if (colunaDe(c) === col) return;
    const { etapa, resultado } = destinoDaColuna(col);
    try {
      const r = await moverCandidatura(c.id, etapa, resultado);
      const rot = COLUNAS_DO_QUADRO.find(([k]) => k === col)?.[1];
      if (r.avisou && r.falhouAviso) toast.warning(`${nomeDoCandidato(c)} → ${rot}`, { description: 'O e-mail ao candidato não saiu.' });
      else toast.success(`${nomeDoCandidato(c)} → ${rot}`, { description: r.avisou ? 'Candidato avisado por e-mail.' : undefined });
      aoMudar();
    } catch {
      toast.error('Não deu para mover. Tente de novo.');
    }
  }

  // Quem não é RH não entra nem sai do resultado (passo 3, 19/10/2026).
  const fechada = (col: Coluna) => !podeFechar && (col === 'aprovado' || col === 'nao_selecionado');
  const pedir = (c: CandidaturaRh, col: Coluna) => {
    if (colunaDe(c) === col) return;
    if (fechada(col) || fechada(colunaDe(c))) { toast.info('O resultado fica com o RH.'); return; }
    if (colunaPedeConfirmacao(col)) setPendente({ c, col }); else void mover(c, col);
  };

  const soltar = (col: Coluna) => (e: DragEvent) => {
    e.preventDefault();
    setSobre(null);
    const c = ativas.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    setArrastando(null);
    if (c) pedir(c, col);
  };

  return (
    <>
      <div className="grid snap-x grid-flow-col auto-cols-[minmax(220px,1fr)] gap-2.5 overflow-x-auto pb-2" data-testid="quadro">
        {COLUNAS_DO_QUADRO.map(([col, rot]) => {
          const daColuna = ativas.filter((c) => colunaDe(c) === col);
          return (
            <section key={col} aria-label={rot}
              onDragOver={(e) => { e.preventDefault(); setSobre(col); }} onDragLeave={() => setSobre((s) => (s === col ? null : s))} onDrop={soltar(col)}
              className={`flex min-h-[360px] snap-start flex-col gap-2 rounded-2xl p-2.5 transition-colors ${sobre === col ? 'bg-emerald-50 ring-2 ring-dashed ring-emerald-600 dark:bg-emerald-950/40' : 'bg-muted/60'}`}>
              <h3 className="flex items-center justify-between px-1 text-[13px] font-semibold">{rot}<span className="font-normal text-muted-foreground">{daColuna.length}</span></h3>
              {fechada(col) && <p className="px-1 text-[11px] text-muted-foreground">Só o RH move para cá.</p>}
              {daColuna.map((c) => (
                <article key={c.id} draggable={!fechada(col)} onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); setArrastando(c.id); }} onDragEnd={() => setArrastando(null)}
                  className={`flex cursor-grab flex-col gap-1 rounded-xl border border-border bg-background p-2.5 text-sm active:cursor-grabbing ${arrastando === c.id ? 'opacity-50' : ''} ${col === 'nao_selecionado' ? 'opacity-75' : ''}`}
                  data-testid="cartao">
                  <button type="button" onClick={() => navigate(`/vagas/${slug}/candidatos/${c.id}`)} className="text-left">
                    <b className="block truncate">{nomeDoCandidato(c)}</b>
                    <span className="block truncate text-xs text-muted-foreground">{[lugarDe(c), escolaridadeDe(c)].filter((t) => t && t !== '—').join(' · ') || '—'}</span>
                  </button>
                  <div className="flex flex-wrap gap-1 text-[10.5px]">
                    {c.requisitos.length > 0 && <span className="rounded bg-muted px-1.5 text-muted-foreground">{c.requisitos.filter((r) => r.atende).length} de {c.requisitos.length}</span>}
                    {c.curriculo_caminho && <span className="rounded bg-muted px-1.5 text-muted-foreground">currículo</span>}
                    {!c.aberta_em && <span className="rounded bg-red-50 px-1.5 font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300">novo</span>}
                    {c.etapa !== 'resultado' && c.aberta_em && estaParado(desde.get(c.id)) && <span className="rounded bg-amber-50 px-1.5 font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">parado</span>}
                  </div>
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                    Mover para
                    <select aria-label={`Mover ${nomeDoCandidato(c)} para`} value={col} onChange={(e) => pedir(c, e.target.value as Coluna)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground">
                      {COLUNAS_DO_QUADRO.filter(([k]) => !fechada(k) || k === col).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                    </select>
                  </label>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      <AlertDialog open={!!pendente} onOpenChange={(v) => { if (!v) setPendente(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendente && (pendente.col === 'aprovado' ? `Aprovar ${nomeDoCandidato(pendente.c)}?` : `Marcar ${nomeDoCandidato(pendente.c)} como não selecionado?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>Ele recebe o e-mail de resultado agora. Dá para voltar depois, mas o e-mail já terá saído.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendente) void mover(pendente.c, pendente.col); setPendente(null); }}
              className={pendente?.col === 'nao_selecionado' ? 'bg-red-700 text-white hover:bg-red-800' : undefined}>
              {pendente?.col === 'aprovado' ? 'Aprovar e avisar' : 'Marcar e avisar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

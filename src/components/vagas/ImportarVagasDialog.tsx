import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SeloDaArea } from './PecasDasVagas';
import { criarVaga, mensagemDoErro } from '@/lib/vagas/api';
import { dadosDaImportacao, linhasDaImportacao } from '@/lib/vagas/importacao';
import { AREAS, ROTULO_DA_AREA, type StatusDaVaga, type Vaga } from '@/lib/vagas/modelo';
import { SEMENTE } from '@/lib/vagas/semente';

/**
 * Importar as vagas do site (fase 1, tela 31b do mockup aprovado).
 *
 * As 42 vagas que estavam nos widgets dos dois sites, já com título e texto
 * corrigidos. Vêm marcadas as que devem entrar; as três que repetem o mesmo
 * Forms nos dois sites e as que já foram importadas vêm desmarcadas. O RH
 * confere, desmarca o que não quiser e importa de uma vez, publicando ou
 * como rascunho. O site antigo não é tocado.
 */

interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  existentes: Vaga[];
  onImportadas: (vagas: Vaga[]) => void;
}

export function ImportarVagasDialog({ open, onOpenChange, existentes, onImportadas }: Props) {
  const { user } = useAuth();
  const linhas = useMemo(() => linhasDaImportacao(SEMENTE, existentes), [existentes]);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);

  useEffect(() => {
    if (open) setMarcadas(new Set(linhas.map((l, i) => (l.sugerida ? i : -1)).filter(i => i >= 0)));
  }, [open, linhas]);

  const alternar = (i: number) => setMarcadas(atual => { const n = new Set(atual); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const ocupado = progresso !== null;

  async function importar(status: StatusDaVaga) {
    const itens = [...marcadas].sort((a, b) => a - b).map(i => linhas[i].item);
    if (!itens.length) return;
    const dados = dadosDaImportacao(itens, status, existentes);
    const feitas: Vaga[] = [];
    setProgresso({ feitas: 0, total: dados.length });
    try {
      // Uma de cada vez: se a internet cair no meio, o que entrou fica e o resto aparece de novo para importar.
      for (const d of dados) {
        feitas.push(await criarVaga(d, user?.id ?? null));
        setProgresso({ feitas: feitas.length, total: dados.length });
      }
      toast.success(`${feitas.length} vagas importadas${status === 'publicada' ? ' e publicadas' : ' como rascunho'}.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(`${feitas.length} de ${dados.length} importadas. ${mensagemDoErro(e)}`);
    } finally {
      if (feitas.length) onImportadas(feitas);
      setProgresso(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!ocupado) onOpenChange(o); }}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-3xl" data-testid="importar-vagas">
        <DialogHeader>
          <DialogTitle>Importar as vagas do site</DialogTitle>
          <DialogDescription>
            As {SEMENTE.length} vagas dos sites do Social e do GOE, com o Forms de cada uma e os títulos já corrigidos. O site antigo continua como está.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm">
          <b>{marcadas.size} marcadas</b>
          <span className="text-muted-foreground">de {linhas.length}</span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setMarcadas(new Set(linhas.map((l, i) => (l.sugerida ? i : -1)).filter(i => i >= 0)))}>Só as sugeridas</Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setMarcadas(new Set())}>Desmarcar todas</Button>
        </div>

        {AREAS.map(area => {
          const daArea = linhas.map((l, i) => ({ l, i })).filter(({ l }) => l.item.area === area);
          if (!daArea.length) return null;
          return (
            <section key={area} aria-label={ROTULO_DA_AREA[area]} className="space-y-1.5">
              <div className="flex items-center gap-2 pt-2"><SeloDaArea area={area} /><span className="text-xs text-muted-foreground">{daArea.length}</span></div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {daArea.map(({ l, i }) => {
                  const id = `imp-${i}`;
                  return (
                    <li key={i} className={`flex gap-3 p-3 ${l.jaImportada || l.item.duplicadaDe ? 'bg-muted/40' : ''}`} data-testid={`importar-${i}`}>
                      <Checkbox id={id} className="mt-0.5" checked={marcadas.has(i)} disabled={ocupado} onCheckedChange={() => alternar(i)} aria-label={`Importar ${l.item.titulo}`} />
                      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <b className="text-sm">{l.item.titulo}</b>
                          {l.item.original.toLowerCase() !== l.item.titulo.toLowerCase() && <span className="text-xs text-muted-foreground line-through">{l.item.original}</span>}
                          {l.jaImportada && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><Check className="h-3 w-3" /> já importada</span>}
                          {l.item.duplicadaDe && <span className="rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">mesmo Forms de “{l.item.duplicadaDe}”</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{l.item.requisitos.join(' · ')}</span>
                        {l.item.nota && <span className="mt-1 flex gap-1.5 text-xs text-sky-800 dark:text-sky-300"><Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />{l.item.nota}</span>}
                      </label>
                      <a href={l.item.link_externo} target="_blank" rel="noopener noreferrer" className="self-start rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={`Abrir o Forms de ${l.item.titulo}`}><ExternalLink className="h-4 w-4" /></a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-border bg-background px-6 py-4 sm:flex-row sm:items-center">
          {progresso
            ? <span className="text-sm" role="status">Importando {progresso.feitas} de {progresso.total}…</span>
            : <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>}
          <span className="flex-1" />
          <Button variant="outline" disabled={ocupado || marcadas.size === 0} onClick={() => importar('rascunho')}>Importar como rascunho</Button>
          <Button disabled={ocupado || marcadas.size === 0} onClick={() => importar('publicada')}><Check className="h-4 w-4" /> Importar e publicar {marcadas.size}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

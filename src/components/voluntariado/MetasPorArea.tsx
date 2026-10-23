import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { definirMetaDaArea } from '@/lib/voluntariado/api';
import { AREAS_DE_AJUDA, AREAS_FORA_DO_FORMULARIO, type AreaDeAjuda } from '@/lib/voluntariado/modelo';

/**
 * As metas por área (23/10/2026), no painel do Marketing. A meta conta só a
 * 1ª opção; quando bate, o formulário avisa e a área só entra como 2ª opção
 * (reserva para desistência). Vazio = sem limite. Apagar uma inscrição
 * reabre a vaga sozinho.
 */
export function MetasPorArea({ metas, primeiras, onSalvas }: { metas: Record<string, number>; primeiras: Record<string, number>; onSalvas: (m: Record<string, number>) => void }) {
  const [texto, setTexto] = useState<Record<string, string>>({});
  // As áreas do formulário; uma tirada (23/10/2026) só aparece se ainda tiver meta, para poder tirá-la.
  const AREAS = AREAS_DE_AJUDA.filter((a) => !AREAS_FORA_DO_FORMULARIO.includes(a.chave) || metas[a.chave]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setTexto(Object.fromEntries(AREAS.map((a) => [a.chave, metas[a.chave] ? String(metas[a.chave]) : '']))); }, [metas]);

  const valor = (k: string) => (texto[k]?.trim() ? Number(texto[k]) : null);
  const mudadas = AREAS.filter((a) => valor(a.chave) !== (metas[a.chave] ?? null));

  async function salvar() {
    const invalida = mudadas.find((a) => { const n = valor(a.chave); return n !== null && (n < 1 || n > 5000); });
    if (invalida) { toast.error(`A meta de ${invalida.rotulo} é um número de 1 a 5.000 (ou vazio, sem limite).`); return; }
    setSalvando(true);
    const novas = { ...metas };
    try {
      for (const a of mudadas) {
        const n = valor(a.chave);
        await definirMetaDaArea(a.chave as AreaDeAjuda, n);
        if (n === null) delete novas[a.chave]; else novas[a.chave] = n;
      }
      toast.success('Metas salvas.');
    } catch {
      toast.error('Não deu para salvar todas as metas. Confira e tente de novo.');
    } finally {
      onSalvas(novas);
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" data-testid="metas-por-area">
      <span className="flex items-start gap-2 text-sm">
        <Target className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <span><b>Metas por área</b><br /><span className="text-muted-foreground">Conta a 1ª opção. Bateu a meta, o formulário avisa e a área só entra como 2ª opção. Vazio = sem limite.</span></span>
      </span>
      <div className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {AREAS.map((a) => {
          const meta = metas[a.chave];
          const lotada = !!meta && (primeiras[a.chave] ?? 0) >= meta;
          return (
            <label key={a.chave} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{a.rotulo} {lotada && <b className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] uppercase text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">lotada</b>}</span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                {primeiras[a.chave] ?? 0} /
                <Input aria-label={`Meta de ${a.rotulo}`} inputMode="numeric" className="h-8 w-16" placeholder="sem" value={texto[a.chave] ?? ''}
                  onChange={(e) => setTexto((t) => ({ ...t, [a.chave]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
              </span>
            </label>
          );
        })}
      </div>
      <Button size="sm" className="self-end" disabled={salvando || mudadas.length === 0} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar metas'}</Button>
    </div>
  );
}

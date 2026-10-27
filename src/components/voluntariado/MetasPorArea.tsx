import { useEffect, useState } from 'react';
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
    <div className="flex flex-col gap-3 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5" data-testid="metas-por-area">
      <div className="text-sm">
        <b className="block text-[15px] font-semibold">Metas por área</b>
        <span className="text-muted-foreground">Conta a 1ª opção. Bateu a meta, o formulário avisa e a área só entra como 2ª opção. Vazio = sem limite.</span>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {AREAS.map((a) => {
          const meta = metas[a.chave];
          const lotada = !!meta && (primeiras[a.chave] ?? 0) >= meta;
          return (
            <label key={a.chave} className="flex items-center justify-between gap-2 border-b border-border/70 py-1.5 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate">{a.rotulo}</span>
                {lotada && <b className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-warning"><span className="h-1.5 w-1.5 rounded-full bg-current" />lotada</b>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                {primeiras[a.chave] ?? 0} /
                <Input aria-label={`Meta de ${a.rotulo}`} inputMode="numeric" className="h-9 w-16 tabular-nums" placeholder="sem" value={texto[a.chave] ?? ''}
                  onChange={(e) => setTexto((t) => ({ ...t, [a.chave]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
              </span>
            </label>
          );
        })}
      </div>
      <Button size="sm" variant="outline" className="self-end" disabled={salvando || mudadas.length === 0} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar metas'}</Button>
    </div>
  );
}

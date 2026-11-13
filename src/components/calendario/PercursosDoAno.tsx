import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarAno } from '@/lib/calendario/api';
import { MESES, autoriaDe, percursosCompletos, type AnoDoCalendario, type Percurso } from '@/lib/calendario/regras';

/**
 * Os percursos do ano (14/11/2026): a tabela da página de Metodologia do PDF
 * e o tema que vai no título de cada mês. Vêm os de 2026 para revisar.
 */
export function PercursosDoAno({ ano, editavel, onAno }: { ano: AnoDoCalendario; editavel: boolean; onAno: (a: AnoDoCalendario) => void }) {
  const [linhas, setLinhas] = useState<Percurso[]>(() => percursosCompletos(ano.percursos));
  const [salvando, setSalvando] = useState(false);
  const mudou = JSON.stringify(linhas.map(l => ({ ...l, tema: l.tema.trim(), sugestoes: l.sugestoes.trim() }))) !== JSON.stringify(percursosCompletos(ano.percursos));
  const mudar = (mes: number, campo: 'tema' | 'sugestoes', v: string) => setLinhas(ls => ls.map(l => (l.mes === mes ? { ...l, [campo]: v } : l)));
  const salvar = async () => {
    setSalvando(true);
    try {
      onAno(await salvarAno(ano.ano, { percursos: linhas.map(l => ({ ...l, tema: l.tema.trim(), sugestoes: l.sugestoes.trim() })) }));
      toast.success('Percursos salvos');
    } catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); }
    finally { setSalvando(false); }
  };
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 lg:px-6">
      <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-[28px]">Percursos do ano · {ano.ano}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">A tabela da página de Metodologia, e o tema que vai no título de cada mês. Vieram os temas de 2026: revisem e troquem.</p>
      <section className="glass-2 mt-5 overflow-hidden rounded-[22px]">
        <div className="hidden grid-cols-[120px_minmax(0,1fr)_minmax(0,0.8fr)] gap-3 border-b border-black/10 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid dark:border-white/10">
          <span>Mês</span><span>Tema transversal</span><span>Sugestões de atividades</span>
        </div>
        {linhas.map((l, i) => (
          <div key={l.mes} className={`grid gap-2 px-4 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center sm:gap-3 ${i % 2 ? 'bg-white/35 dark:bg-white/[.03]' : ''}`}>
            <span className="text-[14px] font-semibold">
              {MESES[l.mes - 1]}
              {autoriaDe(ano, `percurso:${l.mes}`) && <span className="block text-[11px] font-normal text-muted-foreground">por {autoriaDe(ano, `percurso:${l.mes}`)}</span>}
            </span>
            <Input aria-label={`Tema de ${MESES[l.mes - 1]}`} className="h-9" value={l.tema} maxLength={80} disabled={!editavel} onChange={e => mudar(l.mes, 'tema', e.target.value)} />
            <Input aria-label={`Sugestões de ${MESES[l.mes - 1]}`} className="h-9" value={l.sugestoes} maxLength={120} disabled={!editavel} placeholder="—" onChange={e => mudar(l.mes, 'sugestoes', e.target.value)} />
          </div>
        ))}
      </section>
      {editavel && (
        <div className="sticky bottom-3 mt-4 flex justify-end">
          <Button onClick={salvar} disabled={!mudou || salvando} className="shadow-lg">{salvando ? 'Salvando…' : mudou ? 'Salvar os percursos' : 'Tudo salvo'}</Button>
        </div>
      )}
    </div>
  );
}

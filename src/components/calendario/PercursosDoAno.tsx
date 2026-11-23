import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarAnoJuntando } from '@/lib/calendario/api';
import { MESES, autoriaDe, juntarPercursos, percursosCompletos, percursosNaTela, type AnoDoCalendario, type Percurso } from '@/lib/calendario/regras';
import { rotuloDoSalvamento, useSalvarSozinho } from '@/hooks/useSalvarSozinho';

/**
 * Os percursos do ano (14/11/2026): a tabela da página de Metodologia do PDF
 * e o tema que vai no título de cada mês. Vêm os de 2026 para revisar.
 *
 * Desde 23/11/2026 salva sozinho (1,5 s depois de parar de digitar), gravando
 * só os meses que a pessoa mudou por cima da versão mais nova do banco.
 */
export function PercursosDoAno({ ano, editavel, onAno }: { ano: AnoDoCalendario; editavel: boolean; onAno: (a: AnoDoCalendario) => void }) {
  const [linhas, setLinhas] = useState<Percurso[]>(() => percursosCompletos(ano.percursos));
  // O que estava no banco na última vez que a tela viu (para saber o que eu mudei).
  const base = useRef<Percurso[]>(percursosCompletos(ano.percursos));
  useEffect(() => {
    const novos = percursosCompletos(ano.percursos);
    setLinhas(ls => percursosNaTela(ls, base.current, novos));
    base.current = novos;
  }, [ano.percursos]);

  const limpas = linhas.map(l => ({ ...l, tema: l.tema.trim(), sugestoes: l.sugestoes.trim() }));
  const mudou = JSON.stringify(limpas) !== JSON.stringify(percursosCompletos(ano.percursos));
  const mudar = (mes: number, campo: 'tema' | 'sugestoes', v: string) => setLinhas(ls => ls.map(l => (l.mes === mes ? { ...l, [campo]: v } : l)));
  const { estado, salvarAgora } = useSalvarSozinho({
    chave: JSON.stringify(linhas), mudou, ativo: editavel,
    salvar: async () => {
      const meus = limpas, vistos = base.current;
      const novo = await salvarAnoJuntando(ano.ano, atual => ({ percursos: juntarPercursos(atual.percursos, vistos, meus) }));
      // A base passa a ser o que eu enviei: desfazer durante o salvamento não volta.
      base.current = juntarPercursos(vistos, vistos, meus);
      onAno(novo);
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 lg:px-6">
      <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-[28px]">Percursos do ano · {ano.ano}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">A tabela da página de Metodologia, e o tema que vai no título de cada mês. Vieram os temas de 2026: revisem e troquem. Salva sozinho.</p>
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
          <Button onClick={salvarAgora} disabled={estado === 'salvo' || estado === 'salvando'} variant={estado === 'erro' ? 'destructive' : 'default'} className="shadow-lg" aria-live="polite">{rotuloDoSalvamento(estado)}</Button>
        </div>
      )}
    </div>
  );
}

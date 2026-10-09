import { ETAPAS, rotuloDaEtapa, type Etapa, type Resultado } from '@/lib/vagas/candidatura';

/**
 * A linha das etapas: Recebida › Análise › Entrevista › Resultado. No fim,
 * o resultado aparece com o nome (Aprovado ou Não selecionado, decisão de
 * 09/10/2026); "não selecionado" fecha a linha em cinza, sem o verde.
 */
export function EtapasDaCandidatura({ etapa, resultado = null, retirada = false }: { etapa: Etapa; resultado?: Resultado | null; retirada?: boolean }) {
  const atual = ETAPAS.findIndex(([k]) => k === etapa);
  const recusada = etapa === 'resultado' && resultado === 'nao_selecionado';
  const cor = (i: number) => (i > atual ? 'bg-border' : recusada && i === atual ? 'bg-muted-foreground/60' : 'bg-[#81E2CF]');
  const rotulo = rotuloDaEtapa(etapa, resultado);
  return (
    <div className={retirada ? 'opacity-50' : undefined} role="img" aria-label={retirada ? 'Candidatura retirada' : `Etapa: ${rotulo}`}>
      <div className="flex items-center">
        {ETAPAS.map(([k], i) => (
          <div key={k} className="flex flex-1 items-center last:flex-none">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cor(i)}`} data-etapa={k} data-feita={i <= atual ? 'sim' : 'nao'} />
            {i < ETAPAS.length - 1 && <span className={`h-0 flex-1 border-t-2 border-dashed ${i < atual ? 'border-[#81E2CF]' : 'border-border'}`} />}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
        {ETAPAS.map(([k, r], i) => <span key={k} className={i === atual ? 'font-semibold text-foreground' : undefined}>{i === ETAPAS.length - 1 && etapa === 'resultado' ? rotulo : r}</span>)}
      </div>
    </div>
  );
}

import { ETAPAS, type Etapa } from '@/lib/vagas/candidatura';

/** A linha das etapas que o candidato vê: Recebida › Análise › Entrevista › Resultado. */
export function EtapasDaCandidatura({ etapa, retirada = false }: { etapa: Etapa; retirada?: boolean }) {
  const atual = ETAPAS.findIndex(([k]) => k === etapa);
  return (
    <div className={retirada ? 'opacity-50' : undefined} role="img" aria-label={retirada ? 'Candidatura retirada' : `Etapa: ${ETAPAS[atual][1]}`}>
      <div className="flex items-center">
        {ETAPAS.map(([k], i) => (
          <div key={k} className="flex flex-1 items-center last:flex-none">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i <= atual ? 'bg-[#81E2CF]' : 'bg-border'}`} data-etapa={k} data-feita={i <= atual ? 'sim' : 'nao'} />
            {i < ETAPAS.length - 1 && <span className={`h-0 flex-1 border-t-2 border-dashed ${i < atual ? 'border-[#81E2CF]' : 'border-border'}`} />}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
        {ETAPAS.map(([k, rotulo], i) => <span key={k} className={i === atual ? 'font-semibold text-foreground' : undefined}>{rotulo}</span>)}
      </div>
    </div>
  );
}

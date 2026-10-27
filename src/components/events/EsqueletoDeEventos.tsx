import { Skeleton } from '@/components/ui/skeleton';

/**
 * O que a pessoa vê enquanto a lista de eventos ainda não chegou do banco.
 *
 * A vitrine decidia "não há eventos" olhando o tamanho da lista — e a lista
 * começa vazia. Toda visita mostrava por um instante "A próxima programação
 * está sendo montada", e então a grade saltava para o lugar. A Lixeira e o
 * Calendário faziam o mesmo com "A lixeira está vazia" e uma grade em branco.
 *
 * O esqueleto ocupa o espaço que o conteúdo vai ocupar (herói, título, busca,
 * abas, os primeiros cards), então nada pula. Não adivinha quantos eventos
 * existem: reserva a primeira dobra. Sem tempo mínimo — em rede boa dura menos
 * de meio segundo. Mockup aprovado em 11/09/2026.
 *
 * Para o leitor de tela há um único texto, "Carregando…", com `role="status"`;
 * as formas ficam `aria-hidden`. O Skeleton leva `motion-reduce:animate-none`,
 * então quem pediu menos movimento no aparelho vê as formas paradas.
 */

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function Aviso({ texto }: { texto: string }) {
  return <p role="status" aria-live="polite" className="sr-only">{texto}</p>;
}

/**
 * Esboço V2: a linha fantasma da lista com data em destaque (Programações e
 * Lixeira): bloco da data, título e meta, ações e a miniatura à direita.
 */
function LinhaFantasma({ comAcoes = false }: { comAcoes?: boolean }) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[56px_minmax(0,1fr)_auto_136px] sm:px-5">
      <div className="grid justify-items-center gap-1.5">
        <Skeleton className="h-6 w-8" />
        <Skeleton className="h-2.5 w-7" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-[18px] w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
      <div className="col-start-2 flex gap-2 sm:col-start-auto">
        {comAcoes ? (
          <>
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </>
        ) : (
          <Skeleton className="h-9 w-9 rounded-xl" />
        )}
      </div>
      <Skeleton className="hidden aspect-video w-full rounded-xl sm:block" />
    </div>
  );
}

function ListaFantasma({ comAcoes = false }: { comAcoes?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
      <LinhaFantasma comAcoes={comAcoes} />
      <LinhaFantasma comAcoes={comAcoes} />
      <LinhaFantasma comAcoes={comAcoes} />
    </div>
  );
}

interface VitrineProps {
  /** Com o herói de banners em cima. A faixa da equipe fica fora: ela depende da sessão, não da lista. */
  comHero?: boolean;
}

export function EsqueletoDaVitrine({ comHero = true }: VitrineProps) {
  return (
    <div data-testid="esqueleto-da-vitrine" aria-busy="true">
      <Aviso texto="Carregando a programação de eventos" />
      <div aria-hidden="true">
        {/* Esboço V2: o herói recuado e arredondado, e a lista em linhas. */}
        {comHero && (
          <div className="relative mx-auto mt-4 h-[400px] w-[calc(100%-2rem)] max-w-7xl overflow-hidden rounded-[20px] rounded-br-[48px] bg-slate-900 md:h-[460px] md:w-[calc(100%-3rem)]">
            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 rounded-[20px] bg-white/5 p-5 md:bottom-8 md:left-8 md:right-auto md:w-[480px] md:p-7">
              <Skeleton className="h-[22px] w-16 bg-white/10" />
              <Skeleton className="h-8 w-56 md:w-80 bg-white/10" />
              <Skeleton className="h-3.5 w-32 bg-white/10" />
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
          <Skeleton className="mt-6 h-12 w-full max-w-md rounded-xl" />
          <div className="mt-6 mb-6 flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 w-60 rounded-full" />
            <Skeleton className="h-8 w-[74px] rounded-full" />
            <Skeleton className="h-8 w-[74px] rounded-full" />
            <Skeleton className="h-8 w-[74px] rounded-full" />
          </div>
          <ListaFantasma />
        </div>
      </div>
    </div>
  );
}

export function EsqueletoDaLixeira() {
  return (
    <div data-testid="esqueleto-da-lixeira" aria-busy="true">
      <Aviso texto="Carregando a lixeira" />
      <div aria-hidden="true">
        <ListaFantasma comAcoes />
      </div>
    </div>
  );
}

/** Dias com uma barra de evento reservada: só para a grade não parecer um mês em branco. */
const DIAS_COM_EVENTO = new Set([4, 6, 18]);

export function EsqueletoDoCalendario() {
  return (
    <div data-testid="esqueleto-do-calendario" aria-busy="true" className="space-y-6">
      <Aviso texto="Carregando o calendário" />
      <div aria-hidden="true">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-16 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        {/* Esboço V2: a mesma grade limpa do mês, com blocos de borda esquerda. */}
        <div className="grid grid-cols-7 overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
          {DIAS.map((dia, i) => (
            <div key={dia} className={`border-b border-border/70 p-2 text-center text-xs font-semibold text-muted-foreground ${i > 0 ? 'border-l' : ''}`}>{dia}</div>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className={`min-h-[84px] border-border/70 p-1.5 sm:min-h-[116px] ${i % 7 !== 0 ? 'border-l' : ''} ${i < 28 ? 'border-b' : ''}`}>
              <Skeleton className="mb-2 h-4 w-5" />
              {DIAS_COM_EVENTO.has(i) && <Skeleton className="h-[30px] w-full rounded-l-none rounded-r-md border-l-[3px] border-muted-foreground/20" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Quando o banco não respondeu. Antes, o erro ia só para o console e a tela
 * dizia "vazio" — uma mentira tranquila. Aqui a pessoa sabe que foi um erro,
 * e tem o que fazer.
 */
export function ErroAoCarregar({ oQue, onTentar }: { oQue: string; onTentar: () => void }) {
  return (
    <div role="alert" className="rounded-[20px] border border-black/5 bg-card px-6 py-16 text-center dark:border-white/5">
      <h3 className="text-lg font-semibold text-foreground">Não foi possível carregar {oQue}</h3>
      <p className="mt-1 text-muted-foreground">Verifique a conexão e tente de novo.</p>
      <button
        type="button"
        onClick={onTentar}
        className="mt-4 inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
      >
        Tentar de novo
      </button>
    </div>
  );
}

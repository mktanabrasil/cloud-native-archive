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

function CardFantasma({ comAcoes = false }: { comAcoes?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-video bg-muted">
        <div className="absolute top-0 left-0 h-1 w-full bg-muted-foreground/15" />
        <Skeleton className="absolute top-3 left-3 h-[22px] w-16 bg-muted-foreground/15" />
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-[22px] w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        {comAcoes && (
          <div className="mt-1.5 flex gap-3">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
        )}
      </div>
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
        {comHero && (
          <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden bg-slate-900">
            <div className="absolute left-6 md:left-12 bottom-10 flex flex-col gap-3">
              <Skeleton className="h-[22px] w-16 bg-white/10" />
              <Skeleton className="h-8 w-56 md:w-80 bg-white/10" />
              <Skeleton className="h-3.5 w-32 bg-white/10" />
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
          <Skeleton className="mt-6 h-12 w-full max-w-md" />
          <div className="mt-6 mb-6 flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 w-60 rounded-full" />
            <Skeleton className="h-8 w-[74px] rounded-full" />
            <Skeleton className="h-8 w-[74px] rounded-full" />
            <Skeleton className="h-8 w-[74px] rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardFantasma />
            <CardFantasma />
            <div className="hidden lg:block"><CardFantasma /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EsqueletoDaLixeira() {
  return (
    <div data-testid="esqueleto-da-lixeira" aria-busy="true">
      <Aviso texto="Carregando a lixeira" />
      <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CardFantasma comAcoes />
        <CardFantasma comAcoes />
        <div className="hidden lg:block"><CardFantasma comAcoes /></div>
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
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {DIAS.map(dia => (
            <div key={dia} className="bg-card p-2 text-center text-xs font-semibold text-muted-foreground">{dia}</div>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="min-h-[80px] bg-card p-2">
              <Skeleton className="mb-2 h-3 w-4" />
              {DIAS_COM_EVENTO.has(i) && <Skeleton className="h-[18px] w-full rounded" />}
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
    <div role="alert" className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
      <h3 className="text-lg font-medium text-foreground">Não foi possível carregar {oQue}</h3>
      <p className="text-muted-foreground">Verifique a conexão e tente de novo.</p>
      <button
        type="button"
        onClick={onTentar}
        className="mt-4 inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
      >
        Tentar de novo
      </button>
    </div>
  );
}

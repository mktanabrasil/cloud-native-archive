import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Briefcase, Clock, Home, MapPin } from 'lucide-react';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { RodapePublico } from '@/components/events/RodapePublico';
import { ROTULO_DA_AREA, ROTULO_DA_CONTRATACAO, ROTULO_DA_MODALIDADE, type Area, type Vaga } from '@/lib/vagas/modelo';

/**
 * Peças do portal de vagas (fase 1, telas 01 e 03 do mockup aprovado).
 * A cor da área vem da faixa da marca: Social verde-água, Educação amarelo,
 * Administração coral (a mesma da Administração nos eventos). O texto sobre
 * essas cores é sempre grafite, nos dois temas: elas são claras.
 */

export const COR_DA_AREA: Record<Area, string> = {
  social: '#81E2CF',
  educacao: '#FBCE00',
  administracao: '#F37964',
};

export const ICONE_DA_AREA: Record<Area, typeof Home> = {
  social: Home,
  educacao: BookOpen,
  administracao: Briefcase,
};

export function SeloDaArea({ area }: { area: Area }) {
  const Icone = ICONE_DA_AREA[area];
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-[#1F2322]" style={{ background: COR_DA_AREA[area] }}>
      <Icone className="h-3.5 w-3.5" aria-hidden /> {ROTULO_DA_AREA[area]}
    </span>
  );
}

export function SeloAberta() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Aberta
    </span>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground">{children}</span>;
}

/** O cartão da vaga na vitrine: faixa na cor da área, título, três etiquetas. */
export function CartaoDaVaga({ vaga }: { vaga: Vaga }) {
  return (
    <Link
      to={`/vagas/${vaga.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="h-1.5 transition-all group-hover:h-2.5" style={{ background: COR_DA_AREA[vaga.area] }} aria-hidden />
      <div className="flex flex-1 flex-col gap-2.5 px-[18px] pb-[18px] pt-3">
        <div className="flex items-center justify-between gap-2"><SeloDaArea area={vaga.area} /><SeloAberta /></div>
        <h3 className="text-lg font-semibold leading-snug">{vaga.titulo}</h3>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {vaga.carga_horaria && <Etiqueta><Clock className="h-3 w-3" aria-hidden />{vaga.carga_horaria}</Etiqueta>}
          <Etiqueta>{ROTULO_DA_CONTRATACAO[vaga.contratacao]}</Etiqueta>
          <Etiqueta><MapPin className="h-3 w-3" aria-hidden />{vaga.cidade || ROTULO_DA_MODALIDADE[vaga.modalidade]}</Etiqueta>
        </div>
      </div>
    </Link>
  );
}

/** Topo das páginas públicas de vagas: a marca leva à vitrine. */
export function TopoDasVagas() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/vagas" className="flex items-center gap-2.5 font-bold text-foreground">
          <img src="/logo.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-lg lowercase tracking-tight">anabrasil</span>
        </Link>
        <Link to="/vagas" className="text-sm font-semibold text-foreground hover:text-primary">Vagas</Link>
      </div>
    </header>
  );
}

/** A moldura das duas páginas: topo, miolo, rodapé da ANA e o fio de cinco cores. */
export function MolduraDasVagas({ children, abas = null }: { children: ReactNode; abas?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopoDasVagas />
      {abas}
      <main className="flex-1">{children}</main>
      <RodapePublico />
      <InstitutionalFooterBar />
    </div>
  );
}

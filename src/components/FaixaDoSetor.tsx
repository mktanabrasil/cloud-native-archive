import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navItems, paginasVisiveis, setorDoCaminho, type NavItem, type PodeAbrir } from '@/config/navigation';
import { useFaixaDoSetorEscondida } from '@/hooks/useFaixaDoSetor';
import { useAuth } from '@/contexts/AuthContext';
import { ehCandidato } from '@/lib/vagas/conta';
import { DarFeedback } from '@/components/feedback/DarFeedback';

/**
 * A faixa do setor (16/11/2026): logo abaixo da barra, o nome do setor e as
 * páginas dele. Some enquanto uma ferramenta de tela cheia (o editor do
 * Jornal) está aberta.
 *
 * Desde 23/11/2026 traz também o "Dar feedback", no canto direito, em todos
 * os setores (Painel incluído). Com uma página só, a faixa aparece só com o
 * nome do setor e o botão; antes ela sumia.
 */
export function FaixaDoSetor({ pode, cor, compacta = false }: {
  /** O que a pessoa abre: o Calendário Anual, o Jornal, o Semanário. */
  pode: PodeAbrir;
  /** A cor de cada setor, a mesma da barra. */
  cor: (to: string) => string | undefined;
  /** No celular: sem o nome do setor, e as páginas rolam para o lado. */
  compacta?: boolean;
}) {
  const location = useLocation();
  const trilho = useRef<HTMLDivElement>(null);
  // No celular a faixa rola para o lado: a página aberta fica à vista, mesmo
  // quando é uma das últimas (Auditoria). Só o trilho rola, nunca a página.
  useLayoutEffect(() => {
    const t = trilho.current;
    const aberta = t?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!t || !aberta || t.scrollWidth <= t.clientWidth) return;
    t.scrollLeft = Math.max(0, aberta.offsetLeft - (t.clientWidth - aberta.offsetWidth) / 2);
  }, [location.pathname, location.search, compacta]);
  const escondida = useFaixaDoSetorEscondida();
  const { user } = useAuth();
  const setor = setorDoCaminho(location.pathname);
  if (!setor || escondida) return null;
  const todas = paginasVisiveis(setor, pode);
  // Conta de candidato (Trabalhe Conosco) não manda feedback da equipe.
  const comFeedback = !!user && !ehCandidato(user);
  // Uma página só: sem as pílulas (a página já é o setor), só o nome e o botão.
  const paginas = todas.length < 2 ? [] : todas;
  if (paginas.length === 0 && !comFeedback) return null;
  const mostraNome = !compacta || paginas.length === 0;
  const item = navItems.find(i => i.to === setor) as NavItem | undefined;
  const Icone = item?.icon;

  return (
    <nav aria-label={`Páginas de ${item?.label ?? 'setor'}`} className="mx-auto w-full max-w-app px-4 pt-4 lg:px-8 print:hidden">
      <div className="flex items-center gap-2">
        <div ref={trilho} className={cn('relative flex min-w-0 flex-1 items-center gap-2', compacta && '-ml-4 overflow-x-auto pl-4 [scrollbar-width:none]')}>
          {mostraNome && item && (
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-foreground">
              {Icone && (
                <span className="grid h-7 w-7 place-items-center rounded-[9px] text-[#1F2322]" style={{ background: cor(setor) }} aria-hidden>
                  <Icone className="h-[17px] w-[17px]" strokeWidth={2.1} />
                </span>
              )}
              {item.label}
              {paginas.length > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
            </span>
          )}
          {paginas.length > 0 && <ul className={cn('flex min-w-0 gap-1.5', compacta ? 'flex-nowrap' : 'flex-wrap')}>
            {paginas.map(p => {
              const aberta = p.aberta(location.pathname);
              return (
                <li key={p.to} className="shrink-0">
                  <Link
                    to={p.to}
                    aria-current={aberta ? 'page' : undefined}
                    className={cn(
                      'block whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                      aberta
                        ? 'border-transparent bg-foreground font-semibold text-background'
                        : 'border-black/10 bg-white/55 text-foreground/80 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10',
                    )}
                  >
                    {p.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>}
        </div>
        {comFeedback && <DarFeedback compacta={compacta} />}
      </div>
    </nav>
  );
}

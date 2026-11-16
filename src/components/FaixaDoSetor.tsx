import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGINAS_DOS_SETORES, navItems, setorDoCaminho, type NavItem } from '@/config/navigation';
import { useFaixaDoSetorEscondida } from '@/hooks/useFaixaDoSetor';

/**
 * A faixa do setor (16/11/2026): logo abaixo da barra, o nome do setor e as
 * páginas dele. Aparece só quando o setor tem mais de uma página para a
 * pessoa: Vagas e Painel já trazem as abas dentro da página. Some enquanto
 * uma ferramenta de tela cheia (o editor do Jornal) está aberta.
 */
export function FaixaDoSetor({ temCalendario, cor, compacta = false }: {
  /** Mostra o Calendário Anual (marketing ou gestora liberada na lista). */
  temCalendario: boolean;
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
  const setor = setorDoCaminho(location.pathname);
  if (!setor || escondida) return null;
  const paginas = (PAGINAS_DOS_SETORES[setor] ?? []).filter(p => !p.soComCalendario || temCalendario);
  if (paginas.length < 2) return null;
  const item = navItems.find(i => i.to === setor) as NavItem | undefined;
  const busca = new URLSearchParams(location.search);
  const Icone = item?.icon;

  return (
    <nav aria-label={`Páginas de ${item?.label ?? 'setor'}`} className="mx-auto w-full max-w-7xl px-4 pt-4 lg:px-8 print:hidden">
      <div ref={trilho} className={cn('relative flex items-center gap-2', compacta && '-mx-4 overflow-x-auto px-4 [scrollbar-width:none]')}>
        {!compacta && item && (
          <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-foreground">
            {Icone && (
              <span className="grid h-7 w-7 place-items-center rounded-[9px] text-[#1F2322]" style={{ background: cor(setor) }} aria-hidden>
                <Icone className="h-[17px] w-[17px]" strokeWidth={2.1} />
              </span>
            )}
            {item.label}
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
        )}
        <ul className={cn('flex min-w-0 gap-1.5', compacta ? 'flex-nowrap' : 'flex-wrap')}>
          {paginas.map(p => {
            const aberta = p.aberta(location.pathname, busca);
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
        </ul>
      </div>
    </nav>
  );
}

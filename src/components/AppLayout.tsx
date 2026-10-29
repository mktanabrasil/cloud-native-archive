import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LogOut, Users, FlaskConical, ChevronDown, LayoutGrid, CalendarDays, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useBetaPreference } from '@/hooks/useBetaPreference';
import { useIsEmbedded } from '@/hooks/useIsEmbedded';
import { useEntryGateTransition } from '@/hooks/useIsEntryGate';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import logoImg from '@/assets/logo.png';
import { TemaFlutuante } from './ThemeToggle';
import { navItems } from '@/config/navigation';
import { useSouResponsavel } from '@/hooks/useSouResponsavel';
import { useAvisosDaEquipe } from '@/hooks/useAvisosDaEquipe';
import { ehCandidato } from '@/lib/vagas/conta';
import { UiV2 } from '@/lib/uiV2';
import AppLayoutClassico from '@/classico/AppLayout';

// Esboço V2 (kit visual, 26/10/2026): a cor de cada área aparece só na navegação.
const COR_DA_AREA: Record<string, string> = {
  '/': '#01adff',
  '/jornal-institucional': '#f37964',
  '/mercado-solidario': '#E2B979',
  '/vagas': '#81e2cf',
  '/marketing': '#fbce00',
  '/usuarios': '#8A938F',
};
const ROTAS_DE_EVENTOS = ['/', '/visao-geral', '/calendario', '/eventos', '/lixeira'];
// Páginas que moram no Marketing, mas com endereço próprio.
const ROTAS_DO_MARKETING = ['/marketing', '/auditoria', '/design-manual', '/portal-transparencia', '/admin-toolbox', '/pizza-da-alegria/painel', '/fabrica-de-artes'];
const ROTULO_CURTO: Record<string, string> = { 'Jornal Institucional': 'Jornal', 'Mercado Solidário': 'Mercado' };

export default function AppLayout() {
  const souResponsavel = useSouResponsavel();
  const [isMaisOpen, setIsMaisOpen] = useState(false);
  const location = useLocation();
  // A doca aberta fecha ao trocar de página e com Esc.
  useEffect(() => { setIsMaisOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!isMaisOpen) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMaisOpen(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [isMaisOpen]);
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hideLoginParam = queryParams.get('hideLogin') === 'true';
  const hideFooterParam = queryParams.get('hideFooter') === 'true';
  const hideHeaderParam = queryParams.get('hideHeader') === 'true';
  const hideTitleParam = queryParams.get('hideTitle') === 'true';
  const isEmbedParam = queryParams.get('embed') === 'true';

  const { isAuthenticated: temSessao, signOut, user } = useAuth();
  // Conta de candidato (Trabalhe Conosco) vê o app como visitante: sem menu da equipe.
  const isAuthenticated = temSessao && !ehCandidato(user);
  const { isAdmin, isManager, userName, unit, canViewAuditoria, isMarketing, canAccessJournal, isRh } = useUserRole();
  // A bolinha em "Vagas": novos + respostas não lidas (passo 5, 20/10/2026).
  const avisosDeVagas = useAvisosDaEquipe(isRh || souResponsavel, location.pathname);
  const { eligible: betaEligible, rawEnabled: betaOn, toggleBeta } = useBetaPreference();
  const isEmbedded = useIsEmbedded();
  // Na porta de entrada a tela inteira é do card de acesso: sem sessão o menu
  // não tem o que oferecer.
  const { isGate: isEntryGate, entering: gateJustClosed } = useEntryGateTransition();
  const isMobile = useIsMobile();
  // Com seis itens a barra de cima precisa de uns 1100 px. Abaixo disso a
  // navegação desce para a doca, como no celular.
  const [menuCompacto, setMenuCompacto] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1099px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1099px)');
    const mudar = () => setMenuCompacto(mq.matches);
    mudar();
    mq.addEventListener('change', mudar);
    return () => mq.removeEventListener('change', mudar);
  }, []);
  const comDoca = isMobile || menuCompacto;
  const isCleanView = isEmbedded || hideLoginParam || hideFooterParam || hideHeaderParam || hideTitleParam || isEmbedParam;
  const mostraMoldura = !hideHeaderParam && !isEmbedParam && !isEntryGate;

  // Os tokens da V2 valem só dentro do app; embeds e páginas de campanha ficam como estão.
  useEffect(() => {
    if (isCleanView) return;
    document.body.classList.add('ui-v2');
    return () => document.body.classList.remove('ui-v2');
  }, [isCleanView]);

  const itensVisiveis = navItems.filter(item => {
    // Regra para páginas escondidas (não aparecem no menu, acessadas por outra página)
    if (item.hidden) return false;
    // Antes do `marketingOnly`: o Jornal tem regra própria, e a gestão de
    // unidade entra nele sem entrar nas outras páginas da comunicação.
    if (item.journalOnly) return canAccessJournal;
    // RH, ou quem é responsável por algum processo (passo 3, 19/10/2026).
    if (item.rhOnly) return isRh || souResponsavel;
    if (item.marketingOnly) return isMarketing;
    if (item.adminOnly) return isAdmin;
    if (item.managerOnly) return isAdmin || isManager;
    if (item.mktOrAdminOnly) return isAdmin;
    if (item.auditoriaOnly) return canViewAuditoria;
    if (item.requireAuth) return isAuthenticated;
    return true;
  });
  const estaNaArea = (to: string) =>
    to === '/' ? ROTAS_DE_EVENTOS.includes(location.pathname)
      : to === '/marketing' ? ROTAS_DO_MARKETING.some(r => location.pathname.startsWith(r))
      : location.pathname.startsWith(to);

  const contagemDeVagas = (to: string) =>
    to === '/vagas' && avisosDeVagas > 0 ? (
      <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#f37964] px-1 text-[10.5px] font-bold text-[#1F2322]" aria-label={`${avisosDeVagas} para ver`}>
        {avisosDeVagas > 99 ? '99+' : avisosDeVagas}
      </span>
    ) : null;

  const linkDaBarra = (item: (typeof navItems)[number], grande = false, aoClicar?: () => void) => {
    const active = estaNaArea(item.to);
    return (
      <Link
        key={item.to}
        to={`${item.to}${location.search}`}
        onClick={aoClicar}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[13.5px] font-medium text-foreground transition-colors',
          active
            ? 'bg-[hsl(var(--ativo))] font-semibold shadow-[inset_0_1px_0_hsl(var(--glass-luz)),0_2px_8px_hsl(165_30%_12%/0.08)]'
            : 'hover:bg-[hsl(var(--ativo))]',
          grande && 'px-4 py-3 text-base',
        )}
      >
        <IconeDaDoca Icone={iconeDoItem(item)} cor={COR_DA_AREA[item.to]} ativo={active} barra />
        <span>{item.label}</span>
        {contagemDeVagas(item.to)}
      </Link>
    );
  };

  const iniciais = (userName || user?.email || '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');

  const menuDaConta = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2.5 rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Sua conta">
          {/* Na barra com as áreas, o nome só aparece a partir de 1280 px: entre 1100
              e 1279 as seis áreas com ícone não cabem com ele (fica no menu da conta). */}
          <span className={cn('hidden text-right leading-tight', comDoca ? 'md:block' : 'min-[1280px]:block')}>
            <span className="block max-w-[180px] truncate text-xs font-semibold text-foreground">{userName}</span>
            <span className="block max-w-[160px] truncate text-[11px] text-muted-foreground">{unit || user?.email}</span>
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#81e2cf] text-xs font-bold text-[#10201C]">{iniciais}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-sm font-semibold text-foreground">{userName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{unit || user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(isAdmin || isManager) && (
          <DropdownMenuItem asChild>
            <Link to={`/usuarios${location.search}`} className="flex cursor-pointer items-center gap-2 py-2">
              <Users className="h-4 w-4" />
              <span>Painel</span>
            </Link>
          </DropdownMenuItem>
        )}
        {betaEligible && (
          <div className="flex items-center justify-between gap-2 px-2 py-2 text-sm" onClick={e => e.preventDefault()}>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              <span>Modo Teste</span>
            </div>
            <Switch checked={betaOn} onCheckedChange={v => { toggleBeta(v); window.location.reload(); }} />
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="flex cursor-pointer items-center gap-2 py-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Doca do celular: até cinco lugares; com mais áreas, quatro e "Mais".
  // A ordem segue o papel (ajuste de 26/10/2026): quem é do marketing vê o
  // Marketing na doca, quem é do RH vê Vagas; o Mercado, menos usado, vai para
  // o "Mais". E a área em que a pessoa está nunca fica escondida no "Mais".
  const prioridade = (to: string) => {
    const base = ['/', '/jornal-institucional', '/vagas', '/marketing', '/mercado-solidario', '/usuarios'].indexOf(to);
    if (to === '/marketing' && isMarketing) return -2;
    if (to === '/vagas' && (isRh || souResponsavel)) return -1;
    return base < 0 ? 99 : base;
  };
  const ordenados = itensVisiveis.length > 5
    ? [...itensVisiveis].sort((a, b) => (a.to === '/' ? -9 : prioridade(a.to)) - (b.to === '/' ? -9 : prioridade(b.to)))
    : itensVisiveis;
  let naDoca = ordenados.length > 5 ? ordenados.slice(0, 4) : ordenados;
  let noMais = ordenados.length > 5 ? ordenados.slice(4) : [];
  const atualNoMais = noMais.find(i => estaNaArea(i.to));
  if (atualNoMais) {
    noMais = [naDoca[3], ...noMais.filter(i => i !== atualNoMais)];
    naDoca = [...naDoca.slice(0, 3), atualNoMais];
  }
  // Escolhidas as áreas, a doca mostra na ordem de sempre (a do menu do computador).
  const ordemDoMenu = (i: (typeof navItems)[number]) => itensVisiveis.indexOf(i);
  naDoca = [...naDoca].sort((x, y) => ordemDoMenu(x) - ordemDoMenu(y));
  noMais = [...noMais].sort((x, y) => ordemDoMenu(x) - ordemDoMenu(y));
  const colunasDaDoca = naDoca.length + (noMais.length ? 1 : 0);
  // Na doca e na barra do computador, o ícone de cada área (27/10/2026, no lugar
  // dos pontinhos), na cor do texto, que lê bem nos dois temas. Na doca, a área
  // ativa ganha o quadradinho na cor dela, como o ícone do app; na barra, só o
  // fundo claro do item (pedido dele).
  const IconeDaDoca = ({ Icone, cor, ativo, grande = false, barra = false }: { Icone: LucideIcon; cor?: string; ativo: boolean; grande?: boolean; barra?: boolean }) => (
    <span
      className={cn('grid shrink-0 place-items-center transition-[background-color,transform] duration-200', grande ? 'h-10 w-10 rounded-[12px]' : barra ? 'h-4 w-4' : 'h-7 w-7 rounded-[9px]', ativo && !barra && 'scale-105')}
      style={barra ? undefined : { background: ativo ? cor ?? '#8A938F' : grande && cor ? `color-mix(in srgb, ${cor} 22%, transparent)` : undefined, color: ativo ? '#1F2322' : undefined }}
      aria-hidden
    >
      <Icone className={grande ? 'h-[20px] w-[20px]' : barra ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={ativo ? 2.1 : 1.8} />
    </span>
  );
  // Eventos ganha o calendário na doca e na barra: o globo do menu antigo não dizia "eventos".
  const iconeDoItem = (item: (typeof navItems)[number]): LucideIcon => (item.to === '/' ? CalendarDays : item.icon);
  const itemDaDoca = (rotulo: string, ativo: boolean, item?: (typeof navItems)[number]) => (
    <>
      <IconeDaDoca Icone={item ? iconeDoItem(item) : LayoutGrid} cor={item ? COR_DA_AREA[item.to] : undefined} ativo={ativo} />
      <span className="max-w-full truncate px-0.5">{rotulo}</span>
    </>
  );
  const classeDoItem = (ativo: boolean) =>
    cn('relative mx-0.5 grid min-h-[56px] content-center justify-items-center gap-1 rounded-[16px] text-[11px] transition-colors',
      ativo ? 'bg-[hsl(var(--ativo))] font-bold text-foreground shadow-[inset_0_1px_0_hsl(var(--glass-luz)),0_2px_8px_hsl(165_30%_12%/0.08)]' : 'font-semibold text-muted-foreground');

  // Embed e telas limpas (?embed, ?hideHeader…): o layout de antes, sem nenhuma
  // mudança — é o que o site já incorpora (pedido de 26/10/2026).
  if (isCleanView) return <AppLayoutClassico />;

  return (
    <UiV2>
    <div className={cn('flex min-h-screen flex-col bg-transparent', isCleanView && 'min-h-0 h-auto bg-transparent overflow-visible')}>
      {!isCleanView && <div className="ana-mesh" aria-hidden="true" />}
      {mostraMoldura && <ImpersonationBanner />}
      {mostraMoldura && (
        <header
          className={cn(
            'glass-1 sticky top-3 z-50 mx-3 mt-3 rounded-[18px] print:hidden lg:mx-6',
            // desce do topo quando a porta de entrada acabou de dar lugar ao app
            gateJustClosed && 'ana-bar-entering',
          )}
        >
          <div className="flex h-14 w-full items-center gap-4 pl-3 pr-2.5">
            <Link to={`/${location.search}`} className="flex shrink-0 items-center gap-2 transition-transform active:scale-95" aria-label="anabrasil, início">
              <img src={logoImg} alt="" className="h-8 w-8" />
              <span className="text-[17px] leading-none text-foreground" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, letterSpacing: '-0.05em' }}>
                anabrasil
              </span>
            </Link>

            {!comDoca && <nav className="flex min-w-0 flex-1 items-center justify-center gap-1">{itensVisiveis.map(item => linkDaBarra(item))}</nav>}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {isAuthenticated ? (
                menuDaConta
              ) : !hideLoginParam ? (
                <Button asChild variant="outline" size="sm">
                  <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>Entrar</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </header>
      )}

      <main className={cn('flex-1', !isCleanView ? 'mx-auto w-full overflow-x-clip' : 'overflow-visible', mostraMoldura && comDoca && 'pb-28')}>
        <Outlet />
      </main>

      {mostraMoldura && <TemaFlutuante />}
      {mostraMoldura && comDoca && itensVisiveis.length > 0 && isMaisOpen && (
        // Véu leve atrás da doca aberta: tocar fora fecha.
        <button type="button" aria-label="Fechar o menu" onClick={() => setIsMaisOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-[rgb(16_22_21/0.18)] backdrop-blur-[2px] animate-in fade-in-0 duration-200 print:hidden" />
      )}
      {mostraMoldura && comDoca && itensVisiveis.length > 0 && (
        <nav
          aria-label="Navegação"
          data-barra-de-baixo="sempre"
          className="glass-1 fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md overflow-hidden rounded-[24px] px-1 py-1.5 print:hidden"
        >
          {/* "Mais" abre a própria doca para cima, no mesmo vidro, com todas as áreas (27/10/2026). */}
          {noMais.length > 0 && (
            <div id="doca-todas" className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]', isMaisOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')} aria-hidden={!isMaisOpen}>
              <div className="min-h-0 overflow-hidden">
                <div className="px-2.5 pb-2 pt-2.5">
                  <span className="mb-2 block px-1 text-xs font-semibold text-muted-foreground">Todas as áreas</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {itensVisiveis.map(item => {
                      const ativo = estaNaArea(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={`${item.to}${location.search}`}
                          tabIndex={isMaisOpen ? 0 : -1}
                          onClick={() => setIsMaisOpen(false)}
                          aria-current={ativo ? 'page' : undefined}
                          className={cn('relative grid min-h-[78px] content-center justify-items-center gap-1.5 rounded-[18px] px-1 text-center text-[12px] leading-tight transition-colors',
                            ativo ? 'bg-[hsl(var(--ativo))] font-bold text-foreground shadow-[inset_0_1px_0_hsl(var(--glass-luz)),0_2px_8px_hsl(165_30%_12%/0.08)]' : 'font-semibold text-muted-foreground active:bg-[hsl(var(--ativo))]')}
                        >
                          <IconeDaDoca Icone={iconeDoItem(item)} cor={COR_DA_AREA[item.to]} ativo={ativo} grande />
                          <span className="max-w-full px-0.5">{item.label}</span>
                          {item.to === '/vagas' && avisosDeVagas > 0 && <span className="absolute right-3 top-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#f37964] px-1 text-[10.5px] font-bold text-[#1F2322]">{avisosDeVagas > 99 ? '99+' : avisosDeVagas}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <div className="mx-3 mb-1.5 border-t border-black/10 dark:border-white/10" />
              </div>
            </div>
          )}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${colunasDaDoca}, minmax(0, 1fr))` }}>
          {naDoca.map(item => {
            const ativo = estaNaArea(item.to);
            return (
              <Link
                key={item.to}
                to={`${item.to}${location.search}`}
                aria-current={ativo ? 'page' : undefined}
                className={classeDoItem(ativo)}
              >
                {itemDaDoca(ROTULO_CURTO[item.label] ?? item.label, ativo, item)}
                {item.to === '/vagas' && avisosDeVagas > 0 && <span className="absolute right-[22%] top-0 h-2 w-2 rounded-full bg-[#f37964]" aria-label={`${avisosDeVagas} para ver`} />}
              </Link>
            );
          })}
          {noMais.length > 0 && (
            <button type="button" className={classeDoItem(isMaisOpen)} aria-expanded={isMaisOpen} aria-controls="doca-todas" onClick={() => setIsMaisOpen(v => !v)}>
              {isMaisOpen ? (
                <>
                  <span className="grid h-7 w-7 place-items-center" aria-hidden><ChevronDown className="h-[18px] w-[18px]" /></span>
                  <span className="max-w-full truncate px-0.5">Fechar</span>
                </>
              ) : itemDaDoca('Mais', false)}
            </button>
          )}
          </div>
        </nav>
      )}
    </div>
    </UiV2>
  );
}

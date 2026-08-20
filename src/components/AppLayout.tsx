import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogIn, LogOut, Menu, Settings, UserCircle, History, Globe, FlaskConical, BookOpen, Newspaper, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useBetaPreference } from '@/hooks/useBetaPreference';
import { useIsEmbedded } from '@/hooks/useIsEmbedded';
import { useEntryGateTransition } from '@/hooks/useIsEntryGate';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import TestModeBanner, { TestModeTrigger } from '@/components/TestModeBanner';
import logoImg from '@/assets/logo.png';
import { ThemeToggle } from './ThemeToggle';
import { navItems } from '@/config/navigation';

export default function AppLayout() {
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsFirstRender(false), 1000);
    return () => clearTimeout(timer);
  }, []);
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hideLoginParam = queryParams.get('hideLogin') === 'true';
  const hideFooterParam = queryParams.get('hideFooter') === 'true';
  const hideHeaderParam = queryParams.get('hideHeader') === 'true';
  const hideTitleParam = queryParams.get('hideTitle') === 'true';
  const isEmbedParam = queryParams.get('embed') === 'true';
  const [showLoginLocal, setShowLoginLocal] = useState(!hideLoginParam);

  useEffect(() => {
    setShowLoginLocal(!hideLoginParam);
  }, [hideLoginParam]);
  
  const { isAuthenticated, signOut, user } = useAuth();
  const { isAdmin, isManager, userName, unit, canViewAuditoria, isMarketing } = useUserRole();
  const { eligible: betaEligible, rawEnabled: betaOn, toggleBeta } = useBetaPreference();
  const isEmbedded = useIsEmbedded();
  // Na porta de entrada a tela inteira é do card de acesso: sem sessão o menu
  // não tem o que oferecer, e o botão flutuante brigaria com as formas.
  const { isGate: isEntryGate, entering: gateJustClosed } = useEntryGateTransition();
  const isMobile = useIsMobile();
  const isCleanView = isEmbedded || hideLoginParam || hideFooterParam || hideHeaderParam || hideTitleParam || isEmbedParam;

  const NavContent = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.filter(item => {
        const allowedEmails = ['alyson-viana@hotmail.com', 'mkt@anabrasil.org'];
        const isSpecialAdmin = user?.email && allowedEmails.includes(user.email);
        const isAdminEmail = isSpecialAdmin || user?.email === 'contato@anabrasil.org';
        
        // Regra para páginas escondidas (não aparecem no menu, acessadas por outra página)
        if (item.hidden) return false;
        
        if (item.marketingOnly) return isMarketing;
        if (item.adminOnly) return isAdmin || isAdminEmail;
        if (item.managerOnly) return isAdmin || isManager || isAdminEmail;
        if (item.mktOrAdminOnly) return isAdmin || isAdminEmail;
        if (item.auditoriaOnly) return canViewAuditoria;
        if (item.requireAuth) return isAuthenticated;
        return true;
      }).map(item => {
        const active = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={`${item.to}${location.search}`}
            onClick={onClick}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              isMobile && "px-4 py-3 text-base"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );


  return (
    <div className={cn("flex min-h-screen flex-col bg-background", isCleanView && "min-h-0 h-auto bg-transparent overflow-visible")}>
      {!hideHeaderParam && !isEmbedParam && !isEntryGate && <ImpersonationBanner />}
      {!hideHeaderParam && !isEmbedParam && !isEntryGate && (
        <header className={cn(
          "sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 print:hidden",
          // desce do topo quando a porta de entrada acabou de dar lugar ao app
          gateJustClosed && "ana-bar-entering"
        )}>
          <div className="flex h-16 w-full items-center gap-4 px-4 lg:px-8">
            {isMobile && (
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  {/* 44px de alvo no mobile; o `size="icon"` sozinho dá 40 */}
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="p-6 text-left">
                    <SheetTitle className="flex items-center gap-2">
                      <img src={logoImg} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      <span className="font-bold tracking-tighter text-lg lowercase">
                        anabrasil
                      </span>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 px-2">
                    <NavContent onClick={() => setIsMenuOpen(false)} />
                  </nav>
                  <div className="absolute bottom-4 left-0 w-full px-6">
                    {isAuthenticated && (
                      <div className="flex flex-col gap-4 border-t border-border pt-4">
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                          <p className="text-xs text-muted-foreground truncate">{unit || user?.email}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => signOut()} className="w-full justify-start gap-2">
                          <LogOut className="h-4 w-4" />
                          Sair
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            )}

            <Link to={`/${location.search}`} className="flex items-center gap-2.5 shrink-0 group transition-all active:scale-95">
              <img src={logoImg} alt="" className="h-10 w-10 rounded-xl object-cover shadow-sm group-hover:shadow-md transition-shadow" />
              <span className={cn("text-xl leading-none text-foreground tracking-tighter lowercase", isMobile ? "inline" : "hidden sm:inline")} style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
                anabrasil
              </span>
            </Link>

            {!isMobile && (
              <nav className="flex items-center gap-1 flex-1">
                <NavContent />
              </nav>
            )}

            <div className="flex items-center gap-3 shrink-0 ml-auto">
              {isAuthenticated ? (
                <>
                  <div className="flex flex-col items-end hidden md:flex">
                    <span className="text-xs font-semibold text-foreground">{userName}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{unit || user?.email}</span>
                  </div>
                  {!isMobile && (
                    <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5">
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Sair</span>
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </header>
      )}

      <main className={cn(
        "flex-1",
        !isCleanView ? "overflow-auto mx-auto w-full" : "overflow-visible"
      )}>
        <Outlet />
      </main>


      {!hideHeaderParam && !isEmbedParam && !isEntryGate && (
        <div className={cn(
          // area segura: com viewport-fit=cover o botao cai sob a faixa de gestos do iPhone
          "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))] z-[60] duration-500 flex items-center gap-3",
          isFirstRender && "animate-in fade-in slide-in-from-bottom-4"
        )}>
          
          <ThemeToggle />
          {isAuthenticated ? (

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="default" 
                  size="icon" 
                  className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-transform active:scale-95 border-2 border-primary-foreground/20"
                >
                  <UserCircle className="h-7 w-7" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground truncate">{userName}</span>
                  <span className="text-xs font-normal text-muted-foreground truncate">{unit || user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(isAdmin || isManager) && (
                  <DropdownMenuItem asChild>
                    <Link to={`/usuarios${location.search}`} className="flex items-center gap-2 cursor-pointer py-2">
                      <Users className="h-4 w-4" />
                      <span>Painel</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {betaEligible && (
                  <>
                    <DropdownMenuSeparator />
                    <div
                      className="flex items-center justify-between gap-2 px-2 py-2 text-sm"
                      onClick={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" />
                        <span>Modo Teste</span>
                      </div>
                      <Switch checked={betaOn} onCheckedChange={(v) => { toggleBeta(v); window.location.reload(); }} />
                    </div>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 cursor-pointer py-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`} className="transition-transform active:scale-95">
              <Button 
                variant="default" 
                size="icon" 
                className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 border-2 border-primary-foreground/20"
                title="Login Admin"
              >
                <LogIn className="h-7 w-7" />
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

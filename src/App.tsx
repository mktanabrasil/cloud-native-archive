import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { pedidoFoiEnviado } from "@/lib/pedidoEnviado";
import { TestViewProvider } from "@/contexts/TestViewContext";
import AppLayout from "@/components/AppLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import Dashboard from "./pages/Dashboard";

import CalendarPage from "./pages/CalendarPage";
import UsersPage from "./pages/UsersPage";
import AuditPage from "./pages/AuditPage";
import LoginPage from "./pages/LoginPage";
import PublicEventsPage from "./pages/PublicEventsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthConfirmPage from "./pages/AuthConfirmPage";
import DesignManualPage from "./pages/DesignManualPage";
import NewsGeneratorPage from "./pages/NewsGeneratorPage";
import JournalPage from "./pages/JournalPage";
import MarketingHubPage from "./pages/MarketingHubPage";
import EventsHubPage from "./pages/EventsHubPage";
import TransparencyPage from "./pages/TransparencyPage";
import MercadoSolidarioPage from "./pages/MercadoSolidarioPage";
import MercadoSolidarioPublicPage from "./pages/MercadoSolidarioPublicPage";
import TransparencyPublicPage from "./pages/TransparencyPublicPage";
import NotFound from "./pages/NotFound";
import EmailPreview from "./pages/EmailPreview";
import AdminToolboxPage from "./pages/AdminToolboxPage";
import OAuthConsent from "./pages/OAuthConsent";



const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  if (loading) return null;
  if (!isAuthenticated && !isEmbed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function MarketingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isMarketing, loading: roleLoading } = useUserRole();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  if (authLoading || roleLoading) return null;
  if (!isAuthenticated && !isEmbed) return <Navigate to="/login" replace />;
  if (!isMarketing) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Guarda do Jornal. Separada da `MarketingRoute` de propósito: aquela é usada
 * por Auditoria, Manual de Design, Portal da Transparência e Widgets, e
 * afrouxá-la para receber a gestão abriria as quatro de uma vez.
 */
function JournalRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canAccessJournal, loading: roleLoading } = useUserRole();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  if (authLoading || roleLoading) return null;
  if (!isAuthenticated && !isEmbed) return <Navigate to="/login" replace />;
  if (!canAccessJournal) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  // Quem acabou de pedir acesso fica onde está: o `signUp` cria sessão por um
  // instante, e sem isto o app abre — logado — para quem ainda não foi
  // aprovado. Ver `src/lib/pedidoEnviado.ts`.
  const acabouDePedir = pedidoFoiEnviado();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  
  if (loading) return null;
  if (isAuthenticated && !acabouDePedir) return <Navigate to={redirect} replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="anabrasil-theme">
      <TooltipProvider>

      <AuthProvider>
        <TestViewProvider>
          <AppProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={
                  <AuthRedirect><LoginPage /></AuthRedirect>
                } />
                <Route path="/auth/confirm" element={<AuthConfirmPage />} />
                <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                <Route path="/email-preview" element={<EmailPreview />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/mercado-solidario-publico" element={<MercadoSolidarioPublicPage />} />
                <Route path="/portal-transparencia-publico" element={<TransparencyPublicPage />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<EventsHubPage />} />
                  <Route path="/visao-geral" element={
                    <ProtectedRoute><Dashboard /></ProtectedRoute>
                  } />
                  <Route path="/calendario" element={
                    <ProtectedRoute><CalendarPage /></ProtectedRoute>
                  } />
                  {/* Endereço próprio das Programações. Antes só redirecionava para a
                      raiz, que era onde elas viviam; com a porta de entrada na raiz,
                      elas passam a morar aqui — igualmente públicas, sem guarda. */}
                  <Route path="/eventos" element={<PublicEventsPage />} />
                  {/* Aberta a quem está logado: cada pessoa se vê aqui. Quem
                      gerencia os outros é a comunicação, e isso a própria tela
                      decide — ver `podeGerirTodos` em UsersPage. */}
                  <Route path="/usuarios" element={
                    <ProtectedRoute><UsersPage /></ProtectedRoute>
                  } />
                  <Route path="/auditoria" element={
                    <MarketingRoute><AuditPage /></MarketingRoute>
                  } />
                  <Route path="/design-manual" element={
                    <MarketingRoute><DesignManualPage /></MarketingRoute>
                  } />
                  <Route path="/noticias" element={
                    <ProtectedRoute><NewsGeneratorPage /></ProtectedRoute>
                  } />
                  <Route path="/jornal-institucional" element={
                    <JournalRoute><JournalPage /></JournalRoute>
                  } />

                  <Route path="/marketing" element={
                    <ProtectedRoute><MarketingHubPage /></ProtectedRoute>
                  } />
                  <Route path="/mercado-solidario" element={<MercadoSolidarioPage />} />
                  <Route path="/portal-transparencia" element={
                    <MarketingRoute><TransparencyPage /></MarketingRoute>
                  } />
                  <Route path="/admin-toolbox" element={
                    <MarketingRoute><AdminToolboxPage /></MarketingRoute>
                  } />
                  <Route path="*" element={<NotFound />} />

                </Route>
              </Routes>
            </BrowserRouter>
          </AppProvider>
        </TestViewProvider>
      </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);


export default App;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { pedidoFoiEnviado } from "@/lib/pedidoEnviado";
import { TestViewProvider } from "@/contexts/TestViewContext";
import AppLayout from "@/components/AppLayout";
import { ThemeProvider } from "@/components/ThemeProvider";

import UsersPage from "./pages/UsersPage";
import AdministracaoRhPage from "./pages/AdministracaoRhPage";
import AdministracaoVoluntariadoPage from "./pages/AdministracaoVoluntariadoPage";
import AdministracaoFinanceiroPage from "./pages/AdministracaoFinanceiroPage";
import AdministracaoApoiadoresPage from "./pages/AdministracaoApoiadoresPage";
import LoginPage from "./pages/LoginPage";
import PublicEventsPage from "./pages/PublicEventsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SenhaNovaPage from "./pages/SenhaNovaPage";
import AuthConfirmPage from "./pages/AuthConfirmPage";
import JournalPage from "./pages/JournalPage";
import JornaisDasUnidadesPage from "./pages/JornaisDasUnidadesPage";
import { REDIRECIONAMENTOS, ROTAS } from "@/config/navigation";
import { MarketingSemAba, Redireciona } from "@/components/Redireciona";
import MarketingHubPage from "./pages/MarketingHubPage";
import EventsHubPage from "./pages/EventsHubPage";
import RaizPage from "./pages/RaizPage";
import MercadoSolidarioPage from "./pages/MercadoSolidarioPage";
import MercadoSolidarioPublicPage from "./pages/MercadoSolidarioPublicPage";
import EnquetePublicaPage from "./pages/EnquetePublicaPage";
import EnqueteResultadoPage from "./pages/EnqueteResultadoPage";
import TransparencyPublicPage from "./pages/TransparencyPublicPage";
import VagasPage from "./pages/VagasPage";
import VagaPage from "./pages/VagaPage";
import EntrarCandidatoPage from "./pages/EntrarCandidatoPage";
import CriarContaCandidatoPage from "./pages/CriarContaCandidatoPage";
import RecuperarSenhaCandidatoPage from "./pages/RecuperarSenhaCandidatoPage";
import MinhaAreaCandidatoPage from "./pages/MinhaAreaCandidatoPage";
import PrivacidadeCandidatoPage from "./pages/PrivacidadeCandidatoPage";
import MeuPerfilCandidatoPage from "./pages/MeuPerfilCandidatoPage";
import CurriculoCandidatoPage from "./pages/CurriculoCandidatoPage";
import AvisosCandidatoPage from "./pages/AvisosCandidatoPage";
import CandidaturaPage from "./pages/CandidaturaPage";
import CandidaturaDetalhePage from "./pages/CandidaturaDetalhePage";
import CandidatosDaVagaPage from "./pages/CandidatosDaVagaPage";
import FichaDoCandidatoPage from "./pages/FichaDoCandidatoPage";
import PizzaConfirmacaoPage from "./pages/PizzaConfirmacaoPage";
import PizzaPainelPage from "./pages/PizzaPainelPage";
import { PizzaAcompanharPage, PizzaDashboardPage } from "./pages/PizzaDashboardPages";
import PizzaRetiradaPage from "./pages/PizzaRetiradaPage";
import VoluntariadoPage from "./pages/VoluntariadoPage";
import VoluntariadoAoVivoPage, { AoVivoNoEnderecoNovo } from "./pages/VoluntariadoAoVivoPage";
import VoluntariadoCentralPage from "./pages/VoluntariadoCentralPage";
import VoluntariadoPresencaPage from "./pages/VoluntariadoPresencaPage";
import { ROTAS_DO_CANDIDATO } from "@/lib/vagas/conta";
import { destinoDaContaRestrita } from "@/lib/contasRestritas";
import CalendarioAnualPage from "./pages/CalendarioAnualPage";
import SemanarioPage from "./pages/SemanarioPage";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";



const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return null;
  // Sem exceção para `?embed=true` (13/11/2026): o que se embute no site é a
  // vitrine (`/` e `/eventos`), que não passa por aqui. Com a exceção, Painel,
  // Calendário e Visão Geral abriam sem login (vazios, mas abriam).
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Conta de candidato e conta do Calendário Anual não são equipe: cada uma
  // vai para o seu endereço (14/11/2026).
  const destino = isAuthenticated ? destinoDaContaRestrita(user) : null;
  if (destino) return <Navigate to={destino} replace />;
  return <>{children}</>;
}

/**
 * A margem das páginas que não trazem a própria (26/10/2026): a mesma moldura
 * da página inicial. Sem ela, Visão Geral, Calendário, Painel e as páginas da
 * comunicação abertas pelo endereço encostavam na borda da tela. Dentro da
 * página inicial e do Marketing elas já ganham a margem de lá.
 */
function ComMargem({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-app px-4 py-6 lg:px-8">{children}</div>;
}

/**
 * Guarda do Jornal (e do feed). Auditoria, Manual de Design, Portal da
 * Transparência e Widgets são abas do Marketing (`/marketing/…`), que barra
 * quem não é do marketing na própria página; a gestão entra só aqui.
 */
function JournalRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canAccessJournal, temSemanario, loading: roleLoading } = useUserRole();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  if (authLoading || roleLoading) return null;
  if (!isAuthenticated && !isEmbed) return <Navigate to="/login" replace />;
  // A professora e a orientadora: a Educação delas é o Semanário.
  if (!canAccessJournal && temSemanario) return <Navigate to={ROTAS.semanario} replace />;
  if (!canAccessJournal) {
    // Antes era um redirecionamento mudo. O id evita repetir se a rota renderizar duas vezes.
    toast.info('O Jornal é da Educação: da comunicação e da gestão dos CEIs e do GOE.', {
      id: 'jornal-sem-acesso',
      description: 'Você foi levado para a página inicial. Se precisa do Jornal, fale com a coordenação para liberar seu acesso.',
    });
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * O Mercado Solidário no app é só do marketing (16/11/2026). Quem mais chegar
 * ao endereço (um link antigo, o cartão no WhatsApp) vai para a vitrine
 * pública, com o mesmo conteúdo: é a que o site incorpora, e ela não muda.
 */
function MercadoRoute({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { isMarketing, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (authLoading || roleLoading) return null;
  if (!isMarketing) return <Navigate to={{ pathname: '/mercado-solidario-publico', search: location.search }} replace />;
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
    {/* Padrão "system": quem nunca escolheu segue o aparelho; quem fixou, mantém. */}
    <ThemeProvider defaultTheme="system" storageKey="anabrasil-theme">
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
                {/* "Gerar minha senha", pelo link do e-mail (19/11/2026, PR 3 das senhas). */}
                <Route path="/senha-nova" element={<SenhaNovaPage />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/mercado-solidario-publico" element={<MercadoSolidarioPublicPage />} />
                {/* Enquetes (23/09/2026): votar e acompanhar são públicos, fora
                    da barra do app, como a vitrine embutida. */}
                <Route path="/pizza-da-alegria" element={<PizzaConfirmacaoPage />} />
                {/* O dashboard da gestão (10/11/2026): link com código secreto, sem login. */}
                <Route path="/pizza-da-alegria/acompanhar/:codigo" element={<PizzaAcompanharPage />} />
                {/* A retirada com leitor de QR Code (10/11/2026): tela cheia, confere o login ela mesma. */}
                <Route path="/pizza-da-alegria/retirada" element={<PizzaRetiradaPage />} />
                {/* Voluntariado do Natal Feliz (20/10/2026): inscrição pública dos funcionários. */}
                <Route path="/voluntariado/natalfeliz26" element={<VoluntariadoPage />} />
                {/* O primeiro link divulgado (/voluntariado) leva à campanha (21/10/2026). */}
                <Route path="/voluntariado" element={<Navigate to="/voluntariado/natalfeliz26" replace />} />
                {/* O painel ao vivo da gestão (21/10/2026): link com código secreto. */}
                <Route path="/voluntariado/natalfeliz26/acompanhar/:codigo" element={<VoluntariadoAoVivoPage />} />
                <Route path="/voluntariado/acompanhar/:codigo" element={<AoVivoNoEnderecoNovo />} />
                {/* A Central do Voluntário (13/11/2026): entra com o WhatsApp da inscrição. */}
                <Route path="/voluntariado/natalfeliz26/central" element={<VoluntariadoCentralPage />} />
                <Route path="/voluntariado/natalfeliz26/central/:aba" element={<VoluntariadoCentralPage />} />
                {/* A presença na entrada (13/11/2026): leitor da credencial, só a comunicação. */}
                <Route path="/voluntariado/natalfeliz26/presenca" element={<VoluntariadoPresencaPage />} />
                <Route path="/enquete/:slug" element={<EnquetePublicaPage />} />
                <Route path="/enquete/:slug/resultado" element={<EnqueteResultadoPage />} />
                {/* Trabalhe Conosco (fase 1, 25/09/2026): vitrine pública das vagas, fora da barra do app. */}
                <Route path="/vagas" element={<VagasPage />} />
                {/* Conta do candidato (fase 2, PR 6, 28/09/2026). Endereços fixos antes do :slug, e reservados em ENDERECOS_RESERVADOS. */}
                <Route path={ROTAS_DO_CANDIDATO.entrar} element={<EntrarCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.criarConta} element={<CriarContaCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.recuperarSenha} element={<RecuperarSenhaCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.minhaArea} element={<MinhaAreaCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.privacidade} element={<PrivacidadeCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.meuPerfil} element={<MeuPerfilCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.curriculo} element={<CurriculoCandidatoPage />} />
                <Route path={ROTAS_DO_CANDIDATO.avisos} element={<AvisosCandidatoPage />} />
                <Route path={`${ROTAS_DO_CANDIDATO.minhaArea}/:id`} element={<CandidaturaDetalhePage />} />
                <Route path="/vagas/:slug/candidatar" element={<CandidaturaPage />} />
                <Route path="/vagas/:slug/candidatos" element={<CandidatosDaVagaPage />} />
                <Route path="/vagas/:slug/candidatos/:id" element={<FichaDoCandidatoPage />} />
                <Route path="/vagas/:slug" element={<VagaPage />} />
                <Route path="/portal-transparencia-publico" element={<TransparencyPublicPage />} />
                {/* Calendário Anual dos educadores (14/11/2026): fora da barra do app. As
                    coordenadoras entram com conta própria; quem é da equipe e não é do
                    marketing segue para o calendário de eventos, na aba do hub. */}
                <Route path="/social/calendario" element={<CalendarioAnualPage />} />
                {/* Semanário (17/11/2026): a página monta a própria barra, como o calendário. */}
                <Route path="/educacao/semanario" element={<SemanarioPage />} />
                <Route path="/educacao/semanario/:id" element={<SemanarioPage />} />
                {/* Endereços por setor (16/11/2026): os de antes levam aos novos,
                    com o resto do link junto. Ver REDIRECIONAMENTOS. */}
                {Object.entries(REDIRECIONAMENTOS).map(([antigo, novo]) => (
                  <Route key={antigo} path={antigo} element={<Redireciona para={novo} />} />
                ))}
                <Route element={<AppLayout />}>
                  {/* A raiz: a porta de entrada para quem chega sem sessão; para
                      quem está logado, a página inicial (17/11/2026). */}
                  <Route path="/" element={<RaizPage />} />
                  <Route path="/social/eventos" element={<EventsHubPage />} />
                  {/* Endereço próprio das Programações. Antes só redirecionava para a
                      raiz, que era onde elas viviam; com a porta de entrada na raiz,
                      elas passam a morar aqui — igualmente públicas, sem guarda. */}
                  <Route path="/eventos" element={<PublicEventsPage />} />
                  {/* Aberta a quem está logado: cada pessoa se vê aqui. Quem
                      gerencia os outros é a comunicação, e isso a própria tela
                      decide — ver `podeGerirTodos` em UsersPage. */}
                  {/* Administração › RH (18/11/2026): a gestão das vagas, que era o setor Vagas em /vagas. */}
                  <Route path="/administracao/rh" element={
                    <ProtectedRoute><AdministracaoRhPage /></ProtectedRoute>
                  } />
                  {/* Administração › Voluntariado (18/11/2026): os voluntários dos eventos. */}
                  <Route path="/administracao/voluntariado" element={
                    <ProtectedRoute><AdministracaoVoluntariadoPage /></ProtectedRoute>
                  } />
                  {/* Administração › Financeiro, Padrinhos e Parceiros (18/11/2026, PR 6). */}
                  <Route path="/administracao/financeiro" element={
                    <ProtectedRoute><AdministracaoFinanceiroPage /></ProtectedRoute>
                  } />
                  <Route path="/administracao/padrinhos" element={
                    <ProtectedRoute><AdministracaoApoiadoresPage lado="padrinhos" /></ProtectedRoute>
                  } />
                  <Route path="/administracao/parceiros" element={
                    <ProtectedRoute><AdministracaoApoiadoresPage lado="parceiros" /></ProtectedRoute>
                  } />
                  <Route path="/painel" element={
                    <ProtectedRoute><ComMargem><UsersPage /></ComMargem></ProtectedRoute>
                  } />
                  <Route path="/educacao/jornal" element={
                    <JournalRoute><JournalPage /></JournalRoute>
                  } />
                  {/* O feed dos jornais finalizados (16/11/2026): quem entra no Jornal. */}
                  <Route path="/educacao/jornais-das-unidades" element={
                    <JournalRoute><JornaisDasUnidadesPage /></JournalRoute>
                  } />

                  <Route path="/pizza-da-alegria/painel" element={
                    <ProtectedRoute><PizzaPainelPage /></ProtectedRoute>
                  } />
                  <Route path="/pizza-da-alegria/painel/dashboard" element={
                    <ProtectedRoute><PizzaDashboardPage /></ProtectedRoute>
                  } />
                  <Route path="/marketing" element={<MarketingSemAba />} />
                  <Route path="/marketing/mercado-solidario" element={
                    <MercadoRoute><MercadoSolidarioPage /></MercadoRoute>
                  } />
                  <Route path="/marketing/:aba" element={
                    <ProtectedRoute><MarketingHubPage /></ProtectedRoute>
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

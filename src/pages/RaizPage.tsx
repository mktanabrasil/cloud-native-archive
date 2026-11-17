import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROTAS } from '@/config/navigation';
import { useIsCleanView } from '@/hooks/useIsEntryGate';
import { useUserRole } from '@/hooks/useUserRole';
import { destinoDaContaRestrita } from '@/lib/contasRestritas';
import { retornoDoGoogle } from '@/lib/events/conexaoGoogle';
import EventsHubPage from '@/pages/EventsHubPage';
import InicioPage from '@/pages/InicioPage';

/** O que só os Eventos entendem: a aba do hub, o evento aberto e os filtros da programação. */
const PARAMETROS_DOS_EVENTOS = ['tela', 'slug', 'aba', 'unidade', 'como'];

/**
 * `app.anabrasil.org` (17/11/2026): para quem está logado, a página inicial.
 * Tudo o que a raiz já fazia continua com o hub dos Eventos, que sabe fazer:
 * a porta de entrada para quem chega sem sessão, a programação no embed do
 * site, a volta do Google (agenda e Drive da Pizza) e o desvio das contas de
 * candidato e do Calendário Anual.
 */
export default function RaizPage() {
  const { isAuthenticated, user } = useAuth();
  const { soSemanario, loading: carregandoPapel } = useUserRole();
  const limpa = useIsCleanView();
  const { search, hash } = useLocation();
  const voltaDoGoogle = !!retornoDoGoogle(search) || !!new URLSearchParams(search).get('state')?.startsWith('drive:');

  if (!isAuthenticated || limpa || voltaDoGoogle || destinoDaContaRestrita(user)) return <EventsHubPage />;
  // Os links de antes para os Eventos na raiz (`/?tela=calendario` dos
  // e-mails de evento, `?slug=`, os filtros da programação) seguem para eles.
  const busca = new URLSearchParams(search);
  if (PARAMETROS_DOS_EVENTOS.some(p => busca.has(p))) return <Navigate to={{ pathname: ROTAS.eventos, search, hash }} replace />;
  // A professora e a orientadora veem só o Semanário: é a página inicial delas.
  if (carregandoPapel) return null;
  if (soSemanario) return <Navigate to={ROTAS.semanario} replace />;
  return <InicioPage />;
}

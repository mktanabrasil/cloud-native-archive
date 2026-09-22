import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { retornoDoGoogle } from '@/lib/events/conexaoGoogle';
import { Globe, LayoutDashboard, Calendar, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventFormDialog from '@/components/EventFormDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useEntryGateTransition } from '@/hooks/useIsEntryGate';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PublicEventsPage from '@/pages/PublicEventsPage';
import HomePage from '@/pages/HomePage';
import Dashboard from '@/pages/Dashboard';
import CalendarPage from '@/pages/CalendarPage';
import LixeiraPage from '@/pages/LixeiraPage';

const tabs = [
  { value: 'programacoes', label: 'Programações', icon: Globe, Component: PublicEventsPage },
  { value: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard, Component: Dashboard },
  { value: 'calendario', label: 'Calendário', icon: Calendar, Component: CalendarPage },
  /* A lixeira morava dentro das Programações, atrás de um botão. É a única
     tela que apaga linha de verdade; aqui ela é uma aba, e só para admin. */
  { value: 'lixeira', label: 'Lixeira', icon: Trash2, Component: LixeiraPage, apenasAdmin: true },
];

export default function EventsHubPage() {
  const { isAuthenticated } = useAuth();
  const { isAdmin, canCreate } = useUserRole();
  const { isGate, leaving, entering } = useEntryGateTransition();
  const [novoAberto, setNovoAberto] = useState(false);
  const abas = tabs.filter(t => !t.apenasAdmin || isAdmin);
  /**
   * A aba vive na URL (`?tela=calendario`): F5 e "voltar" respeitam onde a
   * pessoa estava, e o link da aba pode ser guardado. `tela`, e não `aba`,
   * porque as Programações já usam `?aba=` para Próximos/Já aconteceram.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // O Google só devolve para a raiz (URI de redirecionamento fixo). Se veio
  // com o nosso `state`, é a conexão da agenda: segue para o Painel terminar.
  useEffect(() => {
    const retorno = retornoDoGoogle(window.location.search);
    if (retorno) navigate(`/usuarios?tab=agenda&code=${encodeURIComponent(retorno.code)}&state=${encodeURIComponent(retorno.state)}`, { replace: true });
  }, [navigate]);

  const pedida = searchParams.get('tela');
  const activeTab = abas.some(t => t.value === pedida) ? (pedida as string) : 'programacoes';
  const setActiveTab = (v: string) => {
    const params = new URLSearchParams(searchParams);
    if (v === 'programacoes') params.delete('tela');
    else params.set('tela', v);
    setSearchParams(params, { replace: true });
  };

  // Sem sessão, a raiz é a porta de entrada — salvo em embed, onde a raiz
  // continua servindo as Programações para não quebrar iframes já publicados.
  if (!isAuthenticated) {
    return isGate ? <HomePage /> : <PublicEventsPage />;
  }

  return (
    <>
      {/* Durante a saída as duas telas coexistem: a porta é uma camada fixa por
          cima, apagando, enquanto o hub já sobe por baixo. */}
      {leaving && <HomePage leaving />}

      <div
        className={cn(
          'mx-auto w-full max-w-7xl px-4 py-6 lg:px-8',
          entering && 'ana-hub-entering',
        )}
      >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Um só "Novo", ao lado das abas (22/09/2026): antes havia um em cada
            cabeçalho (Visão Geral e Calendário) e nenhum nas Programações. No
            celular a faixa de abas rola e o botão fica fixo na ponta direita. */}
        <div className="flex items-center gap-3 pb-2">
          <div className="min-w-0 flex-1 overflow-x-auto">
            {/* alvo de toque: 44px no mobile, os 32px de antes no desktop */}
            <TabsList className="h-[3.25rem] w-max md:h-10">
              {abas.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="h-11 gap-1.5 md:h-8">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {canCreate && (
            <Button onClick={() => setNovoAberto(true)} className="h-11 shrink-0 gap-2 shadow-sm md:h-10" data-testid="novo-evento">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          )}
        </div>
        {canCreate && <EventFormDialog open={novoAberto} onOpenChange={setNovoAberto} />}

        {abas.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <tab.Component />
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </>
  );
}

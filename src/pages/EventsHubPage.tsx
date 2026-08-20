import { useState } from 'react';
import { Globe, LayoutDashboard, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntryGateTransition } from '@/hooks/useIsEntryGate';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PublicEventsPage from '@/pages/PublicEventsPage';
import HomePage from '@/pages/HomePage';
import Dashboard from '@/pages/Dashboard';
import CalendarPage from '@/pages/CalendarPage';

const tabs = [
  { value: 'programacoes', label: 'Programações', icon: Globe, Component: PublicEventsPage },
  { value: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard, Component: Dashboard },
  { value: 'calendario', label: 'Calendário', icon: Calendar, Component: CalendarPage },
];

export default function EventsHubPage() {
  const { isAuthenticated } = useAuth();
  const { isGate, leaving, entering } = useEntryGateTransition();
  const [activeTab, setActiveTab] = useState('programacoes');

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
        <div className="overflow-x-auto pb-2">
          {/* alvo de toque: 44px no mobile, os 32px de antes no desktop */}
          <TabsList className="h-[3.25rem] w-max md:h-10">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-11 gap-1.5 md:h-8">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <tab.Component />
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </>
  );
}

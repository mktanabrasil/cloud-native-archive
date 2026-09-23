import { useState } from 'react';
import { History, BookOpen, FileSearch, LayoutDashboard, Lock, BarChart3 } from 'lucide-react';
import EnquetesPage from '@/pages/EnquetesPage';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AuditPage from '@/pages/AuditPage';
import DesignManualPage from '@/pages/DesignManualPage';
import TransparencyPage from '@/pages/TransparencyPage';
import AdminToolboxPage from '@/pages/AdminToolboxPage';

const tabs = [
  { value: 'auditoria', label: 'Auditoria', icon: History, Component: AuditPage },
  { value: 'design-manual', label: 'Manual Design', icon: BookOpen, Component: DesignManualPage },
  { value: 'transparencia', label: 'Portal Transparência', icon: FileSearch, Component: TransparencyPage },
  { value: 'widgets', label: 'Widgets', icon: LayoutDashboard, Component: AdminToolboxPage },
  { value: 'enquetes', label: 'Enquetes', icon: BarChart3, Component: EnquetesPage },
];

export default function MarketingHubPage() {
  const { isMarketing, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState('auditoria');

  if (loading) return null;

  if (!isMarketing) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é exclusiva para o setor de Marketing.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="h-10 w-max">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-8 gap-1.5">
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
  );
}

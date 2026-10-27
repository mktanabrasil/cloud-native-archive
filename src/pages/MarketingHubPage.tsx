import { useState } from 'react';
import { Lock } from 'lucide-react';
import { PainelDaPizza } from '@/components/pizza/PainelDaPizza';
import { PainelDoVoluntariado } from '@/components/voluntariado/PainelDoVoluntariado';
import EnquetesPage from '@/pages/EnquetesPage';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AuditPage from '@/pages/AuditPage';
import DesignManualPage from '@/pages/DesignManualPage';
import TransparencyPage from '@/pages/TransparencyPage';
import AdminToolboxPage from '@/pages/AdminToolboxPage';

const tabs = [
  { value: 'auditoria', label: 'Auditoria', Component: AuditPage },
  { value: 'design-manual', label: 'Manual Design', Component: DesignManualPage },
  { value: 'transparencia', label: 'Portal Transparência', Component: TransparencyPage },
  { value: 'widgets', label: 'Widgets', Component: AdminToolboxPage },
  { value: 'enquetes', label: 'Enquetes', Component: EnquetesPage },
  { value: 'pizza', label: 'Pizza da Alegria', Component: PainelDaPizza },
  { value: 'voluntariado', label: 'Voluntariado', Component: PainelDoVoluntariado },
];

// A areia do rodapé some no fundo claro (1,3:1); no sublinhado entra a areia forte.
const CORES_DO_RODAPE = ['#E2B979', '#fbce00', '#f37964', '#81e2cf', '#01adff'];

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
        {/* Esboço V2: sub-abas sublinhadas na cor da área (Marketing), como as do RH */}
        <div className="overflow-x-auto border-b border-border">
          <TabsList className="h-auto w-max justify-start gap-5 rounded-none bg-transparent p-0">
            {tabs.map((tab, i) => (
              /* Ajuste de 26/10: o sublinhado varia nas cores do rodapé, aba a aba */
              <TabsTrigger key={tab.value} value={tab.value} style={{ ['--sublinhado' as string]: CORES_DO_RODAPE[i % CORES_DO_RODAPE.length] }} className="-mb-px h-auto shrink-0 rounded-none border-b-[3px] border-transparent px-0 py-2.5 hover:text-foreground data-[state=active]:border-[color:var(--sublinhado)] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            <tab.Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

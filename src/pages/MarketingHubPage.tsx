import { useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { PainelDaPizza } from '@/components/pizza/PainelDaPizza';
import { PainelDoVoluntariado } from '@/components/voluntariado/PainelDoVoluntariado';
import EnquetesPage from '@/pages/EnquetesPage';
import { useUserRole } from '@/hooks/useUserRole';
import AuditPage from '@/pages/AuditPage';
import DesignManualPage from '@/pages/DesignManualPage';
import TransparencyPage from '@/pages/TransparencyPage';
import AdminToolboxPage from '@/pages/AdminToolboxPage';

const tabs = [
  { value: 'auditoria', Component: AuditPage },
  { value: 'design-manual', Component: DesignManualPage },
  { value: 'transparencia', Component: TransparencyPage },
  { value: 'widgets', Component: AdminToolboxPage },
  { value: 'enquetes', Component: EnquetesPage },
  { value: 'pizza', Component: PainelDaPizza },
  { value: 'voluntariado', Component: PainelDoVoluntariado },
];

/**
 * O setor Marketing (16/11/2026): as abas deixaram de ficar aqui dentro e
 * viraram a faixa do setor (`FaixaDoSetor`), junto com o Mercado Solidário.
 * A aba aberta é a do endereço (`?aba=pizza`), então a faixa, o voltar do
 * navegador e os links antigos (`?aba=voluntariado`) continuam valendo.
 */
export default function MarketingHubPage() {
  const { isMarketing, loading } = useUserRole();
  const [params] = useSearchParams();
  const aba = tabs.find((t) => t.value === params.get('aba')) ?? tabs[0];

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
      <aba.Component key={aba.value} />
    </div>
  );
}

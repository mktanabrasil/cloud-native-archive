import type { ComponentType } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { PainelDaPizza } from '@/components/pizza/PainelDaPizza';
import { PainelDoVoluntariado } from '@/components/voluntariado/PainelDoVoluntariado';
import { LembretesDoWhatsApp } from '@/components/lembretes/LembretesDoWhatsApp';
import EnquetesPage from '@/pages/EnquetesPage';
import { useUserRole } from '@/hooks/useUserRole';
import AuditPage from '@/pages/AuditPage';
import DesignManualPage from '@/pages/DesignManualPage';
import TransparencyPage from '@/pages/TransparencyPage';
import AdminToolboxPage from '@/pages/AdminToolboxPage';
import { ABA_INICIAL_DO_MARKETING, rotaDoMarketing, type AbaDoMarketing } from '@/config/navigation';

const ABAS: Record<AbaDoMarketing, ComponentType> = {
  auditoria: AuditPage,
  'design-manual': DesignManualPage,
  transparencia: TransparencyPage,
  widgets: AdminToolboxPage,
  enquetes: EnquetesPage,
  pizza: PainelDaPizza,
  voluntariado: PainelDoVoluntariado,
  lembretes: LembretesDoWhatsApp,
};

/**
 * O setor Marketing (16/11/2026): as abas viraram a faixa do setor
 * (`FaixaDoSetor`), junto com o Mercado Solidário, e cada uma tem o próprio
 * endereço (`/marketing/pizza`). O `/marketing?aba=pizza` de antes leva até
 * ele (`MarketingSemAba`, em App.tsx); aba desconhecida vai para a inicial.
 */
export default function MarketingHubPage() {
  const { isMarketing, loading } = useUserRole();
  const { aba } = useParams<{ aba: string }>();
  const location = useLocation();
  const Aba = aba && aba in ABAS ? ABAS[aba as AbaDoMarketing] : null;

  if (!Aba) return <Navigate to={{ pathname: rotaDoMarketing(ABA_INICIAL_DO_MARKETING), search: location.search }} replace />;
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
    <div className="mx-auto w-full max-w-app px-4 py-6 lg:px-8">
      <Aba key={aba} />
    </div>
  );
}

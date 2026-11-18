import { Navigate } from 'react-router-dom';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { PainelDaPizza } from '@/components/pizza/PainelDaPizza';

/**
 * Administração › Financeiro (18/11/2026, PR 6). Começa com o que já existe:
 * o painel da Pizza da Alegria, o mesmo do Marketing, com o mesmo critério do
 * banco (`pode_ver_pizza`: o vínculo financeiro e o marketing). O que o
 * financeiro pedir depois entra aqui.
 */
export default function AdministracaoFinanceiroPage() {
  const { temFinanceiro, loading } = useUserRole();
  useTituloDaAba('Financeiro · ANA Brasil');
  if (loading) return null;
  if (!temFinanceiro) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <PainelDaPizza />
    </div>
  );
}

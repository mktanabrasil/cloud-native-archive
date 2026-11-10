import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardDaPizza } from '@/components/pizza/DashboardDaPizza';

/**
 * As duas portas do dashboard da Pizza da Alegria (10/11/2026):
 *  - /pizza-da-alegria/painel/dashboard — a equipe do painel (comunicação e
 *    ADM/financeiro), com login, dentro do app;
 *  - /pizza-da-alegria/acompanhar/:codigo — a gestão, sem login, pelo link com
 *    código secreto que a comunicação copia no painel (sem o número do pedido).
 */

export function PizzaDashboardPage() {
  useTituloDaAba('Pizza da Alegria · Dashboard');
  const { isMarketing, bondType, isActive, loading } = useUserRole();
  const pode = isMarketing || (bondType === 'financeiro' && isActive);
  if (loading) return null;
  if (!pode) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">O dashboard da Pizza da Alegria é do ADM e da comunicação.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <DashboardDaPizza topo={
        <Link to="/pizza-da-alegria/painel" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border-[1.5px] border-[#EADBC8] bg-white px-3 text-[13px] font-semibold text-[#2B1A14]">
          <ArrowLeft className="h-4 w-4" /> Painel
        </Link>
      } />
    </div>
  );
}

export function PizzaAcompanharPage() {
  const { codigo = '' } = useParams();
  useTituloDaAba('Pizza da Alegria · Acompanhamento');
  return (
    <div className="min-h-screen bg-[#F4E7D2] px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1200px]">
        <DashboardDaPizza codigo={codigo} />
      </div>
    </div>
  );
}

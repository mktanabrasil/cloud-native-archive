import { Navigate, useSearchParams } from 'react-router-dom';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { ComprasDosEventos } from '@/components/financeiro/ComprasDosEventos';

/**
 * Administração › Financeiro (19/11/2026, PR 1 do Financeiro; mockup e
 * decisões do mesmo dia): o que a ANA compra ou cota em cada evento. A Pizza
 * da Alegria saiu daqui e ficou só no Marketing. Veem o vínculo Financeiro e o
 * marketing (o mesmo critério do banco: `eh_do_financeiro`).
 */
export default function AdministracaoFinanceiroPage() {
  const { temFinanceiro, loading } = useUserRole();
  const [params, setParams] = useSearchParams();
  const vista = params.get('tela') === 'lista' ? 'lista' : 'eventos';
  useTituloDaAba(`${vista === 'lista' ? 'Lista do mês' : 'Compras dos eventos'} · ANA Brasil`);
  if (loading) return null;
  if (!temFinanceiro) return <Navigate to="/" replace />;

  const ir = (v: 'eventos' | 'lista') => {
    const n = new URLSearchParams(params);
    if (v === 'eventos') n.delete('tela'); else n.set('tela', v);
    setParams(n, { replace: true });
  };
  return (
    <div className="pb-16">
      <nav aria-label="Financeiro: abas" className="mt-1">
        <div className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto border-b border-border px-4 sm:px-6">
          {([['Por evento', 'eventos'], ['Lista do mês', 'lista']] as const).map(([rotulo, v]) => (
            <button key={v} type="button" aria-current={vista === v ? 'page' : undefined} onClick={() => ir(v)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm ${vista === v ? 'border-[#81e2cf] font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}`}>
              {rotulo}
            </button>
          ))}
        </div>
      </nav>
      <ComprasDosEventos vista={vista} />
    </div>
  );
}

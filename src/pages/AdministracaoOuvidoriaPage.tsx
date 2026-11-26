import { Navigate } from 'react-router-dom';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { OuvidoriaNoSite } from '@/components/ouvidoria/OuvidoriaNoSite';

/**
 * Administração › Ouvidoria (26/11/2026, mockup aprovado): a ligação do
 * formulário da página Ouvidoria do site com o e-mail da ouvidoria. Só o
 * cartão da API; as mensagens chegam por e-mail e nunca aparecem no app.
 * Veem a administração (RH/admin) e o marketing (o mesmo critério da função).
 */
export default function AdministracaoOuvidoriaPage() {
  const { temOuvidoria, loading } = useUserRole();
  useTituloDaAba('Ouvidoria · ANA Brasil');
  if (loading) return null;
  if (!temOuvidoria) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto w-full max-w-app space-y-4 px-4 pb-16 pt-6 lg:px-8">
      <div>
        <h1 className="font-display text-[26px] font-semibold text-foreground">Ouvidoria</h1>
        <p className="text-[14px] text-muted-foreground">O formulário da página Ouvidoria do site. As mensagens chegam só por e-mail; aqui fica a ligação com o site.</p>
      </div>
      <OuvidoriaNoSite />
    </div>
  );
}

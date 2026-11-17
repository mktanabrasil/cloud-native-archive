import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { FichaDoSemanario } from '@/components/semanario/FichaDoSemanario';
import { ListaDaProfessora } from '@/components/semanario/ListaDaProfessora';
import { ListaDaUnidade } from '@/components/semanario/ListaDaUnidade';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ehContaRestrita } from '@/lib/contasRestritas';

/**
 * /educacao/semanario (17/11/2026): o planejamento da semana das professoras
 * dos CEIs e do GOE, no modelo da Orientação Pedagógica.
 *
 * - A professora: os semanários dela e o preenchimento.
 * - A orientadora pedagógica: os do CEI dela, para ler (a devolutiva chega
 *   num próximo passo).
 * - O marketing: todos, só leitura.
 * - Mais ninguém: volta para a página inicial, com um aviso.
 *
 * `/educacao/semanario/:id` abre um semanário. Quem pode ler cada um é o
 * banco que decide (RLS).
 */
export default function SemanarioPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const { isMarketing, isProfessora, isOrientadora, temSemanario, unit, loading: carregandoPapel } = useUserRole();
  const { id } = useParams();
  const location = useLocation();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (ehContaRestrita(user)) return <Navigate to="/" replace />;
  if (carregandoPapel) return null;
  if (!temSemanario) return <SemAcesso />;

  const professora = isProfessora && !isMarketing;
  // A orientadora escreve a devolutiva dos semanários do CEI dela (o banco confere de novo).
  const mesmaUnidade = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
  const podeDevolver = (s: { unidade: string }) => !!isOrientadora && !isMarketing && mesmaUnidade(unit, s.unidade);
  return (
    <AppLayout>
      <TituloDaAba />
      {id
        ? <FichaDoSemanario key={id} id={id} souADona={s => !!user && s.professora_id === user.id} podeDevolver={podeDevolver} />
        : professora
          ? <ListaDaProfessora professoraId={user!.id} />
          : <ListaDaUnidade titulo={isOrientadora && !isMarketing ? `Semanários · ${unit || 'CEI'}` : 'Semanários das unidades'} marketing={isMarketing} podeDevolver={podeDevolver} pedidos={isOrientadora && !isMarketing} />}
    </AppLayout>
  );
}

function SemAcesso() {
  useEffect(() => {
    toast.info('O Semanário é das professoras e da orientação pedagógica dos CEIs.', {
      id: 'semanario-sem-acesso',
      description: 'Você foi levado para a página inicial. Se precisa dele, fale com a coordenação.',
    });
  }, []);
  return <Navigate to="/" replace />;
}

function TituloDaAba() {
  useEffect(() => {
    const antes = document.title;
    document.title = 'Semanário · ANA Brasil';
    return () => { document.title = antes; };
  }, []);
  return null;
}

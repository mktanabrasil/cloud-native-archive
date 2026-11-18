import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ehCandidato } from '@/lib/vagas/conta';
import { vejoApoiadores } from '@/lib/administracao/apoiadoresApi';

/**
 * Se a pessoa vê Padrinhos e Parceiros (18/11/2026, PR 6): o financeiro, o
 * marketing e quem a administração liberou pelo e-mail. O banco responde
 * (`vejo_apoiadores`), porque a lista de e-mails não sai dele. `carregado`:
 * a resposta já chegou (antes disso, ninguém é mandado embora).
 */
export function useApoiadores(): { vejo: boolean; carregado: boolean } {
  const { user, isAuthenticated, loading } = useAuth();
  const [estado, setEstado] = useState<{ id: string | null; vejo: boolean } | null>(null);
  const id = isAuthenticated && user && !ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!id) { setEstado({ id: null, vejo: false }); return; }
    let vivo = true;
    vejoApoiadores().then(
      (vejo) => { if (vivo) setEstado({ id, vejo }); },
      () => { if (vivo) setEstado({ id, vejo: false }); },
    );
    return () => { vivo = false; };
  }, [id]);
  const atual = !!estado && estado.id === id;
  // Simulando outra pessoa (modo de teste), vale o papel simulado: o financeiro
  // e o marketing veem; a lista de e-mails liberados não se simula.
  const { activePersona } = useTestView();
  const { temFinanceiro, loading: carregandoPapel } = useUserRole();
  if (activePersona) return { vejo: !!temFinanceiro, carregado: !carregandoPapel };
  return { vejo: atual ? estado!.vejo : false, carregado: !loading && atual };
}

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ehCandidato } from '@/lib/vagas/conta';
import { vejoApoiadores } from '@/lib/administracao/apoiadoresApi';

/**
 * Se a pessoa vê Padrinhos e Parceiros (18/11/2026, PR 6): o marketing, os
 * vínculos Padrinhos e Parceiros e quem a administração liberou pelo e-mail
 * (o Financeiro saiu em 23/11/2026). O banco responde
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
  // Simulando outra pessoa (modo de teste), vale o papel simulado: o marketing
  // e os vínculos Padrinhos e Parceiros veem; a lista de e-mails não se simula.
  const { activePersona } = useTestView();
  const { isMarketing, bondType, loading: carregandoPapel } = useUserRole();
  if (activePersona) return { vejo: !!isMarketing || bondType === 'padrinhos' || bondType === 'parceiros', carregado: !carregandoPapel };
  return { vejo: atual ? estado!.vejo : false, carregado: !loading && atual };
}

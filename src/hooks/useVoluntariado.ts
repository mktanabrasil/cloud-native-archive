import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ehCandidato } from '@/lib/vagas/conta';
import { vejoVoluntariado } from '@/lib/voluntariado/acessoApi';

/**
 * Se a pessoa vê Administração › Voluntariado (23/11/2026): o vínculo
 * Voluntariado, o marketing ou quem a administração geral liberou pelo e-mail.
 * O vínculo e o marketing já respondem na hora; a lista só o banco sabe
 * (`vejo_voluntariado`). `carregado`: a resposta já chegou.
 */
export function useVoluntariado(): { vejo: boolean; carregado: boolean } {
  const { user, isAuthenticated, loading } = useAuth();
  const { temVoluntariado, loading: carregandoPapel } = useUserRole();
  const { activePersona } = useTestView();
  const [estado, setEstado] = useState<{ id: string | null; vejo: boolean } | null>(null);
  const id = isAuthenticated && user && !ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!id) { setEstado({ id: null, vejo: false }); return; }
    let vivo = true;
    vejoVoluntariado().then(
      (vejo) => { if (vivo) setEstado({ id, vejo }); },
      () => { if (vivo) setEstado({ id, vejo: false }); },
    );
    return () => { vivo = false; };
  }, [id]);
  // Simulando outra pessoa (modo de teste), vale o papel simulado: a lista não se simula.
  if (activePersona) return { vejo: !!temVoluntariado, carregado: !carregandoPapel };
  if (temVoluntariado) return { vejo: true, carregado: !carregandoPapel };
  const atual = !!estado && estado.id === id;
  return { vejo: atual ? estado!.vejo : false, carregado: !loading && !carregandoPapel && atual };
}

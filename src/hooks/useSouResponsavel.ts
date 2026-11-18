import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ehCandidato } from '@/lib/vagas/conta';

/**
 * Se a pessoa da equipe é responsável por algum processo seletivo aberto
 * (passo 3, 19/10/2026), e se a resposta já chegou. Quem é, mesmo sem ser RH,
 * vê a Administração no menu e a aba "Meus processos". Candidato nunca é.
 *
 * `carregado` (18/11/2026): a página do RH só manda embora quem não é RH
 * depois da resposta; antes, o responsável seria levado ao portal no meio
 * segundo em que `sou` ainda é falso.
 */
export function useResponsavel(): { sou: boolean; carregado: boolean } {
  const { user, isAuthenticated, loading } = useAuth();
  const [estado, setEstado] = useState<{ id: string | null; sou: boolean } | null>(null);
  const id = isAuthenticated && user && !ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!id) { setEstado({ id: null, sou: false }); return; }
    let vivo = true;
    supabase.rpc('sou_responsavel_por_alguma_vaga').then(
      ({ data }) => { if (vivo) setEstado({ id, sou: data === true }); },
      () => { if (vivo) setEstado({ id, sou: false }); },
    );
    return () => { vivo = false; };
  }, [id]);
  const atual = !!estado && estado.id === id;
  return { sou: atual ? estado!.sou : false, carregado: !loading && atual };
}

/** Só o sim ou não (o menu, a página inicial e as Vagas usam assim). */
export function useSouResponsavel(): boolean {
  return useResponsavel().sou;
}

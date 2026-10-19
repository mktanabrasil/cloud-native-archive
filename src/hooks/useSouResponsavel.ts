import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ehCandidato } from '@/lib/vagas/conta';

/**
 * Se a pessoa da equipe é responsável por algum processo seletivo aberto
 * (passo 3, 19/10/2026). Quem é, mesmo sem ser RH, vê "Vagas" no menu e a
 * aba "Meus processos". Candidato nunca é.
 */
export function useSouResponsavel(): boolean {
  const { user, isAuthenticated } = useAuth();
  const [sou, setSou] = useState(false);
  const id = isAuthenticated && user && !ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!id) { setSou(false); return; }
    let vivo = true;
    supabase.rpc('sou_responsavel_por_alguma_vaga').then(({ data }) => { if (vivo) setSou(data === true); }, () => { if (vivo) setSou(false); });
    return () => { vivo = false; };
  }, [id]);
  return sou;
}

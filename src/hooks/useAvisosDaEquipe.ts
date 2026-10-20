import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * A bolinha em "Vagas" no menu da equipe (passo 5, 20/10/2026): candidatos
 * novos que ninguém abriu + respostas de candidatos ainda não lidas. O banco
 * só entrega o que a pessoa enxerga (o RH, tudo; o responsável, só as vagas
 * dele). `chave` refaz a conta (ex.: ao trocar de página).
 */
export function useAvisosDaEquipe(ativo: boolean, chave?: string): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ativo) { setN(0); return; }
    let vivo = true;
    Promise.all([
      supabase.from('candidaturas').select('id', { count: 'exact', head: true }).is('aberta_em', null).is('retirada_em', null),
      supabase.from('candidatura_mensagens').select('id', { count: 'exact', head: true }).eq('autor', 'candidato').is('lida_em', null),
    ]).then(([a, b]) => { if (vivo) setN((a.count ?? 0) + (b.count ?? 0)); }, () => null);
    return () => { vivo = false; };
  }, [ativo, chave]);
  return n;
}

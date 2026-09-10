import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { PercursoId } from '@/lib/journal/tutorial';

/**
 * Quais tutoriais a pessoa já viu — por conta, em qualquer computador.
 *
 * Até 08/09/2026 a marca morava no localStorage. Em outro computador, ou num
 * navegador que não guarda dados do site, o tutorial abria de novo a cada
 * visita; e como a página remontava ao voltar de outra aba (corrigido no
 * #93), quem trocava de aba com o tutorial aberto o via recomeçar sem nunca
 * ficar marcado. Agora a marca é uma linha em `tutoriais_vistos`, só dela.
 *
 * `carregado` diz quando a lista chegou: quem decide abrir o tutorial espera
 * por ele, senão abriria para todo mundo no meio segundo antes da resposta.
 * Sem sessão (persona de teste, visitante) não há o que consultar: fica tudo
 * em memória e o tutorial se comporta como antes.
 */
export function useTutoriaisVistos() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [vistos, setVistos] = useState<Set<PercursoId>>(() => new Set());
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregado(false);
    setVistos(new Set());
    if (!userId) {
      setCarregado(true);
      return;
    }
    supabase
      .from('tutoriais_vistos')
      .select('percurso')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelado) return;
        setVistos(new Set((data ?? []).map(l => l.percurso as PercursoId)));
        setCarregado(true);
      });
    return () => { cancelado = true; };
  }, [userId]);

  const jaViu = useCallback((percurso: PercursoId) => vistos.has(percurso), [vistos]);

  /** Marca na hora, na tela, e grava em seguida. Se a gravação falhar, a marca fica só nesta visita. */
  const marcarVisto = useCallback((percurso: PercursoId) => {
    setVistos(prev => {
      if (prev.has(percurso)) return prev;
      const novo = new Set(prev);
      novo.add(percurso);
      return novo;
    });
    if (!userId) return;
    void supabase
      .from('tutoriais_vistos')
      .upsert({ user_id: userId, percurso }, { onConflict: 'user_id,percurso', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.warn('Não deu para guardar o tutorial como visto:', error.message);
      });
  }, [userId]);

  /** Faz os tutoriais voltarem a abrir sozinhos. Serve para demonstrar a alguém. */
  const esquecer = useCallback(() => {
    setVistos(new Set());
    if (!userId) return;
    void supabase.from('tutoriais_vistos').delete().eq('user_id', userId);
  }, [userId]);

  return { carregado, jaViu, marcarVisto, esquecer };
}

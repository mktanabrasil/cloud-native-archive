import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Tutoriais de primeiro acesso. A chave identifica a tela, e não um sim/não,
 * para o mesmo mecanismo servir a outras telas depois.
 */
export type TutorialKey = 'jornal';

/**
 * Controla se um tutorial já foi visto por *este* usuário.
 *
 * A marca fica no banco, e não no navegador: `localStorage` é por máquina, e a
 * mesma diretora veria tudo de novo em outro computador — ou perderia a marca
 * ao limpar o cache.
 *
 * `pronto` existe para o tutorial não piscar na tela: enquanto a consulta não
 * volta, não dá para saber se é a primeira visita, e abrir para fechar em
 * seguida seria pior do que esperar.
 */
export function useTutorial(key: TutorialKey) {
  const { user } = useAuth();
  const [jaViu, setJaViu] = useState(true);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;

    if (!user) {
      setJaViu(true);
      setPronto(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('user_tutorials')
        .select('tutorial')
        .eq('user_id', user.id)
        .eq('tutorial', key)
        .maybeSingle();

      if (!ativo) return;

      // Falha de leitura conta como "já viu". O tutorial é um extra: se a
      // tabela ainda não existe no ambiente, ou a consulta cai, o certo é ele
      // não aparecer — nunca abrir em laço na cara de quem só quer trabalhar.
      setJaViu(error ? true : !!data);
      setPronto(true);
    })();

    return () => {
      ativo = false;
    };
  }, [user, key]);

  /**
   * Grava a marca e fecha. `ignoreDuplicates` cobre quem reabre pelo botão de
   * ajuda e termina de novo: a segunda gravação vira ON CONFLICT DO NOTHING,
   * sem precisar de permissão de UPDATE.
   */
  const marcarVisto = useCallback(async () => {
    setJaViu(true);
    if (!user) return;
    await supabase
      .from('user_tutorials')
      .upsert(
        { user_id: user.id, tutorial: key },
        { onConflict: 'user_id,tutorial', ignoreDuplicates: true },
      );
  }, [user, key]);

  return { jaViu, pronto, marcarVisto };
}

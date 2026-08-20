import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsEmbedded } from '@/hooks/useIsEmbedded';

/** Quanto tempo a porta fica em cena depois de a sessão chegar. Espelha `.ana-gate-leaving`. */
export const GATE_EXIT_MS = 260;

/** Janela em que o app entra em cena. Espelha `.ana-hub-entering` (180 ms + 360 ms). */
export const HUB_ENTER_MS = 540;

/**
 * A raiz está servindo a porta de entrada?
 *
 * Verdadeiro só quando as três condições valem ao mesmo tempo: a rota é `/`,
 * não há sessão, e a página não está sendo consumida como embed. A última
 * condição é o que preserva os iframes já publicados das Programações — neles
 * a raiz continua entregando exatamente o que entregava antes.
 *
 * `EventsHubPage` usa isto para decidir o que renderizar e `AppLayout` para
 * esconder o cromo: menu de navegação sem sessão não tem o que oferecer. Por
 * isso a regra mora aqui, e não duplicada nos dois.
 */
export function useIsEntryGate(): boolean {
  const { isAuthenticated, loading } = useAuth();
  const isEmbedded = useIsEmbedded();
  const location = useLocation();

  const isCleanView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (
      isEmbedded ||
      params.get('embed') === 'true' ||
      params.get('hideHeader') === 'true' ||
      params.get('hideLogin') === 'true' ||
      params.get('hideFooter') === 'true' ||
      params.get('hideTitle') === 'true'
    );
  }, [isEmbedded, location.search]);

  return !loading && !isAuthenticated && !isCleanView && location.pathname === '/';
}

export interface EntryGateTransition {
  /** A porta é o conteúdo da rota agora. */
  isGate: boolean;
  /** A sessão chegou e a porta ainda está saindo de cena. */
  leaving: boolean;
  /** A porta acabou de fechar e o app está entrando. */
  entering: boolean;
}

/**
 * A porta mais o momento em que ela dá lugar ao app.
 *
 * O `isAuthenticated` vira `true` no instante em que o Supabase responde, e sem
 * isto o React desmontaria a porta no mesmo quadro — a animação de saída não
 * teria tempo de existir. `leaving` segura a porta em cena pela duração dela, e
 * `entering` marca a janela em que o app e o cabeçalho entram.
 *
 * Cada componente chama o hook por conta própria: os dois observam a mesma
 * transição e chegam à mesma conclusão, sem precisar de estado compartilhado.
 */
export function useEntryGateTransition(): EntryGateTransition {
  const isGate = useIsEntryGate();
  const [leaving, setLeaving] = useState(false);
  const [entering, setEntering] = useState(false);
  const eraPorta = useRef(isGate);

  useEffect(() => {
    const fechou = eraPorta.current && !isGate;
    eraPorta.current = isGate;
    if (!fechou) return;

    setLeaving(true);
    setEntering(true);
    const saida = setTimeout(() => setLeaving(false), GATE_EXIT_MS);
    const entrada = setTimeout(() => setEntering(false), HUB_ENTER_MS);
    return () => {
      clearTimeout(saida);
      clearTimeout(entrada);
    };
  }, [isGate]);

  return { isGate, leaving, entering };
}

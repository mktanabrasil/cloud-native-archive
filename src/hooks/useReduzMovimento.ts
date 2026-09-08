import { useEffect, useState } from 'react';

/**
 * Se a pessoa pediu menos movimento ao sistema (`prefers-reduced-motion`).
 *
 * O carrossel da página pública trocava de slide sozinho para todo mundo. Quem
 * tem enjoo de movimento ou usa leitor de tela não deveria ter de correr atrás
 * dele; com a preferência ligada, ele fica parado e só as setas movem.
 */
export function useReduzMovimento(): boolean {
  const [reduz, setReduz] = useState(() => lerPreferencia());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aoMudar = (e: MediaQueryListEvent) => setReduz(e.matches);
    media.addEventListener?.('change', aoMudar);
    return () => media.removeEventListener?.('change', aoMudar);
  }, []);

  return reduz;
}

const lerPreferencia = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

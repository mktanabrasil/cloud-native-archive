import { useEffect, useState } from 'react';

/**
 * A tela é larga (a partir do `lg` do Tailwind, 1024 px)? No Semanário a folha
 * e o painel lateral só são montados nela: no celular eles nem são desenhados,
 * para não gerar PDF à toa (17/11/2026).
 */
export function useTelaLarga(consulta = '(min-width: 1024px)') {
  const [larga, setLarga] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return;
    const mudar = () => setLarga(mq.matches);
    mudar();
    mq.addEventListener?.('change', mudar);
    return () => mq.removeEventListener?.('change', mudar);
  }, [consulta]);
  return larga;
}

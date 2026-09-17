import { useEffect, useState } from 'react';

/**
 * O aparelho é de toque (dedo, sem mouse)?
 *
 * `pointer: coarse` é o que o navegador diz sobre o ponteiro principal: um
 * celular ou tablet responde sim; um notebook com tela sensível ao toque mas
 * mouse ligado responde não. Existe separado de `useIsCompact` porque o
 * problema aqui não é largura: um tablet deitado tem 1024px e ainda assim não
 * tem hover nem precisão para um alvo de 24px (varredura de 16/09/2026).
 */
export function useToque() {
  const [toque, setToque] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia('(pointer: coarse)');
    const atualizar = () => setToque(!!consulta.matches);
    atualizar();
    consulta.addEventListener?.('change', atualizar);
    return () => consulta.removeEventListener?.('change', atualizar);
  }, []);

  return toque;
}

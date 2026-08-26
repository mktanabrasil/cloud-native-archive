import { useEffect, useState } from 'react';

/**
 * O mesmo `lg` do Tailwind (1024px).
 *
 * Casado de propósito com o breakpoint em que o editor do Jornal troca de uma
 * coluna para três: abaixo dele não cabem canvas e painel lado a lado, e é
 * exatamente aí que a navegação por abas precisa entrar. Se um mudar, o outro
 * tem de mudar junto — daí a constante estar nomeada, e não solta no JSX.
 */
const COMPACT_BREAKPOINT = 1024;

/**
 * A tela é estreita demais para o layout de três colunas?
 *
 * Existe separado de `useIsMobile` (768px) porque o problema aqui não é ser
 * celular: um tablet em pé tem 810px e também não comporta as três colunas.
 */
export function useIsCompact() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
    const atualizar = () => setCompact(consulta.matches);
    atualizar();
    consulta.addEventListener('change', atualizar);
    return () => consulta.removeEventListener('change', atualizar);
  }, []);

  return compact;
}

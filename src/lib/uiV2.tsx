import { createContext, useContext, type ReactNode } from 'react';

/**
 * Interface V2 (vidro), 26/10/2026.
 *
 * Só as telas dentro do app (AppLayout, molduras de Vagas e da conta do
 * candidato) ligam a V2. Fora delas — os embeds que o site já usa (Programação,
 * Mercado Solidário, Portal da Transparência), as páginas de campanha e as
 * páginas públicas soltas — os componentes desenham exatamente como antes.
 * O contexto atravessa os portais do Radix, então janelas e menus abertos
 * dentro do app também ficam na V2.
 */
const UiV2Context = createContext(false);

export const useUiV2 = () => useContext(UiV2Context);

export function UiV2({ children, ligada = true }: { children: ReactNode; ligada?: boolean }) {
  return <UiV2Context.Provider value={ligada}>{children}</UiV2Context.Provider>;
}

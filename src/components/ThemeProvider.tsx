import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * O tema do app: claro, escuro, ou o que o aparelho pedir.
 *
 * Até 10/09/2026 o app nascia em "claro" e, no modo "sistema", lia a
 * preferência do aparelho uma vez só, ao carregar. Quem tinha o celular no
 * escuro via o app claro; quem trocava o tema do aparelho com o app aberto
 * não via nada mudar até recarregar. Agora o padrão é "sistema", e nesse modo
 * o app ouve a mudança de preferência e troca na hora.
 *
 * `theme` é a escolha da pessoa (guardada no navegador); `resolvedTheme` é o
 * que está na tela de fato — no modo sistema, o que o aparelho pediu.
 */
export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * A cor da barra do navegador no celular (`<meta name="theme-color">`), uma
 * por tema. São o `--background` de cada um, em hexadecimal, porque a meta
 * não lê variáveis de CSS. Ficava sempre verde-água, mesmo no escuro.
 */
const COR_DA_BARRA: Record<ResolvedTheme, string> = { light: "#f8f6f3", dark: "#191b1a" };

const CONSULTA_DO_SISTEMA = "(prefers-color-scheme: dark)";

const lerSistema = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia?.(CONSULTA_DO_SISTEMA).matches ? "dark" : "light";

const lerGuardado = (chave: string, padrao: Theme): Theme => {
  try {
    const v = localStorage.getItem(chave);
    return v === "dark" || v === "light" || v === "system" ? v : padrao;
  } catch {
    return padrao;
  }
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => lerGuardado(storageKey, defaultTheme));
  const [sistema, setSistema] = useState<ResolvedTheme>(lerSistema);

  // No modo sistema, acompanha o aparelho em tempo real: o horário automático
  // do celular e a troca manual no desktop.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(CONSULTA_DO_SISTEMA);
    setSistema(media.matches ? "dark" : "light");
    const aoMudar = (e: MediaQueryListEvent) => setSistema(e.matches ? "dark" : "light");
    media.addEventListener?.("change", aoMudar);
    return () => media.removeEventListener?.("change", aoMudar);
  }, [theme]);

  const resolvedTheme: ResolvedTheme = theme === "system" ? sistema : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COR_DA_BARRA[resolvedTheme]);
  }, [resolvedTheme]);

  const value = useMemo<ThemeProviderState>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (novo: Theme) => {
        try {
          localStorage.setItem(storageKey, novo);
        } catch {
          /* sem armazenamento: vale só nesta visita */
        }
        setThemeState(novo);
      },
    }),
    [theme, resolvedTheme, storageKey],
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- o hook mora junto do provedor, como no shadcn
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

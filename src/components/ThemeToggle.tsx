import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

/**
 * O botão de tema, em três estados visíveis.
 *
 * Antes ele girava claro → escuro → sistema, mas só mostrava sol ou lua:
 * ninguém sabia que estava em "sistema", nem o que o sistema estava fazendo.
 * Agora cada estado tem o seu ícone — sol, lua, monitor — e o nome do modo
 * para quem usa leitor de tela. O rótulo diz também para onde o próximo
 * clique leva.
 */
const PROXIMO: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
const NOME: Record<Theme, string> = { light: "claro", dark: "escuro", system: "seguindo o aparelho" };

/**
 * O botão de tema flutuando no canto de baixo, em todo o app (pedido de
 * 27/10/2026: era assim antes da V2 e assim continua). No celular ele não
 * aparece: ali vale o tema do aparelho (ver ThemeProvider). No tablet, com a
 * doca embaixo, ela se marca com `data-barra-de-baixo` e o botão sobe para
 * cima dela — a regra está no index.css (`.tema-flutuante`).
 */
export function TemaFlutuante() {
  return (
    <div className="tema-flutuante fixed right-[calc(1.5rem+env(safe-area-inset-right))] z-30 max-md:hidden print:hidden">
      <ThemeToggle className="shadow-[0_4px_16px_hsl(165_30%_12%/0.12)]" />
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const proximo = PROXIMO[theme];
  const rotulo = `Tema ${NOME[theme]}${theme === "system" ? ` (${resolvedTheme === "dark" ? "escuro" : "claro"})` : ""}. Mudar para ${NOME[proximo]}.`;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(proximo)}
      aria-label={rotulo}
      title={rotulo}
      data-theme-mode={theme}
      className={cn("w-10 h-10 rounded-full border-primary/20 bg-background/50 backdrop-blur-sm", className)}
    >
      {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
      {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
      {theme === "system" && <Monitor className="h-[1.2rem] w-[1.2rem]" />}
    </Button>
  );
}

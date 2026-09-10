import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

/**
 * O tema segue o aparelho: padrão "sistema", acompanha a mudança em tempo
 * real, e o botão diz em que modo está.
 */
type Ouvinte = (e: { matches: boolean }) => void;
const sistema = { escuro: false, ouvintes: [] as Ouvinte[] };

beforeEach(() => {
  localStorage.clear();
  sistema.escuro = false;
  sistema.ouvintes = [];
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("dark") && sistema.escuro,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, cb: Ouvinte) => { sistema.ouvintes.push(cb); },
    removeEventListener: (_: string, cb: Ouvinte) => { sistema.ouvintes = sistema.ouvintes.filter(o => o !== cb); },
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
  document.head.innerHTML = '<meta name="theme-color" content="#7ee0c2">';
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.className = "";
});

const aparelhoMuda = (escuro: boolean) => {
  sistema.escuro = escuro;
  act(() => sistema.ouvintes.forEach(o => o({ matches: escuro })));
};
const classe = () => document.documentElement.classList.contains("dark") ? "dark" : "light";
const barra = () => document.querySelector('meta[name="theme-color"]')!.getAttribute("content");
const montar = () => render(<ThemeProvider defaultTheme="system" storageKey="teste-tema"><ThemeToggle /></ThemeProvider>);

describe("seguir o aparelho", () => {
  it("sem escolha guardada, nasce no tema do aparelho", () => {
    sistema.escuro = true;
    montar();

    expect(classe()).toBe("dark");
    expect(barra()).toBe("#191b1a");
    expect(screen.getByRole("button", { name: /seguindo o aparelho \(escuro\)/i })).toBeInTheDocument();
  });

  it("acompanha a troca do aparelho em tempo real, sem recarregar", () => {
    montar();
    expect(classe()).toBe("light");

    aparelhoMuda(true);
    expect(classe()).toBe("dark");

    aparelhoMuda(false);
    expect(classe()).toBe("light");
    expect(barra()).toBe("#f8f6f3");
  });

  it("quem fixou um tema não é afetado pelo aparelho", () => {
    localStorage.setItem("teste-tema", "light");
    sistema.escuro = true;
    montar();

    expect(classe()).toBe("light");
    aparelhoMuda(false);
    aparelhoMuda(true);
    expect(classe()).toBe("light");
  });
});

describe("o botão", () => {
  it("gira claro → escuro → sistema, com o nome de cada modo, e guarda a escolha", () => {
    localStorage.setItem("teste-tema", "light");
    montar();

    const botao = () => screen.getByRole("button", { name: /^tema/i });
    expect(botao().dataset.themeMode).toBe("light");

    fireEvent.click(botao());
    expect(botao().dataset.themeMode).toBe("dark");
    expect(classe()).toBe("dark");
    expect(localStorage.getItem("teste-tema")).toBe("dark");

    fireEvent.click(botao());
    expect(botao().dataset.themeMode).toBe("system");
    expect(botao()).toHaveAccessibleName(/seguindo o aparelho/i);

    fireEvent.click(botao());
    expect(botao().dataset.themeMode).toBe("light");
  });
});

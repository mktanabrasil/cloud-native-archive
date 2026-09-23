import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // O formulário de evento tem ~2300 linhas e os testes dele disparam
    // dezenas de interações; alguns levam 5 a 7 s numa máquina comum. Com os
    // 5 s padrão, passavam ou não conforme a carga (22 e 23/09/2026).
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

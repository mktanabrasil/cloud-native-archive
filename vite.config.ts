import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import type { Plugin } from "vite";
import { CARTOES_DE_LINK, comCartao } from "./src/lib/cartoesDeLink";

// No build, o index.html ganha cópias com o cartão de link das enquetes
// (enquete.html, enquete-resultado.html). O .htaccess manda /enquete/... para
// elas, e o WhatsApp mostra "Enquete" em vez da programação de eventos.
// Ver src/lib/cartoesDeLink.ts (25/09/2026).
const cartoesDeLink = (): Plugin => ({
  name: "cartoes-de-link",
  apply: "build",
  // Depois de gravado: o index.html final (com os scripts do build) só
  // existe aqui.
  writeBundle(opcoes) {
    const pasta = opcoes.dir ?? path.resolve(__dirname, "dist");
    const html = fs.readFileSync(path.join(pasta, "index.html"), "utf8");
    for (const c of CARTOES_DE_LINK) fs.writeFileSync(path.join(pasta, c.arquivo), comCartao(html, c));
  },
});

// O mcpPlugin regenera supabase/functions/mcp/index.ts a cada dev/build, mas
// corrompe o arquivo no Windows. O teste de caminho local do plugin é
// POSIX-only — `p.startsWith(".") || p.startsWith("/")` — e não reconhece
// `C:\...`, então o entry absoluto é classificado como nome de pacote npm e
// externalizado: o bundle vira `import mcp from "npm:C:\\Users\\..."`, um
// caminho da máquina local que não resolve no Deno do Supabase. Publicado
// assim, a Edge Function `mcp` quebra.
//
// Presente em @lovable.dev/mcp-js 0.22.2 e ainda em 0.26.2, então atualizar
// não resolve. Em Linux/macOS o plugin funciona: a regeneração segue ativa no
// Lovable e no Cloudflare Pages, que são quem de fato mantém o arquivo em dia.
// No Windows, edições em src/lib/mcp/ precisam ser regeneradas nesses
// ambientes — nunca localmente.
const mcpPluginSupported = process.platform !== "win32";

// Detect deploy environment + commit
// Cloudflare Pages exposes CF_PAGES, CF_PAGES_COMMIT_SHA, CF_PAGES_BRANCH
// Lovable / local fall back to a timestamp.
const commitSha =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.VITE_COMMIT_SHA ||
  process.env.COMMIT_SHA ||
  `dev-${Date.now()}`;

const environment = (() => {
  if (process.env.CF_PAGES === "1") {
    return process.env.CF_PAGES_BRANCH === "main" || process.env.CF_PAGES_BRANCH === "master"
      ? "cloudflare-production"
      : "cloudflare-preview";
  }
  if (process.env.LOVABLE === "1" || process.env.VITE_LOVABLE) return "lovable";
  return process.env.VITE_ENVIRONMENT || "lovable";
})();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPluginSupported && mcpPlugin(),
    cartoesDeLink(),
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(commitSha),
    __APP_ENV__: JSON.stringify(environment),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));

# Deploy & Sistema de Versões (Beta/Produção)

O sistema de Beta funciona **independente da hospedagem**. Ele usa a tabela `ui_versions` no Supabase como fonte única da verdade.

## Como funciona

- Cada deploy registra uma linha em `ui_versions` com `commit_sha` + `environment`.
- A coluna `is_active_beta` define o que **Beta Testers** vêem.
- A coluna `is_active_production` define o que **todos** vêem.
- Triggers garantem que só existe uma versão ativa por categoria.
- O frontend lê esses campos via `useActiveVersion()`.

## Lovable Hosting

Continua funcionando como hoje. Quando você clica em **Publicar** no painel admin (aba Beta/Histórico), uma nova linha em `ui_versions` é criada e marcada como ativa.

## Cloudflare Pages

### 1. Conectar o repositório GitHub à Cloudflare Pages

Build command: `bun run build` · Output: `dist`

### 2. Subdomínio

Configure `sistema.seudominio.org` em **Pages → Custom domains**.

### 3. Variáveis injetadas no build (já configuradas no `vite.config.ts`)

- `CF_PAGES_COMMIT_SHA` → vira `__APP_VERSION__`
- `CF_PAGES_BRANCH` → define ambiente (`cloudflare-production` se `main`, senão `cloudflare-preview`)

### 4. Registrar o deploy no Supabase (opcional, recomendado)

Crie um GitHub Action OU um webhook do Cloudflare que chama a Edge Function `register-deploy`:

```bash
curl -X POST "https://ihqogooddvhsvfhbwdez.supabase.co/functions/v1/register-deploy" \
  -H "Authorization: Bearer $DEPLOY_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commit_sha": "'"$CF_PAGES_COMMIT_SHA"'",
    "environment": "cloudflare-production",
    "deployed_by": "github-actions"
  }'
```

A função insere a versão e marca como **Beta ativa** automaticamente.  
Promover para Produção continua sendo ato manual do admin no painel.

### Exemplo de GitHub Action (`.github/workflows/register-deploy.yml`)

```yaml
name: Register Deploy
on:
  deployment_status:
jobs:
  register:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "https://ihqogooddvhsvfhbwdez.supabase.co/functions/v1/register-deploy" \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_WEBHOOK_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "{\"commit_sha\":\"${{ github.sha }}\",\"environment\":\"cloudflare-production\",\"deployed_by\":\"github-actions\"}"
```

## Edge Function `mcp` — regeneração automática

`supabase/functions/mcp/index.ts` é **gerado**, não escrito à mão. O `mcpPlugin()` do
`vite.config.ts` empacota `src/lib/mcp/index.ts` e suas importações locais num único
módulo Deno a cada `dev` ou `build`. O banner no topo do arquivo marca essa origem.

**O plugin fica desligado no Windows.** O teste de caminho local dele é POSIX-only
(`p.startsWith(".") || p.startsWith("/")`) e não reconhece `C:\...`; o entry absoluto
acaba tratado como pacote npm e o arquivo é reescrito como
`import mcp from "npm:C:\\Users\\..."` — um caminho de máquina local que não resolve
no Deno do Supabase. Bug presente em `@lovable.dev/mcp-js` 0.22.2 e ainda em 0.26.2.

Consequência prática: **editar `src/lib/mcp/` no Windows não regenera a função.** Rode
`npm run build` no Lovable, no Cloudflare Pages ou em qualquer ambiente Linux/macOS
para produzir o bundle atualizado, e confira se `supabase/functions/mcp/index.ts`
entrou no commit. Se o arquivo contiver algum caminho `C:\`, ele está corrompido —
não publique.

## Secrets necessários

- `DEPLOY_WEBHOOK_TOKEN` — token aleatório usado para autenticar o webhook. Configurado no Supabase como secret da Edge Function e como secret do GitHub Actions / Cloudflare.

## Resumo do fluxo

```
Push no GitHub
   ↓
Cloudflare Pages faz build → deploy
   ↓
GitHub Action chama register-deploy
   ↓
ui_versions ← nova linha (is_active_beta=true)
   ↓
Beta testers veem a nova versão
   ↓
Admin clica "Produção" no painel → is_active_production=true
   ↓
Todos veem a nova versão
```

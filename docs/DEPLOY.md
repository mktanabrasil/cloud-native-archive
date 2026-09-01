# Deploy & Sistema de Versões (Beta/Produção)

O sistema de Beta funciona **independente da hospedagem**. Ele usa a tabela `ui_versions` no Supabase como fonte única da verdade.

---

## O que acontece hoje — medido em 01/09/2026

Leia esta seção antes das outras. As instruções de Cloudflare Pages mais abaixo
descrevem uma opção **que não está em uso**, e seguir o resumo do fluxo antigo
levava à conclusão errada.

**O push publica, e rápido.** Comparando o `Last-Modified` do site com o horário
do merge, em duas ocasiões: **58 e 60 segundos**. Não há passo manual.

**O servidor é LiteSpeed** (lido do cabeçalho `Server`), típico de hospedagem
cPanel — não é a infraestrutura do Cloudflare nem do Lovable.

**O gatilho não está no repositório.** Não existe `.cpanel.yml`, não existe
`.github/workflows/`, não existe configuração de Cloudflare Pages. Alguma
automação constrói e envia a cada merge na `main`, mas ela vive fora do código —
provavelmente no painel do Lovable ou numa integração de git do cPanel.

> **Lacuna conhecida.** Enquanto ninguém documentar onde essa automação está
> configurada, ela não pode ser diagnosticada nem consertada por quem lê o
> repositório. E o `public/.htaccess`, que faz as rotas internas não darem 404 no
> recarregamento, depende de ela subir arquivos ocultos corretamente.

**Consequência a considerar:** qualquer merge na `main` vai ao ar em um minuto,
sem revisão. Foi assim que o botão de importação do Jornal chegou às diretoras
antes de estar pronto.

## Como conferir, do terminal, o que está publicado

Dá para verificar sem acesso ao painel:

```bash
# 1. Quando publicou
curl -sI https://app.anabrasil.org/ | grep -i "last-modified\|^server"

# 2. Qual é o pacote no ar
curl -s https://app.anabrasil.org/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js'

# 3. Em que commit entrou um trecho que você conhece
git log --oneline -S "texto que só existe na versão nova" -- caminho/do/arquivo

# 4. Procurar esse trecho no pacote publicado
curl -s https://app.anabrasil.org/assets/index-XXXX.js | grep -c "o trecho"
```

**Duas armadilhas, as duas já custaram tempo:**

**String no pacote não prova que a funcionalidade aparece.** Código morto atrás de
uma constante `false` continua no arquivo — o minificador guarda o texto e resolve
a constante. Antes de concluir, **construa localmente do mesmo commit** e procure a
mesma string na sua build: se ela também estiver lá, a presença não significa nada.

**O hash do arquivo não serve para comparar builds.** O `vite.config.ts` injeta o
SHA do commit em `__APP_VERSION__`, então build local e build do servidor nunca
geram o mesmo nome, mesmo partindo do mesmo código.

---

## Como funciona

- Cada deploy registra uma linha em `ui_versions` com `commit_sha` + `environment`.
- A coluna `is_active_beta` define o que **Beta Testers** vêem.
- A coluna `is_active_production` define o que **todos** vêem.
- Triggers garantem que só existe uma versão ativa por categoria.
- O frontend lê esses campos via `useActiveVersion()`.

## Lovable Hosting

Continua funcionando como hoje. Quando você clica em **Publicar** no painel admin (aba Beta/Histórico), uma nova linha em `ui_versions` é criada e marcada como ativa.

## Cloudflare Pages — opção não utilizada hoje

> Esta seção descreve um caminho **que nunca foi ativado**. O site é servido por
> LiteSpeed, e não existe configuração de Cloudflare no repositório. Mantida
> como referência, caso a hospedagem mude.

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

### Como é hoje (verificado)

```
Merge na main
   ↓
automação fora do repositório constrói e envia   ← onde? ainda não documentado
   ↓
site no ar em ~60 segundos, servido por LiteSpeed
```

**O que está verificado:** não existe GitHub Action no repositório, então o
caminho documentado abaixo — o que chama `register-deploy` — não é o que roda.

**O que não foi verificado:** se a automação registra a versão em `ui_versions`
por outro meio. Para saber, olhe se a tabela ganhou linha depois do último merge,
ou se a função `register-deploy` recebeu chamada nos registros dela. Enquanto
ninguém checar, não conte com o registro automático.

### Como seria com Cloudflare Pages (não ativado)

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

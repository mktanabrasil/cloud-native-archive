# Mercado Pago — pagamento online das campanhas

Primeira campanha: **Pizza da Alegria** (09/11/2026). Não há pagamento na
unidade: em `/pizza-da-alegria`, a pessoa escolhe os sabores e paga pelo Mercado
Pago, com Pix ou cartão, sem comprovante. Enquanto o pagamento online estiver
desligado (`pagarOnlineLigado()`), a página continua sendo a confirmação com
comprovante que está no ar hoje.

## A solução: Checkout Pro com a API de Orders

- **Checkout Pro**: a pessoa paga numa página do próprio Mercado Pago. Nenhum dado
  de cartão passa pelo app, então não há exigência de PCI. Aceita Pix, cartão de
  crédito e débito e saldo Mercado Pago. O boleto fica de fora, porque compensa em
  dias e a campanha fecha em 05/12 (era 30/11 até 11/11/2026).
- **API de Orders** (`POST /v1/orders`): é a recomendada pelo Mercado Pago. A API
  de Preferences aparece no painel como "será descontinuada em breve".
- **Aplicação no painel**: "ANA Brasil Campanhas", conta da Associação Nazarena
  Assistencial, em mercadopago.com.br/developers/panel/app.

## Como funciona

```
Página /pizza-da-alegria ──criar──▶ Edge Function pizza-pagamento
                                      │ pizza_reservar_online (banco calcula o preço)
                                      │ POST /v1/orders ─▶ Mercado Pago
◀──────────── checkout_url ───────────┘
Pessoa paga no Mercado Pago ──volta──▶ /pizza-da-alegria?pedido=<id>
Mercado Pago ──webhook (Order)──▶ pizza-pagamento?webhook=1
                                      │ GET /v1/orders/{id} (nunca confia no aviso)
                                      │ pizza_aprovar_online ─▶ pizza_confirmacoes (PZ-XXXXX)
Página de volta ──situacao (a cada 5 s)──▶ mostra o número quando aprovar
```

- `pizza_pedidos_online` guarda o pedido até a aprovação. Só o pedido **pago**
  entra em `pizza_confirmacoes`, com forma `mercado_pago` e sem comprovante. Por
  isso o painel e a cópia para o Drive não mudaram de lógica.
- O preço vem sempre do banco (R$ 55). Na aprovação, o banco confere se o valor
  pago cobre o total (`valor_divergente`).
- A aprovação pode ser chamada de novo sem duplicar, porque o aviso do Mercado
  Pago chega mais de uma vez.
- A order vale 2 horas. Depois disso fica `canceled`, e a página oferece
  "Tentar de novo", que cria outra order para o mesmo pedido.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `supabase/migrations/20261109190000_pizza_mercado_pago.sql` | Tabela de pedidos online, funções de reservar e aprovar, forma `mercado_pago` |
| `supabase/functions/pizza-pagamento/index.ts` | Cria a order, recebe o webhook, responde a situação |
| `src/lib/pizza/api.ts` | `pagarOnline`, `pagarDeNovo`, `situacaoDoPedido` |
| `src/pages/PizzaConfirmacaoPage.tsx` | Pedido com pagamento pelo Mercado Pago e a tela de volta |
| `supabase/functions/pizza-drive/` | PDF com "Pago pelo Mercado Pago" e o preço gravado em cada linha |

## Pôr no ar, passo a passo

O backend é o **Supabase próprio** em `supabase.anabrasil.org`, instalado no
**Coolify**. O projeto em nuvem `ihqogooddvhsvfhbwdez`, citado no `config.toml` e
no `DEPLOY.md`, não está mais em uso desde 10/09/2026. Por isso, `supabase db
push`, `supabase functions deploy` e `supabase secrets set` **não servem aqui**:
os três falam com o Supabase em nuvem.

O pagamento online fica **desligado** até o passo 7, porque um merge na `main`
publica em um minuto (ver `DEPLOY.md`). A ordem é sempre esta: banco, função,
segredos, teste e, por último, o botão.

### 1. Banco: rodar a migração no SQL Editor do Studio

1. Abra `https://supabase.anabrasil.org` e entre no Studio com o login de sempre.
   Se ninguém lembrar, o usuário e a senha ficam no Coolify, no serviço do
   Supabase, em *Environment Variables* (as variáveis do painel/dashboard).
2. Menu da esquerda: **SQL Editor → New query**.
3. Abra `supabase/migrations/20261109190000_pizza_mercado_pago.sql` no
   computador, copie **o arquivo inteiro** e cole no editor.
4. Clique em **Run**. O esperado é *Success. No rows returned*.
   A migração pode ser rodada de novo sem estragar nada (usa `IF NOT EXISTS` e
   `CREATE OR REPLACE`).
4b. Faça o mesmo com
   `supabase/migrations/20261109200000_pizza_mercado_pago_permissoes.sql`. Ela
   tira das contas `anon` e `authenticated` a permissão de executar as funções
   novas. Sem ela, qualquer pessoa poderia aprovar um pedido sem pagar.
4c. Faça o mesmo com
   `supabase/migrations/20261110120000_pizza_pagamento_detalhes.sql` (10/11/2026).
   Ela acrescenta as colunas da forma de pagamento, da bandeira e da hora da
   aprovação, que o comprovante mostra.
5. Confira numa nova query:
   ```sql
   select to_regclass('public.pizza_pedidos_online') as tabela,
          (select count(*) from pg_proc where proname in
             ('pizza_reservar_online', 'pizza_aprovar_online', 'pizza_novo_numero')) as funcoes,
          (select pg_get_constraintdef(oid) from pg_constraint
            where conname = 'pizza_forma_check') as formas;
   ```
   O esperado é `tabela = pizza_pedidos_online`, `funcoes = 3`, e `formas`
   contendo `'mercado_pago'`. Para a 4c:
   ```sql
   select count(*) from information_schema.columns
    where table_name = 'pizza_confirmacoes' and column_name in ('mp_forma', 'mp_bandeira', 'mp_aprovado_em');
   ```
   O esperado é `3`.

Nada muda para quem usa o app agora: a migração só acrescenta coisas.

### 2. Função: copiar a pasta para o servidor

No servidor próprio, cada função é uma pasta dentro do volume `functions` do
container `supabase-edge-functions`. O roteador lê
`<volume>/<nome>/index.ts` a cada chamada, então basta a pasta existir.

1. **Achar a pasta no servidor.** No Coolify, abra **Servers → (o servidor) →
   Terminal** (ou entre por SSH) e rode:
   ```bash
   docker inspect $(docker ps -qf name=supabase-edge-functions) --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
   ```
   A linha que termina em `-> /home/deno/functions` mostra a pasta. Ela costuma ser
   `/data/coolify/services/<id do serviço>/volumes/functions`. Confira que as
   outras funções estão lá:
   ```bash
   ls /data/coolify/services/<id>/volumes/functions
   ```
   Devem aparecer `pizza-drive`, `eventos-aviso` e as demais.
2. **Copiar a função nova.** Escolha um dos dois jeitos:
   - **Com SSH no Windows** (PowerShell, na pasta do projeto):
     ```bash
     scp -r supabase/functions/pizza-pagamento root@<servidor>:/data/coolify/services/<id>/volumes/functions/
     ```
   - **Pelo terminal do Coolify**: crie a pasta e cole o arquivo.
     ```bash
     mkdir -p /data/coolify/services/<id>/volumes/functions/pizza-pagamento
     nano /data/coolify/services/<id>/volumes/functions/pizza-pagamento/index.ts
     ```
     Cole o conteúdo inteiro de `supabase/functions/pizza-pagamento/index.ts`,
     salve com `Ctrl+O`, `Enter` e saia com `Ctrl+X`.
3. **Atualizar a `pizza-drive`** (PDF com "Pago pelo Mercado Pago" e o preço certo
   de R$ 55). Copie os dois arquivos, `index.ts` e `pdf.ts`, de
   `supabase/functions/pizza-drive/` por cima dos que estão no servidor, do mesmo
   jeito.
4. **Conferir**, do seu computador:
   ```bash
   curl -s -X POST https://supabase.anabrasil.org/functions/v1/pizza-pagamento -H "content-type: application/json" -d "{\"acao\":\"situacao\",\"pedido\":\"00000000-0000-0000-0000-000000000000\"}"
   ```
   - `{"error":"pedido_nao_encontrado"}`: a função está no ar e falando com o banco.
   - `could not find an appropriate entrypoint`: a pasta ou o nome do arquivo
     estão errados.
   - Erro sobre `pizza_pedidos_online`: o passo 1 (banco) não foi feito.

O servidor próprio não exige login nas funções (conferido em 09/11/2026), então o
aviso do Mercado Pago chega sem precisar de JWT.

### 3. Segredos: no Coolify

As funções leem os segredos das variáveis do container, como os `SMTP_*` dos
avisos de eventos.

1. No Coolify, abra o serviço do Supabase → **Edit Compose File**.
2. Procure o bloco `supabase-edge-functions:` → `environment:`. Ali devem estar
   linhas como `- SMTP_HOST=${SMTP_HOST}`. Logo abaixo delas, acrescente:
   ```yaml
         - MP_ACCESS_TOKEN=${MP_ACCESS_TOKEN}
         - MP_WEBHOOK_SECRET=${MP_WEBHOOK_SECRET}
   ```
   Mantenha o mesmo recuo das linhas vizinhas e salve.
3. Vá em **Environment Variables**. As duas variáveis novas aparecem vazias.
   Preencha:
   - `MP_ACCESS_TOKEN`: no painel do Mercado Pago, **ANA Brasil Campanhas →
     Teste → Credenciais → Access Token**. Use o de **teste** agora.
   - `MP_WEBHOOK_SECRET`: no painel, **Webhooks → Configurar → Assinatura
     secreta** (clique no olho para ver e copie).

   Cole os valores só no Coolify. Não coloque em chat, e-mail nem arquivo do
   repositório.
4. Clique em **Restart** (ou **Redeploy**) no serviço, para o container ler as
   variáveis. O Supabase fica fora do ar por cerca de um minuto, então faça num
   horário calmo.

   > **Incidente de 09/11/2026.** O Restart desliga todos os containers e baixa
   > de novo as imagens antes de religar. A imagem `quay.io/minio/mc` do serviço
   > `minio-createbucket` tinha saído do ar (quay.io respondia 401, e o Docker Hub
   > também não tinha), e o Supabase inteiro ficou parado (`503 no available
   > server`). Para voltar: no terminal do servidor, na pasta
   > `/data/coolify/services/77y98omf51tsbpv1atnprpct`, rodar
   > `docker compose up -d --pull never` deixando esse serviço de fora. Depois, o
   > bloco `minio-createbucket` foi apagado do compose no Coolify. Ele só criava as
   > pastas do armazenamento na primeira instalação, e elas já existiam.
   >
   > Se um Restart voltar a falhar: confira com `docker ps -a --filter
   > "name=77y98omf51tsbpv1atnprpct"` e, antes de tentar de novo, leia o erro de
   > `docker compose up -d` nessa pasta. Para mudar só variáveis das funções,
   > dá para recriar só aquele container:
   > `docker compose up -d --pull never --no-deps supabase-edge-functions`.
5. **Conferir**: no painel do Mercado Pago, **Webhooks → Configurar → Simular
   notificação**, com o evento Order. A resposta tem que ser **200**. Se vier
   **401**, a `MP_WEBHOOK_SECRET` não confere: copie de novo e reinicie.

### 4. Webhook no painel do Mercado Pago

Já configurado no modo teste (09/11/2026):
- URL: `https://supabase.anabrasil.org/functions/v1/pizza-pagamento?webhook=1`
- Evento: **Order (Mercado Pago)**

Se clicar no botão de girar a assinatura secreta, ela muda: atualize a
`MP_WEBHOOK_SECRET` no Coolify e reinicie.

### 5. Testar o cartão no ambiente de teste

Funcionou em 10/11/2026 (PZ-EJU8B, Mastercard de teste). O segredo é o
**comprador de teste criado pela API**: as contas de comprador criadas pelo
painel deixavam o botão Pagar desativado, e pagar como convidado dava "Você não
pode pagar com um e-mail corporativo do Mercado Livre".

1. **Criar o comprador de teste** (uma vez; dica do assistente do Mercado Pago).
   No PowerShell, com o Access Token de **teste** do app "ANA Brasil Campanhas":
   ```powershell
   $token = "<Access Token de teste>"
   $headers = @{ Authorization = "Bearer $token" }
   $body = @{ site_id = "MLB"; description = "Comprador de teste" } | ConvertTo-Json -Compress
   Invoke-RestMethod -Method Post -Uri "https://api.mercadopago.com/users/test_user" -Headers $headers -ContentType "application/json" -Body $body
   ```
   A resposta traz o e-mail (`test_user_…@testuser.com`) e a senha do comprador.
   Guarde-os num lugar seguro; não mande print com o token.
2. **A página no computador**: `.env.local` com `VITE_PIZZA_PAGAR_ONLINE=sim` (não
   vai para o git) e `npm run dev`. Abra `http://localhost:8080/pizza-da-alegria`
   numa janela anônima.
3. **O pedido**, com o nome `Teste Mercado Pago Apagar`: Pagar → popup → Confirmar
   e pagar.
4. **No Mercado Pago**, entre com o comprador do item 1 e pague com um cartão de
   teste (titular `APRO` aprova, `OTHE` recusa; CPF `12345678909`).
5. **"Voltar para …"** leva de volta ao localhost (o Mercado Pago só volta sozinho
   para https). Confira: "Pagamento confirmado", o número, "Baixar comprovante" com
   o nome, a forma ("Cartão de crédito Mastercard") e o código; a linha no painel
   da Pizza; no Drive, o PDF de respostas e "PZ-XXXXX · comprovante.pdf".

**Pix** não tem teste no Checkout Pro (o Mercado Pago só testa Pix pela API, numa
order montada à mão): testa-se em produção, no passo 6.

Depois de qualquer teste, apague os pedidos no SQL Editor:
```sql
delete from pizza_confirmacoes  where nome ilike 'teste mercado pago%';
delete from pizza_pedidos_online where nome ilike 'teste mercado pago%';
```
E apague a pasta da pessoa de teste no Drive (Pizza da Alegria 2026 / Social /
Escritório (ADM) / Teste Mercado Pago…).

### 6. Produção no Mercado Pago (numa sessão só, com quem recebe os códigos da conta)

1. **Credenciais de produção.** No painel do Mercado Pago, abra a aplicação
   "ANA Brasil Campanhas" e ative as **credenciais de produção**. O Mercado Pago
   pede o ramo, o site (`https://app.anabrasil.org`) e aceita os termos. Os dados
   e os termos são da ANA: quem preenche é a conta da ANA.
2. **Chave Pix.** Na conta do Mercado Pago da ANA, confira se há uma chave Pix
   cadastrada (o CNPJ). Sem chave, o Pix não aparece no checkout.
3. **Webhook de produção.** Em **Webhooks → Configurar notificações**, aba
   **Modo produtivo**: URL
   `https://supabase.anabrasil.org/functions/v1/pizza-pagamento?webhook=1`, evento
   **Order (Mercado Pago)**. Salve e copie a **assinatura secreta** de produção.
4. **Segredos no Coolify.** Em **Environment Variables** do serviço do Supabase,
   troque `MP_ACCESS_TOKEN` pelo Access Token de **produção** (começa com
   `APP_USR-`, na aba de produção das Credenciais) e `MP_WEBHOOK_SECRET` pela
   assinatura do item 3. Os valores ficam só no Coolify: nunca em chat, e-mail ou
   arquivo do repositório.
5. **Recriar só o container das funções** (não use o Restart do serviço, ver o
   incidente acima). No terminal do servidor:
   ```bash
   cd /data/coolify/services/77y98omf51tsbpv1atnprpct
   docker compose up -d --pull never --no-deps supabase-edge-functions
   ```
6. **Funções atualizadas.** Copie por cima as versões de 10/11/2026:
   `supabase/functions/pizza-pagamento/index.ts` e, da `pizza-drive`, `index.ts` e
   `pdf.ts` (como no passo 2).
7. **Simular o aviso.** No painel, **Webhooks → Simular notificação**, evento
   Order, no modo produtivo. Tem de responder **200**; **401** é a assinatura errada.
8. **Dois pedidos reais**, pela página no computador (`npm run dev` com o
   `.env.local`), com o nome `Teste Mercado Pago Apagar`:
   - um de R$ 55 no **cartão**;
   - um de R$ 55 no **Pix**.

   Em cada um, confira: o número e o botão "Baixar comprovante" na tela; a linha
   no painel da Pizza com "pago online"; a pasta no Drive com
   "PZ-XXXXX · comprovante.pdf" e o PDF de respostas; no painel do Mercado Pago,
   **Webhooks → Notificações enviadas** com resposta 200.
9. **Devolver e apagar.** Devolva os dois pagamentos pelo painel do Mercado Pago
   (Atividade → o pagamento → Devolver) e rode o SQL de limpeza do passo 5.

### 7. Ligar o pagamento online para todo mundo

Feito em 10/11/2026, depois do pedido real de teste (PZ-EF7S3, Pix, devolvido).
Em `src/lib/pizza/modelo.ts`, `pagarOnlineLigado` passou a valer para todo mundo
(só `VITE_PIZZA_PAGAR_ONLINE=nao` desliga, no computador de quem testa). Para
desligar no site, volte a linha para `=== 'sim'` e faça o merge. A partir daí, a página só
aceita pagamento online: some a confirmação com comprovante. As confirmações já
enviadas continuam no painel.

## O comprovante (10/11/2026)

Mockup aprovado: https://claude.ai/artifact/YFLkrrZasjah83MbQnV3Ee

- **Na tela**, depois da aprovação: "Baixar comprovante" gera uma imagem JPEG no
  celular (`src/lib/pizza/comprovante.ts`), como no Voluntariado.
- **No Drive**: "PZ-XXXXX · comprovante.pdf", ao lado do PDF de respostas,
  montado pela função `pizza-drive` (`montarComprovante`, em `pdf.ts`). O arquivo
  do Drive não passa pelo celular de ninguém.
- **Os dados do pagamento** vêm da order no Mercado Pago, lidos pela função
  `pizza-pagamento`: a forma (`payment_method.type`), a bandeira
  (`payment_method.id`) e o código da operação (o id do pagamento). A API de
  Orders não devolve o final do cartão nem a data de aprovação, então a hora é a
  primeira vez que o servidor viu o pagamento aprovado (`mp_aprovado_em`).
- Se a página perguntar a situação antes de a forma e a hora estarem gravadas, a
  função lê a order de novo e completa (a aprovação repetida não duplica).

## Conciliação

- No painel da Pizza, a barra **Por forma de pagamento** traz a linha "Mercado Pago".
- `pizza_confirmacoes.mp_pagamento_id` é o id do pagamento no Mercado Pago.
- Um estorno feito no Mercado Pago marca `pizza_pedidos_online.status = 'estornado'`
  e gera um aviso nos logs da função. A confirmação continua no painel, então o
  financeiro precisa tirar a pizza da lista à mão.

## Para a próxima campanha

A função e as tabelas são da Pizza. Para outra campanha, copie o padrão:
uma tabela de pedidos online, uma função `reservar` (preço no banco) e uma
`aprovar` (idempotente), além de uma Edge Function com as mesmas três ações.
A aplicação do Mercado Pago pode ser a mesma, mas o webhook é um só por
aplicação. O `external_reference` leva o prefixo da campanha (`pizza_<id>`), e a
função da Pizza ignora orders com outro prefixo. A segunda campanha precisa de
um ponto único de entrada que encaminhe cada aviso pelo prefixo, por exemplo
uma função `pagamentos` que chama a da campanha certa.

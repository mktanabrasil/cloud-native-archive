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
  dias e a campanha fecha em 30/11.
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
5. Confira numa nova query:
   ```sql
   select to_regclass('public.pizza_pedidos_online') as tabela,
          (select count(*) from pg_proc where proname in
             ('pizza_reservar_online', 'pizza_aprovar_online', 'pizza_novo_numero')) as funcoes,
          (select pg_get_constraintdef(oid) from pg_constraint
            where conname = 'pizza_forma_check') as formas;
   ```
   O esperado é `tabela = pizza_pedidos_online`, `funcoes = 3`, e `formas`
   contendo `'mercado_pago'`.

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

### 5. Testar no computador

1. Crie `.env.local` na raiz do projeto com `VITE_PIZZA_PAGAR_ONLINE=sim` (o
   arquivo não vai para o git) e rode `npm run dev`.
2. Em `/pizza-da-alegria`, escolha os sabores, toque em **Pagar … pelo Mercado Pago** e pague com uma **conta de
   comprador de teste** (painel → Contas de teste), numa janela anônima. Use os
   cartões de teste do Mercado Pago. O nome do titular decide o resultado: `APRO`
   aprova e `OTHE` recusa.
3. Confira:
   - aprovado: aparece o número PZ-XXXXX e a linha entra no painel da Pizza com
     "pago online";
   - recusado: aparece "Tentar de novo";
   - no painel do Mercado Pago, **Webhooks → Notificações enviadas** mostra o
     aviso com resposta 200.

   No localhost, o Mercado Pago não volta sozinho (só volta para https). Use o
   botão "Voltar ao site" da página do Mercado Pago.

### 6. Produção no Mercado Pago

No painel, ative as **credenciais de produção** (o Mercado Pago pede dados da
empresa e do site). Depois:
- no Coolify, troque `MP_ACCESS_TOKEN` pelo token de **produção**;
- no painel, configure o webhook na aba **Produção**, com a mesma URL e o mesmo
  evento, e troque `MP_WEBHOOK_SECRET` pela assinatura de produção;
- reinicie o serviço no Coolify.

### 7. Ligar o pagamento online para todo mundo

Em `src/lib/pizza/modelo.ts`, faça `pagarOnlineLigado` devolver `true`. Depois,
faça o merge na `main`, que publica em um minuto. A partir daí, a página só
aceita pagamento pelo Mercado Pago: some a confirmação com comprovante. As
confirmações já enviadas continuam no painel.

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

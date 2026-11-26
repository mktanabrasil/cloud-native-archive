# Ouvidoria do site do ANA Brasil

Recebe o formulário da página `/ouvidoria/` do site e entrega a mensagem por e-mail à ouvidoria. É aberta, sem login e sem chave.

Endereço: `https://supabase.anabrasil.org/functions/v1/ouvidoria`

## Como funciona

- O site manda um `POST` com `multipart/form-data` e uma parte `dados` em JSON:
  - `tipo`: elogio, sugestao, reclamacao, denuncia ou mensagem (um tipo fora da lista vira mensagem);
  - `mensagem`: até 3000 caracteres;
  - `identificado`: sim ou não;
  - `pagina`;
  - `nome` (até 80) e `email` (até 120): só valem quando `identificado` é sim.
- A função guarda a mensagem na tabela `ouvidoria_mensagens` (garantia: nada se perde) e responde **201** com `{ "ok": true, "protocolo": "OUV-2026-0042" }`. O número segue em sequência e recomeça a cada ano.
- Logo depois, o e-mail sai para **ouvidoria@anabrasil.org** com cópia para **adm@anabrasil.org**:
  - o assunto traz o tipo e o protocolo;
  - nas mensagens identificadas, responder ao e-mail vai direto para quem enviou.
- Se a pessoa se identifica e o e-mail não confere (ex.: "maria@gmail"), a mensagem vale do mesmo jeito: o e-mail vai junto, marcado "parece incompleto", e não vira "responder para".
- Se o e-mail falhar:
  - a mensagem continua guardada;
  - o agendamento (pg_cron, a cada 5 min) tenta de novo, com espera crescente de 5, 10, 20 min… até 6 h;
  - depois de 15 min sem sair, vai um aviso para o WhatsApp da MKT, só com o protocolo.
- Enxurrada (mais de 60 mensagens em 10 min, contadas pelo banco, sem nada de quem envia): a mensagem continua sendo guardada e recebe protocolo, nunca é recusada; só o e-mail espera 10 min e o agendamento entrega aos poucos.
- Duas chamadas nunca mandam o mesmo e-mail: quem vai mandar pega a vez antes (coluna `enviando_ate`, 2 min).

## Respostas

| Situação | Código |
|---|---|
| Guardada | 201 `{ ok, protocolo }` |
| Campo-isca preenchido (robô) | 201 `{ ok }`, sem guardar nem mandar |
| Mensagem vazia, longa demais, JSON quebrado | 400 |
| Corpo acima de 64 KB | 413 |
| Mais de 5 envios do mesmo endereço em 10 min | 429 |
| Não conseguiu guardar (banco fora) | 503 |

CORS liberado (`Access-Control-Allow-Origin: *`), com resposta ao preflight (`OPTIONS`).

## Anonimato

- Quando a pessoa não se identifica, fica guardado só o tipo, a mensagem e a hora. O banco recusa nome ou e-mail numa mensagem anônima (`ouvidoria_anonima_sem_dados`).
- Não existe coluna de IP, navegador ou qualquer outro dado de quem enviou.
- O endereço de quem chama serve só ao limite contra robôs: fica na memória da função por até 10 minutos e nunca é gravado nem escrito nos registros. O teto geral (60 em 10 min) conta pelo banco, sem nada de quem envia, e só segura o e-mail.
- Os registros (`console.error`) trazem só o protocolo e o motivo de uma falha, nunca o conteúdo.
- Fora da função: o Kong do servidor (supabase.anabrasil.org) anota uma linha por chamada, com hora, página de origem e navegador, e o Vector leva essa linha ao analytics. O IP que aparece ali é o do proxy do Coolify, não o do visitante (o Kong não confia no X-Forwarded-For). Se um dia configurarem `trusted_ips` no Kong ou o log de acesso do Traefik com cabeçalhos, o IP do visitante passaria a ser anotado: para manter o anonimato, filtrar a rota `/functions/v1/ouvidoria` nesses logs.

## Campo-isca (contra robôs)

Se o formulário tiver um campo escondido chamado `website` (ou `site`, `empresa`, `url`), dentro do JSON ou solto no formulário, e ele vier preenchido, a função finge que deu certo e não guarda nada. Pessoas não veem o campo, então nunca o preenchem.

## No app

Administração › Ouvidoria mostra só o cartão "Ouvidoria no site", para a administração (RH/admin) e o marketing:
- o endereço da API, com o botão Copiar;
- para onde vai cada mensagem;
- quantas chegaram no mês e o último protocolo;
- os e-mails que não saíram, com o botão **Reenviar agora**.

O conteúdo das mensagens nunca chega ao app.

Ações (com o login do app): `POST { "acao": "estado" }` e `POST { "acao": "reenviar" }`.

## Para a equipe

- Código: `supabase/functions/ouvidoria` (`index.ts`, `regras.ts`).
- Tabelas: `ouvidoria_mensagens`, `ouvidoria_contador`, `ouvidoria_estado` (migração `20261126120000_ouvidoria.sql`).
- E-mail: o mesmo servidor SMTP dos avisos do app (variáveis `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` e, se houver, `AVISOS_REMETENTE`), com o nome "Ouvidoria do site".
- Destinatários: `PARA` e `COPIA` em `regras.ts`.

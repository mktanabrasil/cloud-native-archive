# API pública do Portal da Transparência

Para o site do ANA Brasil listar e abrir os documentos de transparência de cada unidade. Aberta, sem login e sem chave.

Endereço base: `https://supabase.anabrasil.org/functions/v1/transparencia`

## Como funciona

- Os documentos continuam só no Google Drive da conta transparencia@anabrasil.org, que é onde a equipe os mantém.
- A API **nunca** consulta o Google na hora da visita. Ela responde a partir de uma lista guardada, que a própria função atualiza a cada 2 minutos. Em cada atualização ela pergunta ao Drive só o que mudou e relê apenas as unidades afetadas. Uma vez por dia, relê todas.
- Se o Google falhar ou a conta desconectar, a API continua respondendo com a **última lista boa**. Se uma leitura nova vier vazia ou com menos da metade dos documentos (por exemplo, uma pasta enviada à lixeira por engano), ela não entra sozinha: alguém precisa confirmar com "Atualizar agora" no painel. Quando a falha passa de 30 minutos, a MKT recebe um aviso no WhatsApp e por e-mail. Se a conta desconectar, o aviso sai na hora.
- Nenhuma resposta tem endereço, código ou nome do Google. O documento abre pelo endereço da própria API: o arquivo passa pelo nosso servidor sem ser guardado.
- Abrir um documento é a única coisa que depende do Google estar no ar naquele momento.

## Endereços

### `GET /` — as unidades

```json
{
  "atualizado_em": "2026-11-24T16:00:00.000Z",
  "unidades": [
    {
      "slug": "ana-jardim-nilopolis",
      "nome": "Ana Jardim Nilópolis",
      "nome_curto": "Nilópolis",
      "pasta": "1 Ana Jardim Nilópolis",
      "grupo": "social",
      "finalizada": false,
      "ordem": 1,
      "pastas": 137,
      "documentos": 733,
      "atualizado_em": "2026-11-24T16:00:00.000Z",
      "endereco": "https://supabase.anabrasil.org/functions/v1/transparencia/unidade/ana-jardim-nilopolis"
    }
  ]
}
```

- `grupo` vem do nome da pasta:
  - `social`: unidades "Ana …";
  - `educacao`: CEIs "Bem Querer";
  - `outros`: por exemplo, o GOE.
- A lista vem na ordem Social, Educação, outros. Dentro de cada grupo, pelo número da frente do nome da pasta (`ordem`).
- `finalizada` vale `true` quando o nome da pasta tem "(Parceria Finalizada)".
- `slug` é o endereço fixo da unidade. Ele é criado uma vez e não muda se o nome da pasta mudar.
- Uma unidade recém-cadastrada só entra na lista depois da primeira leitura completa, que leva poucos minutos. Antes disso, `/unidade/{slug}` responde `503` com `Retry-After`. A API nunca mostra uma unidade vazia por engano.

### `GET /unidade/{slug}` — pastas e documentos de uma unidade

```json
{
  "unidade": { "slug": "ana-jardim-nilopolis", "nome": "Ana Jardim Nilópolis", "...": "igual à lista" },
  "atualizado_em": "2026-11-24T16:00:00.000Z",
  "pastas": [
    {
      "nome": "1 Ata",
      "pastas": [],
      "documentos": [
        {
          "nome": "Ata 2025.pdf",
          "tipo": "pdf",
          "tamanho": 1234,
          "atualizado_em": "2026-01-10T10:00:00Z",
          "chave": "q1W2e3R4t5Y6u7I8",
          "endereco": "https://supabase.anabrasil.org/functions/v1/transparencia/arquivo/q1W2e3R4t5Y6u7I8/Ata%202025.pdf"
        }
      ]
    }
  ],
  "documentos": []
}
```

- Pastas e documentos vêm em ordem natural: "2 Estatuto" antes de "10 Recursos Humanos".
- A árvore pode ter vários níveis.
- `documentos` na raiz são os arquivos soltos na pasta principal da unidade.
- `tamanho` é em bytes. Vem `null` em documentos do Google (Docs e Planilhas), que saem convertidos em PDF.
- `tipo` é a extensão: `pdf`, `xlsx`, `ods`, `jpg`…
- Se a unidade não existe, a resposta é `404`. Se o banco falhar, a API devolve a última resposta boa que tiver; sem nenhuma, `503`.

### `GET /arquivo/{chave}/{nome}` — o documento

- PDF, imagem e texto simples abrem na própria tela do navegador (`Content-Disposition: inline`). Os outros tipos sempre baixam. Com `?baixar=1`, qualquer documento baixa.
- Aceita `Range`, que os leitores de PDF usam para abrir arquivos grandes aos poucos.
- Se o documento foi retirado do portal ou não existe, a resposta é uma página `404` em português.
- A `chave` não muda entre as atualizações. Ela só muda se o documento for apagado e enviado de novo ao Drive.

## Cache e CORS

- `Access-Control-Allow-Origin: *`: qualquer página pode chamar a API.
- `GET /` e `GET /unidade/…` respondem com `Cache-Control: public, max-age=60, stale-while-revalidate=600` e `ETag` (com `If-None-Match`, a resposta é `304`).
- Os documentos respondem com `max-age=3600`.

**Sugestão para o site:** guardar a última resposta da API (no build ou no `localStorage`) e mostrá-la se a API não responder. Assim, nem uma queda do nosso servidor deixa a página de transparência vazia.

## Para a equipe

- Cadastrar ou retirar uma unidade: Marketing › Portal Transparência no app. A API segue em até 2 minutos.
- Documento novo no Drive: aparece na API em até 2 minutos.
- Código: `supabase/functions/transparencia` (`index.ts`, `regras.ts`). Tabelas: `transparencia_*` (migração `20261124130000_transparencia_api.sql`).

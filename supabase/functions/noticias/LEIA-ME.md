# API pública de notícias (blog) do ANA Brasil

Para o site do ANA Brasil mostrar o blog: lista, cada notícia, busca, fotos e vídeos. É aberta, sem login e sem chave.

Endereço base: `https://supabase.anabrasil.org/functions/v1/noticias`

## Como funciona

- As notícias moram no Google Drive compartilhado **Setor Marketing**, na pasta do blog. A organização é Unidade › Ano › "AAAA-MM-DD — Título", e cada notícia tem:
  - `post.json`: título, data, unidade(s), texto e opções;
  - `capa.*`;
  - `fotos/`, em ordem pelo nome do arquivo (01, 02…);
  - `videos/`.
- Os 469 posts antigos do WordPress já estão lá. As notícias novas serão criadas pela ferramenta do app (Marketing › Notícias).
- A API guarda só a lista (texto e referências). Nenhuma foto ou vídeo fica no servidor: os arquivos são buscados no Drive quando alguém abre, e entregues pelo nosso endereço, sem nada do Google.
- A cada 2 minutos, a API pergunta ao Drive o que mudou e relê só as notícias afetadas. Uma vez por dia, relê todas as pastas.
- Uma notícia só é trocada quando a leitura dá certo. Se o Google falhar, continua valendo a versão anterior.
- Se a pasta do blog esvaziar de repente (por exemplo, movida por engano), nada é apagado sem confirmação.
- Uma falha que dura mais de 30 minutos gera aviso no WhatsApp da MKT e por e-mail. Se a conta do Drive desconectar, o aviso sai na hora.

## Endereços

### `GET /` — lista

Parâmetros:
- `unidade` (slug);
- `pagina` (a partir de 1);
- `por_pagina` (de 1 a 100, padrão 24).

Resposta:
- `total`, `pagina`, `paginas`;
- `manchete`: a notícia fixada no topo ou, se nenhuma estiver fixada, a mais recente;
- `unidades`: lista de `{slug, nome, total}`, para montar o filtro;
- `noticias`: as notícias da página, cada uma com:
  - `slug`, `titulo`, `data` (AAAA-MM-DD);
  - `unidade {slug, nome}` e `unidades[]`;
  - `resumo` (o primeiro parágrafo, curto);
  - `capa`;
  - `fotos` e `videos` (quantidades);
  - `destaque` (true na manchete) e `fixada`;
  - `endereco`.

Slugs das unidades: ana-dic, ana-jardim-santana, ana-piaui, aninha-cancela, ana-jardim-nilopolis, ana-oziel, grupo-de-oracao-esperanca e institucional (posts gerais da ANA Brasil). São os mesmos da API de transparência.

### `GET /noticia/{slug}` — a notícia completa

- `titulo`, `data`, `unidade`, `unidades`.
- `texto`: lista de parágrafos, sem HTML.
- `capa`.
- `midias`, sem repetir a capa e na ordem das fotos.

O `slug` dos posts antigos é o do WordPress sem emoji. Exemplo: `dia-das-criancas-especial-com-o-colegio-objetivo`.

### Fotos e vídeos

Uma **foto** traz:

```json
{
  "tipo": "foto",
  "src": ".../arquivo/{chave}/{nome}?tamanho=tela",
  "w": 1600,
  "h": 1200,
  "alt": "descrição para leitor de tela (pode vir vazia)",
  "original": ".../arquivo/{chave}/{nome}",
  "mini": { "src": "...?tamanho=mini", "w": 400, "h": 300 }
}
```

- `tela`: maior lado com até 1600 px, para a página.
- `mini`: maior lado com até 400 px, para listas e galerias.
- `original`: o arquivo cheio, para baixar.
- `w` e `h` já correspondem ao tamanho de tela.

Um **vídeo** traz `{ tipo: "video", src, w, h, duracao (segundos), capa {src, w, h, mini} }`. O `src` é o vídeo inteiro e aceita `Range`.

A `capa` da notícia tem o mesmo formato de uma foto.

### `GET /busca?q=…` — busca (barra de pesquisa do site)

- Procura no título (que vale mais), no texto e no nome da unidade.
- Não diferencia acentos nem maiúsculas, e palavras como "de" e "da" não atrapalham.
- Parâmetros: `&unidade=` e `&limite=` (1 a 100, padrão 20).
- Resposta: `{ q, total, resultados[] }`, no mesmo formato dos itens da lista.

## Cache e CORS

- `Access-Control-Allow-Origin: *`.
- A lista, a notícia e a busca respondem com `Cache-Control: public, max-age=60, stale-while-revalidate=600, stale-if-error=86400` e `ETag` (com `If-None-Match`, a resposta é 304).
- As fotos e os vídeos respondem com `max-age=86400` e `ETag`.

## Para a equipe

- Corrigir uma notícia antiga: editar o `post.json` da pasta no Drive (ou, quando existir, usar a ferramenta do app). O site atualiza em até 2 minutos.
- Código: `supabase/functions/noticias` (`index.ts`, `regras.ts`).
- Tabelas: `noticias*` (migração `20261125090000_noticias_api.sql`).
- Conexão com o Drive: a mesma da Pizza da Alegria (conta contato@, Drive Setor Marketing).

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

Slugs das unidades: ana-dic, ana-jardim-santana, ana-piaui, aninha-cancela, ana-jardim-nilopolis e institucional (posts gerais da ANA Brasil). São os mesmos da API de transparência. O grupo-de-oracao-esperanca aparece só nas 4 notícias antigas; ele e o ana-oziel não são oferecidos no editor (26/11/2026).

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
- A lista, a notícia e a busca respondem com `Cache-Control: public, max-age=60, stale-while-revalidate=60, stale-if-error=86400` e `ETag` (com `If-None-Match`, a resposta é 304).
- As fotos e os vídeos das notícias publicadas respondem com `max-age=86400` e `ETag`. Os de rascunho (e os envios ainda não salvos) só abrem pelo painel, com um código do dia (`?p=`), e nunca ficam em cache público.

## Para a equipe

- Publicar e corrigir notícias: app › Marketing › Notícias. Também dá para editar o `post.json` da pasta no Drive; o site atualiza em até 2 minutos.
- Código: `supabase/functions/noticias` (`index.ts`, `regras.ts`).
- Tabelas: `noticias*` (migrações `20261125090000_noticias_api.sql` e `20261125150000_noticias_gravar_condicional.sql`).
- Conexão com o Drive: a mesma da Pizza da Alegria (conta contato@, Drive Setor Marketing).

## O painel (Marketing › Notícias)

Ações em `POST /noticias`, só para o marketing (login do app): `lista`, `noticia`, `salvar`, `iniciar_envio`, `envio_concluido`, `excluir`.

- **Tudo fica no Drive.** O salvar cria ou atualiza a pasta (unidade › ano › "AAAA-MM-DD — Título"), grava o `post.json` primeiro (com `publicado`, a ordem e as descrições pelo nome final) e depois põe cada arquivo no lugar: `capa.*`, `fotos/` e `videos/` numerados ("03 - nome.jpg"). Retirar uma foto manda para a lixeira do Drive (30 dias).
- **Fotos e vídeos vão do navegador direto para o Drive**, por um envio que a função abre (nada passa pelo servidor). Eles chegam na subpasta `_enviando`, que o site não lê; só entram na notícia quando alguém salva.
- **Rascunho** é `"publicado": false` no `post.json`: não aparece na lista, na notícia, na busca nem nos arquivos.
- **Notícia nova** nasce como rascunho, marcada com o código do editor (`appProperties.anaNovo`). Um salvar repetido depois de uma falha reaproveita a mesma pasta.
- **O salvar e o ciclo nunca correm juntos**: o salvar (e o fim de um envio) pega a mesma trava (`noticias_pegar_trava`) e, se o ciclo estiver rodando, pede a vez (`salvar_esperando_ate`). O ciclo grava com condição (`noticias_gravar` com `p_condicional`), então uma leitura velha nunca cobre uma mais nova.
- **Releitura adiada**: se o salvar não tiver tempo de reler (o Kong corta aos 60 s), a lista já fica com o que foi salvo e o ciclo termina em até 2 minutos. O painel avisa e trava a edição até recarregar.

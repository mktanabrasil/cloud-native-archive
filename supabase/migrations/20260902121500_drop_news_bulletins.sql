-- Apaga a tabela do Informativo.
--
-- A página saiu do ar em 02/09/2026 (PR #48) e nada mais lê daqui. Eram 27
-- rascunhos: 14 vivos, 13 já na lixeira, nenhum publicado.
--
-- Sem CASCADE de propósito. As cinco policies, os dois índices e o trigger
-- de updated_at pertencem à tabela e caem junto; se alguma outra coisa
-- depender dela, é melhor o comando falhar alto do que levar essa coisa
-- embora em silêncio.
--
-- Não mexe em `check_is_admin`, `has_unit_access` nem
-- `update_updated_at_column`: as três são compartilhadas com o resto do app.
--
-- As imagens dos boletins continuam no bucket `event-attachments`, sob o
-- prefixo `news/`. Não dá para varrer por prefixo: o campo de imagem do
-- Jornal grava no mesmo lugar, então apagar `news/` levaria junto as fotos
-- que as diretoras subiram esta semana.

DROP TABLE IF EXISTS public.news_bulletins;

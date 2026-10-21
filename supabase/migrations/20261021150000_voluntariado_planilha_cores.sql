-- Voluntariado do Natal Feliz (21/10/2026): cores por unidade na planilha.
--
-- Cada linha nova chega com a cor da unidade (colunas A a H) e sem negrito.
-- As linhas que já estavam lá são acertadas uma vez só, na próxima chamada
-- da função; esta marca diz quando isso aconteceu.

ALTER TABLE public.voluntariado_planilha
  ADD COLUMN IF NOT EXISTS cores_em timestamptz;

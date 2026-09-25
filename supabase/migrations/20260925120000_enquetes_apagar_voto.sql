-- Enquetes: a equipe apaga um voto (25/09/2026, PR 2).
--
-- Para o voto de teste, ou de quem votou por engano com o número errado.
-- Só marketing e administração, como o resto da gestão das enquetes.
-- Editar e duplicar não precisam de nada novo: a policy de UPDATE e a de
-- INSERT da tabela `enquetes` já cobrem.
--
-- Aplicar no SQL Editor do Studio ANTES de publicar o front.

DROP POLICY IF EXISTS votos_delete_marketing ON public.votos_de_enquete;
CREATE POLICY votos_delete_marketing
  ON public.votos_de_enquete FOR DELETE TO authenticated
  USING (public.is_marketing_user(auth.uid()));

GRANT DELETE ON public.votos_de_enquete TO authenticated;

-- O "já vi" do tutorial do Jornal passa a valer por conta, não por navegador.
--
-- Até aqui a marca morava no localStorage: em outro computador, ou num
-- navegador que não guarda dados do site, o tutorial abria de novo a cada
-- visita. Decisão de 08/09/2026: guardar no banco, por pessoa.
--
-- Não é uma coluna em `profiles`, de propósito. `profiles` não tem policy de
-- UPDATE para a própria linha desde 27/08 (trava de escalada de privilégio), e
-- reabrir isso por causa de uma marca de tutorial seria trocar segurança por
-- conveniência. Uma tabela só dela, com RLS só dela, não toca em nada disso.
--
-- Uma linha por (pessoa, percurso). Percursos hoje: 'listagem' e 'editor';
-- o front decide quais existem, o banco só guarda.

CREATE TABLE IF NOT EXISTS public.tutoriais_vistos (
  user_id  uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  percurso text        NOT NULL,
  visto_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, percurso)
);

COMMENT ON TABLE public.tutoriais_vistos IS 'Tutoriais que cada pessoa já viu (Jornal: listagem, editor). Vale por conta, em qualquer computador.';

ALTER TABLE public.tutoriais_vistos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.tutoriais_vistos TO authenticated;
GRANT ALL ON public.tutoriais_vistos TO service_role;

-- Cada pessoa só vê, marca e desmarca o que é dela. Não há UPDATE: a linha
-- existe ou não existe.
DROP POLICY IF EXISTS "tutoriais_vistos_own_select" ON public.tutoriais_vistos;
CREATE POLICY "tutoriais_vistos_own_select"
  ON public.tutoriais_vistos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tutoriais_vistos_own_insert" ON public.tutoriais_vistos;
CREATE POLICY "tutoriais_vistos_own_insert"
  ON public.tutoriais_vistos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tutoriais_vistos_own_delete" ON public.tutoriais_vistos;
CREATE POLICY "tutoriais_vistos_own_delete"
  ON public.tutoriais_vistos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

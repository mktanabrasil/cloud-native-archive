-- Marca de tutoriais já vistos, uma linha por usuário e por tutorial.
--
-- Genérica de propósito: guarda *qual* tutorial foi visto, e não um sim/não.
-- Assim o mesmo mecanismo atende Calendário e Notícias depois, sem tocar no
-- banco de novo.
--
-- Fica fora de `profiles` porque é registro de uso, não dado cadastral: cresce
-- por linha conforme surgem telas novas, em vez de por coluna.

CREATE TABLE public.user_tutorials (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tutorial)
);

-- Sem UPDATE: uma marca de "já viu" nunca é editada. Quem termina o tutorial
-- de novo grava com ON CONFLICT DO NOTHING, que só precisa de INSERT.
GRANT SELECT, INSERT ON public.user_tutorials TO authenticated;
GRANT ALL ON public.user_tutorials TO service_role;

ALTER TABLE public.user_tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cada um ve os proprios tutoriais"
ON public.user_tutorials FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Cada um marca os proprios tutoriais"
ON public.user_tutorials FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

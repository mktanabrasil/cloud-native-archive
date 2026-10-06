-- Trabalhe Conosco, PR 7 (06/10/2026): perfil e currículo do candidato.
--
-- O perfil é preenchido uma vez só, em 5 passos (mockup aprovado em 06/10):
-- sobre você, contato, formação, experiência e disponibilidade. Sem CPF, RG,
-- endereço completo, idiomas, competências nem pronome, por decisão dele.
-- O currículo é um arquivo só, num balde PRIVADO: o candidato mexe só na
-- própria pasta, e o RH (is_rh_or_admin) lê. Ao trocar, o antigo é apagado.

-- 1. Colunas novas em candidatos -------------------------------------------------

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS nome_social          text,
  ADD COLUMN IF NOT EXISTS nascimento           date,
  ADD COLUMN IF NOT EXISTS whatsapp             text,
  ADD COLUMN IF NOT EXISTS cidade               text,
  ADD COLUMN IF NOT EXISTS bairro               text,
  ADD COLUMN IF NOT EXISTS escolaridade         text,
  ADD COLUMN IF NOT EXISTS curso                text,
  ADD COLUMN IF NOT EXISTS cursos_livres        text,
  ADD COLUMN IF NOT EXISTS sem_experiencia      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disponibilidade      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acessibilidade       text,
  ADD COLUMN IF NOT EXISTS perfil_concluido_em  timestamptz,
  ADD COLUMN IF NOT EXISTS curriculo_caminho    text,
  ADD COLUMN IF NOT EXISTS curriculo_nome       text,
  ADD COLUMN IF NOT EXISTS curriculo_tamanho    integer,
  ADD COLUMN IF NOT EXISTS curriculo_enviado_em timestamptz;

ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_escolaridade_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_escolaridade_check CHECK (
  escolaridade IS NULL OR escolaridade IN (
    'fundamental', 'medio_cursando', 'medio', 'tecnico', 'superior_cursando', 'superior', 'pos'
  )
);

ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_disponibilidade_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_disponibilidade_check CHECK (
  disponibilidade <@ ARRAY['manha', 'tarde', 'noite', 'fim_de_semana']::text[]
);

ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_textos_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_textos_check CHECK (
  coalesce(length(nome_social), 0) <= 120
  AND coalesce(length(whatsapp), 0) <= 20
  AND coalesce(length(cidade), 0) <= 80
  AND coalesce(length(bairro), 0) <= 80
  AND coalesce(length(curso), 0) <= 160
  AND coalesce(length(cursos_livres), 0) <= 600
  AND coalesce(length(acessibilidade), 0) <= 600
);


-- 2. Experiências ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.candidato_experiencias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.candidatos (user_id) ON DELETE CASCADE,
  funcao      text NOT NULL,
  onde        text NOT NULL,
  -- mês e ano, "2023-03"; fim nulo com atual = true é o trabalho de hoje
  inicio      text NOT NULL,
  fim         text,
  atual       boolean NOT NULL DEFAULT false,
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidato_experiencias_textos_check CHECK (
    length(btrim(funcao)) BETWEEN 1 AND 120
    AND length(btrim(onde)) BETWEEN 1 AND 120
    AND coalesce(length(descricao), 0) <= 600
  ),
  CONSTRAINT candidato_experiencias_mes_check CHECK (
    inicio ~ '^\d{4}-(0[1-9]|1[0-2])$'
    AND (fim IS NULL OR fim ~ '^\d{4}-(0[1-9]|1[0-2])$')
    AND (atual OR fim IS NOT NULL)
    AND (fim IS NULL OR fim >= inicio)
  )
);

CREATE INDEX IF NOT EXISTS candidato_experiencias_user_idx ON public.candidato_experiencias (user_id);

COMMENT ON TABLE public.candidato_experiencias IS 'Experiências do perfil do candidato (Trabalhe Conosco, 06/10/2026).';

ALTER TABLE public.candidato_experiencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS candidato_experiencias_proprias ON public.candidato_experiencias;
CREATE POLICY candidato_experiencias_proprias
  ON public.candidato_experiencias FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS candidato_experiencias_rh ON public.candidato_experiencias;
CREATE POLICY candidato_experiencias_rh
  ON public.candidato_experiencias FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidato_experiencias TO authenticated;
GRANT ALL ON public.candidato_experiencias TO service_role;

DROP TRIGGER IF EXISTS update_candidato_experiencias_updated_at ON public.candidato_experiencias;
CREATE TRIGGER update_candidato_experiencias_updated_at
BEFORE UPDATE ON public.candidato_experiencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Balde privado dos currículos ---------------------------------------------------
-- Caminho: <user_id>/curriculo-<uuid>.<ext>. Só PDF, JPG e PNG, até 10 MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('curriculos', 'curriculos', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS curriculos_proprio_ler ON storage.objects;
CREATE POLICY curriculos_proprio_ler
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'curriculos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS curriculos_proprio_enviar ON storage.objects;
CREATE POLICY curriculos_proprio_enviar
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'curriculos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS curriculos_proprio_apagar ON storage.objects;
CREATE POLICY curriculos_proprio_apagar
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'curriculos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS curriculos_rh_ler ON storage.objects;
CREATE POLICY curriculos_rh_ler
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'curriculos' AND public.is_rh_or_admin(auth.uid()));

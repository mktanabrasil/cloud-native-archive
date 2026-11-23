-- Feedback do app, PR 1 (23/11/2026; mockup aprovado e decisões dele no mesmo dia).
--
-- O botão "Dar feedback" na faixa de cada setor grava aqui. Decisões:
--   - só o marketing vê todos (a caixa no Painel vem no PR 2);
--   - quem mandou vê os próprios, com a situação e a resposta;
--   - sempre identificado (o nome e o e-mail saem da conta, nunca do pedido);
--   - um print opcional, no balde privado `feedback-prints`, na pasta da pessoa;
--   - um e-mail ao mkt@ a cada feedback (função `feedback-aviso`; a tabela
--     `feedback_avisos` guarda o que já foi avisado).
--
-- O app só grava pela função `feedback_enviar`: ninguém escreve na tabela
-- direto. Contas de candidato (Trabalhe Conosco) e contas desativadas não
-- mandam feedback.
--
-- ORDEM: rodar ANTES do merge (sem ele, o botão mostra erro ao enviar).
-- Pode rodar de novo sem estragar nada.

-- 1. A tabela --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A conta pode ser apagada depois: o feedback fica, com o nome e o e-mail guardados.
  autor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome      text NOT NULL,
  autor_email     text,
  tipo            text NOT NULL,
  texto           text NOT NULL,
  setor           text,
  pagina          text,
  caminho         text,
  aparelho        text,
  navegador       text,
  print_path      text,
  situacao        text NOT NULL DEFAULT 'novo',
  resposta        text,
  respondido_por  text,
  respondido_em   timestamptz,
  lido_em         timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedbacks_tipo_check CHECK (tipo IN ('ideia', 'erro', 'falta', 'elogio')),
  CONSTRAINT feedbacks_situacao_check CHECK (situacao IN ('novo', 'analise', 'feito', 'nao')),
  CONSTRAINT feedbacks_texto_check CHECK (char_length(btrim(texto)) BETWEEN 1 AND 4000),
  CONSTRAINT feedbacks_aparelho_check CHECK (aparelho IS NULL OR aparelho IN ('celular', 'computador'))
);
CREATE INDEX IF NOT EXISTS feedbacks_autor_idx ON public.feedbacks (autor_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS feedbacks_criado_idx ON public.feedbacks (criado_em DESC);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedbacks FROM anon, authenticated;
GRANT SELECT ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;

-- Quem mandou vê os seus; o marketing vê todos. Ninguém escreve direto.
DROP POLICY IF EXISTS feedbacks_ler ON public.feedbacks;
CREATE POLICY feedbacks_ler ON public.feedbacks FOR SELECT TO authenticated
  USING (autor_id = auth.uid() OR public.is_marketing_user(auth.uid()));

-- 2. O balde do print (privado; cada pessoa sobe na própria pasta) ----------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-prints', 'feedback-prints', false, 8388608, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS feedback_prints_subir ON storage.objects;
CREATE POLICY feedback_prints_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-prints' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS feedback_prints_ler ON storage.objects;
CREATE POLICY feedback_prints_ler ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-prints' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_marketing_user(auth.uid())));

-- Apagar só o print que não chegou a virar feedback (o envio falhou no meio).
DROP POLICY IF EXISTS feedback_prints_apagar ON storage.objects;
CREATE POLICY feedback_prints_apagar ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-prints' AND (storage.foldername(name))[1] = auth.uid()::text
         AND NOT EXISTS (SELECT 1 FROM public.feedbacks f WHERE f.print_path = storage.objects.name));

-- 3. Enviar -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.feedback_enviar(
  _tipo text, _texto text, _setor text DEFAULT NULL, _pagina text DEFAULT NULL, _caminho text DEFAULT NULL,
  _aparelho text DEFAULT NULL, _navegador text DEFAULT NULL, _print text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  eu uuid := auth.uid();
  conta auth.users%ROWTYPE;
  nome text;
  novo uuid;
  limpa text := btrim(coalesce(_texto, ''));
  corta text := NULLIF(btrim(coalesce(_print, '')), '');
BEGIN
  IF eu IS NULL THEN
    RAISE EXCEPTION 'Entre no app para mandar feedback.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO conta FROM auth.users u WHERE u.id = eu;
  IF NOT FOUND OR coalesce(conta.raw_user_meta_data->>'conta', '') = 'candidato'
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = eu AND p.is_active IS NOT FALSE) THEN
    RAISE EXCEPTION 'Só a equipe manda feedback pelo app.' USING ERRCODE = '42501';
  END IF;
  IF _tipo IS NULL OR _tipo NOT IN ('ideia', 'erro', 'falta', 'elogio') THEN
    RAISE EXCEPTION 'Escolha sobre o que é o feedback.' USING ERRCODE = '22023';
  END IF;
  IF limpa = '' THEN
    RAISE EXCEPTION 'Escreva o feedback.' USING ERRCODE = '22023';
  END IF;
  IF char_length(limpa) > 4000 THEN
    RAISE EXCEPTION 'O feedback passou de 4.000 caracteres.' USING ERRCODE = '22023';
  END IF;
  -- O print tem de ser da pasta da pessoa e já estar no balde.
  IF corta IS NOT NULL AND (
       split_part(corta, '/', 1) <> eu::text
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'feedback-prints' AND o.name = corta)
     ) THEN
    RAISE EXCEPTION 'O print não chegou. Anexe de novo.' USING ERRCODE = '22023';
  END IF;

  nome := COALESCE(
    (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.user_id = eu),
    NULLIF(btrim(conta.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(conta.email, ''), '@', 1),
    'Equipe'
  );

  INSERT INTO public.feedbacks (autor_id, autor_nome, autor_email, tipo, texto, setor, pagina, caminho, aparelho, navegador, print_path)
  VALUES (
    eu, nome, lower(conta.email), _tipo, limpa,
    left(NULLIF(btrim(coalesce(_setor, '')), ''), 60),
    left(NULLIF(btrim(coalesce(_pagina, '')), ''), 80),
    left(NULLIF(btrim(coalesce(_caminho, '')), ''), 300),
    CASE WHEN _aparelho IN ('celular', 'computador') THEN _aparelho END,
    left(NULLIF(btrim(coalesce(_navegador, '')), ''), 60),
    corta
  ) RETURNING id INTO novo;
  RETURN novo;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_enviar(text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feedback_enviar(text, text, text, text, text, text, text, text) TO authenticated;

-- 4. O registro dos avisos por e-mail (só a função lê e escreve) ------------------------
-- 'novo': o feedback chegou, vai ao mkt@. 'resposta': o marketing respondeu (PR 2).
CREATE TABLE IF NOT EXISTS public.feedback_avisos (
  feedback_id    uuid NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  marca          timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'enviando',
  destinatarios  text[] NOT NULL DEFAULT '{}',
  erro           text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, tipo, marca),
  CONSTRAINT feedback_avisos_tipo_check CHECK (tipo IN ('novo', 'resposta')),
  CONSTRAINT feedback_avisos_status_check CHECK (status IN ('enviando', 'enviado', 'sem_destinatario', 'falhou'))
);
ALTER TABLE public.feedback_avisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_avisos FROM anon, authenticated;
GRANT ALL ON public.feedback_avisos TO service_role;

-- Conferência.
SELECT 'tabela feedbacks' AS item, (to_regclass('public.feedbacks') IS NOT NULL)::text AS valor
UNION ALL SELECT 'tabela feedback_avisos', (to_regclass('public.feedback_avisos') IS NOT NULL)::text
UNION ALL SELECT 'RLS ligada', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.feedbacks'::regclass)
UNION ALL SELECT 'balde privado', (SELECT (NOT public)::text FROM storage.buckets WHERE id = 'feedback-prints')
UNION ALL SELECT 'políticas do balde', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'feedback_prints_%')
UNION ALL SELECT 'função feedback_enviar', (to_regprocedure('public.feedback_enviar(text, text, text, text, text, text, text, text)') IS NOT NULL)::text;

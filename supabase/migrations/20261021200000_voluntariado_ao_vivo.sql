-- Voluntariado do Natal Feliz (21/10/2026): o painel ao vivo da gestão.
--
-- Decisões dele: um link à parte, como o acompanhamento da enquete, com um
-- CÓDIGO SECRETO no endereço (/voluntariado/acompanhar/<código>), que a
-- comunicação copia e pode trocar no painel; mostra nome, unidade e áreas de
-- quem se inscreveu, nunca o WhatsApp nem o protocolo; meta de voluntários
-- editável no painel (sem número, sem barra); a página busca de novo a cada
-- 30 segundos.

-- 1. A configuração: uma linha só ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_config (
  id                      integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  codigo_acompanhamento   text NOT NULL,
  meta                    integer CHECK (meta IS NULL OR meta BETWEEN 1 AND 5000),
  atualizado_em           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.voluntariado_config (id, codigo_acompanhamento)
VALUES (1, left(replace(gen_random_uuid()::text, '-', ''), 24))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.voluntariado_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voluntariado_config_comunicacao ON public.voluntariado_config;
CREATE POLICY voluntariado_config_comunicacao ON public.voluntariado_config FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));
REVOKE ALL ON public.voluntariado_config FROM anon, authenticated;
GRANT SELECT ON public.voluntariado_config TO authenticated;
GRANT ALL ON public.voluntariado_config TO service_role;

-- 2. A comunicação troca o código e define a meta -------------------------------------------

CREATE OR REPLACE FUNCTION public.trocar_codigo_do_voluntariado()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo text := left(replace(gen_random_uuid()::text, '-', ''), 24);
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.voluntariado_config SET codigo_acompanhamento = novo, atualizado_em = now() WHERE id = 1;
  RETURN novo;
END;
$$;

CREATE OR REPLACE FUNCTION public.definir_meta_do_voluntariado(p_meta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_meta IS NOT NULL AND p_meta NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'meta_invalida'; END IF;
  UPDATE public.voluntariado_config SET meta = p_meta, atualizado_em = now() WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.trocar_codigo_do_voluntariado() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_meta_do_voluntariado(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trocar_codigo_do_voluntariado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_meta_do_voluntariado(integer) TO authenticated;

-- 3. O que o link de acompanhamento lê (sem login, só com o código certo) ---------------------

-- Nome, unidade, área e as duas opções de cada inscrição, e a meta. Nunca o
-- WhatsApp nem o protocolo. As contas (por dia, por área…) são feitas na página.
CREATE OR REPLACE FUNCTION public.acompanhamento_do_voluntariado(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT * INTO cfg FROM public.voluntariado_config WHERE id = 1;
  IF cfg IS NULL OR coalesce(p_codigo, '') = '' OR p_codigo <> cfg.codigo_acompanhamento THEN
    RAISE EXCEPTION 'codigo_invalido';
  END IF;
  RETURN jsonb_build_object(
    'meta', cfg.meta,
    'agora', now(),
    'inscricoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'nome', v.nome, 'unidade_id', v.unidade_id, 'unidade_nome', v.unidade_nome, 'area', v.area,
        'opcao1', v.opcao1, 'opcao2', v.opcao2, 'created_at', v.created_at
      ) ORDER BY v.created_at)
      FROM public.voluntarios_natal v
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.acompanhamento_do_voluntariado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acompanhamento_do_voluntariado(text) TO anon, authenticated;

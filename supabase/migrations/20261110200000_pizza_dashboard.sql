-- Pizza da Alegria (10/11/2026): o dashboard.
--
-- Duas portas para os mesmos gráficos:
--  - a equipe do painel (comunicação e ADM/financeiro), com login, em
--    /pizza-da-alegria/painel/dashboard;
--  - a gestão, sem login, por um link com CÓDIGO SECRETO no endereço
--    (/pizza-da-alegria/acompanhar/<código>), como o acompanhamento ao vivo do
--    Voluntariado. A comunicação copia o link no painel e pode trocar o código.
--
-- O que o link da gestão lê: nome, unidade, área, sabores, valor, forma de
-- pagamento e retirada de cada pedido. Nunca o número do pedido (é ele que vale
-- na retirada, não pode circular), o código do Mercado Pago nem o comprovante.
--
-- Pode rodar de novo sem estragar nada.

-- 1. O código do link da gestão: uma linha só ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.pizza_config (
  id                      integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  codigo_acompanhamento   text NOT NULL,
  atualizado_em           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.pizza_config (id, codigo_acompanhamento)
VALUES (1, left(replace(gen_random_uuid()::text, '-', ''), 24))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pizza_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pizza_config_painel ON public.pizza_config;
CREATE POLICY pizza_config_painel ON public.pizza_config FOR SELECT TO authenticated
  USING (public.pode_ver_pizza(auth.uid()));
REVOKE ALL ON public.pizza_config FROM anon, authenticated;
GRANT SELECT ON public.pizza_config TO authenticated;
GRANT ALL ON public.pizza_config TO service_role;

-- 2. A comunicação troca o código (o link antigo para de abrir) ------------------------------

CREATE OR REPLACE FUNCTION public.trocar_codigo_da_pizza()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo text := left(replace(gen_random_uuid()::text, '-', ''), 24);
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.pizza_config SET codigo_acompanhamento = novo, atualizado_em = now() WHERE id = 1;
  RETURN novo;
END;
$$;

REVOKE ALL ON FUNCTION public.trocar_codigo_da_pizza() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trocar_codigo_da_pizza() TO authenticated;

-- 3. Os dados do dashboard -----------------------------------------------------------------

-- Sem código: só a equipe do painel (e aí vem também o número do pedido).
-- Com código: qualquer pessoa com o link certo, sem o número.
-- As contas (por dia, por unidade, por sabor…) são feitas na página.
CREATE OR REPLACE FUNCTION public.dados_do_dashboard_da_pizza(p_codigo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
  equipe boolean := coalesce(p_codigo, '') = '';
BEGIN
  IF equipe THEN
    IF NOT public.pode_ver_pizza(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  ELSE
    SELECT * INTO cfg FROM public.pizza_config WHERE id = 1;
    IF cfg IS NULL OR p_codigo <> cfg.codigo_acompanhamento THEN RAISE EXCEPTION 'codigo_invalido'; END IF;
  END IF;
  RETURN jsonb_build_object(
    'agora', now(),
    'pedidos', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'nome', c.nome, 'unidade_id', c.unidade_id, 'unidade_nome', c.unidade_nome, 'area', c.area,
          'sabores', c.sabores, 'quantidade', c.quantidade, 'total', c.total,
          'forma', c.forma, 'mp_forma', c.mp_forma, 'mp_bandeira', c.mp_bandeira,
          'retirada', c.retirada, 'retirada_em', c.retirada_em, 'created_at', c.created_at
        ) || CASE WHEN equipe THEN jsonb_build_object('numero', c.numero) ELSE '{}'::jsonb END
        ORDER BY c.created_at)
      FROM public.pizza_confirmacoes c
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dados_do_dashboard_da_pizza(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dados_do_dashboard_da_pizza(text) TO anon, authenticated;

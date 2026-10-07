-- Pizza da Alegria (07/10/2026): confirmação de pagamento, só para controle.
--
-- O pedido e o pagamento acontecem na unidade. Pelo link público
-- (/pizza-da-alegria), quem já pagou confirma o nome, a unidade em que
-- trabalha, os sabores, a forma de pagamento e anexa o comprovante
-- (obrigatório; opcional só no dinheiro). Ninguém de fora lê nada: o envio
-- passa por uma função, e só ADM (financeiro), comunicação e admin veem o
-- painel. Pedidos até 30/11/2026; retirada 04/12/2026, na unidade.

-- 1. Quem vê o painel -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pode_ver_pizza(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_marketing_user(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = _user_id AND p.bond_type = 'financeiro' AND coalesce(p.is_active, false)
      );
$$;

REVOKE ALL ON FUNCTION public.pode_ver_pizza(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_pizza(uuid) TO authenticated;

-- 2. Tabela -------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.pizza_numero_seq;

CREATE TABLE IF NOT EXISTS public.pizza_confirmacoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                text NOT NULL UNIQUE,
  nome                  text NOT NULL,
  unidade_id            text NOT NULL,
  unidade_nome          text NOT NULL,
  area                  text NOT NULL,
  -- { "marguerita": 1, "calabresa": 2 }
  sabores               jsonb NOT NULL,
  quantidade            integer NOT NULL,
  total                 numeric(10, 2) NOT NULL,
  forma                 text NOT NULL,
  comprovante_caminho   text,
  comprovante_nome      text,
  retirada              boolean NOT NULL DEFAULT false,
  retirada_em           timestamptz,
  -- parte 2: quando a cópia para o Drive (Setor Marketing) ficar pronta
  drive_copiado_em      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pizza_area_check CHECK (area IN ('educacao', 'social')),
  CONSTRAINT pizza_forma_check CHECK (forma IN ('pix', 'credito', 'debito', 'dinheiro', 'pluxee')),
  CONSTRAINT pizza_quantidade_check CHECK (quantidade BETWEEN 1 AND 200),
  CONSTRAINT pizza_comprovante_check CHECK (forma = 'dinheiro' OR comprovante_caminho IS NOT NULL)
);

COMMENT ON TABLE public.pizza_confirmacoes IS 'Pizza da Alegria: confirmações de pagamento (07/10/2026).';

CREATE INDEX IF NOT EXISTS pizza_confirmacoes_unidade_idx ON public.pizza_confirmacoes (unidade_id, created_at DESC);

DROP TRIGGER IF EXISTS update_pizza_confirmacoes_updated_at ON public.pizza_confirmacoes;
CREATE TRIGGER update_pizza_confirmacoes_updated_at
BEFORE UPDATE ON public.pizza_confirmacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pizza_confirmacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pizza_select_painel ON public.pizza_confirmacoes;
CREATE POLICY pizza_select_painel
  ON public.pizza_confirmacoes FOR SELECT TO authenticated
  USING (public.pode_ver_pizza(auth.uid()));

-- O painel só marca a retirada.
DROP POLICY IF EXISTS pizza_update_painel ON public.pizza_confirmacoes;
CREATE POLICY pizza_update_painel
  ON public.pizza_confirmacoes FOR UPDATE TO authenticated
  USING (public.pode_ver_pizza(auth.uid()))
  WITH CHECK (public.pode_ver_pizza(auth.uid()));

GRANT SELECT, UPDATE ON public.pizza_confirmacoes TO authenticated;
GRANT ALL ON public.pizza_confirmacoes TO service_role;

-- 3. Comprovantes: balde privado; quem envia só sobe, nunca lê ---------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pizza-comprovantes', 'pizza-comprovantes', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS pizza_comprovante_enviar ON storage.objects;
CREATE POLICY pizza_comprovante_enviar
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'pizza-comprovantes' AND (storage.foldername(name))[1] = 'envios');

DROP POLICY IF EXISTS pizza_comprovante_ler ON storage.objects;
CREATE POLICY pizza_comprovante_ler
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pizza-comprovantes' AND public.pode_ver_pizza(auth.uid()));

-- 4. A confirmação pública ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirmar_pizza(
  p_nome text,
  p_unidade_id text,
  p_unidade_nome text,
  p_area text,
  p_sabores jsonb,
  p_forma text,
  p_comprovante text DEFAULT NULL,
  p_comprovante_nome text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  permitidos text[] := ARRAY['marguerita', 'frango', 'calabresa', 'mucarela', 'lombo', 'napolitana'];
  chave text;
  qtd integer;
  total_qtd integer := 0;
  limpos jsonb := '{}'::jsonb;
  v_numero text;
BEGIN
  -- Prazo: até 30/11/2026, horário de Brasília.
  IF now() >= timestamptz '2026-12-01 00:00:00 America/Sao_Paulo' THEN
    RAISE EXCEPTION 'prazo_encerrado';
  END IF;

  IF length(btrim(coalesce(p_nome, ''))) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'nome_invalido';
  END IF;
  IF length(btrim(coalesce(p_unidade_id, ''))) NOT BETWEEN 1 AND 60
     OR length(btrim(coalesce(p_unidade_nome, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'unidade_invalida';
  END IF;
  IF p_area NOT IN ('educacao', 'social') THEN
    RAISE EXCEPTION 'unidade_invalida';
  END IF;
  IF p_forma NOT IN ('pix', 'credito', 'debito', 'dinheiro', 'pluxee') THEN
    RAISE EXCEPTION 'forma_invalida';
  END IF;

  IF jsonb_typeof(p_sabores) <> 'object' THEN
    RAISE EXCEPTION 'sabores_invalidos';
  END IF;
  FOR chave, qtd IN SELECT key, (value)::text::integer FROM jsonb_each(p_sabores) LOOP
    IF NOT chave = ANY (permitidos) OR qtd < 0 OR qtd > 50 THEN
      RAISE EXCEPTION 'sabores_invalidos';
    END IF;
    IF qtd > 0 THEN
      limpos := limpos || jsonb_build_object(chave, qtd);
      total_qtd := total_qtd + qtd;
    END IF;
  END LOOP;
  IF total_qtd = 0 THEN
    RAISE EXCEPTION 'sem_pizzas';
  END IF;

  -- Comprovante: obrigatório fora do dinheiro, e precisa ter subido mesmo.
  IF p_comprovante IS NULL AND p_forma <> 'dinheiro' THEN
    RAISE EXCEPTION 'comprovante_obrigatorio';
  END IF;
  IF p_comprovante IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pizza-comprovantes' AND o.name = p_comprovante
  ) THEN
    RAISE EXCEPTION 'comprovante_nao_encontrado';
  END IF;
  IF p_comprovante IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pizza_confirmacoes c WHERE c.comprovante_caminho = p_comprovante
  ) THEN
    RAISE EXCEPTION 'comprovante_repetido';
  END IF;

  v_numero := 'PZ-' || lpad(nextval('public.pizza_numero_seq')::text, 4, '0');

  INSERT INTO public.pizza_confirmacoes
    (numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, comprovante_caminho, comprovante_nome)
  VALUES
    (v_numero, left(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), 120), btrim(p_unidade_id), left(btrim(p_unidade_nome), 120), p_area,
     limpos, total_qtd, total_qtd * 50, p_forma, p_comprovante, left(p_comprovante_nome, 200));

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_pizza(text, text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_pizza(text, text, text, text, jsonb, text, text, text) TO anon, authenticated;
GRANT USAGE ON SEQUENCE public.pizza_numero_seq TO service_role;

-- Pizza da Alegria (09/11/2026): o preço passou de R$ 50 para R$ 55.
-- Mesma função de 20261109120000, só muda o total. Confirmações antigas ficam com o valor gravado.

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
  letras constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  tentativa integer := 0;
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

  LOOP
    tentativa := tentativa + 1;
    v_numero := 'PZ-' || (
      SELECT string_agg(substr(letras, 1 + floor(random() * length(letras))::integer, 1), '')
      FROM generate_series(1, 5)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pizza_confirmacoes c WHERE c.numero = v_numero);
    IF tentativa >= 20 THEN RAISE EXCEPTION 'numero_indisponivel'; END IF;
  END LOOP;

  INSERT INTO public.pizza_confirmacoes
    (numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, comprovante_caminho, comprovante_nome)
  VALUES
    (v_numero, left(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), 120), btrim(p_unidade_id), left(btrim(p_unidade_nome), 120), p_area,
     limpos, total_qtd, total_qtd * 55, p_forma, p_comprovante, left(p_comprovante_nome, 200));

  RETURN v_numero;
END;
$$;

-- Pizza da Alegria (09/11/2026): pagar online pelo Mercado Pago (Checkout Pro).
--
-- Quem ainda não pagou escolhe "Pagar agora", vai para a página do Mercado
-- Pago (Pix ou cartão) e volta para /pizza-da-alegria. O pagamento na unidade
-- com comprovante continua igual.
--
-- O pedido online fica em `pizza_pedidos_online` até o Mercado Pago aprovar.
-- Só então vira uma linha em `pizza_confirmacoes`, com forma 'mercado_pago' e
-- sem comprovante. Por isso o painel e a cópia para o Drive só veem pedidos
-- pagos e não precisaram mudar de lógica. Quem fala com o Mercado Pago é a
-- Edge Function `pizza-pagamento`, com a chave de serviço. Ninguém de fora lê
-- as tabelas.

-- 1. A confirmação aceita o Mercado Pago, sem comprovante ---------------------------

ALTER TABLE public.pizza_confirmacoes DROP CONSTRAINT IF EXISTS pizza_forma_check;
ALTER TABLE public.pizza_confirmacoes ADD CONSTRAINT pizza_forma_check
  CHECK (forma IN ('pix', 'credito', 'debito', 'dinheiro', 'pluxee', 'mercado_pago'));

ALTER TABLE public.pizza_confirmacoes DROP CONSTRAINT IF EXISTS pizza_comprovante_check;
ALTER TABLE public.pizza_confirmacoes ADD CONSTRAINT pizza_comprovante_check
  CHECK (forma IN ('dinheiro', 'mercado_pago') OR comprovante_caminho IS NOT NULL);

-- O número do pagamento no Mercado Pago, para a conciliação. Um pagamento, uma confirmação.
ALTER TABLE public.pizza_confirmacoes ADD COLUMN IF NOT EXISTS mp_pagamento_id text UNIQUE;

-- 2. Pedidos online, antes do pagamento ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pizza_pedidos_online (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  unidade_id        text NOT NULL,
  unidade_nome      text NOT NULL,
  area              text NOT NULL,
  sabores           jsonb NOT NULL,
  quantidade        integer NOT NULL,
  total             numeric(10, 2) NOT NULL,
  -- pendente → aprovado | recusado | cancelado | estornado
  status            text NOT NULL DEFAULT 'pendente',
  mp_order_id       text,
  mp_pagamento_id   text,
  mp_status         text,
  mp_status_detalhe text,
  confirmacao_id    uuid REFERENCES public.pizza_confirmacoes (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pizza_online_area_check CHECK (area IN ('educacao', 'social')),
  CONSTRAINT pizza_online_status_check CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado')),
  CONSTRAINT pizza_online_quantidade_check CHECK (quantidade BETWEEN 1 AND 200)
);

COMMENT ON TABLE public.pizza_pedidos_online IS 'Pizza da Alegria: pedidos pagos pelo Mercado Pago, antes e depois da aprovação (09/11/2026).';

DROP TRIGGER IF EXISTS update_pizza_pedidos_online_updated_at ON public.pizza_pedidos_online;
CREATE TRIGGER update_pizza_pedidos_online_updated_at
BEFORE UPDATE ON public.pizza_pedidos_online
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Só a chave de serviço (a Edge Function). O painel pode ler, para acompanhar.
ALTER TABLE public.pizza_pedidos_online ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pizza_online_select_painel ON public.pizza_pedidos_online;
CREATE POLICY pizza_online_select_painel
  ON public.pizza_pedidos_online FOR SELECT TO authenticated
  USING (public.pode_ver_pizza(auth.uid()));

GRANT SELECT ON public.pizza_pedidos_online TO authenticated;
GRANT ALL ON public.pizza_pedidos_online TO service_role;

-- 3. Número da confirmação (PZ-XXXXX), o mesmo sorteio de confirmar_pizza -----------------

CREATE OR REPLACE FUNCTION public.pizza_novo_numero()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  letras constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_numero text;
  tentativa integer := 0;
BEGIN
  LOOP
    tentativa := tentativa + 1;
    v_numero := 'PZ-' || (
      SELECT string_agg(substr(letras, 1 + floor(random() * length(letras))::integer, 1), '')
      FROM generate_series(1, 5)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pizza_confirmacoes c WHERE c.numero = v_numero);
    IF tentativa >= 20 THEN RAISE EXCEPTION 'numero_indisponivel'; END IF;
  END LOOP;
  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.pizza_novo_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pizza_novo_numero() TO service_role;

-- 4. Reservar o pedido online (antes de ir ao Mercado Pago) -------------------------------
-- Mesmas regras de confirmar_pizza: prazo, nome, unidade, sabores. O preço sai daqui.

CREATE OR REPLACE FUNCTION public.pizza_reservar_online(
  p_nome text,
  p_unidade_id text,
  p_unidade_nome text,
  p_area text,
  p_sabores jsonb
)
RETURNS TABLE (id uuid, quantidade integer, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preco constant integer := 55;
  permitidos text[] := ARRAY['marguerita', 'frango', 'calabresa', 'mucarela', 'lombo', 'napolitana'];
  chave text;
  qtd integer;
  total_qtd integer := 0;
  limpos jsonb := '{}'::jsonb;
  v_id uuid;
BEGIN
  IF now() >= timestamptz '2026-12-01 00:00:00 America/Sao_Paulo' THEN
    RAISE EXCEPTION 'prazo_encerrado';
  END IF;
  IF length(btrim(coalesce(p_nome, ''))) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'nome_invalido';
  END IF;
  IF length(btrim(coalesce(p_unidade_id, ''))) NOT BETWEEN 1 AND 60
     OR length(btrim(coalesce(p_unidade_nome, ''))) NOT BETWEEN 1 AND 120
     OR p_area NOT IN ('educacao', 'social') THEN
    RAISE EXCEPTION 'unidade_invalida';
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

  INSERT INTO public.pizza_pedidos_online (nome, unidade_id, unidade_nome, area, sabores, quantidade, total)
  VALUES (left(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), 120), btrim(p_unidade_id), left(btrim(p_unidade_nome), 120),
          p_area, limpos, total_qtd, total_qtd * preco)
  RETURNING pizza_pedidos_online.id INTO v_id;

  RETURN QUERY SELECT v_id, total_qtd, (total_qtd * preco)::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.pizza_reservar_online(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pizza_reservar_online(text, text, text, text, jsonb) TO service_role;

-- 5. Aprovar: o pagamento aprovado vira confirmação. Pode ser chamada de novo sem duplicar. --

CREATE OR REPLACE FUNCTION public.pizza_aprovar_online(
  p_pedido uuid,
  p_pagamento_id text,
  p_valor numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pizza_pedidos_online%ROWTYPE;
  v_numero text;
  v_confirmacao uuid;
BEGIN
  SELECT * INTO v_pedido FROM public.pizza_pedidos_online WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pedido_nao_encontrado';
  END IF;

  -- Já aprovado (o aviso do Mercado Pago chega mais de uma vez): devolve o mesmo número.
  IF v_pedido.confirmacao_id IS NOT NULL THEN
    SELECT numero INTO v_numero FROM public.pizza_confirmacoes WHERE id = v_pedido.confirmacao_id;
    RETURN v_numero;
  END IF;

  IF p_valor IS NULL OR p_valor < v_pedido.total THEN
    RAISE EXCEPTION 'valor_divergente';
  END IF;

  v_numero := public.pizza_novo_numero();

  INSERT INTO public.pizza_confirmacoes
    (numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, mp_pagamento_id)
  VALUES
    (v_numero, v_pedido.nome, v_pedido.unidade_id, v_pedido.unidade_nome, v_pedido.area,
     v_pedido.sabores, v_pedido.quantidade, v_pedido.total, 'mercado_pago', p_pagamento_id)
  RETURNING id INTO v_confirmacao;

  UPDATE public.pizza_pedidos_online
     SET status = 'aprovado', mp_pagamento_id = p_pagamento_id, mp_status = 'approved', confirmacao_id = v_confirmacao
   WHERE id = p_pedido;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.pizza_aprovar_online(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pizza_aprovar_online(uuid, text, numeric) TO service_role;

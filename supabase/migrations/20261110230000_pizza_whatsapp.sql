-- Pizza da Alegria (10/11/2026): o WhatsApp e "Seus pedidos".
--
-- Decisões dele (mockup https://claude.ai/artifact/9SBAvUhduZ9fr21iGGJUuq):
--  - o formulário pede o WhatsApp com DDD, logo depois do nome;
--  - quem volta ao formulário com o MESMO nome e o MESMO WhatsApp vê os
--    próprios pedidos e baixa o comprovante de novo. Só o WhatsApp não basta:
--    o comprovante é o ingresso da retirada;
--  - os pedidos de antes não têm WhatsApp e não são reconhecidos;
--  - o WhatsApp aparece na planilha e no painel, nunca no link da gestão nem
--    no comprovante;
--  - na retirada, quem tem mais pedidos a retirar é mostrado, com "Registrar
--    todos".
--
-- O WhatsApp é gravado só com os dígitos (10 ou 11). Pode rodar de novo sem
-- estragar nada.

ALTER TABLE public.pizza_pedidos_online ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.pizza_confirmacoes   ADD COLUMN IF NOT EXISTS telefone text;
CREATE INDEX IF NOT EXISTS pizza_confirmacoes_telefone_idx   ON public.pizza_confirmacoes (telefone);
CREATE INDEX IF NOT EXISTS pizza_pedidos_online_telefone_idx ON public.pizza_pedidos_online (telefone);
COMMENT ON COLUMN public.pizza_confirmacoes.telefone IS 'Pizza da Alegria: WhatsApp de quem pediu, só dígitos (10/11/2026).';

-- O nome para comparar: sem acento, minúsculo, espaços simples.
CREATE OR REPLACE FUNCTION public.pizza_nome_comparavel(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'));
$$;

-- 1. Aprovar o pagamento: igual à de 09/11, agora levando o WhatsApp para a confirmação.
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
    (numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma, mp_pagamento_id, telefone)
  VALUES
    (v_numero, v_pedido.nome, v_pedido.unidade_id, v_pedido.unidade_nome, v_pedido.area,
     v_pedido.sabores, v_pedido.quantidade, v_pedido.total, 'mercado_pago', p_pagamento_id, v_pedido.telefone)
  RETURNING id INTO v_confirmacao;

  UPDATE public.pizza_pedidos_online
     SET status = 'aprovado', mp_pagamento_id = p_pagamento_id, mp_status = 'approved', confirmacao_id = v_confirmacao
   WHERE id = p_pedido;

  RETURN v_numero;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pizza_aprovar_online(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pizza_aprovar_online(uuid, text, numeric) TO service_role;

-- 2. "Seus pedidos": nome e WhatsApp precisam bater. Sem login (é o formulário público).
--    Devolve os pagos (com o que o comprovante precisa) e os que ficaram sem pagar.
CREATE OR REPLACE FUNCTION public.meus_pedidos_da_pizza(p_nome text, p_telefone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_nome text := public.pizza_nome_comparavel(p_nome);
BEGIN
  IF length(v_tel) NOT BETWEEN 10 AND 11 OR length(v_nome) < 3 THEN
    RETURN jsonb_build_object('pagos', '[]'::jsonb, 'pendentes', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'pagos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'numero', c.numero, 'nome', c.nome, 'unidade_nome', c.unidade_nome, 'sabores', c.sabores,
        'quantidade', c.quantidade, 'total', c.total, 'mp_forma', c.mp_forma, 'mp_bandeira', c.mp_bandeira,
        'codigo', c.mp_pagamento_id, 'pago_em', coalesce(c.mp_aprovado_em, c.created_at),
        'retirada', c.retirada
      ) ORDER BY c.created_at)
      FROM public.pizza_confirmacoes c
      WHERE c.telefone = v_tel AND public.pizza_nome_comparavel(c.nome) = v_nome
    ), '[]'::jsonb),
    -- Sem pagar: recusados, expirados e pendentes há mais de 30 minutos (um Pix
    -- em andamento não aparece, para ninguém pagar duas vezes).
    'pendentes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'pedido', o.id, 'sabores', o.sabores, 'quantidade', o.quantidade, 'total', o.total,
        'status', o.status, 'criado_em', o.created_at
      ) ORDER BY o.created_at)
      FROM public.pizza_pedidos_online o
      WHERE o.telefone = v_tel AND public.pizza_nome_comparavel(o.nome) = v_nome
        AND o.confirmacao_id IS NULL
        AND (o.status IN ('recusado', 'cancelado') OR (o.status = 'pendente' AND o.created_at < now() - interval '30 minutes'))
        AND o.created_at > now() - interval '15 days'
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.meus_pedidos_da_pizza(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meus_pedidos_da_pizza(text, text) TO anon, authenticated;

-- 3. Retirada: além do pedido lido, os outros pedidos da mesma pessoa ainda a
--    retirar (mesmo WhatsApp; ou, sem WhatsApp, mesmo nome e mesma unidade).
CREATE OR REPLACE FUNCTION public.pizza_outros_a_retirar(c public.pizza_confirmacoes)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('numero', o.numero, 'sabores', o.sabores, 'quantidade', o.quantidade) ORDER BY o.created_at), '[]'::jsonb)
  FROM public.pizza_confirmacoes o
  WHERE o.id <> c.id AND NOT o.retirada
    AND ((c.telefone IS NOT NULL AND o.telefone = c.telefone)
      OR (public.pizza_nome_comparavel(o.nome) = public.pizza_nome_comparavel(c.nome) AND o.unidade_id = c.unidade_id));
$$;

REVOKE ALL ON FUNCTION public.pizza_outros_a_retirar(public.pizza_confirmacoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_retirada_pizza(p_numero text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.pizza_confirmacoes;
  quem text;
  v_numero text := upper(btrim(coalesce(p_numero, '')));
BEGIN
  IF NOT public.pode_ver_pizza(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT email INTO quem FROM auth.users WHERE id = auth.uid();

  UPDATE public.pizza_confirmacoes
     SET retirada = true, retirada_em = now(), retirada_por = quem
   WHERE pizza_confirmacoes.numero = v_numero AND NOT retirada
  RETURNING * INTO v;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'registrada', 'pedido', public.pizza_pedido_na_retirada(v), 'outros', public.pizza_outros_a_retirar(v));
  END IF;

  SELECT * INTO v FROM public.pizza_confirmacoes WHERE pizza_confirmacoes.numero = v_numero;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'nao_encontrado');
  END IF;
  RETURN jsonb_build_object('status', 'ja_retirada', 'pedido', public.pizza_pedido_na_retirada(v), 'outros', public.pizza_outros_a_retirar(v));
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_retirada_pizza(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_retirada_pizza(text) TO authenticated;

-- 4. A planilha passa a ter uma linha por pessoa (o desenho ganha a versão 2),
--    e o WhatsApp também marca a planilha como pendente.
ALTER TABLE public.pizza_planilha ADD COLUMN IF NOT EXISTS desenho_versao integer NOT NULL DEFAULT 1;
UPDATE public.pizza_planilha SET pendente = true WHERE id = 1;

DROP TRIGGER IF EXISTS pizza_planilha_mudou ON public.pizza_confirmacoes;
CREATE TRIGGER pizza_planilha_mudou
  AFTER UPDATE OF numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma,
                  retirada, retirada_em, mp_pagamento_id, mp_forma, mp_bandeira, telefone
  ON public.pizza_confirmacoes
  FOR EACH STATEMENT EXECUTE FUNCTION public.pizza_planilha_marcar();

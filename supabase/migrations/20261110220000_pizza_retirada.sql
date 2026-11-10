-- Pizza da Alegria (10/11/2026): a retirada com leitor de QR Code.
--
-- O comprovante traz um QR Code com o número do pedido. Na tela de retirada,
-- cada leitura chama registrar_retirada_pizza: dá baixa uma vez só e devolve o
-- pedido, para a equipe conferir o nome e entregar os sabores certos. Se já foi
-- retirado, devolve quando e quem deu a baixa (ninguém leva duas vezes).
-- Só quem pode ver a Pizza (comunicação e ADM/financeiro) dá baixa.
--
-- Pode rodar de novo sem estragar nada.

ALTER TABLE public.pizza_confirmacoes
  ADD COLUMN IF NOT EXISTS retirada_por text; -- e-mail de quem deu a baixa

COMMENT ON COLUMN public.pizza_confirmacoes.retirada_por IS 'Pizza da Alegria: e-mail de quem deu a baixa na retirada (10/11/2026).';

CREATE OR REPLACE FUNCTION public.pizza_pedido_na_retirada(c public.pizza_confirmacoes)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'numero', c.numero, 'nome', c.nome, 'unidade_nome', c.unidade_nome, 'sabores', c.sabores,
    'quantidade', c.quantidade, 'retirada_em', c.retirada_em, 'retirada_por', c.retirada_por
  );
$$;

REVOKE ALL ON FUNCTION public.pizza_pedido_na_retirada(public.pizza_confirmacoes) FROM PUBLIC, anon;

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

  -- A baixa só acontece se ainda não foi retirada: duas leituras juntas não entregam duas vezes.
  UPDATE public.pizza_confirmacoes
     SET retirada = true, retirada_em = now(), retirada_por = quem
   WHERE pizza_confirmacoes.numero = v_numero AND NOT retirada
  RETURNING * INTO v;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'registrada', 'pedido', public.pizza_pedido_na_retirada(v));
  END IF;

  SELECT * INTO v FROM public.pizza_confirmacoes WHERE pizza_confirmacoes.numero = v_numero;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'nao_encontrado');
  END IF;
  RETURN jsonb_build_object('status', 'ja_retirada', 'pedido', public.pizza_pedido_na_retirada(v));
END;
$$;

CREATE OR REPLACE FUNCTION public.desfazer_retirada_pizza(p_numero text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_ver_pizza(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.pizza_confirmacoes
     SET retirada = false, retirada_em = NULL, retirada_por = NULL
   WHERE numero = upper(btrim(coalesce(p_numero, '')));
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_retirada_pizza(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desfazer_retirada_pizza(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_retirada_pizza(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_retirada_pizza(text) TO authenticated;

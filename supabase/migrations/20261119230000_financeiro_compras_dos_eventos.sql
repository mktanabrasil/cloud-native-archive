-- Administração › Financeiro: compras e cotações dos eventos (19/11/2026,
-- PR 1 do Financeiro; mockup e decisões do mesmo dia).
--
-- O Financeiro deixa a Pizza da Alegria (fica só no Marketing) e passa a ver,
-- evento a evento, o que é compra ou cotação da ANA, lido do formulário de
-- eventos (nada novo para a unidade preencher):
--   - alimentação com fornecedor "ANA";
--   - transporte de fora (a frota não basta) ou veículo de apoio.
-- Equipamentos e impressos ficam de fora (a ANA já tem o material).
-- Eventos pendentes aparecem (com selo); cada item tem A cotar / Cotado /
-- Comprado, com valor e fornecedor opcionais. Só o vínculo Financeiro e o
-- marketing marcam.
--
-- Pode rodar antes ou depois do merge (sem o SQL, a página avisa que falta).
-- Pode rodar de novo sem estragar nada.

-- 1. Quem é do Financeiro --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eh_do_financeiro(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(_uid) OR EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.user_id = _uid AND p.bond_type = 'financeiro' AND p.is_active IS NOT FALSE
  );
$$;
REVOKE ALL ON FUNCTION public.eh_do_financeiro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_do_financeiro(uuid) TO authenticated;

-- 2. A Pizza da Alegria sai do Financeiro: só o marketing (que inclui o admin) --------------
-- (pode_ver_pizza guarda as regras das tabelas da Pizza; mudar aqui vale para todas.)
CREATE OR REPLACE FUNCTION public.pode_ver_pizza(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_marketing_user(_user_id);
$$;
REVOKE ALL ON FUNCTION public.pode_ver_pizza(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_pizza(uuid) TO authenticated;

-- 3. A situação de cada item -------------------------------------------------------------
-- `chave` identifica o item dentro do evento (ex.: "alimento:almoco:marmitex",
-- "transporte:apoio-de-fora"); `assinatura` é o pedido no momento em que foi
-- marcado (quantidade, passageiros): se a unidade mudar, a tela avisa.
CREATE TABLE IF NOT EXISTS public.financeiro_itens (
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  chave               text NOT NULL,
  situacao            text NOT NULL DEFAULT 'a_cotar' CHECK (situacao IN ('a_cotar', 'cotado', 'comprado')),
  valor               numeric(12, 2) CHECK (valor IS NULL OR valor >= 0),
  fornecedor          text CHECK (fornecedor IS NULL OR length(fornecedor) <= 120),
  assinatura          text,
  atualizado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_por      uuid,
  atualizado_por_nome text,
  PRIMARY KEY (event_id, chave)
);
ALTER TABLE public.financeiro_itens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_itens FROM anon, authenticated;
GRANT ALL ON public.financeiro_itens TO service_role;

-- 4. Os eventos com compras, para o Financeiro ----------------------------------------
-- Pendentes, confirmados e concluídos, fora da lixeira, que COMEÇAM no
-- período (evento que vira o mês conta só no mês em que começa, para o total
-- não sair dobrado), com comida da ANA ou transporte de fora. Devolve só o que a página
-- usa, com a situação de cada item já marcado.
CREATE OR REPLACE FUNCTION public.financeiro_eventos(_de timestamptz, _ate timestamptz)
RETURNS TABLE (
  id uuid, title text, unit text, location text, start_datetime timestamptz, end_datetime timestamptz, status text,
  food_items jsonb, transport_passengers integer, transport_external_support boolean, transport_extra_equipment boolean,
  transport_vehicle text, transport_support_vehicle text, itens jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.eh_do_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Só o Financeiro e o marketing veem as compras dos eventos.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.title::text, e.unit::text, e.location::text, e.start_datetime, e.end_datetime, e.status::text,
           coalesce(to_jsonb(e.food_items), '[]'::jsonb), e.transport_passengers::integer,
           coalesce(e.transport_external_support, false), coalesce(e.transport_extra_equipment, false),
           e.transport_vehicle::text, e.transport_support_vehicle::text,
           coalesce((SELECT jsonb_agg(jsonb_build_object(
                       'chave', f.chave, 'situacao', f.situacao, 'valor', f.valor, 'fornecedor', f.fornecedor,
                       'assinatura', f.assinatura, 'atualizado_em', f.atualizado_em, 'atualizado_por_nome', f.atualizado_por_nome))
                       FROM public.financeiro_itens f WHERE f.event_id = e.id), '[]'::jsonb)
      FROM public.events e
     WHERE e.deleted_at IS NULL
       AND e.status IN ('pendente', 'confirmado', 'concluido')
       AND e.start_datetime >= _de
       AND e.start_datetime < _ate
       AND (
         coalesce(e.transport_external_support, false) OR coalesce(e.transport_extra_equipment, false)
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(to_jsonb(e.food_items)) = 'array' THEN to_jsonb(e.food_items) ELSE '[]'::jsonb END) r,
                         jsonb_array_elements(CASE WHEN jsonb_typeof(r -> 'alimentos') = 'array' THEN r -> 'alimentos' ELSE '[]'::jsonb END) a
            WHERE a ->> 'fornecedor' = 'ANA'
         )
       )
     ORDER BY e.start_datetime;
END;
$$;
REVOKE ALL ON FUNCTION public.financeiro_eventos(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_eventos(timestamptz, timestamptz) TO authenticated;

-- 5. Marcar a situação (só o Financeiro e o marketing) ----------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_marcar(
  _event_id uuid, _chave text, _situacao text, _valor numeric DEFAULT NULL, _fornecedor text DEFAULT NULL, _assinatura text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.eh_do_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Só o Financeiro e o marketing marcam as compras.' USING ERRCODE = '42501';
  END IF;
  IF _situacao NOT IN ('a_cotar', 'cotado', 'comprado') THEN
    RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023';
  END IF;
  IF _chave IS NULL OR length(_chave) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Item inválido.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Este evento não existe mais ou foi para a lixeira.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.financeiro_itens (event_id, chave, situacao, valor, fornecedor, assinatura, atualizado_em, atualizado_por, atualizado_por_nome)
  VALUES (_event_id, _chave, _situacao, _valor, nullif(btrim(coalesce(_fornecedor, '')), ''), _assinatura, now(), auth.uid(), public.meu_nome_no_calendario())
  ON CONFLICT (event_id, chave) DO UPDATE
    SET situacao = EXCLUDED.situacao, valor = EXCLUDED.valor, fornecedor = EXCLUDED.fornecedor, assinatura = EXCLUDED.assinatura,
        atualizado_em = EXCLUDED.atualizado_em, atualizado_por = EXCLUDED.atualizado_por, atualizado_por_nome = EXCLUDED.atualizado_por_nome;
END;
$$;
REVOKE ALL ON FUNCTION public.financeiro_marcar(uuid, text, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_marcar(uuid, text, text, numeric, text, text) TO authenticated;

-- Conferência.
SELECT 'tabela financeiro_itens' AS item, (to_regclass('public.financeiro_itens') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc WHERE proname IN ('eh_do_financeiro', 'financeiro_eventos', 'financeiro_marcar')
UNION ALL
SELECT 'pizza só do marketing', (position('financeiro' IN pg_get_functiondef('public.pode_ver_pizza(uuid)'::regprocedure)) = 0)::text;

-- Administração: quem vê cada página, conta por conta (23/11/2026, pedido dele
-- depois da conferência dos acessos).
--
-- 1. Padrinhos e Parceiros: o vínculo Financeiro deixa de ver sozinho (a
--    financeiro3@ não deve ver). Veem o marketing (que inclui a administração
--    geral), os vínculos Padrinhos e Parceiros e quem a administração geral
--    liberar pelo e-mail no fim da página.
-- 2. Voluntariado: ganha a mesma lista "Quem mais vê" (a parceiros@ e a
--    eventos@ cuidam do setor sem ter o vínculo Voluntariado). Veem o
--    marketing, o vínculo Voluntariado e quem for liberado.
--
-- ORDEM: pode rodar antes ou depois do merge. Sem ele, a página Voluntariado
-- mostra a lista "Quem mais vê" com erro (só para a administração geral) e o
-- Financeiro continua vendo Padrinhos e Parceiros. Pode rodar de novo.

-- 1. Padrinhos e Parceiros sem o Financeiro automático ---------------------------------
CREATE OR REPLACE FUNCTION public.pode_ver_apoiadores(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(_uid)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.user_id = _uid AND p.is_active IS NOT FALSE
           AND (p.bond_type IN ('padrinhos', 'parceiros')
                OR lower(btrim(coalesce(p.email, ''))) IN (SELECT a.email FROM public.acesso_apoiadores a))
      );
$$;
REVOKE ALL ON FUNCTION public.pode_ver_apoiadores(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_apoiadores(uuid) TO authenticated;

-- 2. Voluntariado: quem mais vê, pelo e-mail ------------------------------------------
CREATE TABLE IF NOT EXISTS public.acesso_voluntariado (
  email           text PRIMARY KEY,
  adicionado_em   timestamptz NOT NULL DEFAULT now(),
  adicionado_por  text,
  CONSTRAINT acesso_voluntariado_email_formato CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
ALTER TABLE public.acesso_voluntariado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acesso_voluntariado FROM anon, authenticated;
GRANT ALL ON public.acesso_voluntariado TO service_role;

-- As regras das tabelas do voluntariado já chamam esta função: nenhuma muda.
CREATE OR REPLACE FUNCTION public.eh_do_voluntariado(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(_uid) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _uid AND p.is_active IS NOT FALSE
      AND (p.bond_type = 'voluntariado'
           OR lower(btrim(coalesce(p.email, ''))) IN (SELECT a.email FROM public.acesso_voluntariado a))
  );
$$;
REVOKE ALL ON FUNCTION public.eh_do_voluntariado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eh_do_voluntariado(uuid) TO authenticated;

-- Para o menu: "eu vejo?" sem expor a lista.
CREATE OR REPLACE FUNCTION public.vejo_voluntariado()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND public.eh_do_voluntariado(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.vejo_voluntariado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vejo_voluntariado() TO authenticated;

CREATE OR REPLACE FUNCTION public.acesso_voluntariado_lista()
RETURNS TABLE (email text, adicionado_em timestamptz, adicionado_por text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Só a administração geral vê quem tem acesso.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT a.email, a.adicionado_em, a.adicionado_por FROM public.acesso_voluntariado a ORDER BY a.email;
END;
$$;
REVOKE ALL ON FUNCTION public.acesso_voluntariado_lista() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acesso_voluntariado_lista() TO authenticated;

CREATE OR REPLACE FUNCTION public.acesso_voluntariado_mudar(_email text, _liberar boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  e text := lower(btrim(coalesce(_email, '')));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Só a administração geral libera o acesso.' USING ERRCODE = '42501';
  END IF;
  IF _liberar THEN
    INSERT INTO public.acesso_voluntariado (email, adicionado_por) VALUES (e, public.meu_nome_no_calendario())
    ON CONFLICT (email) DO NOTHING;
  ELSE
    DELETE FROM public.acesso_voluntariado WHERE email = e;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.acesso_voluntariado_mudar(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acesso_voluntariado_mudar(text, boolean) TO authenticated;

-- Conferência: a tabela nova, as funções e a regra de Padrinhos sem o Financeiro.
SELECT 'tabela acesso_voluntariado' AS item, (to_regclass('public.acesso_voluntariado') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'funções do voluntariado', count(*)::text FROM pg_proc
 WHERE proname IN ('eh_do_voluntariado', 'vejo_voluntariado', 'acesso_voluntariado_lista', 'acesso_voluntariado_mudar')
UNION ALL
SELECT 'Padrinhos sem o Financeiro automático', (pg_get_functiondef('public.pode_ver_apoiadores(uuid)'::regprocedure) NOT LIKE '%''financeiro''%')::text;

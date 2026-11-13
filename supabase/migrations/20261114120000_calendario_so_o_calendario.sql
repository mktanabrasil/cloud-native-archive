-- Calendário Anual: "só o calendário" para contas da equipe (13/11/2026).
--
-- As coordenadoras do Social são as gestoras já cadastradas (dic@,
-- jdnilopolis@, diretoriasantana@). Pedido dele: entram com o e-mail da
-- gestão, mas, por enquanto, só enxergam o calendário. O marketing liga e
-- desliga isso por pessoa em "Coordenadoras com acesso" (nasce ligado).
--
-- Ligado, a conta da equipe:
--   - no app, qualquer página da equipe a manda para /calendario;
--   - no banco, deixa de contar como equipe para ler eventos e a fila de
--     avisos (eh_da_equipe e eh_gestao_ativa), como a conta só do calendário.
-- O marketing nunca fica preso, mesmo se estiver na lista.
--
-- Pode rodar de novo sem estragar nada.

ALTER TABLE public.calendario_acessos ADD COLUMN IF NOT EXISTS so_calendario boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.so_o_calendario(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NOT public.is_marketing_user(_uid) AND EXISTS (
    SELECT 1 FROM public.calendario_acessos a
    JOIN auth.users u ON lower(u.email) = a.email
    WHERE u.id = _uid AND a.ativo AND a.so_calendario
  );
$$;
REVOKE ALL ON FUNCTION public.so_o_calendario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.so_o_calendario(uuid) TO authenticated, service_role;

-- As duas regras de 13/11 (20261113180000), agora sem quem está só no calendário.
CREATE OR REPLACE FUNCTION public.eh_da_equipe(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND is_active IS NOT FALSE
  ) AND NOT public.so_o_calendario(_uid);
$$;

CREATE OR REPLACE FUNCTION public.eh_gestao_ativa(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND is_active IS NOT FALSE
      AND permission_level IN ('admin_geral', 'gestor_unidade', 'eventos_parceiros')
  ) AND NOT public.so_o_calendario(_uid);
$$;

-- Conferência: a coluna e a função.
SELECT 'coluna so_calendario' AS item, count(*)::text AS valor FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'calendario_acessos' AND column_name = 'so_calendario'
UNION ALL
SELECT 'eh_da_equipe olha o calendário', (position('so_o_calendario' IN pg_get_functiondef('public.eh_da_equipe(uuid)'::regprocedure)) > 0)::text;

-- Calendário Anual: sai a trava "só o calendário" (17/11/2026).
--
-- A trava de 13/11 (20261114120000) prendia as gestoras liberadas no
-- Calendário Anual só nele: no app, toda página da equipe as mandava para o
-- calendário; no banco, deixavam de contar como equipe para ler eventos e a
-- fila de avisos. Com o app por setores, a gestora do Social vê o Social, e
-- o calendário está nele. Pedido dele: tirar a trava.
--
-- As duas regras voltam a ser as de 13/11 (20261113180000), sem a cláusula
-- da trava; a função da trava e a coluna saem. As contas só do calendário
-- (as coordenadoras sem conta da equipe) não mudam: elas não têm perfil, e
-- `eh_da_equipe` já não as conta.
--
-- Rodar DEPOIS de o PR estar no ar: o app de antes lê a coluna `so_calendario`.
-- Tudo roda junto: se alguma parte falhar, nada muda.

CREATE OR REPLACE FUNCTION public.eh_da_equipe(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND is_active IS NOT FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.eh_gestao_ativa(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND is_active IS NOT FALSE
      AND permission_level IN ('admin_geral', 'gestor_unidade', 'eventos_parceiros')
  );
$$;

-- Sem CASCADE de propósito: se outra regra ainda usar a função, isto falha e
-- nada do arquivo é aplicado.
DROP FUNCTION IF EXISTS public.so_o_calendario(uuid);

ALTER TABLE public.calendario_acessos DROP COLUMN IF EXISTS so_calendario;

-- Conferência: as duas regras sem a trava, a função e a coluna fora.
SELECT 'eh_da_equipe sem a trava' AS item, (position('so_o_calendario' IN pg_get_functiondef('public.eh_da_equipe(uuid)'::regprocedure)) = 0)::text AS valor
UNION ALL
SELECT 'eh_gestao_ativa sem a trava', (position('so_o_calendario' IN pg_get_functiondef('public.eh_gestao_ativa(uuid)'::regprocedure)) = 0)::text
UNION ALL
SELECT 'função so_o_calendario existe', (to_regprocedure('public.so_o_calendario(uuid)') IS NOT NULL)::text
UNION ALL
SELECT 'coluna so_calendario existe', (count(*) > 0)::text FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'calendario_acessos' AND column_name = 'so_calendario';

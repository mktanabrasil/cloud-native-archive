-- Calendário Anual por setor (17/11/2026).
--
-- O calendário virou uma página do setor Social: quem preenche é a gestão de
-- cada unidade do Social (as NAVEs) e o marketing, pela regra do setor. Sai a
-- lista "Coordenadoras com acesso" (`calendario_acessos`) e, com ela, a
-- entrada própria do calendário (as contas só do calendário).
--
-- - `eh_do_calendario`: em vez de procurar o e-mail na lista, olha o perfil
--   (gestão de unidade ativa, de uma unidade do Social). As regras das tabelas
--   do calendário já chamam esta função; nenhuma muda.
-- - `meu_nome_no_calendario`: sem a lista, o nome vem do perfil da equipe.
-- - A tabela `calendario_acessos` sai.
--
-- A lista das unidades do Social espelha as NAVEs de `NEWS_UNITS`
-- (`src/lib/news/units.ts`), pelo `profileUnit`. Unidade nova do Social:
-- acrescentar aqui também.
--
-- ORDEM: rodar DEPOIS do SQL 20261117100000_calendario_sem_so_o_calendario.sql
-- (a função da trava ainda lê esta tabela) e depois de o PR estar no ar.
-- Tudo roda junto: se alguma parte falhar, nada muda.

DO $$
BEGIN
  IF to_regprocedure('public.so_o_calendario(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Rode antes o SQL 20261117100000_calendario_sem_so_o_calendario.sql (a trava ainda está no banco).';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.eh_do_calendario()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_active IS NOT FALSE
      AND p.permission_level = 'gestor_unidade'
      AND lower(btrim(p.unit)) IN ('dic', 'nilópolis', 'santana', 'piauí', 'oziel')
  );
$$;

CREATE OR REPLACE FUNCTION public.meu_nome_no_calendario()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.user_id = auth.uid()),
    (SELECT NULLIF(btrim(u.raw_user_meta_data->>'name'), '') FROM auth.users u WHERE u.id = auth.uid()),
    split_part(public.meu_email_no_auth(), '@', 1)
  );
$$;

DROP TABLE IF EXISTS public.calendario_acessos;

-- Conferência: quem preenche agora (as gestoras do Social, pelo perfil) e a lista fora.
SELECT 'preenche: ' || coalesce(p.name, '(sem nome)') || ' · ' || p.unit AS item, 'sim' AS valor
FROM public.profiles p
WHERE p.is_active IS NOT FALSE
  AND p.permission_level = 'gestor_unidade'
  AND lower(btrim(p.unit)) IN ('dic', 'nilópolis', 'santana', 'piauí', 'oziel')
UNION ALL
SELECT 'tabela calendario_acessos existe', (to_regclass('public.calendario_acessos') IS NOT NULL)::text;

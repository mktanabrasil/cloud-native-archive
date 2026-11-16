-- O Jornal é da Educação (16/11/2026).
--
-- Com o app organizado por setores, o Jornal ficou só com os CEIs e o GOE: a
-- gestão das NAVEs (o Social) saiu dele. A tela já não mostra o Jornal a ela;
-- isto faz o banco dizer o mesmo. `journal_unit_of` é a única porta da gestão
-- nas políticas de `journals` (ver 20260826180000_jornal_por_unidade.sql), e
-- passa a devolver a unidade só quando ela é da Educação. O marketing e a
-- administração continuam vendo e editando tudo, como antes.
--
-- A lista espelha os CEIs e o GOE de `NEWS_UNITS` (`src/lib/news/units.ts`),
-- pelo `profileUnit`, que é o que o pedido de acesso grava em `profiles.unit`.
-- Inclui as parcerias finalizadas, como lá. Unidade nova da Educação no
-- catálogo: acrescentar aqui também.

CREATE OR REPLACE FUNCTION public.journal_unit_of(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(p.unit), '')
  FROM public.profiles p
  WHERE p.user_id = _user_id
    AND p.is_active IS NOT FALSE
    AND p.permission_level = 'gestor_unidade'
    AND lower(TRIM(p.unit)) IN (
      'goe',
      'pierre weil', 'calmon', 'porto', 'são josé', 'anísio', 'capanema',
      'leonel', 'paulo freire', 'mayara masson', 'ferramola', 'vandir',
      'midori', 'eldorado', 'joão batista'
    )
$$;

-- Conferência: as gestoras ativas por unidade, e se continuam no Jornal.
-- Esperado: "sim" nos CEIs e no GOE; "não" nas NAVEs (DIC, Nilópolis,
-- Santana, Piauí, Oziel).
SELECT
  NULLIF(TRIM(p.unit), '') AS unidade,
  count(*) AS gestoras,
  CASE WHEN bool_or(public.journal_unit_of(p.user_id) IS NOT NULL) THEN 'sim' ELSE 'não' END AS no_jornal
FROM public.profiles p
WHERE p.permission_level = 'gestor_unidade'
  AND p.is_active IS NOT FALSE
GROUP BY 1
ORDER BY 3 DESC, 1;

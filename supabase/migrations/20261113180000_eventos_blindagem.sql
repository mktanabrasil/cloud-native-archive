-- Eventos: blindagem do acesso antes do lançamento (13/11/2026).
--
-- Medido em produção nesse dia (SQL só de leitura e a chave pública):
--
--   1. As permissões de coluna de 02/09 (20260902130000) se perderam na troca
--      para o banco próprio (10/09): `anon` lia as 66 colunas de `events`.
--      Qualquer pessoa, sem login, recebia `notes`, `created_by` (nomes),
--      logística, transporte e o id da agenda dos eventos públicos.
--   2. `avisos_de_evento` tinha SELECT `USING (true)` para `authenticated`. A
--      fila guarda a cópia inteira de cada evento confirmado, cancelado ou
--      alterado, inclusive os internos, e os e-mails da equipe. Qualquer
--      conta, inclusive a de candidato que se cria em /vagas/criar-conta, lia
--      tudo pela API.
--   3. A conta de candidato lia pela sessão os eventos públicos em qualquer
--      situação (pendentes e cancelados também), com todas as colunas.
--   4. O evento do "Grupo ANA Brasil" (o Natal Feliz) é de todas as unidades,
--      mas `has_unit_access` só conhece a unidade de cada gestora: o interno
--      do Grupo não aparecia para nenhuma delas, e o e-mail do lançamento
--      levaria a um link vazio.
--
-- Pode rodar de novo sem estragar nada. Aplicar no SQL Editor do Studio
-- ANTES de publicar o front (o front já pede as colunas da vitrine pelo nome
-- desde 02/09, então a ordem não derruba nada; o que importa é não ficar sem).

-- 1. Quem é da equipe ------------------------------------------------------------
--
-- Tem perfil ativo. A conta de candidato não ganha perfil (desvio na
-- `handle_new_user`, 28/09/2026); quem pede acesso ganha perfil "usuário
-- padrão" e aparece no Painel, como sempre.

CREATE OR REPLACE FUNCTION public.eh_da_equipe(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND is_active IS NOT FALSE
  );
$$;

-- A gestão ativa (admin geral, gestão de unidade, eventos e parceiros).
CREATE OR REPLACE FUNCTION public.eh_gestao_ativa(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND is_active IS NOT FALSE
      AND permission_level IN ('admin_geral', 'gestor_unidade', 'eventos_parceiros')
  );
$$;

REVOKE ALL ON FUNCTION public.eh_da_equipe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eh_gestao_ativa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eh_da_equipe(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eh_gestao_ativa(uuid) TO authenticated, service_role;

-- 2. Eventos: logado e fora da equipe não lê nada -------------------------------
--
-- RESTRITIVA: soma um "E" a todas as regras de leitura que já existem, sem
-- precisar reescrevê-las. A equipe segue exatamente como estava. A conta de
-- candidato que abre a vitrine logada pede sem a própria sessão (o front faz
-- isso desde este PR) e recebe o mesmo que a família.

DROP POLICY IF EXISTS events_so_a_equipe_logada ON public.events;
CREATE POLICY events_so_a_equipe_logada
  ON public.events AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.eh_da_equipe(auth.uid()));

-- 3. O evento do Grupo para a gestão das unidades --------------------------------
--
-- PERMISSIVA, a mais: só leitura. Gravar continua com a administração e a
-- comunicação (a migração 20261111190000 não mexeu em quem grava).

DROP POLICY IF EXISTS events_grupo_para_a_gestao ON public.events;
CREATE POLICY events_grupo_para_a_gestao
  ON public.events FOR SELECT TO authenticated
  USING (unit = 'Grupo ANA Brasil' AND deleted_at IS NULL AND public.eh_gestao_ativa(auth.uid()));

-- 4. A fila de avisos: a administração, a comunicação e a gestão da unidade ------

DROP POLICY IF EXISTS avisos_select_equipe ON public.avisos_de_evento;
CREATE POLICY avisos_select_equipe
  ON public.avisos_de_evento FOR SELECT TO authenticated
  USING (
    public.check_is_admin(auth.uid())
    OR public.is_marketing_user(auth.uid())
    OR (
      public.eh_gestao_ativa(auth.uid())
      AND (public.has_unit_access(evento->>'unit') OR evento->>'unit' = 'Grupo ANA Brasil')
    )
  );

-- 5. As colunas da vitrine para quem não tem sessão (de novo) -------------------
--
-- O mesmo de 20260902130000. Revogar o SELECT da tabela também revoga o das
-- colunas; por isso a lista vem logo depois. Coluna nova nasce fora dela.

GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

REVOKE SELECT ON public.events FROM PUBLIC;
REVOKE SELECT ON public.events FROM anon;

GRANT SELECT (
  id,
  title,
  description,
  unit,
  location,
  start_datetime,
  end_datetime,
  status,
  visibility,
  slug,
  deleted_at,
  custom_color,
  banner_url_desktop,
  banner_url_mobile,
  banner_image_desktop,
  banner_image_mobile,
  banner_display_time,
  event_logo_url,
  use_logo_as_title,
  full_height_title,
  show_in_banner,
  show_banner_fade,
  show_banner_overlay,
  has_unit_collaboration,
  collaborating_units,
  external_collaborators
) ON public.events TO anon;

-- Gravar, quem não tem sessão nunca pôde (nenhuma regra deixa); agora nem o
-- privilégio fica.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.events FROM anon;

-- Conferência -------------------------------------------------------------------
-- Esperado: anon · SELECT = 26 e nenhuma outra linha do anon; a restritiva e as
-- duas regras novas na lista; a fila sem o "true".
SELECT 'colunas' AS item, grantee || ' · ' || privilege_type AS nome, count(*)::text AS valor
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'events' AND grantee = 'anon'
GROUP BY grantee, privilege_type
UNION ALL
SELECT 'regra', tablename || ' · ' || policyname, permissive || ' · ' || cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('events_so_a_equipe_logada', 'events_grupo_para_a_gestao', 'avisos_select_equipe')
ORDER BY 1, 2;

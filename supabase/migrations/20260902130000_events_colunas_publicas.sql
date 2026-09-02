-- Fecha as colunas internas de `events` para quem não tem sessão.
--
-- O RLS já escolhia as LINHAS certas (só confirmado e público, nunca a
-- lixeira), mas devolvia a linha inteira. Medido em 02/09/2026 com a chave
-- pública e sem sessão: 33 eventos, cada um com todas as 50 colunas —
-- `notes` preenchido em 17 deles com logística interna, e o `created_by` de
-- todos. Linha certa, colunas demais.
--
-- Privilégio de coluna resolve no servidor o que o cliente não deveria
-- precisar lembrar de fazer.
--
-- ORDEM IMPORTA: o app precisa já estar publicado pedindo as colunas
-- nominalmente (ver `src/lib/events/camposPublicos.ts`). Com o código antigo,
-- que pedia `*`, este comando derruba a página pública — `SELECT *` exige
-- privilégio em todas as colunas.

-- Explícitos primeiro, para que o REVOKE de PUBLIC abaixo não atinja quem
-- depende dele hoje.
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

REVOKE SELECT ON public.events FROM PUBLIC;
REVOKE SELECT ON public.events FROM anon;

-- A vitrine, e só ela. Coluna nova nasce fora desta lista.
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

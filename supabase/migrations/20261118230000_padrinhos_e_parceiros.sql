-- Administração › Financeiro, Padrinhos e Parceiros (18/11/2026, setor
-- Administração, PR 6).
--
-- Decisão de 18/11: Padrinhos e Parceiros começam como uma LISTA LIDA DOS
-- EVENTOS (o que as unidades escreveram em "Tem padrinho, doador ou empresa
-- envolvida?" e nas instituições participantes). Quem vê: o financeiro, o
-- marketing (que inclui o admin) e os responsáveis que a administração
-- liberar pelo e-mail (lista `acesso_apoiadores`, editada na própria página
-- por quem é admin).
--
-- O Financeiro começa com o que já existe: o painel da Pizza da Alegria
-- (`pode_ver_pizza`, sem mudança aqui).
--
-- Pode rodar antes ou depois do merge (sem o SQL, as páginas avisam que
-- falta). Pode rodar de novo sem estragar nada.

-- 1. Quem mais vê (por e-mail) ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acesso_apoiadores (
  email           text PRIMARY KEY,
  adicionado_em   timestamptz NOT NULL DEFAULT now(),
  adicionado_por  text,
  CONSTRAINT acesso_apoiadores_email_formato CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
ALTER TABLE public.acesso_apoiadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acesso_apoiadores FROM anon, authenticated;
GRANT ALL ON public.acesso_apoiadores TO service_role;

-- 2. Quem vê Padrinhos e Parceiros ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_ver_apoiadores(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(_uid)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.user_id = _uid AND p.is_active IS NOT FALSE
           AND (p.bond_type = 'financeiro'
                OR lower(btrim(coalesce(p.email, ''))) IN (SELECT a.email FROM public.acesso_apoiadores a))
      );
$$;
REVOKE ALL ON FUNCTION public.pode_ver_apoiadores(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_apoiadores(uuid) TO authenticated;

-- Para o menu: "eu vejo?" sem expor a lista.
CREATE OR REPLACE FUNCTION public.vejo_apoiadores()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND public.pode_ver_apoiadores(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.vejo_apoiadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vejo_apoiadores() TO authenticated;

-- 3. Os eventos com padrinhos, doadores, empresas ou instituições ------------------------
-- Fora da lixeira e não cancelados (pendentes entram: o financeiro se
-- planeja antes). Só os campos que as duas páginas usam.
CREATE OR REPLACE FUNCTION public.apoiadores_dos_eventos()
RETURNS TABLE (
  id uuid, title text, unit text, start_datetime timestamptz, end_datetime timestamptz, status text,
  partners jsonb, partner_type text, partner_name text, external_collaborators jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.pode_ver_apoiadores(auth.uid()) THEN
    RAISE EXCEPTION 'Só o financeiro, o marketing e quem a administração liberar veem os padrinhos e parceiros.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.title::text, e.unit::text, e.start_datetime, e.end_datetime, e.status::text,
           CASE WHEN e.partner_involved THEN coalesce(to_jsonb(e.partners), '[]'::jsonb) ELSE '[]'::jsonb END,
           CASE WHEN e.partner_involved THEN e.partner_type::text END,
           CASE WHEN e.partner_involved THEN e.partner_name::text END,
           CASE WHEN e.has_unit_collaboration THEN coalesce(to_jsonb(e.external_collaborators), '[]'::jsonb) ELSE '[]'::jsonb END
      FROM public.events e
     WHERE e.deleted_at IS NULL
       AND e.status IS DISTINCT FROM 'cancelado'
       AND (
         (e.partner_involved AND (coalesce(jsonb_array_length(to_jsonb(e.partners)), 0) > 0 OR coalesce(btrim(e.partner_name::text), '') <> ''))
         OR (e.has_unit_collaboration AND coalesce(jsonb_array_length(to_jsonb(e.external_collaborators)), 0) > 0)
       )
     ORDER BY e.start_datetime DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.apoiadores_dos_eventos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apoiadores_dos_eventos() TO authenticated;

-- 4. A lista de acesso: só o admin lê e muda ------------------------------------------
CREATE OR REPLACE FUNCTION public.acesso_apoiadores_lista()
RETURNS TABLE (email text, adicionado_em timestamptz, adicionado_por text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Só a administração geral vê quem tem acesso.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT a.email, a.adicionado_em, a.adicionado_por FROM public.acesso_apoiadores a ORDER BY a.email;
END;
$$;
REVOKE ALL ON FUNCTION public.acesso_apoiadores_lista() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acesso_apoiadores_lista() TO authenticated;

CREATE OR REPLACE FUNCTION public.acesso_apoiadores_mudar(_email text, _liberar boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  e text := lower(btrim(coalesce(_email, '')));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Só a administração geral libera o acesso.' USING ERRCODE = '42501';
  END IF;
  IF _liberar THEN
    INSERT INTO public.acesso_apoiadores (email, adicionado_por) VALUES (e, public.meu_nome_no_calendario())
    ON CONFLICT (email) DO NOTHING;
  ELSE
    DELETE FROM public.acesso_apoiadores WHERE email = e;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.acesso_apoiadores_mudar(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acesso_apoiadores_mudar(text, boolean) TO authenticated;

-- Conferência: a tabela e as cinco funções.
SELECT 'tabela acesso_apoiadores' AS item, (to_regclass('public.acesso_apoiadores') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc
 WHERE proname IN ('pode_ver_apoiadores', 'vejo_apoiadores', 'apoiadores_dos_eventos', 'acesso_apoiadores_lista', 'acesso_apoiadores_mudar');

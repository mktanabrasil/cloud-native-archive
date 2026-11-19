-- Conta desativada não entra; vínculos Padrinhos e Parceiros (19/11/2026).
--
-- 1. A brecha: conta da equipe DESATIVADA não recebia o e-mail "Gerar minha
--    senha" (certo), mas caía no "Esqueci a senha" de sempre do login, cujo
--    link já entra no app. Para quem saiu com e-mail pessoal, isso era um
--    caminho de volta. Agora a função senha-pedir não manda e-mail nenhum para
--    conta da equipe desativada (e o app derruba conta desativada por qualquer
--    caminho de entrada).
-- 2. Os vínculos do setor Administração que faltavam no Painel: Padrinhos e
--    Parceiros (setores da ANA, com e-mail próprio; não há parceiro externo com
--    conta, decisão de 19/11). Quem tem um deles vê as páginas Padrinhos e
--    Parceiros, como o financeiro.
--
-- Rodar ANTES de publicar a senha-pedir e do merge (o Painel passa a oferecer
-- os vínculos; sem a regra nova o banco recusa salvar). Pode rodar de novo.

-- 1. O vínculo ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bond_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bond_type_check
  CHECK (bond_type IS NULL OR bond_type IN (
    'rh','financeiro','marketing','nota_fiscal','voluntariado','padrinhos','parceiros',
    'gestao_social','educador',
    'orientacao_pedagogica','professora',
    'parceiro','usuario_comum'
  ));

-- 2. Quem vê Padrinhos e Parceiros: + os vínculos novos -----------------------------------
CREATE OR REPLACE FUNCTION public.pode_ver_apoiadores(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(_uid)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.user_id = _uid AND p.is_active IS NOT FALSE
           AND (p.bond_type IN ('financeiro', 'padrinhos', 'parceiros')
                OR lower(btrim(coalesce(p.email, ''))) IN (SELECT a.email FROM public.acesso_apoiadores a))
      );
$$;
REVOKE ALL ON FUNCTION public.pode_ver_apoiadores(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_apoiadores(uuid) TO authenticated;

-- 3. Conta da equipe desativada, pelo e-mail (para a senha-pedir não mandar nada) ---------
CREATE OR REPLACE FUNCTION public.conta_da_equipe_desativada(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE lower(btrim(p.email)) = lower(btrim(_email)) AND p.user_id IS NOT NULL
       AND p.is_active IS NOT TRUE
       AND public.senha_da_equipe(p.user_id)
  );
$$;
REVOKE ALL ON FUNCTION public.conta_da_equipe_desativada(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conta_da_equipe_desativada(text) TO service_role;

-- 4. Desativar bloqueia no próprio login (revisão de 19/11) ------------------------------
-- O "Esqueci a senha" do login (GoTrue) também pode ser chamado direto, sem
-- passar pela senha-pedir. Por isso a trava fica no login: conta desativada
-- ganha banned_until, e o GoTrue recusa senha, link e renovação de sessão.
-- Reativar (inclusive aprovar o pedido de acesso) tira a trava. Não mexe na
-- senha, então o cadeado não dispara.
CREATE OR REPLACE FUNCTION public.trava_conta_desativada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;
  IF NEW.is_active IS FALSE THEN
    UPDATE auth.users SET banned_until = '2999-12-31 00:00:00+00' WHERE id = NEW.user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = NEW.user_id::text;
    DELETE FROM auth.sessions WHERE user_id = NEW.user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trava_conta_desativada() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trava_conta_desativada ON public.profiles;
CREATE TRIGGER trava_conta_desativada
  AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trava_conta_desativada();

-- Quem já está desativado hoje (inclusive pedido de acesso pendente) fica
-- travado agora; aprovar ou reativar tira a trava.
UPDATE auth.users u SET banned_until = '2999-12-31 00:00:00+00'
  FROM public.profiles p
 WHERE p.user_id = u.id AND p.is_active IS FALSE AND (u.banned_until IS NULL OR u.banned_until < now());

-- Conferência.
SELECT 'vínculos padrinhos e parceiros' AS item, (pg_get_constraintdef(oid) LIKE '%padrinhos%' AND pg_get_constraintdef(oid) LIKE '%''parceiros''%')::text AS valor
  FROM pg_constraint WHERE conname = 'profiles_bond_type_check'
UNION ALL
SELECT 'função conta_da_equipe_desativada', (count(*) > 0)::text FROM pg_proc WHERE proname = 'conta_da_equipe_desativada'
UNION ALL
SELECT 'gatilho trava_conta_desativada', (count(*) > 0)::text FROM pg_trigger WHERE tgname = 'trava_conta_desativada'
UNION ALL
SELECT 'contas desativadas travadas', count(*)::text FROM auth.users u JOIN public.profiles p ON p.user_id = u.id WHERE p.is_active IS FALSE AND u.banned_until > now();

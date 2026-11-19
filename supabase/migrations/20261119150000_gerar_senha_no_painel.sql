-- Gerar a senha pelo Painel (19/11/2026, PR 2 das senhas; mockup aprovado no
-- mesmo dia).
--
-- O marketing e a administração geral geram a senha de qualquer conta da
-- equipe (todas, menos administração geral e marketing) no padrão FdGhJiuPn.
-- A senha antiga para na hora e as sessões abertas caem. Fica registrado quem
-- gerou e quando (aqui e na Auditoria). Quem gera é a função `senha-gerar`,
-- com a chave de serviço; a senha nunca é guardada.
--
-- Vale com o cadeado ligado ou desligado (PR 1): é assim que a conta passa de
-- uma pessoa para outra.
--
-- Rodar ANTES de publicar a função `senha-gerar`. Pode rodar de novo sem
-- estragar nada (não mexe no interruptor do cadeado).

-- 1. Quem é conta da equipe (a regra do cadeado, sem o interruptor) ----------------------
-- Com perfil (candidato não tem) e nem administração geral nem marketing.
CREATE OR REPLACE FUNCTION public.senha_da_equipe(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _uid)
     AND NOT coalesce(public.is_admin(_uid), false)
     AND NOT coalesce(public.is_marketing_user(_uid), false);
$$;
REVOKE ALL ON FUNCTION public.senha_da_equipe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.senha_da_equipe(uuid) TO service_role;

-- O cadeado passa a usar a mesma regra (mesmo resultado do PR 1).
CREATE OR REPLACE FUNCTION public.senha_trancada(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT ligado FROM public.senhas_config WHERE id = 1), false)
     AND public.senha_da_equipe(_uid);
$$;
REVOKE ALL ON FUNCTION public.senha_trancada(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.senha_trancada(uuid) TO service_role;

-- 2. O registro (quem gerou, quando, por onde) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.senhas_geradas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  gerada_em       timestamptz NOT NULL DEFAULT now(),
  gerada_por      uuid,
  gerada_por_nome text,
  origem          text NOT NULL DEFAULT 'painel' CHECK (origem IN ('painel', 'email'))
);
CREATE INDEX IF NOT EXISTS senhas_geradas_user_idx ON public.senhas_geradas (user_id, gerada_em DESC);
ALTER TABLE public.senhas_geradas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.senhas_geradas FROM anon, authenticated;
GRANT ALL ON public.senhas_geradas TO service_role;

-- 3. O que a função do servidor usa ----------------------------------------------------
-- Derruba as sessões abertas (o app sai na próxima renovação do acesso, em até
-- 1 hora) e anula os links pendentes de "Esqueci a senha", de acesso por e-mail
-- e de troca de e-mail: quem saiu não usa um link pedido antes (revisão de 19/11).
-- O UPDATE não toca a senha, então o cadeado não dispara.
CREATE OR REPLACE FUNCTION public.encerrar_sessoes(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = _user_id::text;
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  UPDATE auth.users
     SET recovery_token = '', confirmation_token = '', email_change_token_new = '', email_change_token_current = '', reauthentication_token = ''
   WHERE id = _user_id;
  -- GoTrue mais novo guarda os links também aqui.
  IF to_regclass('auth.one_time_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.one_time_tokens WHERE user_id = $1' USING _user_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.encerrar_sessoes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_sessoes(uuid) TO service_role;

-- Se a troca falhar depois de liberada, a liberação não fica sobrando.
CREATE OR REPLACE FUNCTION public.cancelar_liberacao(_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  DELETE FROM public.senha_liberacoes WHERE user_id = _user_id;
$$;
REVOKE ALL ON FUNCTION public.cancelar_liberacao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_liberacao(uuid) TO service_role;

-- 4. Para o Painel: de cada conta, se é da equipe e a última senha gerada --------------
CREATE OR REPLACE FUNCTION public.senhas_do_painel()
RETURNS TABLE (user_id uuid, da_equipe boolean, gerada_em timestamptz, gerada_por_nome text, origem text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (coalesce(public.is_admin(auth.uid()), false) OR coalesce(public.is_marketing_user(auth.uid()), false)) THEN
    RAISE EXCEPTION 'Só o marketing e a administração geral veem as senhas do Painel.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.user_id, public.senha_da_equipe(p.user_id), g.gerada_em, g.gerada_por_nome, g.origem
      FROM public.profiles p
      LEFT JOIN LATERAL (
        SELECT s.gerada_em, s.gerada_por_nome, s.origem FROM public.senhas_geradas s
         WHERE s.user_id = p.user_id ORDER BY s.gerada_em DESC LIMIT 1
      ) g ON true
     WHERE p.user_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.senhas_do_painel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.senhas_do_painel() TO authenticated;

-- Conferência: a tabela e as funções novas.
SELECT 'tabela senhas_geradas' AS item, (to_regclass('public.senhas_geradas') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc
 WHERE proname IN ('senha_da_equipe', 'encerrar_sessoes', 'cancelar_liberacao', 'senhas_do_painel')
UNION ALL
SELECT 'cadeado ligado', ligado::text FROM public.senhas_config WHERE id = 1;

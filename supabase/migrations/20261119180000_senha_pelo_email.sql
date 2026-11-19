-- A senha pelo e-mail (19/11/2026, PR 3 das senhas; mockup aprovado no mesmo dia).
--
-- "Esqueceu a senha?" de uma conta da equipe manda um e-mail com o botão
-- "Gerar minha senha". O link leva a uma página do app; o botão de lá gera a
-- senha no padrão FdGhJiuPn e mostra na tela. Decisões de 19/11:
--   - o link vale 1 hora e funciona uma vez;
--   - no máximo um e-mail a cada 5 minutos por conta;
--   - a senha só muda quando a pessoa toca no botão (digitar o e-mail de
--     alguém não muda a senha de ninguém).
-- Administração geral e marketing seguem com o "Esqueci a senha" de sempre.
--
-- O link guarda só o resumo (sha-256) do código; o código vai no e-mail.
-- Quem lê e grava é o servidor (funções senha-pedir e senha-resgatar).
--
-- Rodar ANTES de publicar as funções. Pode rodar de novo sem estragar nada.
-- O cadeado continua como está: ele liga no arquivo 20261119190000, o último.

CREATE TABLE IF NOT EXISTS public.senha_pedidos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  motivo      text NOT NULL DEFAULT 'esqueci' CHECK (motivo IN ('esqueci', 'aprovado')),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em   timestamptz NOT NULL,
  usado_em    timestamptz
);
CREATE INDEX IF NOT EXISTS senha_pedidos_user_idx ON public.senha_pedidos (user_id, criado_em DESC);
ALTER TABLE public.senha_pedidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.senha_pedidos FROM anon, authenticated;
GRANT ALL ON public.senha_pedidos TO service_role;

-- A conta da equipe pelo e-mail (o "Esqueceu a senha?" só sabe o e-mail).
-- Só conta ATIVA: pedido de acesso ainda pendente (perfil inativo) não ganha
-- senha por aqui; quem libera é a aprovação, que manda o mesmo e-mail.
CREATE OR REPLACE FUNCTION public.conta_da_equipe_pelo_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.user_id FROM public.profiles p
   WHERE lower(btrim(p.email)) = lower(btrim(_email)) AND p.user_id IS NOT NULL AND p.is_active IS TRUE
     AND public.senha_da_equipe(p.user_id)
   ORDER BY p.created_at NULLS LAST LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.conta_da_equipe_pelo_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conta_da_equipe_pelo_email(text) TO service_role;

-- Cria o pedido numa tacada só (revisão de 19/11): uma trava por conta, o
-- limite de um e-mail a cada 5 minutos (o de aprovação passa) e um teto geral
-- de 60 e-mails por hora, para ninguém lotar uma caixa nem a cota de envio
-- disparando pedidos ao mesmo tempo. Os links anteriores, ainda não usados,
-- morrem. Devolve false quando um limite segura o pedido (sem e-mail).
CREATE OR REPLACE FUNCTION public.criar_pedido_de_senha(_user_id uuid, _token_hash text, _motivo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('senha_pedido:' || _user_id::text));
  IF _motivo = 'esqueci' THEN
    IF EXISTS (SELECT 1 FROM public.senha_pedidos WHERE user_id = _user_id AND criado_em > now() - interval '5 minutes') THEN
      RETURN false;
    END IF;
    IF (SELECT count(*) FROM public.senha_pedidos WHERE criado_em > now() - interval '1 hour') >= 60 THEN
      RETURN false;
    END IF;
  END IF;
  UPDATE public.senha_pedidos SET usado_em = now() WHERE user_id = _user_id AND usado_em IS NULL;
  INSERT INTO public.senha_pedidos (user_id, token_hash, motivo, expira_em)
  VALUES (_user_id, _token_hash, _motivo, now() + interval '1 hour');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.criar_pedido_de_senha(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_de_senha(uuid, text, text) TO service_role;

-- Usa o pedido uma vez só: devolve a conta se o código vale (não usado, não
-- vencido, conta ainda ativa) e marca como usado no mesmo passo. Duas abas,
-- um só ganha.
CREATE OR REPLACE FUNCTION public.usar_pedido_de_senha(_token_hash text)
RETURNS TABLE (user_id uuid, motivo text)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.senha_pedidos p SET usado_em = now()
   WHERE p.token_hash = _token_hash AND p.usado_em IS NULL AND p.expira_em > now()
     AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = p.user_id AND pr.is_active IS TRUE)
  RETURNING p.user_id, p.motivo;
$$;

-- encerrar_sessoes (PR 2) passa a matar também os links "Gerar minha senha"
-- pendentes: quando o Painel gera a senha da conta (troca de dono), um link
-- pedido antes por quem saiu não pega a conta de volta (revisão de 19/11).
CREATE OR REPLACE FUNCTION public.encerrar_sessoes(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = _user_id::text;
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  UPDATE auth.users
     SET recovery_token = '', confirmation_token = '', email_change_token_new = '', email_change_token_current = '', reauthentication_token = ''
   WHERE id = _user_id;
  IF to_regclass('auth.one_time_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.one_time_tokens WHERE user_id = $1' USING _user_id;
  END IF;
  UPDATE public.senha_pedidos SET usado_em = now() WHERE user_id = _user_id AND usado_em IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.encerrar_sessoes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_sessoes(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.usar_pedido_de_senha(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usar_pedido_de_senha(text) TO service_role;

-- Conferência: a tabela e as duas funções.
SELECT 'tabela senha_pedidos' AS item, (to_regclass('public.senha_pedidos') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc WHERE proname IN ('conta_da_equipe_pelo_email', 'usar_pedido_de_senha', 'criar_pedido_de_senha')
UNION ALL
SELECT 'cadeado ligado', ligado::text FROM public.senhas_config WHERE id = 1;

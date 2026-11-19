-- O cadeado das senhas (19/11/2026, PR 1 das senhas; mockup aprovado no mesmo dia).
--
-- Toda conta da equipe, menos a administração geral e o marketing, passa a ter
-- a senha definida pelo app (padrão FdGhJiuPn): a pessoa não escolhe nem troca.
-- No desligamento, o marketing gera uma senha nova e a conta passa à próxima
-- pessoa. Candidatos do Trabalhe Conosco ficam de fora (são de fora e criam a
-- própria conta).
--
-- O login (GoTrue) deixa qualquer pessoa logada trocar a própria senha pela
-- API, e o "Esqueci a senha" termina numa troca dessas. Por isso o cadeado
-- fica no banco: um gatilho em auth.users recusa a troca da senha de uma conta
-- trancada, a não ser que uma função do servidor (com a chave de serviço) tenha
-- liberado aquela troca segundos antes (`liberar_troca_de_senha`). Criar a
-- conta não é troca, e continua livre.
--
-- INTERRUPTOR: o cadeado nasce DESLIGADO. Enquanto o "Esqueci a senha" ainda
-- leva a pessoa a escolher a senha (até o PR 3), ligar trancaria o primeiro
-- acesso de quem foi pré-cadastrada. Para ligar, no fim:
--   UPDATE public.senhas_config SET ligado = true, ligado_em = now() WHERE id = 1;
--
-- Pode rodar de novo sem estragar nada (não religa nem desliga o interruptor).

-- 1. O interruptor ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.senhas_config (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ligado     boolean NOT NULL DEFAULT false,
  ligado_em  timestamptz
);
INSERT INTO public.senhas_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.senhas_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.senhas_config FROM anon, authenticated;
GRANT ALL ON public.senhas_config TO service_role;

-- 2. As liberações (uma troca, por 2 minutos, pedida pelo servidor) --------------------
CREATE TABLE IF NOT EXISTS public.senha_liberacoes (
  user_id   uuid PRIMARY KEY,
  expira_em timestamptz NOT NULL
);
ALTER TABLE public.senha_liberacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.senha_liberacoes FROM anon, authenticated;
GRANT ALL ON public.senha_liberacoes TO service_role;

-- 3. Quem tem a senha trancada ----------------------------------------------------------
-- Interruptor ligado, conta da equipe (com perfil), e nem administração geral
-- nem marketing. Candidato do Trabalhe Conosco não tem perfil (vai só para
-- `candidatos`), e fica de fora por isso. NÃO olhar o user_metadata: a
-- própria pessoa consegue escrever nele (revisão de 19/11).
CREATE OR REPLACE FUNCTION public.senha_trancada(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT ligado FROM public.senhas_config WHERE id = 1), false)
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _uid)
     AND NOT coalesce(public.is_admin(_uid), false)
     AND NOT coalesce(public.is_marketing_user(_uid), false);
$$;
-- O Supabase dá EXECUTE a anon e authenticated por padrão: tirar dos dois.
REVOKE ALL ON FUNCTION public.senha_trancada(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.senha_trancada(uuid) TO service_role;

-- Para a tela: "a minha senha é trancada?"
CREATE OR REPLACE FUNCTION public.minha_senha_trancada()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND public.senha_trancada(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.minha_senha_trancada() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_senha_trancada() TO authenticated;

-- Só o servidor (chave de serviço) libera uma troca, logo antes de fazê-la.
CREATE OR REPLACE FUNCTION public.liberar_troca_de_senha(_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.senha_liberacoes (user_id, expira_em) VALUES (_user_id, now() + interval '2 minutes')
  ON CONFLICT (user_id) DO UPDATE SET expira_em = EXCLUDED.expira_em;
$$;
REVOKE ALL ON FUNCTION public.liberar_troca_de_senha(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_troca_de_senha(uuid) TO service_role;

-- 4. O gatilho em auth.users -----------------------------------------------------------
-- Só olha quando a senha muda. Conta trancada sem liberação válida: recusa,
-- e o login devolve erro. Com liberação: usa (apaga) e deixa passar.
-- Manutenção do próprio login não é troca: quando a senha antiga não estava no
-- formato bcrypt de sempre ($2a$/$2b$/$2y$), o GoTrue regrava no login, e isso passa.
CREATE OR REPLACE FUNCTION public.guarda_senha_trancada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.encrypted_password IS NOT DISTINCT FROM OLD.encrypted_password THEN
    RETURN NEW;
  END IF;
  IF OLD.encrypted_password IS NULL OR OLD.encrypted_password = '' OR OLD.encrypted_password !~ '^\$2[aby]\$' THEN
    RETURN NEW;
  END IF;
  IF NOT public.senha_trancada(NEW.id) THEN
    RETURN NEW;
  END IF;
  DELETE FROM public.senha_liberacoes WHERE user_id = NEW.id AND expira_em > now();
  IF FOUND THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'senha_trancada: a senha desta conta é definida pela administração.' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.guarda_senha_trancada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guarda_senha_trancada ON auth.users;
CREATE TRIGGER guarda_senha_trancada
  BEFORE UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guarda_senha_trancada();

-- Conferência: o interruptor (deve vir false na primeira vez), o gatilho e as funções.
SELECT 'cadeado ligado' AS item, ligado::text AS valor FROM public.senhas_config WHERE id = 1
UNION ALL
SELECT 'gatilho', tgname FROM pg_trigger WHERE tgname = 'guarda_senha_trancada'
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc WHERE proname IN ('senha_trancada', 'minha_senha_trancada', 'liberar_troca_de_senha', 'guarda_senha_trancada');

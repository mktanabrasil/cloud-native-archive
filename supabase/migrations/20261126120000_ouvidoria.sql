-- Ouvidoria do site (26/11/2026).
--
-- O formulário da página /ouvidoria/ do site manda para a função `ouvidoria`,
-- que guarda a mensagem aqui (garantia: se o e-mail falhar, nada se perde),
-- devolve um número de protocolo e manda o e-mail para ouvidoria@anabrasil.org
-- com cópia para a administração. As mensagens NÃO aparecem no app: o cartão
-- de Administração › Ouvidoria só mostra a ligação com o site e as contagens.
--
-- Quem não se identifica: guardamos só o tipo, a mensagem e a hora. Não há
-- coluna de IP, navegador ou qualquer outro dado de quem enviou.
--
-- Pode rodar de novo sem estragar nada.

-- 1. As mensagens ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ouvidoria_mensagens (
  id bigserial PRIMARY KEY,
  protocolo text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('elogio', 'sugestao', 'reclamacao', 'denuncia', 'mensagem')),
  mensagem text NOT NULL CHECK (char_length(mensagem) BETWEEN 1 AND 3000),
  identificado boolean NOT NULL,
  nome text CHECK (nome IS NULL OR char_length(nome) <= 80),
  email text CHECK (email IS NULL OR char_length(email) <= 120),
  criado_em timestamptz NOT NULL DEFAULT now(),
  email_enviado_em timestamptz,        -- quando o e-mail saiu (nulo = pendente)
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  proxima_tentativa timestamptz NOT NULL DEFAULT now(),        -- depois de uma falha: quando tentar de novo
  enviando_ate timestamptz NOT NULL DEFAULT now() + interval '2 minutes',  -- a vez de quem está mandando (quem criou começa com ela)
  avisado_em timestamptz,              -- aviso de e-mail atrasado (WhatsApp da MKT)
  CONSTRAINT ouvidoria_anonima_sem_dados CHECK (identificado OR (nome IS NULL AND email IS NULL))
);
CREATE INDEX IF NOT EXISTS ouvidoria_mensagens_pendentes ON public.ouvidoria_mensagens (proxima_tentativa) WHERE email_enviado_em IS NULL;
CREATE INDEX IF NOT EXISTS ouvidoria_mensagens_criado ON public.ouvidoria_mensagens (criado_em DESC);

-- 2. Protocolo em sequência, por ano (OUV-2026-0001…) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.ouvidoria_contador (
  ano integer PRIMARY KEY,
  ultimo integer NOT NULL
);

-- 3. O segredo do agendamento --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ouvidoria_estado (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  segredo text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
INSERT INTO public.ouvidoria_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ouvidoria_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ouvidoria_contador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ouvidoria_estado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ouvidoria_mensagens, public.ouvidoria_contador, public.ouvidoria_estado FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ouvidoria_mensagens, public.ouvidoria_contador, public.ouvidoria_estado TO service_role;
REVOKE ALL ON SEQUENCE public.ouvidoria_mensagens_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ouvidoria_mensagens_id_seq TO service_role;

-- 4. Registrar: número do protocolo e a mensagem, numa transação só ---------------------------------
CREATE OR REPLACE FUNCTION public.ouvidoria_registrar(p_tipo text, p_mensagem text, p_identificado boolean, p_nome text, p_email text)
RETURNS TABLE (id bigint, protocolo text, criado_em timestamptz)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_ano integer := extract(year FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::integer;
  v_n integer;
  v_prot text;
BEGIN
  INSERT INTO public.ouvidoria_contador AS c (ano, ultimo) VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;
  -- lpad corta números maiores que o tamanho: a partir de 10000, o número vai inteiro.
  v_prot := format('OUV-%s-%s', v_ano, CASE WHEN v_n < 10000 THEN lpad(v_n::text, 4, '0') ELSE v_n::text END);
  RETURN QUERY
  INSERT INTO public.ouvidoria_mensagens AS m (protocolo, tipo, mensagem, identificado, nome, email)
  VALUES (v_prot, p_tipo, p_mensagem, p_identificado,
          CASE WHEN p_identificado THEN p_nome END, CASE WHEN p_identificado THEN p_email END)
  RETURNING m.id, m.protocolo, m.criado_em;
END $$;
REVOKE ALL ON FUNCTION public.ouvidoria_registrar(text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ouvidoria_registrar(text, text, boolean, text, text) TO service_role;

-- 5. O agendamento: e-mails que não saíram, a cada 5 minutos --------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE $cmd$
      SELECT cron.schedule('ouvidoria-reenviar', '*/5 * * * *', $job$
        SELECT net.http_post(
          url := 'https://supabase.anabrasil.org/functions/v1/ouvidoria',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-ouvidoria-segredo', (SELECT segredo FROM public.ouvidoria_estado WHERE id = 1)),
          body := jsonb_build_object('acao', 'reenviar'),
          timeout_milliseconds := 60000
        );
      $job$)
    $cmd$;
  ELSE
    RAISE NOTICE 'pg_cron ou pg_net indisponível: o agendamento não foi criado.';
  END IF;
END $$;

-- Conferência: estado 1, agendamento '*/5 * * * *', anon_le false, coluna_de_ip false.
SELECT
  (SELECT count(*) FROM public.ouvidoria_estado) AS estado,
  (SELECT schedule FROM cron.job WHERE jobname = 'ouvidoria-reenviar') AS agendamento,
  has_table_privilege('anon', 'public.ouvidoria_mensagens', 'SELECT') AS anon_le,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ouvidoria_mensagens' AND column_name IN ('ip', 'endereco_ip', 'ip_address', 'user_agent', 'navegador')) AS coluna_de_ip;

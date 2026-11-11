-- Pizza da Alegria (11/11/2026): o ranking da disputa vai sozinho ao grupo de
-- WhatsApp ANABRASIL PUBLICAÇÕES, às sextas, 15h em Brasília (13/11, 20/11,
-- 27/11 e 04/12), pela função `pizza-ranking` e o Evolution API do Coolify.
--
-- 1. pizza_ranking_config: uma linha só, com o endereço do Evolution, a
--    instância, o token (colado por ele depois, no SQL Editor), o grupo, o
--    número de teste (o próprio WhatsApp da MKT, "Mensagens para mim"), o
--    e-mail de aviso, o segredo do agendamento e o interruptor `ligado`, que
--    NASCE DESLIGADO: nada vai ao grupo até ele ligar no painel.
-- 2. pizza_ranking_envios: cada tentativa (enviado, falhou, pulado).
-- As duas só a chave de serviço lê e grava (RLS ligado, sem política).
-- 3. O agendamento: pg_cron chama a função toda sexta às 18h UTC (15h em
--    Brasília) pelo pg_net. A função só envia nas quatro datas, entre 14h45 e
--    16h, com o interruptor ligado e se o grupo ainda não recebeu no dia.
--
-- Pode rodar de novo sem estragar nada (o token e o segredo ficam como estão).

CREATE TABLE IF NOT EXISTS public.pizza_ranking_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  evolution_url text DEFAULT 'http://evo-d7horb3rn7gpdqpk4jrcdfqv.45.90.109.31.sslip.io',
  instancia text NOT NULL DEFAULT 'anabrasil-ranking',
  token text,
  grupo text NOT NULL DEFAULT '5519998428050-1589548654@g.us',
  grupo_nome text NOT NULL DEFAULT 'ANABRASIL PUBLICAÇÕES',
  teste text NOT NULL DEFAULT '5519998190927@s.whatsapp.net',
  aviso_email text DEFAULT 'mkt@anabrasil.org',
  segredo text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ligado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
INSERT INTO public.pizza_ranking_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.pizza_ranking_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pizza_ranking_config FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.pizza_ranking_envios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  destino text NOT NULL CHECK (destino IN ('grupo', 'teste')),
  origem text NOT NULL CHECK (origem IN ('agendado', 'painel')),
  situacao text NOT NULL CHECK (situacao IN ('enviado', 'falhou', 'pulado')),
  detalhe text,
  pizzas integer,
  por uuid
);
CREATE INDEX IF NOT EXISTS pizza_ranking_envios_criado_em ON public.pizza_ranking_envios (criado_em DESC);
ALTER TABLE public.pizza_ranking_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pizza_ranking_envios FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pizza_ranking_config, public.pizza_ranking_envios TO service_role;

-- 3. O agendamento ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_net indisponível: %', SQLERRM;
  END;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron indisponível: %', SQLERRM;
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- Com o mesmo nome, o cron.schedule troca o que já existia.
    EXECUTE $cmd$
      SELECT cron.schedule('pizza-ranking-sexta', '0 18 * * 5', $job$
        SELECT net.http_post(
          url := 'https://supabase.anabrasil.org/functions/v1/pizza-ranking',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-ranking-segredo', (SELECT segredo FROM public.pizza_ranking_config WHERE id = 1)),
          body := jsonb_build_object('acao', 'agendado'),
          timeout_milliseconds := 90000
        );
      $job$)
    $cmd$;
  END IF;
END $$;

-- O que ficou: as duas extensões, a configuração e o agendamento (1 = ok).
SELECT
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_net') AS pg_net,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron,
  (SELECT count(*) FROM public.pizza_ranking_config) AS configuracao,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'cron' AND p.proname = 'schedule') AS agendador;

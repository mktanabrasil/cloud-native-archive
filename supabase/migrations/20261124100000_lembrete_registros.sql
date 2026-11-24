-- Lembrete diário dos registros das unidades (24/11/2026).
--
-- De segunda a sexta, às 10h em Brasília, a função `lembrete-registros` manda
-- ao grupo ANABRASIL PUBLICAÇÕES a arte do dia com a mensagem, o modelo para
-- copiar e, às segundas, a arte "Como enviar". Usa a mesma conexão do ranking
-- da Pizza (endereço do Evolution, instância, token, grupo e número de teste
-- ficam em pizza_ranking_config): nada novo para colar.
--
-- 1. lembrete_registros_config: uma linha, com o interruptor (NASCE
--    DESLIGADO), a mensagem e o modelo (editáveis no painel) e o segredo do
--    agendamento.
-- 2. lembrete_registros_envios: cada tentativa (enviado, falhou, pulado).
-- As duas só a chave de serviço lê e grava (RLS ligado, sem política).
-- 3. O agendamento: pg_cron chama a função de segunda a sexta às 13h UTC
--    (10h em Brasília). A função só envia entre 9h45 e 11h, com o interruptor
--    ligado e se o grupo ainda não recebeu no dia.
--
-- Pode rodar de novo sem estragar nada (o texto e o segredo ficam como estão).

CREATE TABLE IF NOT EXISTS public.lembrete_registros_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ligado boolean NOT NULL DEFAULT false,
  mensagem text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT '',
  segredo text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
-- Mensagem e modelo vazios = os de fábrica (regras.ts), que a função usa.
INSERT INTO public.lembrete_registros_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.lembrete_registros_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lembrete_registros_config FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.lembrete_registros_envios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  destino text NOT NULL CHECK (destino IN ('grupo', 'teste')),
  origem text NOT NULL CHECK (origem IN ('agendado', 'painel')),
  situacao text NOT NULL CHECK (situacao IN ('enviado', 'falhou', 'pulado')),
  -- O dia do conteúdo (Brasília) e quantas peças chegaram: o grupo nunca recebe a mesma peça duas vezes.
  dia date,
  pecas smallint NOT NULL DEFAULT 0,
  cor text,
  com_como_enviar boolean NOT NULL DEFAULT false,
  detalhe text,
  por uuid
);
CREATE INDEX IF NOT EXISTS lembrete_registros_envios_criado_em ON public.lembrete_registros_envios (criado_em DESC);
ALTER TABLE public.lembrete_registros_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lembrete_registros_envios FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lembrete_registros_config, public.lembrete_registros_envios TO service_role;

-- 3. O agendamento (pg_cron e pg_net já existem: o ranking da Pizza usa) ------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- Com o mesmo nome, o cron.schedule troca o que já existia.
    EXECUTE $cmd$
      SELECT cron.schedule('lembrete-registros', '0 13 * * 1-5', $job$
        SELECT net.http_post(
          url := 'https://supabase.anabrasil.org/functions/v1/lembrete-registros',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-lembrete-segredo', (SELECT segredo FROM public.lembrete_registros_config WHERE id = 1)),
          body := jsonb_build_object('acao', 'agendado'),
          timeout_milliseconds := 90000
        );
      $job$)
    $cmd$;
  ELSE
    RAISE NOTICE 'pg_cron ou pg_net indisponível: o agendamento não foi criado.';
  END IF;
END $$;

-- Conferência: configuração 1, interruptor false, agendamento '0 13 * * 1-5'.
SELECT
  (SELECT count(*) FROM public.lembrete_registros_config) AS configuracao,
  (SELECT ligado FROM public.lembrete_registros_config WHERE id = 1) AS ligado,
  (SELECT schedule FROM cron.job WHERE jobname = 'lembrete-registros') AS agendamento;

-- API pública do Portal Transparência (24/11/2026).
--
-- O site novo lê a lista de documentos de cada unidade pela função
-- `transparencia`, que responde SEMPRE daqui (nunca do Google na hora da
-- visita). A função atualiza estas tabelas por trás, a cada 2 minutos, e só
-- troca a lista de uma unidade quando a leitura do Drive deu certo: se o Google
-- falhar, fica valendo a última lista boa. Os arquivos continuam só no Drive.
--
-- 1. transparency_configs.slug: o endereço fixo de cada unidade no site.
-- 2. transparencia_estado: segredos, marcador de mudanças do Drive, trava e avisos.
-- 3. transparencia_unidades: a última lista boa de cada unidade (árvore em JSON).
-- 4. transparencia_itens: cada pasta e documento publicado, pela chave pública.
-- 5. transparencia_gravar / transparencia_pegar_trava: gravação atômica e trava.
-- 6. O agendamento (pg_cron + pg_net), a cada 2 minutos.
--
-- Pode rodar de novo sem estragar nada.

-- 1. Endereço fixo da unidade ------------------------------------------------------------
ALTER TABLE public.transparency_configs ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS transparency_configs_slug_unico ON public.transparency_configs (slug) WHERE slug IS NOT NULL;

-- 2. Estado da atualização -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transparencia_estado (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Cabeçalho que o agendamento manda para a função.
  segredo text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  -- Base das chaves públicas dos documentos (não muda: as chaves ficam iguais).
  segredo_das_chaves text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  marcador_de_mudancas text,
  trava_ate timestamptz,
  ciclo_em timestamptz,
  ciclo_erro text,
  falhando_desde timestamptz,
  alerta_em timestamptz,
  alerta_motivo text
);
INSERT INTO public.transparencia_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. A última lista boa de cada unidade ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transparencia_unidades (
  config_id uuid PRIMARY KEY REFERENCES public.transparency_configs (id) ON DELETE CASCADE,
  arvore jsonb,
  pastas integer NOT NULL DEFAULT 0,
  documentos integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz,          -- quando a lista foi lida com sucesso
  tentativa_em timestamptz,           -- a última tentativa (com ou sem sucesso)
  erro text,                          -- o erro da última tentativa, se falhou
  falhando_desde timestamptz,         -- desde quando as tentativas falham seguidas
  sujo boolean NOT NULL DEFAULT true  -- precisa ler de novo
);

-- 4. Cada pasta e documento publicado ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transparencia_itens (
  config_id uuid NOT NULL REFERENCES public.transparency_configs (id) ON DELETE CASCADE,
  chave text NOT NULL,
  drive_id text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('pasta', 'arquivo')),
  nome text NOT NULL,
  mime text,
  tamanho bigint,
  modificado_em timestamptz,
  PRIMARY KEY (config_id, chave)
);
CREATE INDEX IF NOT EXISTS transparencia_itens_chave ON public.transparencia_itens (chave);
CREATE INDEX IF NOT EXISTS transparencia_itens_drive ON public.transparencia_itens (drive_id);

ALTER TABLE public.transparencia_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transparencia_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transparencia_itens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transparencia_estado, public.transparencia_unidades, public.transparencia_itens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.transparencia_estado, public.transparencia_unidades, public.transparencia_itens TO service_role;

-- 5. Gravação atômica de uma unidade e trava do ciclo -----------------------------------
-- Troca a lista e os itens da unidade de uma vez: quem lê vê a lista velha ou a nova, nunca metade.
CREATE OR REPLACE FUNCTION public.transparencia_gravar(p_config uuid, p_arvore jsonb, p_pastas integer, p_documentos integer, p_itens jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM public.transparencia_itens WHERE config_id = p_config;
  INSERT INTO public.transparencia_itens (config_id, chave, drive_id, tipo, nome, mime, tamanho, modificado_em)
  SELECT DISTINCT ON (i.chave) p_config, i.chave, i.drive_id, i.tipo, i.nome, i.mime, i.tamanho, i.modificado_em
  FROM jsonb_to_recordset(p_itens) AS i(chave text, drive_id text, tipo text, nome text, mime text, tamanho bigint, modificado_em timestamptz);
  INSERT INTO public.transparencia_unidades AS u (config_id, arvore, pastas, documentos, atualizado_em, tentativa_em, erro, sujo)
  VALUES (p_config, p_arvore, p_pastas, p_documentos, now(), now(), NULL, false)
  ON CONFLICT (config_id) DO UPDATE SET arvore = EXCLUDED.arvore, pastas = EXCLUDED.pastas, documentos = EXCLUDED.documentos,
    atualizado_em = now(), tentativa_em = now(), erro = NULL, falhando_desde = NULL, sujo = false;
END $$;

-- Só um ciclo por vez: devolve o "até quando" da trava se pegou (o ciclo solta só a dele), ou NULL.
DROP FUNCTION IF EXISTS public.transparencia_pegar_trava(integer);
CREATE FUNCTION public.transparencia_pegar_trava(p_segundos integer)
RETURNS text LANGUAGE sql SET search_path = public AS $$
  UPDATE public.transparencia_estado SET trava_ate = clock_timestamp() + make_interval(secs => p_segundos)
  WHERE id = 1 AND (trava_ate IS NULL OR trava_ate < now())
  RETURNING trava_ate::text;
$$;

REVOKE ALL ON FUNCTION public.transparencia_gravar(uuid, jsonb, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transparencia_pegar_trava(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transparencia_gravar(uuid, jsonb, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.transparencia_pegar_trava(integer) TO service_role;

-- 6. O agendamento: a cada 2 minutos -----------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE $cmd$
      SELECT cron.schedule('transparencia-atualizar', '*/2 * * * *', $job$
        SELECT net.http_post(
          url := 'https://supabase.anabrasil.org/functions/v1/transparencia',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-transparencia-segredo', (SELECT segredo FROM public.transparencia_estado WHERE id = 1)),
          body := jsonb_build_object('acao', 'atualizar'),
          timeout_milliseconds := 120000
        );
      $job$)
    $cmd$;
  ELSE
    RAISE NOTICE 'pg_cron ou pg_net indisponível: o agendamento não foi criado.';
  END IF;
END $$;

-- Conferência: estado 1, unidades_cadastradas 20, agendamento '*/2 * * * *', anon_le_itens false.
SELECT
  (SELECT count(*) FROM public.transparencia_estado) AS estado,
  (SELECT count(*) FROM public.transparency_configs) AS unidades_cadastradas,
  (SELECT schedule FROM cron.job WHERE jobname = 'transparencia-atualizar') AS agendamento,
  has_table_privilege('anon', 'public.transparencia_itens', 'SELECT') AS anon_le_itens;

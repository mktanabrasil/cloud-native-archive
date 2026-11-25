-- API pública de notícias (blog) do site (25/11/2026).
--
-- As notícias moram no Drive compartilhado Setor Marketing, na pasta do blog
-- (unidade › ano › "AAAA-MM-DD — Título", cada uma com post.json, capa,
-- fotos/ e videos/), como o Portal da Transparência. Estas tabelas guardam só
-- a LISTA (texto e referências aos arquivos do Drive): nenhuma foto ou vídeo
-- fica no servidor. A função `noticias` relê por trás, a cada 2 minutos, o que
-- mudou no Drive, e só troca a notícia quando a leitura deu certo.
--
-- Pode rodar de novo sem estragar nada.

-- 1. Estado da leitura do Drive ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.noticias_estado (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  segredo text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  segredo_das_chaves text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  raiz_id text,                 -- a pasta do blog no Drive
  estrutura jsonb,              -- ids das pastas de unidade e de ano (para saber onde nascem posts novos)
  varrido_em timestamptz,       -- a última leitura completa das pastas
  marcador_de_mudancas text,
  trava_ate timestamptz,
  ciclo_em timestamptz,
  ciclo_erro text,
  falhando_desde timestamptz,
  alerta_em timestamptz,
  alerta_motivo text
);
INSERT INTO public.noticias_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Uma linha por notícia (pasta de post no Drive) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.noticias (
  pasta_id text PRIMARY KEY,
  slug text UNIQUE,
  pasta_nome text NOT NULL,
  unidade_pasta text,
  wp_id integer,                -- o id do post no WordPress (para os redirecionamentos)
  wp_slug text,
  dados jsonb,                  -- a notícia pronta (título, data, unidade(s), texto, capa, mídias, na_lista, fixada)
  data date,
  subpastas text[] NOT NULL DEFAULT '{}',  -- ids de fotos/ e videos/ (para achar mudanças)
  atualizado_em timestamptz,    -- leitura boa
  tentativa_em timestamptz,
  erro text,
  falhando_desde timestamptz,
  sujo boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS noticias_data ON public.noticias (data DESC);

-- 3. Cada arquivo (capa, foto, vídeo), pela chave pública ---------------------------------
CREATE TABLE IF NOT EXISTS public.noticias_arquivos (
  chave text PRIMARY KEY,
  pasta_id text NOT NULL REFERENCES public.noticias (pasta_id) ON DELETE CASCADE,
  drive_id text NOT NULL,
  nome text NOT NULL,
  mime text,
  tamanho bigint,
  w integer,
  h integer,
  modificado_em timestamptz
);
CREATE INDEX IF NOT EXISTS noticias_arquivos_pasta ON public.noticias_arquivos (pasta_id);
CREATE INDEX IF NOT EXISTS noticias_arquivos_drive ON public.noticias_arquivos (drive_id);

ALTER TABLE public.noticias_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias_arquivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noticias_estado, public.noticias, public.noticias_arquivos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.noticias_estado, public.noticias, public.noticias_arquivos TO service_role;

-- 4. Gravação atômica de uma notícia e trava do ciclo ---------------------------------------
CREATE OR REPLACE FUNCTION public.noticias_gravar(p_pasta text, p_slug text, p_dados jsonb, p_data date, p_subpastas text[], p_wp_id integer, p_wp_slug text, p_arquivos jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.noticias SET slug = p_slug, dados = p_dados, data = p_data, subpastas = p_subpastas, wp_id = p_wp_id, wp_slug = p_wp_slug,
    atualizado_em = now(), tentativa_em = now(), erro = NULL, falhando_desde = NULL, sujo = false
  WHERE pasta_id = p_pasta;
  IF NOT FOUND THEN RAISE EXCEPTION 'notícia % não está cadastrada', p_pasta; END IF;
  DELETE FROM public.noticias_arquivos WHERE pasta_id = p_pasta;
  INSERT INTO public.noticias_arquivos (chave, pasta_id, drive_id, nome, mime, tamanho, w, h, modificado_em)
  SELECT DISTINCT ON (a.chave) a.chave, p_pasta, a.drive_id, a.nome, a.mime, a.tamanho, a.w, a.h, a.modificado_em
  FROM jsonb_to_recordset(p_arquivos) AS a(chave text, drive_id text, nome text, mime text, tamanho bigint, w integer, h integer, modificado_em timestamptz)
  ON CONFLICT (chave) DO UPDATE SET pasta_id = EXCLUDED.pasta_id, drive_id = EXCLUDED.drive_id, nome = EXCLUDED.nome, mime = EXCLUDED.mime,
    tamanho = EXCLUDED.tamanho, w = EXCLUDED.w, h = EXCLUDED.h, modificado_em = EXCLUDED.modificado_em;
END $$;

CREATE OR REPLACE FUNCTION public.noticias_pegar_trava(p_segundos integer)
RETURNS text LANGUAGE sql SET search_path = public AS $$
  UPDATE public.noticias_estado SET trava_ate = clock_timestamp() + make_interval(secs => p_segundos)
  WHERE id = 1 AND (trava_ate IS NULL OR trava_ate < now())
  RETURNING trava_ate::text;
$$;

REVOKE ALL ON FUNCTION public.noticias_gravar(text, text, jsonb, date, text[], integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.noticias_pegar_trava(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.noticias_gravar(text, text, jsonb, date, text[], integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.noticias_pegar_trava(integer) TO service_role;

-- 5. O agendamento: a cada 2 minutos -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE $cmd$
      SELECT cron.schedule('noticias-atualizar', '1-59/2 * * * *', $job$
        SELECT net.http_post(
          url := 'https://supabase.anabrasil.org/functions/v1/noticias',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-noticias-segredo', (SELECT segredo FROM public.noticias_estado WHERE id = 1)),
          body := jsonb_build_object('acao', 'atualizar'),
          timeout_milliseconds := 120000
        );
      $job$)
    $cmd$;
  ELSE
    RAISE NOTICE 'pg_cron ou pg_net indisponível: o agendamento não foi criado.';
  END IF;
END $$;

-- Conferência: estado 1, agendamento '1-59/2 * * * *', anon_le_noticias false, conexao_do_drive true.
SELECT
  (SELECT count(*) FROM public.noticias_estado) AS estado,
  (SELECT schedule FROM cron.job WHERE jobname = 'noticias-atualizar') AS agendamento,
  has_table_privilege('anon', 'public.noticias', 'SELECT') AS anon_le_noticias,
  EXISTS (SELECT 1 FROM public.pizza_drive_conexao WHERE id = 1) AS conexao_do_drive;

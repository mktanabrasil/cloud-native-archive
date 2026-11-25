-- Notícias: o ciclo não grava por cima de um salvar do painel (25/11/2026).
--
-- O painel (Marketing › Notícias) salva no Drive e relê a notícia na hora. Se o
-- ciclo de 2 minutos tinha começado a ler a mesma notícia antes, ele gravaria
-- por cima a versão velha (um rascunho voltaria ao site até o ciclo seguinte).
-- Agora o ciclo passa `p_condicional` e o `atualizado_em` que viu na fila: se a
-- notícia foi regravada nesse meio-tempo, ele não grava e só a marca para reler.
-- O painel continua gravando sempre (sem condição).
--
-- Os parâmetros novos têm valor padrão: a função já publicada continua
-- funcionando até a nova subir. Pode rodar de novo sem estragar nada.

-- O salvar e o ciclo nunca correm juntos (mesma trava). Quando um salvar está
-- esperando, ele marca aqui; o ciclo para de começar leituras e solta a trava.
ALTER TABLE public.noticias_estado ADD COLUMN IF NOT EXISTS salvar_esperando_ate timestamptz;

DROP FUNCTION IF EXISTS public.noticias_gravar(text, text, jsonb, date, text[], integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.noticias_gravar(
  p_pasta text, p_slug text, p_dados jsonb, p_data date, p_subpastas text[], p_wp_id integer, p_wp_slug text, p_arquivos jsonb,
  p_condicional boolean DEFAULT false, p_antes timestamptz DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.noticias WHERE pasta_id = p_pasta) THEN
    RAISE EXCEPTION 'notícia % não está cadastrada', p_pasta;
  END IF;
  UPDATE public.noticias SET slug = p_slug, dados = p_dados, data = p_data, subpastas = p_subpastas, wp_id = p_wp_id, wp_slug = p_wp_slug,
    atualizado_em = now(), tentativa_em = now(), erro = NULL, falhando_desde = NULL, sujo = false
  WHERE pasta_id = p_pasta AND (NOT p_condicional OR atualizado_em IS NOT DISTINCT FROM p_antes);
  IF NOT FOUND THEN
    -- Alguém (o painel) regravou enquanto o ciclo lia: fica a versão do painel; o próximo ciclo relê.
    UPDATE public.noticias SET sujo = true WHERE pasta_id = p_pasta;
    RETURN false;
  END IF;
  DELETE FROM public.noticias_arquivos WHERE pasta_id = p_pasta;
  INSERT INTO public.noticias_arquivos (chave, pasta_id, drive_id, nome, mime, tamanho, w, h, modificado_em)
  SELECT DISTINCT ON (a.chave) a.chave, p_pasta, a.drive_id, a.nome, a.mime, a.tamanho, a.w, a.h, a.modificado_em
  FROM jsonb_to_recordset(p_arquivos) AS a(chave text, drive_id text, nome text, mime text, tamanho bigint, w integer, h integer, modificado_em timestamptz)
  ON CONFLICT (chave) DO UPDATE SET pasta_id = EXCLUDED.pasta_id, drive_id = EXCLUDED.drive_id, nome = EXCLUDED.nome, mime = EXCLUDED.mime,
    tamanho = EXCLUDED.tamanho, w = EXCLUDED.w, h = EXCLUDED.h, modificado_em = EXCLUDED.modificado_em;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.noticias_gravar(text, text, jsonb, date, text[], integer, text, jsonb, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.noticias_gravar(text, text, jsonb, date, text[], integer, text, jsonb, boolean, timestamptz) TO service_role;

-- PostgREST passa a enxergar a assinatura nova na hora.
NOTIFY pgrst, 'reload schema';

-- Conferência: uma linha só, com os 10 parâmetros e retorno boolean; anon_executa false; coluna_nova true.
SELECT p.oid::regprocedure AS funcao, pg_get_function_result(p.oid) AS retorno,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_executa,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'noticias_estado' AND column_name = 'salvar_esperando_ate') AS coluna_nova
FROM pg_proc p WHERE p.proname = 'noticias_gravar' AND p.pronamespace = 'public'::regnamespace;

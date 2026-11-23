-- Feedback do app, PR 2 (23/11/2026): a caixa no Painel.
--
-- O marketing abre cada feedback (fica "lido"), muda a situação (Novo, Em
-- análise, Feito, Não vamos fazer) e pode responder. Quem mandou vê a
-- situação e a resposta no "Seus feedbacks" e recebe um e-mail
-- (função `feedback-aviso`, tipo 'resposta').
--
-- Só pelas funções daqui; a tabela continua sem escrita direta.
-- ORDEM: rodar ANTES do merge (sem ele, a aba Feedback mostra erro ao salvar).
-- Pode rodar de novo sem estragar nada.

-- Abrir: marca como lido (só a primeira vez conta).
CREATE OR REPLACE FUNCTION public.feedback_marcar_lido(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN
    RAISE EXCEPTION 'Só o marketing cuida do feedback.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.feedbacks SET lido_em = now() WHERE id = _id AND lido_em IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_marcar_lido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feedback_marcar_lido(uuid) TO authenticated;

-- Salvar a situação e a resposta. Devolve a marca da mudança (atualizado_em)
-- quando algo mudou, para o aviso por e-mail; nada mudou, devolve NULL.
-- _versao: o atualizado_em que a tela leu. Se alguém salvou depois (outra
-- pessoa do marketing, outra aba), recusa em vez de apagar o que foi escrito.
CREATE OR REPLACE FUNCTION public.feedback_atualizar(_id uuid, _situacao text, _resposta text, _versao timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  f public.feedbacks%ROWTYPE;
  resp text := NULLIF(btrim(coalesce(_resposta, '')), '');
  agora timestamptz := clock_timestamp();
  nome text;
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN
    RAISE EXCEPTION 'Só o marketing cuida do feedback.' USING ERRCODE = '42501';
  END IF;
  IF _situacao IS NULL OR _situacao NOT IN ('novo', 'analise', 'feito', 'nao') THEN
    RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(resp, '')) > 4000 THEN
    RAISE EXCEPTION 'A resposta passou de 4.000 caracteres.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.feedbacks WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF _versao IS NULL OR f.atualizado_em IS DISTINCT FROM _versao THEN
    RAISE EXCEPTION 'Alguém mudou este feedback enquanto você escrevia. A caixa foi atualizada: confira e salve de novo.' USING ERRCODE = '40001';
  END IF;
  IF f.situacao = _situacao AND f.resposta IS NOT DISTINCT FROM resp THEN
    UPDATE public.feedbacks SET lido_em = coalesce(lido_em, agora) WHERE id = _id;
    RETURN NULL;
  END IF;
  nome := COALESCE(
    (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.user_id = auth.uid()),
    'Marketing'
  );
  UPDATE public.feedbacks SET
    situacao = _situacao,
    resposta = resp,
    respondido_por = CASE WHEN resp IS DISTINCT FROM f.resposta THEN CASE WHEN resp IS NULL THEN NULL ELSE nome END ELSE respondido_por END,
    respondido_em = CASE WHEN resp IS DISTINCT FROM f.resposta THEN CASE WHEN resp IS NULL THEN NULL ELSE agora END ELSE respondido_em END,
    lido_em = coalesce(lido_em, agora),
    atualizado_em = agora
  WHERE id = _id;
  RETURN agora;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_atualizar(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feedback_atualizar(uuid, text, text, timestamptz) TO authenticated;

-- Conferência.
SELECT 'função feedback_marcar_lido' AS item, (to_regprocedure('public.feedback_marcar_lido(uuid)') IS NOT NULL)::text AS valor
UNION ALL SELECT 'função feedback_atualizar', (to_regprocedure('public.feedback_atualizar(uuid, text, text, timestamptz)') IS NOT NULL)::text
UNION ALL SELECT 'feedbacks até agora', (SELECT count(*)::text FROM public.feedbacks);

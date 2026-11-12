-- Voluntariado do Natal Feliz (12/11/2026): "como ficou sabendo" e a área CCII.
--
-- 1. Quem é de fora ("Nenhum dos dois") e responde "Não" à indicação passa a
--    contar como ficou sabendo (campo obrigatório no formulário). A resposta
--    fica na coluna nova como_soube. O banco NÃO exige o campo: assim o
--    formulário que ainda estiver aberto num celular, na versão antiga,
--    continua enviando entre este SQL e o merge.
-- 2. Área nova, CCII (trabalho com os idosos: apoio nas atividades com eles),
--    para funcionários e voluntários de fora.
--
-- inscrever_voluntario ganha o 12º parâmetro (p_como_soube, opcional). A
-- versão de 11 parâmetros sai junto: com as duas, o PostgREST não saberia
-- qual chamar quando o formulário antigo manda os 11. Com uma só, o
-- formulário antigo cai nela (o 12º fica vazio) e o novo também.
--
-- Pode rodar de novo sem estragar nada.

-- 1. A coluna nova ---------------------------------------------------------------------------

ALTER TABLE public.voluntarios_natal ADD COLUMN IF NOT EXISTS como_soube text;

-- 2. CCII nas opções e nas metas --------------------------------------------------------------

-- NOT VALID, como antes: vale para o que entrar daqui em diante.
ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_opcoes_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_opcoes_check CHECK (
  opcao1 IN ('cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
             'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids', 'ccii')
  AND (opcao2 IS NULL OR (opcao2 <> opcao1 AND opcao2 IN (
             'cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
             'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids', 'ccii')))
) NOT VALID;

CREATE OR REPLACE FUNCTION public.definir_meta_da_area(p_area text, p_meta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_area NOT IN ('cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
                    'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids', 'ccii') THEN
    RAISE EXCEPTION 'area_invalida';
  END IF;
  IF p_meta IS NULL THEN
    DELETE FROM public.voluntariado_metas WHERE area = p_area;
    RETURN;
  END IF;
  IF p_meta NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'meta_invalida'; END IF;
  INSERT INTO public.voluntariado_metas (area, meta) VALUES (p_area, p_meta)
  ON CONFLICT (area) DO UPDATE SET meta = excluded.meta, atualizado_em = now();
END;
$$;

-- 3. A inscrição, com o 12º parâmetro ---------------------------------------------------------

DROP FUNCTION IF EXISTS public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.inscrever_voluntario(
  p_nome text,
  p_whatsapp text,
  p_horario text,
  p_vinculo text,
  p_opcao1 text,
  p_opcao2 text DEFAULT NULL,
  p_unidade_id text DEFAULT NULL,
  p_unidade_nome text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_indicado_por text DEFAULT NULL,
  p_igreja text DEFAULT NULL,
  p_como_soube text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Sem I, O, 0 e 1: ninguém confunde ao ler ou ditar o protocolo.
  letras constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_opcao2 text := nullif(btrim(coalesce(p_opcao2, '')), '');
  v_indicado text := nullif(left(btrim(regexp_replace(coalesce(p_indicado_por, ''), '\s+', ' ', 'g')), 120), '');
  v_igreja text := nullif(left(btrim(regexp_replace(coalesce(p_igreja, ''), '\s+', ' ', 'g')), 120), '');
  v_como_soube text := nullif(left(btrim(regexp_replace(coalesce(p_como_soube, ''), '\s+', ' ', 'g')), 120), '');
  v_areas text[];
  v_meta integer;
  v_protocolo text;
  tentativa integer := 0;
BEGIN
  -- Prazo: até 15/11/2026, horário de Brasília.
  IF now() >= timestamptz '2026-11-16 00:00:00 America/Sao_Paulo' THEN
    RAISE EXCEPTION 'prazo_encerrado';
  END IF;

  IF length(btrim(coalesce(p_nome, ''))) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'nome_invalido';
  END IF;
  -- Quem digita com o 55 do Brasil na frente também passa.
  IF length(v_whatsapp) IN (12, 13) AND left(v_whatsapp, 2) = '55' THEN
    v_whatsapp := substr(v_whatsapp, 3);
  END IF;
  IF v_whatsapp !~ '^[1-9][0-9]{9,10}$' THEN
    RAISE EXCEPTION 'whatsapp_invalido';
  END IF;
  -- Sem o "Dia anterior" (23/10/2026).
  IF p_horario IS NULL OR p_horario NOT IN ('manha', 'tarde', 'pos_evento', 'dia_todo') THEN
    RAISE EXCEPTION 'horario_invalido';
  END IF;

  -- As áreas de cada vínculo (as mesmas do formulário), só as do dia do evento.
  -- CCII (12/11/2026): para funcionários e voluntários de fora.
  v_areas := CASE p_vinculo
    WHEN 'funcionario' THEN ARRAY['cozinha', 'inflaveis', 'estacoes', 'ccii']
    WHEN 'alcance'     THEN ARRAY['cozinha', 'louvor_kids', 'som', 'recreacao_kids', 'inflaveis', 'presentes_kids']
    WHEN 'comunidade'  THEN ARRAY['cozinha', 'inflaveis', 'estacoes', 'ccii']
  END;
  IF v_areas IS NULL THEN RAISE EXCEPTION 'vinculo_invalido'; END IF;

  IF p_vinculo = 'funcionario' THEN
    IF length(btrim(coalesce(p_unidade_id, ''))) NOT BETWEEN 1 AND 60
       OR length(btrim(coalesce(p_unidade_nome, ''))) NOT BETWEEN 1 AND 120
       OR coalesce(p_area, '') NOT IN ('educacao', 'social') THEN
      RAISE EXCEPTION 'unidade_invalida';
    END IF;
  END IF;

  IF v_opcao2 = p_opcao1 THEN
    v_opcao2 := NULL;
  END IF;
  IF p_opcao1 IS NULL OR NOT (p_opcao1 = ANY (v_areas)) OR (v_opcao2 IS NOT NULL AND NOT (v_opcao2 = ANY (v_areas))) THEN
    RAISE EXCEPTION 'area_invalida';
  END IF;
  IF EXISTS (SELECT 1 FROM public.voluntarios_natal v WHERE v.whatsapp = v_whatsapp) THEN
    RAISE EXCEPTION 'ja_inscrito';
  END IF;

  -- A meta da 1ª opção. A trava faz duas inscrições na mesma área esperarem
  -- uma pela outra: a última vaga não sai duas vezes.
  PERFORM pg_advisory_xact_lock(hashtext('voluntariado_meta:' || p_opcao1));
  SELECT m.meta INTO v_meta FROM public.voluntariado_metas m WHERE m.area = p_opcao1;
  IF v_meta IS NOT NULL AND (SELECT count(*) FROM public.voluntarios_natal v WHERE v.opcao1 = p_opcao1) >= v_meta THEN
    RAISE EXCEPTION 'area_lotada';
  END IF;

  LOOP
    tentativa := tentativa + 1;
    v_protocolo := 'VL-' || (
      SELECT string_agg(substr(letras, 1 + floor(random() * length(letras))::integer, 1), '')
      FROM generate_series(1, 5)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.voluntarios_natal v WHERE v.protocolo = v_protocolo);
    IF tentativa >= 20 THEN RAISE EXCEPTION 'protocolo_indisponivel'; END IF;
  END LOOP;

  BEGIN
    INSERT INTO public.voluntarios_natal
      (protocolo, nome, whatsapp, vinculo, horario, unidade_id, unidade_nome, area, indicado_por, igreja, como_soube, opcao1, opcao2)
    VALUES (
      v_protocolo, left(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), 120), v_whatsapp, p_vinculo, p_horario,
      CASE WHEN p_vinculo = 'funcionario' THEN btrim(p_unidade_id) END,
      CASE WHEN p_vinculo = 'funcionario' THEN left(btrim(p_unidade_nome), 120) END,
      CASE WHEN p_vinculo = 'funcionario' THEN p_area END,
      CASE WHEN p_vinculo = 'comunidade' THEN v_indicado END,
      CASE WHEN p_vinculo = 'comunidade' THEN v_igreja END,
      -- Só quem é de fora e não foi indicado conta como ficou sabendo.
      CASE WHEN p_vinculo = 'comunidade' AND v_indicado IS NULL THEN v_como_soube END,
      p_opcao1, v_opcao2);
  EXCEPTION
    WHEN check_violation THEN RAISE EXCEPTION 'area_invalida';
    WHEN unique_violation THEN RAISE EXCEPTION 'ja_inscrito';
  END;

  RETURN v_protocolo;
END;
$$;

REVOKE ALL ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;

-- O PostgREST relê as funções (a de 11 parâmetros sumiu, a de 12 chegou).
NOTIFY pgrst, 'reload schema';

-- Conferência: deve mostrar 1 linha (só a versão de 12 parâmetros), com coluna_como_soube = 1.
SELECT p.oid::regprocedure AS funcao,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'voluntarios_natal' AND column_name = 'como_soube') AS coluna_como_soube
FROM pg_proc p
WHERE p.proname = 'inscrever_voluntario' AND p.pronamespace = 'public'::regnamespace;

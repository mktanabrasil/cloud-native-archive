-- Voluntariado do Natal Feliz (23/10/2026): só o dia do evento, e a planilha da coordenação.
--
-- 1. O voluntariado passa a ser só no dia do evento: montagem/desmontagem,
--    decoração e limpeza pré ficam com os funcionários, no dia anterior,
--    como dia trabalhado. Saem do formulário essas áreas e o horário "Dia
--    anterior". Quem já se inscreveu nelas continua como está.
-- 2. A versão antiga de inscrever_voluntario (7 parâmetros) sai: o front em
--    etapas está no ar desde o #203.
-- 3. As inscrições passam a cair direto na planilha da coordenação
--    ("Mapeamento Natal Feliz 2026", aba Voluntários), que já tem as colunas
--    e as listas. A planilha antiga do app foi para a lixeira. Tudo o que já
--    existe é reenviado para a planilha nova.

-- 1. A inscrição: as áreas e os horários do dia do evento ----------------------------------

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
  p_igreja text DEFAULT NULL
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
  v_areas := CASE p_vinculo
    WHEN 'funcionario' THEN ARRAY['cozinha', 'inflaveis', 'estacoes']
    WHEN 'alcance'     THEN ARRAY['cozinha', 'louvor_kids', 'som', 'recreacao_kids', 'inflaveis', 'presentes_kids']
    WHEN 'comunidade'  THEN ARRAY['cozinha', 'inflaveis', 'estacoes']
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
      (protocolo, nome, whatsapp, vinculo, horario, unidade_id, unidade_nome, area, indicado_por, igreja, opcao1, opcao2)
    VALUES (
      v_protocolo, left(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), 120), v_whatsapp, p_vinculo, p_horario,
      CASE WHEN p_vinculo = 'funcionario' THEN btrim(p_unidade_id) END,
      CASE WHEN p_vinculo = 'funcionario' THEN left(btrim(p_unidade_nome), 120) END,
      CASE WHEN p_vinculo = 'funcionario' THEN p_area END,
      CASE WHEN p_vinculo = 'comunidade' THEN v_indicado END,
      CASE WHEN p_vinculo = 'comunidade' THEN v_igreja END,
      p_opcao1, v_opcao2);
  EXCEPTION
    WHEN check_violation THEN RAISE EXCEPTION 'area_invalida';
    WHEN unique_violation THEN RAISE EXCEPTION 'ja_inscrito';
  END;

  RETURN v_protocolo;
END;
$$;

REVOKE ALL ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;

-- 2. A versão antiga (7 parâmetros) sai -----------------------------------------------------

DROP FUNCTION IF EXISTS public.inscrever_voluntario(text, text, text, text, text, text, text);

-- 3. A planilha da coordenação ----------------------------------------------------------------

-- A aba onde escrever, e uma trava para duas chamadas ao mesmo tempo não
-- escreverem na mesma linha (a função procura a primeira linha livre).
ALTER TABLE public.voluntariado_planilha
  ADD COLUMN IF NOT EXISTS aba           text,
  ADD COLUMN IF NOT EXISTS escrevendo_em timestamptz;

INSERT INTO public.voluntariado_planilha (id, planilha_id, aba, criada_por, criada_em, erro, cores_em, cabecalho_em)
VALUES (1, '1A4HR2tiCQLqTTo2NOpSBoCVTpZ9Habc_SCB5BgBNn5I', 'Voluntários', 'planilha da coordenação (23/10/2026)', now(), NULL, now(), now())
ON CONFLICT (id) DO UPDATE SET
  planilha_id = excluded.planilha_id, aba = excluded.aba, criada_por = excluded.criada_por, criada_em = excluded.criada_em,
  erro = NULL, cores_em = excluded.cores_em, cabecalho_em = excluded.cabecalho_em, escrevendo_em = NULL;

-- Tudo o que já existe vai para a planilha nova.
UPDATE public.voluntarios_natal SET planilha_em = NULL, planilha_tentando_em = NULL;

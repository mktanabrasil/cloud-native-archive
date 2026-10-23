-- Voluntariado do Natal Feliz (23/10/2026): o formulário em etapas e as metas por área.
--
-- O formulário deixa de ser só dos funcionários: abre para o público e para o
-- Alcance JNI (parceiro). Antes de tudo, a pessoa confirma que vai ao
-- treinamento obrigatório de 28/11 no Manaim (quem não pode não chega a
-- gravar nada). Depois: nome, WhatsApp, horário (um só), vínculo e as áreas,
-- que mudam conforme o vínculo:
--   funcionário(a) da ANA → unidade (só a Educação: GOE e CEIs);
--   Alcance JNI           → nada a mais;
--   nenhum dos dois       → quem da ANA indicou (se alguém) e a igreja (opcional).
--
-- Metas (decisões de 23/10/2026): um total por área, contando só a 1ª opção.
-- Área lotada não aceita mais 1ª opção, só 2ª (reserva para desistência);
-- apagar uma inscrição reabre a vaga. Área sem meta não tem limite. O
-- formulário público só fica sabendo QUAIS áreas lotaram, nunca os números.
--
-- Ainda não havia inscrições (23/10/2026). A versão antiga de
-- inscrever_voluntario (7 parâmetros) continua até o front novo estar no ar,
-- para o formulário de agora não quebrar entre o SQL e o merge.

-- 1. As colunas novas ---------------------------------------------------------------------

ALTER TABLE public.voluntarios_natal
  ADD COLUMN IF NOT EXISTS vinculo      text NOT NULL DEFAULT 'funcionario',
  ADD COLUMN IF NOT EXISTS horario      text,
  ADD COLUMN IF NOT EXISTS indicado_por text,
  ADD COLUMN IF NOT EXISTS igreja       text;

-- Só o funcionário tem unidade.
ALTER TABLE public.voluntarios_natal
  ALTER COLUMN unidade_id   DROP NOT NULL,
  ALTER COLUMN unidade_nome DROP NOT NULL,
  ALTER COLUMN area         DROP NOT NULL;

ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_area_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_area_check
  CHECK (area IS NULL OR area IN ('educacao', 'social'));

ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_vinculo_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_vinculo_check
  CHECK (vinculo IN ('funcionario', 'alcance', 'comunidade'));

ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_unidade_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_unidade_check
  CHECK (vinculo <> 'funcionario' OR (unidade_id IS NOT NULL AND unidade_nome IS NOT NULL AND area IS NOT NULL));

ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_horario_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_horario_check
  CHECK (horario IS NULL OR horario IN ('manha', 'tarde', 'dia_anterior', 'pos_evento', 'dia_todo'));

-- As 10 áreas de agora. NOT VALID: vale para o que entrar daqui em diante,
-- sem barrar a migração se sobrou alguma inscrição de teste com área antiga.
ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_opcoes_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_opcoes_check CHECK (
  opcao1 IN ('cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
             'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids')
  AND (opcao2 IS NULL OR (opcao2 <> opcao1 AND opcao2 IN (
             'cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
             'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids')))
) NOT VALID;

CREATE INDEX IF NOT EXISTS voluntarios_natal_opcao1_idx ON public.voluntarios_natal (opcao1);

-- 2. As metas por área ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_metas (
  area           text PRIMARY KEY,
  meta           integer NOT NULL CHECK (meta BETWEEN 1 AND 5000),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voluntariado_metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voluntariado_metas_comunicacao ON public.voluntariado_metas;
CREATE POLICY voluntariado_metas_comunicacao ON public.voluntariado_metas FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));
REVOKE ALL ON public.voluntariado_metas FROM anon, authenticated;
GRANT SELECT ON public.voluntariado_metas TO authenticated;
GRANT ALL ON public.voluntariado_metas TO service_role;

-- A comunicação define a meta de uma área (vazio = sem limite).
CREATE OR REPLACE FUNCTION public.definir_meta_da_area(p_area text, p_meta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_area NOT IN ('cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
                    'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids') THEN
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

REVOKE ALL ON FUNCTION public.definir_meta_da_area(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_meta_da_area(text, integer) TO authenticated;

-- O formulário público: só QUAIS áreas lotaram (sem números, sem ninguém).
CREATE OR REPLACE FUNCTION public.areas_lotadas_do_voluntariado()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(m.area ORDER BY m.area), '{}')
  FROM public.voluntariado_metas m
  WHERE (SELECT count(*) FROM public.voluntarios_natal v WHERE v.opcao1 = m.area) >= m.meta;
$$;

REVOKE ALL ON FUNCTION public.areas_lotadas_do_voluntariado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.areas_lotadas_do_voluntariado() TO anon, authenticated;

-- 3. A inscrição em etapas ---------------------------------------------------------------------

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
  IF p_horario IS NULL OR p_horario NOT IN ('manha', 'tarde', 'dia_anterior', 'pos_evento', 'dia_todo') THEN
    RAISE EXCEPTION 'horario_invalido';
  END IF;

  -- As áreas de cada vínculo (as mesmas do formulário).
  v_areas := CASE p_vinculo
    WHEN 'funcionario' THEN ARRAY['cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes']
    WHEN 'alcance'     THEN ARRAY['cozinha', 'montagem', 'louvor_kids', 'som', 'limpeza_pre', 'recreacao_kids', 'inflaveis', 'presentes_kids']
    WHEN 'comunidade'  THEN ARRAY['cozinha', 'montagem', 'limpeza_pre', 'inflaveis', 'estacoes']
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

-- 4. O painel ao vivo: vínculo, horário e as metas ---------------------------------------------

-- Continua sem WhatsApp e sem protocolo; também sem indicação e igreja.
CREATE OR REPLACE FUNCTION public.acompanhamento_do_voluntariado(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT * INTO cfg FROM public.voluntariado_config WHERE id = 1;
  IF cfg IS NULL OR coalesce(p_codigo, '') = '' OR p_codigo <> cfg.codigo_acompanhamento THEN
    RAISE EXCEPTION 'codigo_invalido';
  END IF;
  RETURN jsonb_build_object(
    'meta', cfg.meta,
    'agora', now(),
    'metas', coalesce((SELECT jsonb_object_agg(m.area, m.meta) FROM public.voluntariado_metas m), '{}'::jsonb),
    'inscricoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'nome', v.nome, 'vinculo', v.vinculo, 'horario', v.horario,
        'unidade_id', v.unidade_id, 'unidade_nome', v.unidade_nome, 'area', v.area,
        'opcao1', v.opcao1, 'opcao2', v.opcao2, 'created_at', v.created_at
      ) ORDER BY v.created_at)
      FROM public.voluntarios_natal v
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.acompanhamento_do_voluntariado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acompanhamento_do_voluntariado(text) TO anon, authenticated;

-- 5. A planilha do Google ganha colunas: o cabeçalho é reescrito uma vez ------------------------

ALTER TABLE public.voluntariado_planilha
  ADD COLUMN IF NOT EXISTS cabecalho_em timestamptz;

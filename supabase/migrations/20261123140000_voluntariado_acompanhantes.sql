-- Voluntariado do Natal Feliz (23/11/2026): acompanhantes.
--
-- No formulário, "Vai levar acompanhante?": pessoa idosa ou criança, com nome
-- e idade (até 4). Ficam numa coluna nova da inscrição e vão para a planilha
-- da coordenação, na coluna L ("Acompanhantes").
--
-- A inscrever_voluntario ganha o 13º parâmetro, p_acompanhantes (jsonb,
-- opcional). Em vez de reescrever a função, este SQL parte da que está no
-- banco agora (com o prazo de 26/11 e o que mais tiver) e acrescenta só o
-- acompanhante: o parâmetro, a conferência e a coluna no INSERT. A versão de
-- 12 parâmetros sai (senão o banco não sabe qual chamar).
--
-- ORDEM: rodar ANTES do merge (o app novo manda p_acompanhantes).
-- Pode rodar de novo sem estragar nada.

ALTER TABLE public.voluntarios_natal ADD COLUMN IF NOT EXISTS acompanhantes jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
DECLARE
  antiga regprocedure := to_regprocedure('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text)');
  def text;
  nova text;
BEGIN
  IF to_regprocedure('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text, jsonb)') IS NOT NULL THEN
    RAISE NOTICE 'A inscrição já recebe os acompanhantes: nada a fazer.';
    RETURN;
  END IF;
  IF antiga IS NULL THEN
    RAISE EXCEPTION 'Não achei a inscrever_voluntario de 12 parâmetros; nada foi mudado.';
  END IF;
  def := pg_get_functiondef(antiga);
  IF position('p_como_soube text DEFAULT NULL::text)' in def) = 0
     OR position(E'\nBEGIN' in def) = 0
     OR position('como_soube, opcao1, opcao2)' in def) = 0
     OR position('p_opcao1, v_opcao2);' in def) = 0
     OR position('DECLARE' in def) = 0 THEN
    RAISE EXCEPTION 'A inscrever_voluntario não está como esperado; nada foi mudado.';
  END IF;

  -- 1. O parâmetro novo, opcional.
  nova := replace(def, 'p_como_soube text DEFAULT NULL::text)', 'p_como_soube text DEFAULT NULL::text, p_acompanhantes jsonb DEFAULT NULL::jsonb)');
  -- 2. A variável com a lista conferida.
  nova := regexp_replace(nova, 'DECLARE', E'DECLARE\n  v_acomp jsonb := ''[]''::jsonb;\n  v_a jsonb;\n  v_idade integer;', '');
  -- 3. A conferência, no começo do corpo (o primeiro BEGIN na margem; não depende
  --    da quebra de linha do arquivo): até 4; pessoa idosa ou criança; nome e idade.
  nova := replace(nova, E'\nBEGIN', E'\nBEGIN\n  -- Acompanhantes (23/11/2026): pessoa idosa ou criança, com nome e idade; até 4.\n  IF p_acompanhantes IS NOT NULL AND jsonb_typeof(p_acompanhantes) = ''array'' THEN\n    IF jsonb_array_length(p_acompanhantes) > 4 THEN RAISE EXCEPTION ''acompanhante_invalido''; END IF;\n    FOR v_a IN SELECT * FROM jsonb_array_elements(p_acompanhantes) LOOP\n      IF coalesce(v_a->>''tipo'', '''') NOT IN (''idoso'', ''crianca'')\n         OR char_length(btrim(coalesce(v_a->>''nome'', ''''))) < 2\n         OR coalesce(v_a->>''idade'', '''') !~ ''^[0-9]{1,3}$'' THEN\n        RAISE EXCEPTION ''acompanhante_invalido'';\n      END IF;\n      v_idade := (v_a->>''idade'')::integer;\n      IF v_idade > 120 THEN RAISE EXCEPTION ''acompanhante_invalido''; END IF;\n      v_acomp := v_acomp || jsonb_build_array(jsonb_build_object(\n        ''tipo'', v_a->>''tipo'',\n        ''nome'', left(btrim(regexp_replace(v_a->>''nome'', ''\\s+'', '' '', ''g'')), 120),\n        ''idade'', v_idade));\n    END LOOP;\n  ELSIF p_acompanhantes IS NOT NULL AND jsonb_typeof(p_acompanhantes) <> ''null'' THEN\n    RAISE EXCEPTION ''acompanhante_invalido'';\n  END IF;');
  -- 4. A coluna no INSERT.
  nova := replace(nova, 'como_soube, opcao1, opcao2)', 'como_soube, opcao1, opcao2, acompanhantes)');
  nova := replace(nova, 'p_opcao1, v_opcao2);', 'p_opcao1, v_opcao2, v_acomp);');

  EXECUTE nova;
  EXECUTE 'DROP FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text)';
END;
$$;

REVOKE ALL ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text, jsonb) TO anon, authenticated;

-- A API do banco recarrega a lista de funções na hora (como no 20261112120000).
NOTIFY pgrst, 'reload schema';

-- Conferência: as quatro linhas devem mostrar true.
SELECT 'coluna acompanhantes' AS item, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'voluntarios_natal' AND column_name = 'acompanhantes')::text AS valor
UNION ALL SELECT 'inscrição com acompanhantes', (to_regprocedure('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text, jsonb)') IS NOT NULL)::text
UNION ALL SELECT 'versão de 12 parâmetros saiu', (to_regprocedure('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text)') IS NULL)::text
UNION ALL SELECT 'prazo continua 26/11', (position('2026-11-27 00:00:00' in pg_get_functiondef('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text, jsonb)'::regprocedure)) > 0)::text;

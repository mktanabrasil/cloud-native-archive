-- Voluntariado do Natal Feliz (20/10/2026): inscrição dos funcionários.
--
-- Link público (/voluntariado), como o da Pizza da Alegria: a pessoa informa
-- o nome completo, o WhatsApp, a unidade em que trabalha e onde quer ajudar
-- no Natal Feliz de 08/12/2026 (1ª opção obrigatória, 2ª opcional; sem limite
-- por área). Inscrições até 15/11/2026. O protocolo é sorteado (VL-XXXXX),
-- não segue a ordem de chegada. Ninguém de fora lê nada: o envio passa por
-- uma função, e só administradores e comunicação veem o painel.

-- 1. Tabela -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntarios_natal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo      text NOT NULL UNIQUE,
  nome           text NOT NULL,
  -- só os dígitos, com DDD (10 ou 11)
  whatsapp       text NOT NULL,
  unidade_id     text NOT NULL,
  unidade_nome   text NOT NULL,
  area           text NOT NULL,
  opcao1         text NOT NULL,
  opcao2         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voluntarios_area_check CHECK (area IN ('educacao', 'social')),
  CONSTRAINT voluntarios_whatsapp_check CHECK (whatsapp ~ '^[0-9]{10,11}$'),
  CONSTRAINT voluntarios_opcoes_check CHECK (
    opcao1 IN ('cozinha', 'montagem', 'decoracao', 'logistica', 'som', 'projecao',
               'recreacao_kids', 'inflaveis', 'atividades_adultos', 'presentes_kids',
               'intercessao', 'alojamentos', 'limpeza_pre', 'limpeza_durante', 'limpeza_pos',
               'estacionamento', 'seguranca')
    AND (opcao2 IS NULL OR (opcao2 <> opcao1 AND opcao2 IN (
               'cozinha', 'montagem', 'decoracao', 'logistica', 'som', 'projecao',
               'recreacao_kids', 'inflaveis', 'atividades_adultos', 'presentes_kids',
               'intercessao', 'alojamentos', 'limpeza_pre', 'limpeza_durante', 'limpeza_pos',
               'estacionamento', 'seguranca')))
  )
);

COMMENT ON TABLE public.voluntarios_natal IS 'Voluntariado do Natal Feliz 2026: inscrições dos funcionários (20/10/2026).';

CREATE UNIQUE INDEX IF NOT EXISTS voluntarios_natal_whatsapp_idx ON public.voluntarios_natal (whatsapp);
CREATE INDEX IF NOT EXISTS voluntarios_natal_unidade_idx ON public.voluntarios_natal (unidade_id, created_at DESC);

ALTER TABLE public.voluntarios_natal ENABLE ROW LEVEL SECURITY;

-- Administradores e comunicação (is_marketing_user já inclui o admin).
DROP POLICY IF EXISTS voluntarios_select_painel ON public.voluntarios_natal;
CREATE POLICY voluntarios_select_painel
  ON public.voluntarios_natal FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));

-- O painel apaga (inscrição de teste, desistência).
DROP POLICY IF EXISTS voluntarios_delete_painel ON public.voluntarios_natal;
CREATE POLICY voluntarios_delete_painel
  ON public.voluntarios_natal FOR DELETE TO authenticated
  USING (public.is_marketing_user(auth.uid()));

REVOKE ALL ON public.voluntarios_natal FROM anon, authenticated;
GRANT SELECT, DELETE ON public.voluntarios_natal TO authenticated;
GRANT ALL ON public.voluntarios_natal TO service_role;

-- 2. A inscrição pública --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inscrever_voluntario(
  p_nome text,
  p_whatsapp text,
  p_unidade_id text,
  p_unidade_nome text,
  p_area text,
  p_opcao1 text,
  p_opcao2 text DEFAULT NULL
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
  IF length(btrim(coalesce(p_unidade_id, ''))) NOT BETWEEN 1 AND 60
     OR length(btrim(coalesce(p_unidade_nome, ''))) NOT BETWEEN 1 AND 120
     OR p_area NOT IN ('educacao', 'social') THEN
    RAISE EXCEPTION 'unidade_invalida';
  END IF;
  IF v_opcao2 = p_opcao1 THEN
    v_opcao2 := NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.voluntarios_natal v WHERE v.whatsapp = v_whatsapp) THEN
    RAISE EXCEPTION 'ja_inscrito';
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
    INSERT INTO public.voluntarios_natal (protocolo, nome, whatsapp, unidade_id, unidade_nome, area, opcao1, opcao2)
    VALUES (v_protocolo, left(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), 120), v_whatsapp,
            btrim(p_unidade_id), left(btrim(p_unidade_nome), 120), p_area, p_opcao1, v_opcao2);
  EXCEPTION
    WHEN check_violation THEN RAISE EXCEPTION 'area_invalida';
    WHEN unique_violation THEN RAISE EXCEPTION 'ja_inscrito';
  END;

  RETURN v_protocolo;
END;
$$;

REVOKE ALL ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inscrever_voluntario(text, text, text, text, text, text, text) TO anon, authenticated;

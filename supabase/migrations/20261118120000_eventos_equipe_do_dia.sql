-- Eventos (18/11/2026, setor Administração, PR 2): quem trabalha no dia.
--
-- No formulário, "Quem vai ajudar no dia?" passa a pedir os nomes:
--   - Funcionários: os nomes de quem vai trabalhar (o RH controla o banco de
--     horas depois);
--   - Voluntários: nome e WhatsApp de cada um (o Voluntariado cadastra).
-- `support_team` continua como está (o texto "Funcionários, Voluntários").
--
-- As duas listas são da equipe: não entram nos campos públicos do evento (a
-- lista de permissão `CAMPOS_PUBLICOS_DO_EVENTO` no app não as inclui).
--
-- Confirmado o evento, a gestora não grava mais nada nele
-- (`events_gestor_update`). A decisão de 18/11 é que a unidade ainda pode
-- trocar SÓ a lista de nomes: por isso a função `trocar_equipe_do_evento`,
-- que confere a unidade e mexe só nessas duas colunas.
--
-- RODAR ANTES DO MERGE: o formulário novo grava as colunas novas, e sem elas
-- o salvar dá erro para todo mundo.
-- Pode rodar de novo sem estragar nada.

-- 1. As colunas ------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS equipe_funcionarios jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS equipe_voluntarios jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Funcionários: lista de nomes (texto de 1 a 120), até 80.
CREATE OR REPLACE FUNCTION public.equipe_funcionarios_valida(_l jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT jsonb_typeof(_l) = 'array'
     AND jsonb_array_length(_l) <= 80
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(_l) x
       WHERE jsonb_typeof(x) <> 'string' OR length(btrim(x #>> '{}')) NOT BETWEEN 1 AND 120
     );
$$;

-- Voluntários: [{ "nome": "...", "whatsapp": "19998124410" }], WhatsApp só
-- dígitos, com DDD (10 ou 11), como no formulário do voluntariado. Até 80.
CREATE OR REPLACE FUNCTION public.equipe_voluntarios_valida(_l jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT jsonb_typeof(_l) = 'array'
     AND jsonb_array_length(_l) <= 80
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(_l) x
       WHERE jsonb_typeof(x) <> 'object'
          OR jsonb_typeof(x -> 'nome') IS DISTINCT FROM 'string'
          OR jsonb_typeof(x -> 'whatsapp') IS DISTINCT FROM 'string'
          OR length(btrim(x ->> 'nome')) NOT BETWEEN 1 AND 120
          OR (x ->> 'whatsapp') !~ '^[0-9]{10,11}$'
     );
$$;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_equipe_funcionarios_valida;
ALTER TABLE public.events ADD CONSTRAINT events_equipe_funcionarios_valida CHECK (public.equipe_funcionarios_valida(equipe_funcionarios));
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_equipe_voluntarios_valida;
ALTER TABLE public.events ADD CONSTRAINT events_equipe_voluntarios_valida CHECK (public.equipe_voluntarios_valida(equipe_voluntarios));

-- 2. Trocar a equipe de um evento confirmado ------------------------------------------
-- Quem pode: a comunicação/admin, ou a gestão com acesso à unidade do evento
-- (a mesma regra de `events_gestor_update`). Só as duas listas mudam; o
-- resto do evento fica como a administração confirmou. Devolve a linha nova
-- (vazio se não pôde).
CREATE OR REPLACE FUNCTION public.trocar_equipe_do_evento(_id uuid, _funcionarios jsonb, _voluntarios jsonb)
RETURNS SETOF public.events
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (public.check_is_admin(auth.uid()) OR public.is_marketing_user(auth.uid())) THEN
    -- A unidade: gestão ativa com acesso à unidade, e só no evento confirmado
    -- (antes disso ela edita o evento inteiro pelo formulário).
    IF NOT public.has_unit_access(ev.unit)
       OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active IS NOT FALSE) THEN
      RAISE EXCEPTION 'Só a unidade do evento (ou a comunicação) troca a equipe.' USING ERRCODE = '42501';
    END IF;
    IF ev.status <> 'confirmado' THEN
      RAISE EXCEPTION 'A equipe muda por aqui só no evento confirmado; antes disso, edite o evento.' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Só a lista do que está marcado em "Quem vai ajudar no dia?".
  RETURN QUERY
    UPDATE public.events
       SET equipe_funcionarios = CASE WHEN position('Funcionários' IN coalesce(ev.support_team, '')) > 0 THEN coalesce(_funcionarios, '[]'::jsonb) ELSE '[]'::jsonb END,
           equipe_voluntarios = CASE WHEN position('Voluntários' IN coalesce(ev.support_team, '')) > 0 THEN coalesce(_voluntarios, '[]'::jsonb) ELSE '[]'::jsonb END
     WHERE id = _id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.trocar_equipe_do_evento(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trocar_equipe_do_evento(uuid, jsonb, jsonb) TO authenticated;

-- Conferência: as duas colunas, as duas travas e a função.
SELECT 'colunas' AS item, count(*)::text AS valor FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'events' AND column_name IN ('equipe_funcionarios', 'equipe_voluntarios')
UNION ALL
SELECT 'travas', count(*)::text FROM pg_constraint WHERE conname IN ('events_equipe_funcionarios_valida', 'events_equipe_voluntarios_valida')
UNION ALL
SELECT 'função', count(*)::text FROM pg_proc WHERE proname = 'trocar_equipe_do_evento';

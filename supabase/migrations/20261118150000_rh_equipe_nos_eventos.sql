-- Administração › RH (18/11/2026, PR 3): a equipe nos eventos.
--
-- O RH precisa saber quem da equipe trabalhou em cada evento, para depois
-- controlar o banco de horas. Os nomes vêm do formulário de eventos
-- (`events.equipe_funcionarios`, PR 2).
--
-- O RH (vínculo rh, unidade Administração) não lê os eventos internos das
-- unidades pelas regras de `events`: a leitura passa pela função
-- `rh_eventos_da_equipe`, que confere `is_rh_or_admin` e devolve só o que o
-- RH usa. O "Conferido" fica numa tabela à parte (`rh_conferencias`), com a
-- equipe do momento: se a unidade trocar os nomes depois, a tela avisa.
--
-- Pode rodar antes ou depois do merge (sem o SQL, a aba avisa que falta).
-- Pode rodar de novo sem estragar nada.

-- 1. A conferência do RH ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_conferencias (
  event_id           uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  equipe             jsonb NOT NULL DEFAULT '[]'::jsonb,
  conferido_em       timestamptz NOT NULL DEFAULT now(),
  conferido_por      uuid,
  conferido_por_nome text
);
ALTER TABLE public.rh_conferencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rh_conferencias FROM anon, authenticated;
GRANT ALL ON public.rh_conferencias TO service_role;

-- 2. Os eventos com funcionários, para o RH ---------------------------------------------
-- Confirmados e concluídos (o banco de horas é feito depois do evento), fora
-- da lixeira, com pelo menos um nome, que encostam no período pedido.
CREATE OR REPLACE FUNCTION public.rh_eventos_da_equipe(_de timestamptz, _ate timestamptz)
RETURNS TABLE (
  id uuid, title text, unit text, location text, start_datetime timestamptz, end_datetime timestamptz, status text,
  equipe_funcionarios jsonb, conferido_em timestamptz, conferido_por_nome text, equipe_conferida jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_rh_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Só o RH vê a equipe dos eventos.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.title::text, e.unit::text, e.location::text, e.start_datetime, e.end_datetime, e.status::text,
           e.equipe_funcionarios, c.conferido_em, c.conferido_por_nome, c.equipe
      FROM public.events e
      LEFT JOIN public.rh_conferencias c ON c.event_id = e.id
     WHERE e.deleted_at IS NULL
       AND e.status IN ('confirmado', 'concluido')
       AND jsonb_array_length(e.equipe_funcionarios) > 0
       AND e.start_datetime < _ate
       AND coalesce(e.end_datetime, e.start_datetime) >= _de
     ORDER BY e.start_datetime;
END;
$$;

-- 3. Marcar (ou desmarcar) como conferido -----------------------------------------------
-- Guarda a equipe que o RH VIU na tela (`_equipe`), para saber se ela mudou
-- depois, inclusive no meio-tempo entre abrir a tela e tocar em Conferido.
DROP FUNCTION IF EXISTS public.rh_conferir_evento(uuid, boolean);
CREATE OR REPLACE FUNCTION public.rh_conferir_evento(_id uuid, _conferido boolean, _equipe jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  IF NOT public.is_rh_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Só o RH confere a equipe dos eventos.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO ev FROM public.events WHERE id = _id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este evento não existe mais ou foi para a lixeira.' USING ERRCODE = 'P0002';
  END IF;
  IF _conferido THEN
    INSERT INTO public.rh_conferencias (event_id, equipe, conferido_em, conferido_por, conferido_por_nome)
    VALUES (_id, CASE WHEN jsonb_typeof(_equipe) = 'array' THEN _equipe ELSE ev.equipe_funcionarios END, now(), auth.uid(), public.meu_nome_no_calendario())
    ON CONFLICT (event_id) DO UPDATE
      SET equipe = EXCLUDED.equipe, conferido_em = EXCLUDED.conferido_em,
          conferido_por = EXCLUDED.conferido_por, conferido_por_nome = EXCLUDED.conferido_por_nome;
  ELSE
    DELETE FROM public.rh_conferencias WHERE event_id = _id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_eventos_da_equipe(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rh_conferir_evento(uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_eventos_da_equipe(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_conferir_evento(uuid, boolean, jsonb) TO authenticated;

-- Conferência: a tabela e as duas funções.
SELECT 'tabela rh_conferencias' AS item, (to_regclass('public.rh_conferencias') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc WHERE proname IN ('rh_eventos_da_equipe', 'rh_conferir_evento');

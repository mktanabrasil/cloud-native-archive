-- O e-mail do Financeiro (19/11/2026, PR 2 do Financeiro; decisões do mockup
-- do mesmo dia).
--
-- Quem está na lista do Financeiro no Painel recebe as compras da ANA de cada
-- evento (alimentação com fornecedor "ANA" e transporte de fora):
--   - ao CONFIRMAR o evento (ou criá-lo já confirmado), se ele tiver compras;
--   - de novo quando a unidade muda essas compras depois de confirmado
--     ("Pedido alterado": o que entrou, o que saiu, o que mudou de quantidade).
-- Pendentes não geram e-mail (aparecem só na página, com selo). Equipamentos e
-- impressos ficam de fora, como na página.
--
-- Um gatilho À PARTE (as migrações não são a fonte da verdade; não
-- reescrevemos as funções instaladas), no molde do da equipe do dia. Os avisos
-- nascem com a agenda "ignorado": as compras não mudam a agenda do Google.
--
-- ORDEM: publicar a função eventos-aviso nova ANTES de rodar este SQL. A
-- função antiga não conhece o tipo "financeiro": tentaria mandá-lo como aviso
-- geral, quebraria e o marcaria "falhou" (e "falhou" não volta sozinho).
-- Pode rodar de novo sem estragar nada.

-- 1. O tipo novo na fila.
ALTER TABLE public.avisos_de_evento DROP CONSTRAINT IF EXISTS avisos_de_evento_tipo_check;
ALTER TABLE public.avisos_de_evento
  ADD CONSTRAINT avisos_de_evento_tipo_check
  CHECK (tipo IN ('confirmado', 'cancelado', 'alterado', 'atualizado', 'devolvido', 'equipe_rh', 'equipe_voluntariado', 'financeiro'));

-- 2. As compras de um evento, num formato fácil de comparar: os alimentos que
-- a ANA fornece (refeição, nome, quantidade, na ordem do formulário) e o
-- transporte de fora. Sem compras: '{"alimentos": []}'.
CREATE OR REPLACE FUNCTION public.compras_do_evento(
  _food jsonb, _apoio boolean, _passageiros integer, _extra boolean, _veiculo text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'alimentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('item', btrim(coalesce(r.v->>'item', '')), 'nome', btrim(a.v->>'nome'), 'quantidade', btrim(coalesce(a.v->>'quantidade', ''))) ORDER BY r.n, a.n)
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_food) = 'array' THEN _food ELSE '[]'::jsonb END) WITH ORDINALITY AS r(v, n)
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(r.v) = 'object' AND jsonb_typeof(r.v->'alimentos') = 'array' THEN r.v->'alimentos' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS a(v, n)
       WHERE jsonb_typeof(a.v) = 'object'
         AND a.v->>'fornecedor' = 'ANA'
         AND btrim(coalesce(a.v->>'nome', '')) <> ''
    ), '[]'::jsonb),
    'apoio', CASE WHEN _apoio THEN coalesce(_passageiros, 0) END,
    'veiculo', CASE WHEN _extra THEN coalesce(btrim(_veiculo), '') END
  ));
$$;

-- 3. O gatilho.
CREATE OR REPLACE FUNCTION public.enfileirar_financeiro_do_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  esta boolean := NEW.status = 'confirmado' AND NEW.deleted_at IS NULL;
  era  boolean := TG_OP = 'UPDATE' AND OLD.status = 'confirmado' AND OLD.deleted_at IS NULL;
  vazio constant jsonb := '{"alimentos": []}'::jsonb;
  c_novo jsonb;
  c_velho jsonb;
BEGIN
  IF NOT esta THEN RETURN NEW; END IF;
  c_novo := public.compras_do_evento(NEW.food_items, NEW.transport_external_support, NEW.transport_passengers, NEW.transport_extra_equipment, NEW.transport_support_vehicle);
  IF NOT era THEN
    IF c_novo <> vazio THEN
      INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
      VALUES (NEW.id, 'financeiro', to_jsonb(NEW), NULL, 'pendente', 'ignorado');
    END IF;
    RETURN NEW;
  END IF;
  c_velho := public.compras_do_evento(OLD.food_items, OLD.transport_external_support, OLD.transport_passengers, OLD.transport_extra_equipment, OLD.transport_support_vehicle);
  IF c_novo IS DISTINCT FROM c_velho THEN
    INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
    VALUES (NEW.id, 'financeiro', to_jsonb(NEW), to_jsonb(OLD), 'pendente', 'ignorado');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enfileirar_financeiro_do_evento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_enfileira_financeiro ON public.events;
CREATE TRIGGER events_enfileira_financeiro
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enfileirar_financeiro_do_evento();

-- Conferência: a regra com os oito tipos e o gatilho novo.
SELECT 'tipos' AS item, pg_get_constraintdef(oid) AS valor FROM pg_constraint WHERE conname = 'avisos_de_evento_tipo_check'
UNION ALL
SELECT 'gatilho', tgname FROM pg_trigger WHERE tgname = 'events_enfileira_financeiro';

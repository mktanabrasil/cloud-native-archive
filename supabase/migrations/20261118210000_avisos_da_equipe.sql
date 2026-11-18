-- Os e-mails da equipe do dia (18/11/2026, setor Administração, PR 5; mockup
-- aprovado no mesmo dia).
--
-- O RH recebe os funcionários escalados e o Voluntariado recebe os voluntários
-- (nome e WhatsApp) de cada evento, num e-mail com o card do evento e os nomes
-- em destaque. Decisões de 18/11:
--   - sai ao CONFIRMAR o evento, só se ele tiver funcionários (RH) ou
--     voluntários (Voluntariado);
--   - mudou a lista depois de confirmado: sai de novo, "Equipe alterada", com
--     quem entrou e quem saiu;
--   - quem recebe é uma lista no Painel (card "Avisos por e-mail"), guardada em
--     system_configs ('avisos_equipe') pela função eventos-aviso.
--
-- Um gatilho À PARTE do `events_enfileira_aviso` (as migrações não são a fonte
-- da verdade; não reescrevemos a função instalada). Os avisos nascem com a
-- agenda "ignorado": a equipe não muda a agenda do Google.
--
-- Pode rodar antes ou depois do merge (sem a função nova, os avisos ficam na
-- fila e saem quando ela for publicada). Pode rodar de novo sem estragar nada.

-- 1. Os tipos novos na fila.
ALTER TABLE public.avisos_de_evento DROP CONSTRAINT IF EXISTS avisos_de_evento_tipo_check;
ALTER TABLE public.avisos_de_evento
  ADD CONSTRAINT avisos_de_evento_tipo_check
  CHECK (tipo IN ('confirmado', 'cancelado', 'alterado', 'atualizado', 'devolvido', 'equipe_rh', 'equipe_voluntariado'));

-- 2. O gatilho.
-- Ao confirmar (ou criar já confirmado): um aviso por lista que tiver alguém,
-- sem "antes". Já confirmado e a lista mudou: um aviso com o evento de antes,
-- para o e-mail mostrar quem entrou e quem saiu (inclusive quando a lista
-- esvaziou).
CREATE OR REPLACE FUNCTION public.enfileirar_equipe_do_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  esta boolean := NEW.status = 'confirmado' AND NEW.deleted_at IS NULL;
  era  boolean := TG_OP = 'UPDATE' AND OLD.status = 'confirmado' AND OLD.deleted_at IS NULL;
  f_novo jsonb := coalesce(NEW.equipe_funcionarios, '[]'::jsonb);
  v_novo jsonb := coalesce(NEW.equipe_voluntarios, '[]'::jsonb);
  f_velho jsonb;
  v_velho jsonb;
BEGIN
  IF NOT esta THEN RETURN NEW; END IF;
  IF NOT era THEN
    IF jsonb_array_length(f_novo) > 0 THEN
      INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
      VALUES (NEW.id, 'equipe_rh', to_jsonb(NEW), NULL, 'pendente', 'ignorado');
    END IF;
    IF jsonb_array_length(v_novo) > 0 THEN
      INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
      VALUES (NEW.id, 'equipe_voluntariado', to_jsonb(NEW), NULL, 'pendente', 'ignorado');
    END IF;
    RETURN NEW;
  END IF;
  f_velho := coalesce(OLD.equipe_funcionarios, '[]'::jsonb);
  v_velho := coalesce(OLD.equipe_voluntarios, '[]'::jsonb);
  IF f_novo IS DISTINCT FROM f_velho THEN
    INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
    VALUES (NEW.id, 'equipe_rh', to_jsonb(NEW), to_jsonb(OLD), 'pendente', 'ignorado');
  END IF;
  IF v_novo IS DISTINCT FROM v_velho THEN
    INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
    VALUES (NEW.id, 'equipe_voluntariado', to_jsonb(NEW), to_jsonb(OLD), 'pendente', 'ignorado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_enfileira_equipe ON public.events;
CREATE TRIGGER events_enfileira_equipe
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enfileirar_equipe_do_evento();

-- Conferência: a regra com os sete tipos e o gatilho novo.
SELECT 'tipos' AS item, pg_get_constraintdef(oid) AS valor FROM pg_constraint WHERE conname = 'avisos_de_evento_tipo_check'
UNION ALL
SELECT 'gatilho', tgname FROM pg_trigger WHERE tgname = 'events_enfileira_equipe';

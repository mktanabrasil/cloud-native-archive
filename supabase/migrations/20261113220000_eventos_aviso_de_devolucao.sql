-- Eventos: o e-mail de devolução (13/11/2026; mockup aprovado no mesmo dia).
--
-- Quando a administração devolve um evento com observação, quem enviou recebe
-- um e-mail com a observação e um botão que abre o evento no formulário.
-- Decisões dele: só quem enviou recebe; no pré-lançamento, ninguém (a função
-- marca "ignorado").
--
-- Um gatilho À PARTE do `events_enfileira_aviso`, para não reescrever a função
-- instalada (as migrações não são a fonte da verdade). Ele só olha a devolução:
-- o evento continua pendente e ganhou uma observação nova (ou a mesma, numa
-- nova revisão). Reenviar pela unidade limpa a observação; aprovar também.
-- Nenhum dos dois dispara.
--
-- A agenda do Google não muda numa devolução: o aviso nasce com a agenda
-- "ignorado".
--
-- Pode rodar de novo sem estragar nada.

-- 1. O tipo novo na fila.
ALTER TABLE public.avisos_de_evento DROP CONSTRAINT IF EXISTS avisos_de_evento_tipo_check;
ALTER TABLE public.avisos_de_evento
  ADD CONSTRAINT avisos_de_evento_tipo_check
  CHECK (tipo IN ('confirmado', 'cancelado', 'alterado', 'atualizado', 'devolvido'));

-- 2. O gatilho.
CREATE OR REPLACE FUNCTION public.enfileirar_devolucao_de_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status, agenda_status)
  VALUES (NEW.id, 'devolvido', to_jsonb(NEW), NULL, 'pendente', 'ignorado');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_enfileira_devolucao ON public.events;
CREATE TRIGGER events_enfileira_devolucao
  AFTER UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    NEW.status = 'pendente'
    AND NEW.deleted_at IS NULL
    AND NEW.review_note IS NOT NULL
    AND btrim(NEW.review_note) <> ''
    AND (NEW.review_note IS DISTINCT FROM OLD.review_note OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at)
  )
  EXECUTE FUNCTION public.enfileirar_devolucao_de_evento();

-- Conferência: a regra com os cinco tipos e o gatilho novo.
SELECT 'tipos' AS item, pg_get_constraintdef(oid) AS valor FROM pg_constraint WHERE conname = 'avisos_de_evento_tipo_check'
UNION ALL
SELECT 'gatilho', tgname FROM pg_trigger WHERE tgname = 'events_enfileira_devolucao';

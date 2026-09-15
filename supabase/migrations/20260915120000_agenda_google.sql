-- Eventos confirmados na Agenda do Google.
--
-- Decisões de 15/09/2026 (mockup aprovado, com o ajuste do mesmo dia): o robô
-- (conta de serviço eventos-agenda@…) é o DONO das agendas — cria "ANA ·
-- Eventos" (equipe) e "Programação ANA" (pública), e compartilha como leitura
-- com as quatro caixas fixas e com a gestão cadastrada por unidade. Só
-- confirmados; sem convidados; a equipe só lê no Google e edita no app. A
-- cor por unidade vai em cada evento. A engrenagem é a mesma do e-mail: o
-- gatilho já enfileira em `avisos_de_evento`; a função `eventos-aviso` ganha
-- um segundo passo, com estado próprio.
--
-- 1. `agendas_google`: os identificadores das agendas que o robô criou.
-- 2. O evento guarda o que criou no Google, para editar e cancelar o certo.
-- 3. A fila ganha o estado do passo "agenda", independente do e-mail.
-- 4. O gatilho ganha o tipo "atualizado": título, descrição, visibilidade ou
--    unidade de um confirmado mudaram — vai para a agenda, NÃO gera e-mail.
--
-- Aplicar no SQL Editor do Studio ANTES de publicar a função.

-- 1. As agendas do robô -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agendas_google (
  chave        text PRIMARY KEY CHECK (chave IN ('equipe', 'publica')),
  calendar_id  text NOT NULL,
  nome         text NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  -- quem já recebeu compartilhamento de leitura (e-mails), para não repetir
  compartilhada_com text[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.agendas_google ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agendas_select_equipe ON public.agendas_google;
CREATE POLICY agendas_select_equipe ON public.agendas_google FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.agendas_google TO authenticated;
GRANT ALL ON public.agendas_google TO service_role;

-- 2. Espelho no Google ---------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_event_link text,
  ADD COLUMN IF NOT EXISTS google_public_event_id text,
  ADD COLUMN IF NOT EXISTS google_public_event_link text;

COMMENT ON COLUMN public.events.google_event_id IS 'Id do evento na agenda "ANA · Eventos" (Google Calendar). Vazio = não está lá.';
COMMENT ON COLUMN public.events.google_public_event_id IS 'Id do evento na agenda pública "Programação ANA". Só eventos públicos.';

-- 3. Estado do passo "agenda" na fila ----------------------------------------

ALTER TABLE public.avisos_de_evento
  ADD COLUMN IF NOT EXISTS agenda_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS agenda_erro text,
  ADD COLUMN IF NOT EXISTS agenda_em timestamptz,
  ADD COLUMN IF NOT EXISTS agenda_link text;

ALTER TABLE public.avisos_de_evento DROP CONSTRAINT IF EXISTS avisos_de_evento_agenda_status_check;
ALTER TABLE public.avisos_de_evento
  ADD CONSTRAINT avisos_de_evento_agenda_status_check
  CHECK (agenda_status IN ('pendente', 'enviado', 'falhou', 'ignorado'));

ALTER TABLE public.avisos_de_evento DROP CONSTRAINT IF EXISTS avisos_de_evento_status_check;
ALTER TABLE public.avisos_de_evento
  ADD CONSTRAINT avisos_de_evento_status_check
  CHECK (status IN ('pendente', 'enviado', 'falhou', 'ignorado'));

ALTER TABLE public.avisos_de_evento DROP CONSTRAINT IF EXISTS avisos_de_evento_tipo_check;
ALTER TABLE public.avisos_de_evento
  ADD CONSTRAINT avisos_de_evento_tipo_check
  CHECK (tipo IN ('confirmado', 'cancelado', 'alterado', 'atualizado'));

-- Os avisos anteriores a esta migração são de antes da agenda existir.
UPDATE public.avisos_de_evento
SET agenda_status = 'ignorado', agenda_erro = 'anterior à agenda'
WHERE agenda_status = 'pendente';

DROP INDEX IF EXISTS avisos_de_evento_pendentes_idx;
CREATE INDEX IF NOT EXISTS avisos_de_evento_pendentes_idx
  ON public.avisos_de_evento (criado_em)
  WHERE status = 'pendente' OR agenda_status = 'pendente';

-- 4. O gatilho, com o tipo "atualizado" -----------------------------------------
--
-- Mudanças só nas colunas do espelho (google_*) NÃO disparam: a própria função
-- as grava depois de falar com o Google, e um gatilho aí seria um laço.

CREATE OR REPLACE FUNCTION public.enfileirar_aviso_de_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tipo_aviso text;
  era_confirmado boolean;
  esta_confirmado boolean;
  mudou_agenda boolean;
  mudou_conteudo boolean;
BEGIN
  esta_confirmado := NEW.status = 'confirmado' AND NEW.deleted_at IS NULL;

  IF TG_OP = 'INSERT' THEN
    IF esta_confirmado THEN tipo_aviso := 'confirmado'; END IF;
  ELSE
    era_confirmado := OLD.status = 'confirmado' AND OLD.deleted_at IS NULL;
    mudou_agenda := NEW.start_datetime IS DISTINCT FROM OLD.start_datetime
                 OR NEW.end_datetime   IS DISTINCT FROM OLD.end_datetime
                 OR NEW.location       IS DISTINCT FROM OLD.location;
    mudou_conteudo := NEW.title        IS DISTINCT FROM OLD.title
                   OR NEW.description  IS DISTINCT FROM OLD.description
                   OR NEW.visibility   IS DISTINCT FROM OLD.visibility
                   OR NEW.unit         IS DISTINCT FROM OLD.unit;
    IF esta_confirmado AND NOT era_confirmado THEN
      tipo_aviso := 'confirmado';
    ELSIF era_confirmado AND NOT esta_confirmado
          AND (NEW.status = 'cancelado' OR NEW.deleted_at IS NOT NULL) THEN
      tipo_aviso := 'cancelado';
    ELSIF era_confirmado AND esta_confirmado AND mudou_agenda THEN
      tipo_aviso := 'alterado';
    ELSIF era_confirmado AND esta_confirmado AND mudou_conteudo THEN
      tipo_aviso := 'atualizado';
    END IF;
  END IF;

  IF tipo_aviso IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes, status)
  VALUES (
    NEW.id, tipo_aviso, to_jsonb(NEW),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
    CASE WHEN tipo_aviso = 'atualizado' THEN 'ignorado' ELSE 'pendente' END
  );

  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
       AND current_setting('app.avisos_url', true) IS NOT NULL
       AND current_setting('app.avisos_url', true) <> '' THEN
      PERFORM net.http_post(
        url     := current_setting('app.avisos_url', true),
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-avisos-segredo', coalesce(current_setting('app.avisos_segredo', true), '')),
        body    := jsonb_build_object('origem', 'banco')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_enfileira_aviso ON public.events;
CREATE TRIGGER events_enfileira_aviso
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enfileirar_aviso_de_evento();

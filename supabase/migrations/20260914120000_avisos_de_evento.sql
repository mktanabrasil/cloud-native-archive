-- Avisos por e-mail quando um evento é confirmado, cancelado ou muda de data.
--
-- Decisão de 14/09/2026 (mockup aprovado). O fluxo:
--   1. Um gatilho em `events` percebe a mudança e ENFILEIRA um aviso nesta
--      tabela, com o tipo (confirmado / cancelado / alterado) e uma foto do
--      evento no momento. Isso é garantido: acontece dentro da transação.
--   2. A Edge Function `eventos-aviso` processa os pendentes: monta o e-mail e
--      o .ics, descobre os destinatários e envia pelo SMTP da ANA. Ela é
--      chamada (a) pelo próprio banco via pg_net, se a extensão existir e as
--      configurações abaixo estiverem definidas; (b) pelo app, logo depois de
--      salvar; (c) pelo botão "Reenviar" no painel de detalhe. Qualquer uma
--      das três processa TUDO o que estiver pendente, então um aviso não se
--      perde se o navegador fechar no meio.
--   3. A tela lê esta tabela para mostrar "Aviso enviado a N endereços" ou o
--      erro, com "Reenviar".
--
-- Destinatários (decisão de 14/09): sempre mkt@, contato@, parceiros@ e
-- eventos@anabrasil.org; mais os perfis ativos da unidade do evento (a
-- unidade vem do pedido de acesso); mais quem criou. Resolvidos na função, na
-- hora do envio — por isso a fila guarda o evento, não a lista.
--
-- Aplicar no SQL Editor do Studio (supabase.anabrasil.org) ANTES de publicar
-- o front. Depois, se quiser o disparo direto do banco, rodar também o bloco
-- "Opcional" no fim, com a URL e o segredo reais.

-- 1. A fila / registro ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.avisos_de_evento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('confirmado', 'cancelado', 'alterado')),
  -- foto do evento no momento do gatilho; "antes" só quando houve mudança
  evento        jsonb NOT NULL,
  antes         jsonb,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'falhou')),
  destinatarios text[] NOT NULL DEFAULT '{}',
  erro          text,
  tentativas    int NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  enviado_em    timestamptz
);

CREATE INDEX IF NOT EXISTS avisos_de_evento_event_idx ON public.avisos_de_evento (event_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS avisos_de_evento_pendentes_idx ON public.avisos_de_evento (criado_em) WHERE status = 'pendente';

ALTER TABLE public.avisos_de_evento ENABLE ROW LEVEL SECURITY;

-- A equipe lê (para o painel); só o banco e a função escrevem.
DROP POLICY IF EXISTS avisos_select_equipe ON public.avisos_de_evento;
CREATE POLICY avisos_select_equipe
  ON public.avisos_de_evento FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.avisos_de_evento TO authenticated;
GRANT ALL ON public.avisos_de_evento TO service_role;

-- 2. O gatilho ----------------------------------------------------------------
--
-- confirmado: status virou 'confirmado' (ou nasceu confirmado), não apagado.
-- cancelado : ERA confirmado e foi para 'cancelado' ou para a lixeira.
-- alterado  : continua confirmado e mudou data, horário ou local.
-- Um pendente cancelado antes de ser confirmado não avisa ninguém.

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
BEGIN
  esta_confirmado := NEW.status = 'confirmado' AND NEW.deleted_at IS NULL;

  IF TG_OP = 'INSERT' THEN
    IF esta_confirmado THEN tipo_aviso := 'confirmado'; END IF;
  ELSE
    era_confirmado := OLD.status = 'confirmado' AND OLD.deleted_at IS NULL;
    IF esta_confirmado AND NOT era_confirmado THEN
      tipo_aviso := 'confirmado';
    ELSIF era_confirmado AND NOT esta_confirmado
          AND (NEW.status = 'cancelado' OR NEW.deleted_at IS NOT NULL) THEN
      tipo_aviso := 'cancelado';
    ELSIF era_confirmado AND esta_confirmado AND (
          NEW.start_datetime IS DISTINCT FROM OLD.start_datetime
       OR NEW.end_datetime   IS DISTINCT FROM OLD.end_datetime
       OR NEW.location       IS DISTINCT FROM OLD.location) THEN
      tipo_aviso := 'alterado';
    END IF;
  END IF;

  IF tipo_aviso IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.avisos_de_evento (event_id, tipo, evento, antes)
  VALUES (NEW.id, tipo_aviso, to_jsonb(NEW), CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END);

  -- Opcional: avisar a função na hora, se pg_net e as configurações existirem.
  -- Sem isso, o app chama a função ao salvar e o botão "Reenviar" também.
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
    -- a fila já tem o aviso; o disparo direto é só atalho
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_enfileira_aviso ON public.events;
CREATE TRIGGER events_enfileira_aviso
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enfileirar_aviso_de_evento();

-- 3. Opcional: disparo direto do banco ----------------------------------------
--
-- Rodar só depois de a função `eventos-aviso` estar publicada no servidor
-- próprio, trocando pelos valores reais. O segredo é o mesmo AVISOS_SEGREDO
-- configurado na função.
--
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--   ALTER DATABASE postgres SET app.avisos_url = 'https://supabase.anabrasil.org/functions/v1/eventos-aviso';
--   ALTER DATABASE postgres SET app.avisos_segredo = '<segredo>';

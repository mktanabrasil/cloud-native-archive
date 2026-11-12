-- Central do Voluntário (13/11/2026): /voluntariado/natalfeliz26/central.
--
-- Depois da inscrição, cada voluntário entra com o WhatsApp da inscrição e
-- acompanha tudo até o Natal Feliz: a credencial (QR com o protocolo), o
-- cronograma, o local e os avisos no celular. A equipe lê a credencial na
-- entrada do treinamento e do evento, e a presença fica registrada.
--
-- 1. O cronograma (a comunicação monta no painel).
-- 2. Os avisos: os do cronograma saem sozinhos (X min antes de cada item) e
--    os avulsos a equipe manda na hora ou agenda.
-- 3. Os celulares com avisos ligados (Web Push).
-- 4. A presença no treinamento e no evento.
-- 5. As chaves dos avisos (VAPID): a função voluntariado-avisos cria na
--    primeira vez e guarda aqui. Só o service_role lê.
-- 6. O que a Central lê, pelo WhatsApp: os dados da própria pessoa, o
--    cronograma e os avisos dela. Nada de outras pessoas.
-- 7. O agendamento: o pg_cron chama a função a cada minuto, só quando há
--    aviso na hora de sair.
--
-- Pode rodar de novo sem estragar nada.

-- As áreas e os turnos válidos (os mesmos do formulário).
CREATE OR REPLACE FUNCTION public.voluntariado_areas_validas()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
               'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids', 'ccii', 'atipicas']
$$;

-- 1. O cronograma -------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_cronograma (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia           date NOT NULL,
  inicio        time NOT NULL,
  fim           time,
  titulo        text NOT NULL,
  tipo          text NOT NULL DEFAULT 'atividade',
  local         text,
  detalhe       text,
  -- Vazio = para todos. Senão, só para quem tem essa área (1ª opção) ou esse turno.
  areas         text[] NOT NULL DEFAULT '{}',
  horarios      text[] NOT NULL DEFAULT '{}',
  -- Minutos antes do início para o aviso no celular (0 = na hora). Vazio = sem aviso.
  avisar_min    integer,
  aviso_texto   text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cronograma_titulo_check CHECK (length(btrim(titulo)) BETWEEN 2 AND 80),
  CONSTRAINT cronograma_tipo_check CHECK (tipo IN ('checkin', 'atividade', 'evento', 'intervalo', 'transicao')),
  CONSTRAINT cronograma_local_check CHECK (local IS NULL OR length(local) <= 60),
  CONSTRAINT cronograma_detalhe_check CHECK (detalhe IS NULL OR length(detalhe) <= 240),
  CONSTRAINT cronograma_fim_check CHECK (fim IS NULL OR fim > inicio),
  CONSTRAINT cronograma_areas_check CHECK (areas <@ public.voluntariado_areas_validas()),
  CONSTRAINT cronograma_horarios_check CHECK (horarios <@ ARRAY['manha', 'tarde', 'pos_evento', 'dia_todo']),
  CONSTRAINT cronograma_aviso_check CHECK (avisar_min IS NULL OR avisar_min BETWEEN 0 AND 1440),
  CONSTRAINT cronograma_aviso_texto_check CHECK (aviso_texto IS NULL OR length(aviso_texto) <= 160)
);
CREATE INDEX IF NOT EXISTS voluntariado_cronograma_dia_idx ON public.voluntariado_cronograma (dia, inicio);

-- 2. Os avisos ----------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_avisos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL,
  texto         text NOT NULL,
  enviar_em     timestamptz NOT NULL DEFAULT now(),
  areas         text[] NOT NULL DEFAULT '{}',
  horarios      text[] NOT NULL DEFAULT '{}',
  -- O aviso de um item do cronograma (um por item). Apagou o item, apaga o aviso.
  cronograma_id uuid UNIQUE REFERENCES public.voluntariado_cronograma(id) ON DELETE CASCADE,
  enviado_em    timestamptz,
  -- Passou da hora sem sair (a função estava parada, ou o item entrou atrasado): não manda velho.
  pulado        boolean NOT NULL DEFAULT false,
  entregues     integer NOT NULL DEFAULT 0,
  falhas        integer NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avisos_titulo_check CHECK (length(btrim(titulo)) BETWEEN 2 AND 80),
  CONSTRAINT avisos_texto_check CHECK (length(btrim(texto)) BETWEEN 2 AND 240),
  CONSTRAINT avisos_areas_check CHECK (areas <@ public.voluntariado_areas_validas()),
  CONSTRAINT avisos_horarios_check CHECK (horarios <@ ARRAY['manha', 'tarde', 'pos_evento', 'dia_todo'])
);
CREATE INDEX IF NOT EXISTS voluntariado_avisos_fila_idx ON public.voluntariado_avisos (enviar_em) WHERE enviado_em IS NULL;

-- 3. Os celulares com avisos ligados -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_dispositivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voluntario_id uuid NOT NULL REFERENCES public.voluntarios_natal(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  ultimo_envio  timestamptz,
  CONSTRAINT dispositivos_endpoint_check CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1000),
  CONSTRAINT dispositivos_chaves_check CHECK (length(p256dh) BETWEEN 40 AND 200 AND length(auth) BETWEEN 10 AND 100)
);
CREATE INDEX IF NOT EXISTS voluntariado_dispositivos_voluntario_idx ON public.voluntariado_dispositivos (voluntario_id);

-- 4. A presença --------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_presencas (
  voluntario_id uuid NOT NULL REFERENCES public.voluntarios_natal(id) ON DELETE CASCADE,
  momento       text NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (voluntario_id, momento),
  CONSTRAINT presencas_momento_check CHECK (momento IN ('treinamento', 'evento'))
);

-- 5. As chaves dos avisos ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_avisos_config (
  id            integer PRIMARY KEY DEFAULT 1,
  vapid_publica text,
  vapid_privada text,
  CONSTRAINT avisos_config_um CHECK (id = 1)
);
INSERT INTO public.voluntariado_avisos_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Quem pode o quê: a comunicação (is_marketing_user) lê e mexe no cronograma
-- e nos avisos, e lê a presença e os celulares. O resto só por função.
ALTER TABLE public.voluntariado_cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntariado_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntariado_dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntariado_presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntariado_avisos_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cronograma_comunicacao ON public.voluntariado_cronograma;
CREATE POLICY cronograma_comunicacao ON public.voluntariado_cronograma FOR ALL TO authenticated
  USING (public.is_marketing_user(auth.uid())) WITH CHECK (public.is_marketing_user(auth.uid()));
DROP POLICY IF EXISTS avisos_comunicacao ON public.voluntariado_avisos;
CREATE POLICY avisos_comunicacao ON public.voluntariado_avisos FOR ALL TO authenticated
  USING (public.is_marketing_user(auth.uid())) WITH CHECK (public.is_marketing_user(auth.uid()));
DROP POLICY IF EXISTS dispositivos_comunicacao ON public.voluntariado_dispositivos;
CREATE POLICY dispositivos_comunicacao ON public.voluntariado_dispositivos FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));
DROP POLICY IF EXISTS presencas_comunicacao ON public.voluntariado_presencas;
CREATE POLICY presencas_comunicacao ON public.voluntariado_presencas FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));

REVOKE ALL ON public.voluntariado_cronograma, public.voluntariado_avisos, public.voluntariado_dispositivos,
  public.voluntariado_presencas, public.voluntariado_avisos_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voluntariado_cronograma, public.voluntariado_avisos TO authenticated;
GRANT SELECT ON public.voluntariado_dispositivos, public.voluntariado_presencas TO authenticated;
GRANT ALL ON public.voluntariado_cronograma, public.voluntariado_avisos, public.voluntariado_dispositivos,
  public.voluntariado_presencas, public.voluntariado_avisos_config TO service_role;

-- O aviso de cada item do cronograma acompanha o item ----------------------------------------------

CREATE OR REPLACE FUNCTION public.voluntariado_cronograma_atualizado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voluntariado_cronograma_atualizado ON public.voluntariado_cronograma;
CREATE TRIGGER voluntariado_cronograma_atualizado BEFORE UPDATE ON public.voluntariado_cronograma
  FOR EACH ROW EXECUTE FUNCTION public.voluntariado_cronograma_atualizado();

-- "7h", "7h30".
CREATE OR REPLACE FUNCTION public.voluntariado_hora_curta(p time)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(p, 'FMHH24') || 'h' || CASE WHEN extract(minute FROM p) = 0 THEN '' ELSE to_char(p, 'MI') END
$$;

CREATE OR REPLACE FUNCTION public.voluntariado_aviso_do_cronograma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_texto text;
BEGIN
  IF NEW.avisar_min IS NULL THEN
    -- Sem aviso: some o que ainda não saiu (o que já saiu fica no histórico).
    DELETE FROM public.voluntariado_avisos WHERE cronograma_id = NEW.id AND enviado_em IS NULL;
    RETURN NULL;
  END IF;
  v_texto := coalesce(
    nullif(btrim(coalesce(NEW.aviso_texto, '')), ''),
    concat_ws(' · ',
      CASE WHEN NEW.avisar_min = 0 THEN 'Começa agora' ELSE 'Começa às ' || public.voluntariado_hora_curta(NEW.inicio) END,
      nullif(btrim(coalesce(NEW.local, '')), '')));
  INSERT INTO public.voluntariado_avisos (titulo, texto, enviar_em, areas, horarios, cronograma_id)
  VALUES (NEW.titulo, v_texto,
          ((NEW.dia + NEW.inicio) AT TIME ZONE 'America/Sao_Paulo') - make_interval(mins => NEW.avisar_min),
          NEW.areas, NEW.horarios, NEW.id)
  ON CONFLICT (cronograma_id) DO UPDATE
    SET titulo = excluded.titulo, texto = excluded.texto, enviar_em = excluded.enviar_em,
        areas = excluded.areas, horarios = excluded.horarios, pulado = false
    WHERE public.voluntariado_avisos.enviado_em IS NULL;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS voluntariado_aviso_do_cronograma ON public.voluntariado_cronograma;
CREATE TRIGGER voluntariado_aviso_do_cronograma AFTER INSERT OR UPDATE ON public.voluntariado_cronograma
  FOR EACH ROW EXECUTE FUNCTION public.voluntariado_aviso_do_cronograma();

-- Para quem é: área vazia = todos; turno vazio = todos; "dia todo" está em todos os turnos.
CREATE OR REPLACE FUNCTION public.voluntariado_e_para(p_areas text[], p_horarios text[], p_opcao1 text, p_horario text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (cardinality(p_areas) = 0 OR p_opcao1 = ANY (p_areas))
     AND (cardinality(p_horarios) = 0 OR p_horario IS NULL OR p_horario = 'dia_todo' OR p_horario = ANY (p_horarios))
$$;

-- 6. O que a Central lê ------------------------------------------------------------------------

-- O WhatsApp como o formulário grava: só dígitos, sem o 55 do Brasil.
CREATE OR REPLACE FUNCTION public.voluntariado_whatsapp(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
BEGIN
  IF length(v) IN (12, 13) AND left(v, 2) = '55' THEN v := substr(v, 3); END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.central_do_voluntario(p_whatsapp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.voluntarios_natal;
BEGIN
  SELECT * INTO v FROM public.voluntarios_natal WHERE whatsapp = public.voluntariado_whatsapp(p_whatsapp);
  IF NOT FOUND THEN
    -- Um pouco de espera em cada número errado: tentar um atrás do outro fica lento.
    PERFORM pg_sleep(0.4);
    RAISE EXCEPTION 'nao_encontrado';
  END IF;
  RETURN jsonb_build_object(
    'voluntario', jsonb_build_object(
      'protocolo', v.protocolo, 'nome', v.nome, 'vinculo', v.vinculo, 'unidade_nome', v.unidade_nome,
      'igreja', v.igreja, 'horario', v.horario, 'opcao1', v.opcao1, 'opcao2', v.opcao2, 'inscrito_em', v.created_at),
    'presencas', coalesce((SELECT jsonb_object_agg(p.momento, p.registrado_em) FROM public.voluntariado_presencas p WHERE p.voluntario_id = v.id), '{}'::jsonb),
    'cronograma', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'dia', c.dia, 'inicio', to_char(c.inicio, 'HH24:MI'), 'fim', to_char(c.fim, 'HH24:MI'),
        'titulo', c.titulo, 'tipo', c.tipo, 'local', c.local, 'detalhe', c.detalhe, 'areas', c.areas, 'horarios', c.horarios)
        ORDER BY c.dia, c.inicio, c.titulo)
      FROM public.voluntariado_cronograma c), '[]'::jsonb),
    'avisos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'enviado_em', a.enviado_em) ORDER BY a.enviado_em DESC)
      FROM (SELECT * FROM public.voluntariado_avisos x
            WHERE x.enviado_em IS NOT NULL AND NOT x.pulado
              AND public.voluntariado_e_para(x.areas, x.horarios, v.opcao1, v.horario)
            ORDER BY x.enviado_em DESC LIMIT 30) a), '[]'::jsonb),
    'celulares', (SELECT count(*) FROM public.voluntariado_dispositivos d WHERE d.voluntario_id = v.id)
  );
END;
$$;

-- Liga os avisos neste celular (até 5 celulares por pessoa; o mais antigo sai).
CREATE OR REPLACE FUNCTION public.ativar_avisos_voluntario(p_whatsapp text, p_endpoint text, p_p256dh text, p_auth text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.voluntarios_natal WHERE whatsapp = public.voluntariado_whatsapp(p_whatsapp);
  IF v_id IS NULL THEN PERFORM pg_sleep(0.4); RAISE EXCEPTION 'nao_encontrado'; END IF;
  BEGIN
    INSERT INTO public.voluntariado_dispositivos (voluntario_id, endpoint, p256dh, auth)
    VALUES (v_id, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth))
    ON CONFLICT (endpoint) DO UPDATE SET voluntario_id = excluded.voluntario_id, p256dh = excluded.p256dh, auth = excluded.auth;
  EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'celular_invalido';
  END;
  DELETE FROM public.voluntariado_dispositivos
  WHERE id IN (SELECT id FROM public.voluntariado_dispositivos WHERE voluntario_id = v_id ORDER BY criado_em DESC OFFSET 5);
END;
$$;

CREATE OR REPLACE FUNCTION public.desativar_avisos_voluntario(p_whatsapp text, p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.voluntariado_dispositivos d
  USING public.voluntarios_natal v
  WHERE d.voluntario_id = v.id AND v.whatsapp = public.voluntariado_whatsapp(p_whatsapp) AND d.endpoint = btrim(p_endpoint);
END;
$$;

-- A presença: a equipe lê a credencial (o protocolo) na entrada.
CREATE OR REPLACE FUNCTION public.registrar_presenca_voluntario(p_protocolo text, p_momento text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.voluntarios_natal;
  v_em timestamptz;
  v_status text := 'registrada';
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_momento IS NULL OR p_momento NOT IN ('treinamento', 'evento') THEN RAISE EXCEPTION 'momento_invalido'; END IF;
  SELECT * INTO v FROM public.voluntarios_natal WHERE protocolo = upper(btrim(coalesce(p_protocolo, '')));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'nao_encontrado', 'protocolo', upper(btrim(coalesce(p_protocolo, ''))));
  END IF;
  INSERT INTO public.voluntariado_presencas (voluntario_id, momento) VALUES (v.id, p_momento)
  ON CONFLICT (voluntario_id, momento) DO NOTHING
  RETURNING registrado_em INTO v_em;
  IF v_em IS NULL THEN
    v_status := 'ja_registrada';
    SELECT p.registrado_em INTO v_em FROM public.voluntariado_presencas p WHERE p.voluntario_id = v.id AND p.momento = p_momento;
  END IF;
  RETURN jsonb_build_object(
    'status', v_status, 'momento', p_momento, 'registrado_em', v_em,
    'voluntario', jsonb_build_object('id', v.id, 'protocolo', v.protocolo, 'nome', v.nome, 'vinculo', v.vinculo,
      'unidade_nome', v.unidade_nome, 'horario', v.horario, 'opcao1', v.opcao1));
END;
$$;

CREATE OR REPLACE FUNCTION public.desfazer_presenca_voluntario(p_protocolo text, p_momento text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  DELETE FROM public.voluntariado_presencas p
  USING public.voluntarios_natal v
  WHERE p.voluntario_id = v.id AND v.protocolo = upper(btrim(coalesce(p_protocolo, ''))) AND p.momento = p_momento;
END;
$$;

REVOKE ALL ON FUNCTION public.central_do_voluntario(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ativar_avisos_voluntario(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.desativar_avisos_voluntario(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_presenca_voluntario(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.desfazer_presenca_voluntario(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.central_do_voluntario(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_avisos_voluntario(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desativar_avisos_voluntario(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_voluntario(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_presenca_voluntario(text, text) TO authenticated;

-- 7. O agendamento ------------------------------------------------------------------------------

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_net indisponível: %', SQLERRM;
  END;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron indisponível: %', SQLERRM;
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- A cada minuto, mas só chama a função quando tem aviso na hora de sair.
    -- Com o mesmo nome, o cron.schedule troca o que já existia.
    EXECUTE $cmd$
      SELECT cron.schedule('voluntariado-avisos', '* * * * *', $job$
        SELECT net.http_post(
          url := 'https://supabase.anabrasil.org/functions/v1/voluntariado-avisos',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('acao', 'processar'),
          timeout_milliseconds := 60000
        )
        WHERE EXISTS (SELECT 1 FROM public.voluntariado_avisos WHERE enviado_em IS NULL AND enviar_em <= now());
      $job$)
    $cmd$;
  END IF;
END $$;

-- Conferência (1 = ok): as tabelas, a função da Central e o agendamento.
SELECT
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN
     ('voluntariado_cronograma', 'voluntariado_avisos', 'voluntariado_dispositivos', 'voluntariado_presencas', 'voluntariado_avisos_config')) = 5 AS tabelas,
  (SELECT count(*) FROM pg_proc WHERE proname = 'central_do_voluntario') AS central,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_net') AS pg_net;

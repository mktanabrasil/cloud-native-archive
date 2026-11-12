-- Central do Voluntário (12/11/2026, a pedido dele): gestores e o botão do formulário.
--
-- 1. O botão da Central no formulário fica escondido até a comunicação ligar
--    o interruptor no painel (no dia do treinamento, 28/11).
-- 2. Os gestores entram na Central pelo número, sem inscrição: veem o
--    cronograma inteiro e recebem todos os avisos. Não entram nas contagens
--    de voluntários nem na planilha. A comunicação cadastra no painel.
-- 3. Os celulares com avisos ligados passam a ser de um voluntário OU de um gestor.
-- 4. A Central e os avisos reconhecem o gestor.
--
-- Pode rodar de novo sem estragar nada.

-- 1. O interruptor do botão no formulário ------------------------------------------------------

ALTER TABLE public.voluntariado_config ADD COLUMN IF NOT EXISTS central_no_formulario boolean NOT NULL DEFAULT false;

-- O formulário pergunta (sem login).
CREATE OR REPLACE FUNCTION public.central_no_formulario()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT central_no_formulario FROM public.voluntariado_config WHERE id = 1), false)
$$;

CREATE OR REPLACE FUNCTION public.definir_central_no_formulario(p_ligado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.voluntariado_config SET central_no_formulario = coalesce(p_ligado, false), atualizado_em = now() WHERE id = 1;
END;
$$;

-- 2. Os gestores ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_gestores (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  whatsapp  text NOT NULL UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestores_nome_check CHECK (length(btrim(nome)) BETWEEN 2 AND 120),
  CONSTRAINT gestores_whatsapp_check CHECK (whatsapp ~ '^[1-9][0-9]{9,10}$')
);

ALTER TABLE public.voluntariado_gestores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gestores_comunicacao ON public.voluntariado_gestores;
CREATE POLICY gestores_comunicacao ON public.voluntariado_gestores FOR ALL TO authenticated
  USING (public.is_marketing_user(auth.uid())) WITH CHECK (public.is_marketing_user(auth.uid()));
REVOKE ALL ON public.voluntariado_gestores FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voluntariado_gestores TO authenticated;
GRANT ALL ON public.voluntariado_gestores TO service_role;

-- 3. Os celulares: de um voluntário ou de um gestor ------------------------------------------------

ALTER TABLE public.voluntariado_dispositivos ALTER COLUMN voluntario_id DROP NOT NULL;
ALTER TABLE public.voluntariado_dispositivos ADD COLUMN IF NOT EXISTS gestor_id uuid REFERENCES public.voluntariado_gestores(id) ON DELETE CASCADE;
ALTER TABLE public.voluntariado_dispositivos DROP CONSTRAINT IF EXISTS dispositivos_dono_check;
ALTER TABLE public.voluntariado_dispositivos ADD CONSTRAINT dispositivos_dono_check CHECK (num_nonnulls(voluntario_id, gestor_id) = 1);
CREATE INDEX IF NOT EXISTS voluntariado_dispositivos_gestor_idx ON public.voluntariado_dispositivos (gestor_id);

-- 4. A Central e os avisos reconhecem o gestor -------------------------------------------------

CREATE OR REPLACE FUNCTION public.central_do_voluntario(p_whatsapp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.voluntarios_natal;
  g public.voluntariado_gestores;
  v_tel text := public.voluntariado_whatsapp(p_whatsapp);
  v_cronograma jsonb;
BEGIN
  v_cronograma := coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'dia', c.dia, 'inicio', to_char(c.inicio, 'HH24:MI'), 'fim', to_char(c.fim, 'HH24:MI'),
      'titulo', c.titulo, 'tipo', c.tipo, 'local', c.local, 'detalhe', c.detalhe, 'areas', c.areas, 'horarios', c.horarios)
      ORDER BY c.dia, c.inicio, c.titulo)
    FROM public.voluntariado_cronograma c), '[]'::jsonb);

  SELECT * INTO v FROM public.voluntarios_natal WHERE whatsapp = v_tel;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'perfil', 'voluntario',
      'voluntario', jsonb_build_object(
        'protocolo', v.protocolo, 'nome', v.nome, 'vinculo', v.vinculo, 'unidade_nome', v.unidade_nome,
        'igreja', v.igreja, 'horario', v.horario, 'opcao1', v.opcao1, 'opcao2', v.opcao2, 'inscrito_em', v.created_at),
      'presencas', coalesce((SELECT jsonb_object_agg(p.momento, p.registrado_em) FROM public.voluntariado_presencas p WHERE p.voluntario_id = v.id), '{}'::jsonb),
      'cronograma', v_cronograma,
      'avisos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'enviado_em', a.enviado_em) ORDER BY a.enviado_em DESC)
        FROM (SELECT * FROM public.voluntariado_avisos x
              WHERE x.enviado_em IS NOT NULL AND NOT x.pulado
                AND public.voluntariado_e_para(x.areas, x.horarios, v.opcao1, v.horario)
              ORDER BY x.enviado_em DESC LIMIT 30) a), '[]'::jsonb),
      'celulares', (SELECT count(*) FROM public.voluntariado_dispositivos d WHERE d.voluntario_id = v.id)
    );
  END IF;

  -- O gestor: sem inscrição, vê tudo e recebe todos os avisos.
  SELECT * INTO g FROM public.voluntariado_gestores WHERE whatsapp = v_tel;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'perfil', 'gestor',
      'voluntario', jsonb_build_object(
        'protocolo', null, 'nome', g.nome, 'vinculo', 'gestao', 'unidade_nome', null,
        'igreja', null, 'horario', null, 'opcao1', null, 'opcao2', null, 'inscrito_em', g.criado_em),
      'presencas', '{}'::jsonb,
      'cronograma', v_cronograma,
      'avisos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'enviado_em', a.enviado_em) ORDER BY a.enviado_em DESC)
        FROM (SELECT * FROM public.voluntariado_avisos x
              WHERE x.enviado_em IS NOT NULL AND NOT x.pulado
              ORDER BY x.enviado_em DESC LIMIT 30) a), '[]'::jsonb),
      'celulares', (SELECT count(*) FROM public.voluntariado_dispositivos d WHERE d.gestor_id = g.id)
    );
  END IF;

  -- Um pouco de espera em cada número errado: tentar um atrás do outro fica lento.
  PERFORM pg_sleep(0.4);
  RAISE EXCEPTION 'nao_encontrado';
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
  v_tel text := public.voluntariado_whatsapp(p_whatsapp);
  v_id uuid;
  g_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.voluntarios_natal WHERE whatsapp = v_tel;
  IF v_id IS NULL THEN SELECT id INTO g_id FROM public.voluntariado_gestores WHERE whatsapp = v_tel; END IF;
  IF v_id IS NULL AND g_id IS NULL THEN PERFORM pg_sleep(0.4); RAISE EXCEPTION 'nao_encontrado'; END IF;
  BEGIN
    INSERT INTO public.voluntariado_dispositivos (voluntario_id, gestor_id, endpoint, p256dh, auth)
    VALUES (v_id, g_id, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth))
    ON CONFLICT (endpoint) DO UPDATE
      SET voluntario_id = excluded.voluntario_id, gestor_id = excluded.gestor_id, p256dh = excluded.p256dh, auth = excluded.auth;
  EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'celular_invalido';
  END;
  DELETE FROM public.voluntariado_dispositivos
  WHERE id IN (
    SELECT id FROM public.voluntariado_dispositivos
    WHERE (v_id IS NOT NULL AND voluntario_id = v_id) OR (g_id IS NOT NULL AND gestor_id = g_id)
    ORDER BY criado_em DESC OFFSET 5);
END;
$$;

CREATE OR REPLACE FUNCTION public.desativar_avisos_voluntario(p_whatsapp text, p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text := public.voluntariado_whatsapp(p_whatsapp);
BEGIN
  DELETE FROM public.voluntariado_dispositivos d
  WHERE d.endpoint = btrim(p_endpoint)
    AND (d.voluntario_id IN (SELECT id FROM public.voluntarios_natal WHERE whatsapp = v_tel)
      OR d.gestor_id IN (SELECT id FROM public.voluntariado_gestores WHERE whatsapp = v_tel));
END;
$$;

REVOKE ALL ON FUNCTION public.central_no_formulario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.definir_central_no_formulario(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.central_no_formulario() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.definir_central_no_formulario(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.central_do_voluntario(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_avisos_voluntario(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desativar_avisos_voluntario(text, text) TO anon, authenticated;

-- Conferência (true = ok): o interruptor (desligado), os gestores e a Central nova.
SELECT
  (SELECT central_no_formulario = false FROM public.voluntariado_config WHERE id = 1) AS botao_escondido,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voluntariado_gestores') = 1 AS gestores,
  (SELECT position('gestor' in pg_get_functiondef('public.central_do_voluntario(text)'::regprocedure)) > 0) AS central_com_gestor;

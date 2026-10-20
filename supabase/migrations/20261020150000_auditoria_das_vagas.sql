-- Trabalhe Conosco, passo 6 do roteiro (20/10/2026): auditoria do acesso a
-- dados de candidatos. (Os relatórios são contas sobre o que já existe e não
-- precisam de tabela.)
--
-- Decisões dele: fica em Vagas (não na /auditoria geral, que as gestoras de
-- unidade veem); só ADMINISTRADORES leem; aviso de "fora do comum" quando a
-- mesma pessoa abre mais de 30 fichas ou currículos em 1 hora; a planilha de
-- candidatos (nome, e-mail, WhatsApp) é só do RH, e cada download fica
-- registrado.
--
-- O registro é imutável: ninguém altera nem apaga, nem administrador (os
-- gatilhos recusam UPDATE, DELETE e TRUNCATE). Não tem chave estrangeira de
-- propósito: guarda protocolo e título para continuar legível mesmo se a
-- candidatura ou a vaga sumirem.

-- 1. O registro ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vagas_auditoria (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  em              timestamptz NOT NULL DEFAULT now(),
  quem            uuid,
  quem_nome       text,
  -- 'admin' | 'rh' | 'responsavel' | 'sistema'
  papel           text,
  -- ficha.aberta, curriculo.aberto, planilha.baixada, candidato.movido,
  -- mensagem.enviada, vaga.criada, vaga.editada, vaga.status, vaga.apagada,
  -- responsavel.nomeado, alerta.conferido
  acao            text NOT NULL,
  candidatura_id  uuid,
  protocolo       text,
  vaga_id         uuid,
  vaga_titulo     text,
  detalhe         text
);
CREATE INDEX IF NOT EXISTS vagas_auditoria_em_idx ON public.vagas_auditoria (em DESC);
CREATE INDEX IF NOT EXISTS vagas_auditoria_quem_idx ON public.vagas_auditoria (quem, em);

ALTER TABLE public.vagas_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vagas_auditoria_admin ON public.vagas_auditoria;
CREATE POLICY vagas_auditoria_admin
  ON public.vagas_auditoria FOR SELECT TO authenticated
  USING (coalesce(public.check_is_admin(auth.uid()), false));
REVOKE ALL ON public.vagas_auditoria FROM anon, authenticated;
GRANT SELECT ON public.vagas_auditoria TO authenticated;
GRANT SELECT, INSERT ON public.vagas_auditoria TO service_role;

CREATE OR REPLACE FUNCTION public.vagas_auditoria_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'auditoria_imutavel';
END;
$$;

DROP TRIGGER IF EXISTS vagas_auditoria_imutavel ON public.vagas_auditoria;
CREATE TRIGGER vagas_auditoria_imutavel
BEFORE UPDATE OR DELETE ON public.vagas_auditoria
FOR EACH ROW EXECUTE FUNCTION public.vagas_auditoria_imutavel();

DROP TRIGGER IF EXISTS vagas_auditoria_sem_truncate ON public.vagas_auditoria;
CREATE TRIGGER vagas_auditoria_sem_truncate
BEFORE TRUNCATE ON public.vagas_auditoria
FOR EACH STATEMENT EXECUTE FUNCTION public.vagas_auditoria_imutavel();

-- 2. Gravar (uso interno: as funções e os gatilhos abaixo chamam) -------------------------

CREATE OR REPLACE FUNCTION public.auditar_vagas(p_acao text, p_candidatura uuid, p_vaga uuid, p_detalhe text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eu uuid := auth.uid();
  v_vaga uuid := p_vaga;
  v_protocolo text;
  v_titulo text;
BEGIN
  IF p_candidatura IS NOT NULL THEN
    SELECT c.protocolo, c.vaga_id INTO v_protocolo, v_vaga FROM public.candidaturas c WHERE c.id = p_candidatura;
  END IF;
  IF v_vaga IS NOT NULL THEN
    SELECT v.titulo INTO v_titulo FROM public.vagas v WHERE v.id = v_vaga;
  END IF;
  INSERT INTO public.vagas_auditoria (quem, quem_nome, papel, acao, candidatura_id, protocolo, vaga_id, vaga_titulo, detalhe)
  VALUES (
    eu,
    CASE WHEN eu IS NULL THEN 'Sistema' ELSE public.nome_de_quem_age() END,
    CASE
      WHEN eu IS NULL THEN 'sistema'
      WHEN coalesce(public.check_is_admin(eu), false) THEN 'admin'
      WHEN public.is_rh_or_admin(eu) THEN 'rh'
      ELSE 'responsavel'
    END,
    p_acao, p_candidatura, v_protocolo, v_vaga, v_titulo, left(p_detalhe, 500)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.auditar_vagas(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- 3. O que o app avisa: abrir ficha, abrir currículo, baixar planilha ----------------------

CREATE OR REPLACE FUNCTION public.registrar_acesso(p_acao text, p_candidatura uuid DEFAULT NULL, p_vaga uuid DEFAULT NULL, p_detalhe text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_acao IN ('ficha.aberta', 'curriculo.aberto') THEN
    IF p_candidatura IS NULL THEN RAISE EXCEPTION 'candidatura_obrigatoria'; END IF;
    IF NOT (public.is_rh_or_admin(auth.uid()) OR public.responsavel_pela_candidatura(p_candidatura, auth.uid())) THEN
      RAISE EXCEPTION 'sem_permissao';
    END IF;
  ELSIF p_acao = 'planilha.baixada' THEN
    -- A planilha com nome, e-mail e WhatsApp é só do RH (decisão de 20/10/2026).
    IF p_vaga IS NULL THEN RAISE EXCEPTION 'vaga_obrigatoria'; END IF;
    IF NOT public.is_rh_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  ELSE
    RAISE EXCEPTION 'acao_invalida';
  END IF;
  PERFORM public.auditar_vagas(p_acao, p_candidatura, p_vaga, p_detalhe);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_acesso(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(text, uuid, uuid, text) TO authenticated;

-- 4. O que o banco registra sozinho -----------------------------------------------------------

-- Mover de etapa e enviar mensagem já passam pelo histórico da candidatura.
CREATE OR REPLACE FUNCTION public.auditar_historico_da_candidatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acao = 'etapa' THEN
    PERFORM public.auditar_vagas('candidato.movido', NEW.candidatura_id, NULL, coalesce(NEW.de, '?') || ' → ' || coalesce(NEW.para, '?'));
  ELSIF NEW.acao = 'mensagem' THEN
    PERFORM public.auditar_vagas('mensagem.enviada', NEW.candidatura_id, NULL, NEW.para);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditar_historico_da_candidatura ON public.candidatura_historico;
CREATE TRIGGER auditar_historico_da_candidatura
AFTER INSERT ON public.candidatura_historico
FOR EACH ROW EXECUTE FUNCTION public.auditar_historico_da_candidatura();

-- Criar, editar, mudar status, nomear responsável e apagar vaga.
CREATE OR REPLACE FUNCTION public.auditar_vaga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  campos text;
  nome text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.auditar_vagas('vaga.criada', NULL, NEW.id, NEW.codigo);
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.vagas_auditoria (quem, quem_nome, papel, acao, vaga_id, vaga_titulo, detalhe)
    VALUES (auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'Sistema' ELSE public.nome_de_quem_age() END,
            CASE WHEN auth.uid() IS NULL THEN 'sistema' WHEN coalesce(public.check_is_admin(auth.uid()), false) THEN 'admin' ELSE 'rh' END,
            'vaga.apagada', OLD.id, OLD.titulo, OLD.codigo);
    RETURN OLD;
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    SELECT coalesce(nullif(btrim(p.name), ''), p.email) INTO nome FROM public.profiles p WHERE p.user_id = NEW.responsavel_id;
    PERFORM public.auditar_vagas('responsavel.nomeado', NULL, NEW.id, CASE WHEN NEW.responsavel_id IS NULL THEN 'sem responsável' ELSE coalesce(nome, 'pessoa da equipe') END);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.auditar_vagas('vaga.status', NULL, NEW.id, coalesce(OLD.status, '?') || ' → ' || coalesce(NEW.status, '?'));
  END IF;
  SELECT string_agg(n.key, ', ' ORDER BY n.key) INTO campos
    FROM jsonb_each(to_jsonb(NEW)) n
   WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key)
     AND n.key NOT IN ('updated_at', 'responsavel_id', 'status');
  IF campos IS NOT NULL THEN
    PERFORM public.auditar_vagas('vaga.editada', NULL, NEW.id, campos);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditar_vaga ON public.vagas;
CREATE TRIGGER auditar_vaga
AFTER INSERT OR UPDATE OR DELETE ON public.vagas
FOR EACH ROW EXECUTE FUNCTION public.auditar_vaga();

-- 5. O aviso de "fora do comum" (só administradores) ----------------------------------------

-- Mais de 30 fichas ou currículos abertos pela mesma pessoa dentro da mesma
-- hora. `media_por_dia` = quanto ela costuma abrir nos dias em que abre algo
-- (últimos 30 dias), para comparar.
CREATE OR REPLACE FUNCTION public.alertas_da_auditoria(p_dias integer DEFAULT 30)
RETURNS TABLE (quem uuid, quem_nome text, hora timestamptz, quantidade integer, media_por_dia numeric, vagas text, conferido boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT coalesce(public.check_is_admin(auth.uid()), false) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  RETURN QUERY
    WITH aberturas AS (
      SELECT a.quem, a.quem_nome, a.em, a.vaga_titulo
        FROM public.vagas_auditoria a
       WHERE a.acao IN ('ficha.aberta', 'curriculo.aberto')
         AND a.quem IS NOT NULL
         AND a.em >= now() - make_interval(days => greatest(p_dias, 1))
    ),
    por_hora AS (
      SELECT ab.quem, max(ab.quem_nome) AS quem_nome, date_trunc('hour', ab.em) AS hora, count(*)::integer AS quantidade,
             string_agg(DISTINCT coalesce(ab.vaga_titulo, '?'), ', ') AS vagas
        FROM aberturas ab
       GROUP BY ab.quem, date_trunc('hour', ab.em)
      HAVING count(*) > 30
    ),
    costume AS (
      SELECT a.quem, round(count(*)::numeric / greatest(count(DISTINCT date_trunc('day', a.em)), 1), 1) AS media
        FROM public.vagas_auditoria a
       WHERE a.acao IN ('ficha.aberta', 'curriculo.aberto') AND a.em >= now() - interval '30 days'
       GROUP BY a.quem
    )
    SELECT ph.quem, ph.quem_nome, ph.hora, ph.quantidade, c.media, ph.vagas,
           EXISTS (SELECT 1 FROM public.vagas_auditoria x WHERE x.acao = 'alerta.conferido' AND x.detalhe = ph.quem::text || '|' || to_char(ph.hora AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24'))
      FROM por_hora ph LEFT JOIN costume c ON c.quem = ph.quem
     ORDER BY ph.hora DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.alertas_da_auditoria(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alertas_da_auditoria(integer) TO authenticated;

-- "Marcar como conferido": também vira registro (quem conferiu e quando).
CREATE OR REPLACE FUNCTION public.conferir_alerta(p_quem uuid, p_hora timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT coalesce(public.check_is_admin(auth.uid()), false) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  PERFORM public.auditar_vagas('alerta.conferido', NULL, NULL, p_quem::text || '|' || to_char(date_trunc('hour', p_hora) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24'));
END;
$$;
REVOKE ALL ON FUNCTION public.conferir_alerta(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_alerta(uuid, timestamptz) TO authenticated;

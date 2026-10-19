-- Trabalhe Conosco, passo 3 do roteiro (19/10/2026): processos seletivos com
-- responsável e prazo.
--
-- Decisões dele: qualquer pessoa ativa da equipe pode ser responsável; UM por
-- vaga (a coluna vagas.responsavel_id já existe desde o PR 1); quem é
-- responsável e não é RH vê só os processos dele (quadro, ficha, currículo,
-- observações, mover até Entrevista) e NÃO fecha o resultado; a pessoa recebe
-- e-mail ao ser nomeada.

-- 1. Prazo do processo (o "prazo" que já existe é o das inscrições) ---------------

ALTER TABLE public.vagas ADD COLUMN IF NOT EXISTS prazo_processo date;

-- 2. Quem é responsável por qual vaga --------------------------------------------------

CREATE OR REPLACE FUNCTION public.responsavel_pela_vaga(_vaga_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.vagas v WHERE v.id = _vaga_id AND v.responsavel_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.responsavel_pela_candidatura(_candidatura_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidaturas c JOIN public.vagas v ON v.id = c.vaga_id
    WHERE c.id = _candidatura_id AND v.responsavel_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.responsavel_pela_vaga(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.responsavel_pela_candidatura(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.responsavel_pela_vaga(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responsavel_pela_candidatura(uuid, uuid) TO authenticated;

-- 3. O responsável lê o que é do processo dele --------------------------------------------

DROP POLICY IF EXISTS vagas_select_responsavel ON public.vagas;
CREATE POLICY vagas_select_responsavel
  ON public.vagas FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid());

DROP POLICY IF EXISTS candidaturas_select_responsavel ON public.candidaturas;
CREATE POLICY candidaturas_select_responsavel
  ON public.candidaturas FOR SELECT TO authenticated
  USING (public.responsavel_pela_vaga(vaga_id, auth.uid()));

DROP POLICY IF EXISTS candidatura_historico_responsavel ON public.candidatura_historico;
CREATE POLICY candidatura_historico_responsavel
  ON public.candidatura_historico FOR SELECT TO authenticated
  USING (public.responsavel_pela_candidatura(candidatura_id, auth.uid()));

DROP POLICY IF EXISTS candidatura_observacoes_responsavel ON public.candidatura_observacoes;
CREATE POLICY candidatura_observacoes_responsavel
  ON public.candidatura_observacoes FOR ALL TO authenticated
  USING (public.responsavel_pela_candidatura(candidatura_id, auth.uid()))
  WITH CHECK (public.responsavel_pela_candidatura(candidatura_id, auth.uid()));

-- A cópia do currículo da candidatura (curriculos/<user_id>/candidatura-…).
DROP POLICY IF EXISTS curriculos_responsavel_ler ON storage.objects;
CREATE POLICY curriculos_responsavel_ler
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'curriculos' AND EXISTS (
      SELECT 1 FROM public.candidaturas c JOIN public.vagas v ON v.id = c.vaga_id
      WHERE c.curriculo_caminho = storage.objects.name AND v.responsavel_id = auth.uid()
    )
  );

-- 4. Abrir e mover: o RH em tudo; o responsável até Entrevista -------------------------------

CREATE OR REPLACE FUNCTION public.abrir_candidatura(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_rh_or_admin(auth.uid()) OR public.responsavel_pela_candidatura(p_id, auth.uid())) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  UPDATE public.candidaturas SET aberta_em = now() WHERE id = p_id AND aberta_em IS NULL;
  IF FOUND THEN
    INSERT INTO public.candidatura_historico (candidatura_id, acao, por) VALUES (p_id, 'aberta', public.nome_de_quem_age());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mover_candidatura(p_id uuid, p_etapa text, p_resultado text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordem text[] := ARRAY['recebida', 'analise', 'entrevista', 'resultado'];
  atual record;
  avisar boolean;
  rh boolean := public.is_rh_or_admin(auth.uid());
BEGIN
  IF NOT (rh OR public.responsavel_pela_candidatura(p_id, auth.uid())) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF NOT p_etapa = ANY (ordem) THEN RAISE EXCEPTION 'etapa_invalida'; END IF;
  IF (p_etapa = 'resultado') <> (p_resultado IS NOT NULL) THEN RAISE EXCEPTION 'resultado_invalido'; END IF;

  SELECT * INTO atual FROM public.candidaturas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'candidatura_nao_encontrada'; END IF;
  IF atual.retirada_em IS NOT NULL THEN RAISE EXCEPTION 'candidatura_retirada'; END IF;
  -- O resultado é do RH: o responsável não entra nem sai dele.
  IF NOT rh AND (p_etapa = 'resultado' OR atual.etapa = 'resultado') THEN RAISE EXCEPTION 'so_rh_fecha'; END IF;
  IF atual.etapa = p_etapa AND atual.resultado IS NOT DISTINCT FROM p_resultado THEN RETURN false; END IF;

  avisar := array_position(ordem, p_etapa) > array_position(ordem, atual.etapa)
            OR (p_etapa = 'resultado' AND atual.etapa = 'resultado');

  UPDATE public.candidaturas
     SET etapa = p_etapa, resultado = p_resultado, aberta_em = coalesce(aberta_em, now())
   WHERE id = p_id;

  INSERT INTO public.candidatura_historico (candidatura_id, acao, de, para, por)
  VALUES (p_id, 'etapa', atual.etapa || coalesce(':' || atual.resultado, ''), p_etapa || coalesce(':' || p_resultado, ''), public.nome_de_quem_age());

  RETURN avisar;
END;
$$;

-- 5. A lista da equipe para escolher o responsável (só o RH chama) ----------------------------

CREATE OR REPLACE FUNCTION public.equipe_para_responsavel()
RETURNS TABLE (user_id uuid, nome text, email text, unidade text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_rh_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  RETURN QUERY
    SELECT p.user_id, coalesce(nullif(btrim(p.name), ''), p.email, 'Sem nome'), p.email, p.unit
    FROM public.profiles p
    WHERE coalesce(p.is_active, false)
      AND NOT EXISTS (SELECT 1 FROM public.candidatos c WHERE c.user_id = p.user_id)
    ORDER BY 2;
END;
$$;

REVOKE ALL ON FUNCTION public.equipe_para_responsavel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipe_para_responsavel() TO authenticated;

-- 6. Quem sou eu nos processos (para o menu e "Meus processos") -----------------------------

CREATE OR REPLACE FUNCTION public.sou_responsavel_por_alguma_vaga()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.vagas v WHERE v.responsavel_id = auth.uid() AND v.status NOT IN ('encerrada', 'arquivada'));
$$;

REVOKE ALL ON FUNCTION public.sou_responsavel_por_alguma_vaga() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sou_responsavel_por_alguma_vaga() TO authenticated;

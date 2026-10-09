-- Trabalhe Conosco, PR 9 (09/10/2026): o painel do RH.
--
-- Decisões dele: o candidato vê "Aprovado" ou "Não selecionado" no
-- resultado; recebe e-mail a cada mudança de etapa (voltar não avisa); o RH
-- tem observações internas na ficha, que o candidato nunca lê; só RH e admin.
--
-- O RH não edita a linha da candidatura direto: move pela função
-- mover_candidatura, que confere a regra, grava o histórico e deixa marcado
-- qual aviso falta mandar.

-- 1. Colunas novas -----------------------------------------------------------------

ALTER TABLE public.candidaturas
  ADD COLUMN IF NOT EXISTS resultado      text,
  -- quando alguém do RH abriu a ficha pela primeira vez ("novo" some)
  ADD COLUMN IF NOT EXISTS aberta_em      timestamptz,
  -- a última etapa avisada por e-mail ao candidato (para não repetir)
  ADD COLUMN IF NOT EXISTS etapa_avisada  text;

ALTER TABLE public.candidaturas DROP CONSTRAINT IF EXISTS candidaturas_resultado_check;
ALTER TABLE public.candidaturas ADD CONSTRAINT candidaturas_resultado_check CHECK (
  (etapa = 'resultado' AND resultado IN ('aprovado', 'nao_selecionado'))
  OR (etapa <> 'resultado' AND resultado IS NULL)
);

-- 2. Observações e histórico: só RH e admin ------------------------------------------

CREATE TABLE IF NOT EXISTS public.candidatura_observacoes (
  candidatura_id  uuid PRIMARY KEY REFERENCES public.candidaturas (id) ON DELETE CASCADE,
  texto           text NOT NULL DEFAULT '',
  atualizado_por  text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidatura_observacoes_texto_check CHECK (length(texto) <= 4000)
);

ALTER TABLE public.candidatura_observacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidatura_observacoes_rh ON public.candidatura_observacoes;
CREATE POLICY candidatura_observacoes_rh
  ON public.candidatura_observacoes FOR ALL TO authenticated
  USING (public.is_rh_or_admin(auth.uid()))
  WITH CHECK (public.is_rh_or_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.candidatura_observacoes TO authenticated;
GRANT ALL ON public.candidatura_observacoes TO service_role;

CREATE TABLE IF NOT EXISTS public.candidatura_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id  uuid NOT NULL REFERENCES public.candidaturas (id) ON DELETE CASCADE,
  -- 'enviada' | 'aberta' | 'etapa' | 'retirada'
  acao            text NOT NULL,
  de              text,
  para            text,
  por             text,
  em              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidatura_historico_idx ON public.candidatura_historico (candidatura_id, em);

ALTER TABLE public.candidatura_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidatura_historico_rh ON public.candidatura_historico;
CREATE POLICY candidatura_historico_rh
  ON public.candidatura_historico FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));
GRANT SELECT ON public.candidatura_historico TO authenticated;
GRANT ALL ON public.candidatura_historico TO service_role;

-- O envio e a retirada também entram no histórico.
CREATE OR REPLACE FUNCTION public.candidaturas_historico_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.candidatura_historico (candidatura_id, acao, para, por) VALUES (NEW.id, 'enviada', 'recebida', 'candidato');
  ELSIF OLD.retirada_em IS NULL AND NEW.retirada_em IS NOT NULL THEN
    INSERT INTO public.candidatura_historico (candidatura_id, acao, de, por) VALUES (NEW.id, 'retirada', OLD.etapa, 'candidato');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidaturas_historico_automatico ON public.candidaturas;
CREATE TRIGGER candidaturas_historico_automatico
AFTER INSERT OR UPDATE ON public.candidaturas
FOR EACH ROW EXECUTE FUNCTION public.candidaturas_historico_automatico();

-- 3. Quem é "fulano do RH" no histórico ------------------------------------------------

CREATE OR REPLACE FUNCTION public.nome_de_quem_age()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(btrim(p.name), ''), u.email, 'RH')
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = auth.uid();
$$;

-- 4. Abrir a ficha e mover de etapa ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.abrir_candidatura(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_rh_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.candidaturas SET aberta_em = now() WHERE id = p_id AND aberta_em IS NULL;
  IF FOUND THEN
    INSERT INTO public.candidatura_historico (candidatura_id, acao, por) VALUES (p_id, 'aberta', public.nome_de_quem_age());
  END IF;
END;
$$;

-- p_etapa: 'recebida' | 'analise' | 'entrevista' | 'resultado'; p_resultado só com 'resultado'.
-- Devolve true quando o candidato deve ser avisado (avançou ou chegou ao resultado).
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
BEGIN
  IF NOT public.is_rh_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF NOT p_etapa = ANY (ordem) THEN RAISE EXCEPTION 'etapa_invalida'; END IF;
  IF (p_etapa = 'resultado') <> (p_resultado IS NOT NULL) THEN RAISE EXCEPTION 'resultado_invalido'; END IF;

  SELECT * INTO atual FROM public.candidaturas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'candidatura_nao_encontrada'; END IF;
  IF atual.retirada_em IS NOT NULL THEN RAISE EXCEPTION 'candidatura_retirada'; END IF;
  IF atual.etapa = p_etapa AND atual.resultado IS NOT DISTINCT FROM p_resultado THEN RETURN false; END IF;

  -- Avisa quando anda para frente (ou muda o resultado); voltar não avisa.
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

REVOKE ALL ON FUNCTION public.abrir_candidatura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mover_candidatura(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nome_de_quem_age() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abrir_candidatura(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mover_candidatura(uuid, text, text) TO authenticated;

-- 5. O RH lê o perfil e as experiências dos candidatos (já lia, PR 7) e as
--    vagas mesmo encerradas (já lia, PR 1). Nada novo aqui.

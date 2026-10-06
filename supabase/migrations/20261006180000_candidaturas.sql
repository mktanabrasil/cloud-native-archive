-- Trabalhe Conosco, PR 8 (06/10/2026): a candidatura feita no app.
--
-- Decisões dele: todas as vagas passam a usar o app de uma vez (o link do
-- Forms fica guardado, sem botão); para enviar, o perfil precisa estar
-- completo (o currículo é opcional); e-mail de confirmação com o protocolo;
-- etapas que o candidato vê: recebida › analise › entrevista › resultado.
--
-- A candidatura guarda uma CÓPIA do que foi enviado (perfil, experiências,
-- requisitos marcados, respostas e uma cópia do currículo no balde): se o
-- candidato mudar o perfil ou trocar o currículo depois, o RH continua vendo
-- o que chegou naquele dia.

-- 1. Tabela ---------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.candidaturas_protocolo_seq;

CREATE TABLE IF NOT EXISTS public.candidaturas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo           text NOT NULL UNIQUE,
  user_id             uuid NOT NULL REFERENCES public.candidatos (user_id) ON DELETE CASCADE,
  vaga_id             uuid NOT NULL REFERENCES public.vagas (id) ON DELETE RESTRICT,
  etapa               text NOT NULL DEFAULT 'recebida',
  -- a cópia do perfil e das experiências no momento do envio
  perfil              jsonb NOT NULL,
  -- [{ "texto": "Ensino Médio completo", "atende": true }]
  requisitos          jsonb NOT NULL DEFAULT '[]',
  -- [{ "pergunta_id": "...", "texto": "...", "tipo": "...", "resposta": "..." | [...] }]
  respostas           jsonb NOT NULL DEFAULT '[]',
  origem              text,
  curriculo_caminho   text,
  curriculo_nome      text,
  confirmacao_enviada_em timestamptz,
  retirada_em         timestamptz,
  motivo_retirada     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidaturas_etapa_check CHECK (etapa IN ('recebida', 'analise', 'entrevista', 'resultado')),
  CONSTRAINT candidaturas_textos_check CHECK (
    coalesce(length(origem), 0) <= 60 AND coalesce(length(motivo_retirada), 0) <= 200
  )
);

COMMENT ON TABLE public.candidaturas IS 'Candidaturas do Trabalhe Conosco feitas no app (06/10/2026).';

-- Uma candidatura ativa por vaga; depois de retirar, pode se candidatar de novo.
CREATE UNIQUE INDEX IF NOT EXISTS candidaturas_uma_ativa_por_vaga
  ON public.candidaturas (user_id, vaga_id) WHERE retirada_em IS NULL;
CREATE INDEX IF NOT EXISTS candidaturas_user_idx ON public.candidaturas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS candidaturas_vaga_idx ON public.candidaturas (vaga_id, created_at DESC);

-- 2. Protocolo e campos que só o banco decide ---------------------------------------
-- "2026-000418": ano do envio e um número que não se repete.

CREATE OR REPLACE FUNCTION public.candidaturas_ao_inserir()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.protocolo := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY') || '-'
                   || lpad(nextval('public.candidaturas_protocolo_seq')::text, 6, '0');
  NEW.etapa := 'recebida';
  NEW.retirada_em := NULL;
  NEW.motivo_retirada := NULL;
  NEW.confirmacao_enviada_em := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidaturas_ao_inserir ON public.candidaturas;
CREATE TRIGGER candidaturas_ao_inserir
BEFORE INSERT ON public.candidaturas
FOR EACH ROW EXECUTE FUNCTION public.candidaturas_ao_inserir();

DROP TRIGGER IF EXISTS update_candidaturas_updated_at ON public.candidaturas;
CREATE TRIGGER update_candidaturas_updated_at
BEFORE UPDATE ON public.candidaturas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Quem vê e quem mexe --------------------------------------------------------------

ALTER TABLE public.candidaturas ENABLE ROW LEVEL SECURITY;

-- O candidato vê as próprias.
DROP POLICY IF EXISTS candidaturas_select_propria ON public.candidaturas;
CREATE POLICY candidaturas_select_propria
  ON public.candidaturas FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- O candidato envia para si mesmo, só para vaga publicada e aberta.
DROP POLICY IF EXISTS candidaturas_insert_propria ON public.candidaturas;
CREATE POLICY candidaturas_insert_propria
  ON public.candidaturas FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vagas v
      WHERE v.id = vaga_id AND v.status = 'publicada' AND (v.prazo IS NULL OR v.prazo > now())
    )
  );

-- RH e admin leem todas e mudam a etapa (o painel é o PR 9).
DROP POLICY IF EXISTS candidaturas_select_rh ON public.candidaturas;
CREATE POLICY candidaturas_select_rh
  ON public.candidaturas FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

DROP POLICY IF EXISTS candidaturas_update_rh ON public.candidaturas;
CREATE POLICY candidaturas_update_rh
  ON public.candidaturas FOR UPDATE TO authenticated
  USING (public.is_rh_or_admin(auth.uid()))
  WITH CHECK (public.is_rh_or_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.candidaturas TO authenticated;
GRANT ALL ON public.candidaturas TO service_role;
GRANT USAGE ON SEQUENCE public.candidaturas_protocolo_seq TO authenticated, service_role;

-- 4. Retirar: o candidato não edita a linha; só pede para retirar -----------------------

CREATE OR REPLACE FUNCTION public.retirar_candidatura(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.candidaturas
     SET retirada_em = now(),
         motivo_retirada = nullif(left(btrim(coalesce(p_motivo, '')), 200), '')
   WHERE id = p_id AND user_id = auth.uid() AND retirada_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'candidatura_nao_encontrada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.retirar_candidatura(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retirar_candidatura(uuid, text) TO authenticated;

-- 5. O RH lê o perfil e as experiências de quem se candidatou (já lia; nada novo).
-- A cópia do currículo fica em curriculos/<user_id>/candidatura-<uuid>.<ext>,
-- coberta pelas políticas do PR 7 (dono e RH).

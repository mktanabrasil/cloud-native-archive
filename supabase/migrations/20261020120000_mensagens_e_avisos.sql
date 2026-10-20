-- Trabalhe Conosco, passo 5 do roteiro (20/10/2026): mensagens pela ficha e
-- avisos no app.
--
-- Decisões dele: a equipe (RH e o responsável pelo processo, só nas vagas
-- dele) escreve ao candidato com três modelos: convite para entrevista,
-- pedir informação e mensagem livre. O candidato só responde quando o RH
-- pede (pergunta e convite); o convite tem "Confirmo presença / Não posso
-- nesse horário". O e-mail leva o texto inteiro, com o botão para o app.
-- O candidato tem um sino com os avisos; a equipe, uma bolinha em "Vagas".
--
-- Ninguém escreve na tabela direto: enviar, responder e marcar como lida
-- passam pelas funções abaixo, que conferem quem pode o quê.

-- 1. Mensagens -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.candidatura_mensagens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id    uuid NOT NULL REFERENCES public.candidaturas (id) ON DELETE CASCADE,
  -- 'equipe' | 'candidato'
  autor             text NOT NULL,
  -- da equipe: 'convite' | 'pergunta' | 'recado'; do candidato: 'resposta'
  tipo              text NOT NULL,
  texto             text NOT NULL,
  -- só no convite: { "dia": "2026-10-24", "hora": "14:00", "formato": "presencial", "local": "..." }
  entrevista        jsonb,
  -- a resposta aponta para a mensagem respondida
  responde_a        uuid REFERENCES public.candidatura_mensagens (id) ON DELETE CASCADE,
  -- só no convite: 'confirmada' | 'nao_pode'
  presenca          text,
  -- nome de quem escreveu, da equipe (o candidato aparece pelo nome da ficha)
  por               text,
  -- quando o outro lado leu
  lida_em           timestamptz,
  email_enviado_em  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidatura_mensagens_autor_check CHECK (autor IN ('equipe', 'candidato')),
  CONSTRAINT candidatura_mensagens_tipo_check CHECK (
    (autor = 'equipe' AND tipo IN ('convite', 'pergunta', 'recado')) OR (autor = 'candidato' AND tipo = 'resposta')
  ),
  CONSTRAINT candidatura_mensagens_texto_check CHECK (length(btrim(texto)) BETWEEN 1 AND 4000),
  CONSTRAINT candidatura_mensagens_presenca_check CHECK (presenca IS NULL OR (tipo = 'convite' AND presenca IN ('confirmada', 'nao_pode')))
);
CREATE INDEX IF NOT EXISTS candidatura_mensagens_idx ON public.candidatura_mensagens (candidatura_id, created_at);
CREATE INDEX IF NOT EXISTS candidatura_mensagens_nao_lidas_idx ON public.candidatura_mensagens (autor) WHERE lida_em IS NULL;

ALTER TABLE public.candidatura_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS candidatura_mensagens_equipe ON public.candidatura_mensagens;
CREATE POLICY candidatura_mensagens_equipe
  ON public.candidatura_mensagens FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()) OR public.responsavel_pela_candidatura(candidatura_id, auth.uid()));

DROP POLICY IF EXISTS candidatura_mensagens_candidato ON public.candidatura_mensagens;
CREATE POLICY candidatura_mensagens_candidato
  ON public.candidatura_mensagens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.candidaturas c WHERE c.id = candidatura_id AND c.user_id = auth.uid()));

GRANT SELECT ON public.candidatura_mensagens TO authenticated;
GRANT ALL ON public.candidatura_mensagens TO service_role;

-- Quando o candidato viu o sino pela última vez.
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS avisos_vistos_em timestamptz;

-- 2. A equipe envia ---------------------------------------------------------------------

-- Devolve o id da mensagem e se o convite moveu a candidatura para Entrevista.
CREATE OR REPLACE FUNCTION public.enviar_mensagem(p_candidatura uuid, p_tipo text, p_texto text, p_entrevista jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atual record;
  nova uuid;
  moveu boolean := false;
  quem text := public.nome_de_quem_age();
BEGIN
  IF NOT (public.is_rh_or_admin(auth.uid()) OR public.responsavel_pela_candidatura(p_candidatura, auth.uid())) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  IF p_tipo NOT IN ('convite', 'pergunta', 'recado') THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF length(btrim(coalesce(p_texto, ''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'texto_invalido'; END IF;

  SELECT * INTO atual FROM public.candidaturas WHERE id = p_candidatura FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'candidatura_nao_encontrada'; END IF;
  IF atual.retirada_em IS NOT NULL THEN RAISE EXCEPTION 'candidatura_retirada'; END IF;

  IF p_tipo = 'convite' THEN
    IF atual.etapa = 'resultado' THEN RAISE EXCEPTION 'convite_depois_do_resultado'; END IF;
    IF coalesce(p_entrevista ->> 'dia', '') = '' OR coalesce(p_entrevista ->> 'hora', '') = '' THEN RAISE EXCEPTION 'convite_sem_data'; END IF;
    -- O convite leva à Entrevista; o e-mail do convite vale como o aviso da etapa (um e-mail só).
    IF atual.etapa <> 'entrevista' THEN
      UPDATE public.candidaturas
         SET etapa = 'entrevista', etapa_avisada = 'entrevista', aberta_em = coalesce(aberta_em, now())
       WHERE id = p_candidatura;
      INSERT INTO public.candidatura_historico (candidatura_id, acao, de, para, por)
      VALUES (p_candidatura, 'etapa', atual.etapa, 'entrevista', quem);
      moveu := true;
    END IF;
  END IF;

  INSERT INTO public.candidatura_mensagens (candidatura_id, autor, tipo, texto, entrevista, por)
  VALUES (p_candidatura, 'equipe', p_tipo, btrim(p_texto), CASE WHEN p_tipo = 'convite' THEN p_entrevista END, quem)
  RETURNING id INTO nova;

  INSERT INTO public.candidatura_historico (candidatura_id, acao, para, por) VALUES (p_candidatura, 'mensagem', p_tipo, quem);

  RETURN jsonb_build_object('id', nova, 'moveu', moveu);
END;
$$;

-- 3. O candidato responde (só ao que pede resposta) ---------------------------------------

CREATE OR REPLACE FUNCTION public.responder_mensagem(p_mensagem uuid, p_texto text DEFAULT NULL, p_presenca text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  t text := btrim(coalesce(p_texto, ''));
  nova uuid;
BEGIN
  SELECT cm.*, c.user_id, c.retirada_em INTO m
    FROM public.candidatura_mensagens cm JOIN public.candidaturas c ON c.id = cm.candidatura_id
   WHERE cm.id = p_mensagem;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'mensagem_nao_encontrada'; END IF;
  IF m.retirada_em IS NOT NULL THEN RAISE EXCEPTION 'candidatura_retirada'; END IF;
  IF m.autor <> 'equipe' OR m.tipo NOT IN ('convite', 'pergunta') THEN RAISE EXCEPTION 'nao_pede_resposta'; END IF;
  IF length(t) > 1000 THEN RAISE EXCEPTION 'texto_invalido'; END IF;

  IF m.tipo = 'convite' THEN
    IF p_presenca NOT IN ('confirmada', 'nao_pode') THEN RAISE EXCEPTION 'presenca_invalida'; END IF;
    IF p_presenca = 'nao_pode' AND t = '' THEN RAISE EXCEPTION 'diga_quando_pode'; END IF;
    UPDATE public.candidatura_mensagens SET presenca = p_presenca, lida_em = coalesce(lida_em, now()) WHERE id = p_mensagem;
    t := CASE WHEN p_presenca = 'confirmada' THEN 'Confirmo presença.' || CASE WHEN t <> '' THEN ' ' || t ELSE '' END
              ELSE 'Não posso nesse horário. ' || t END;
  ELSE
    IF t = '' THEN RAISE EXCEPTION 'texto_invalido'; END IF;
    UPDATE public.candidatura_mensagens SET lida_em = coalesce(lida_em, now()) WHERE id = p_mensagem;
  END IF;

  INSERT INTO public.candidatura_mensagens (candidatura_id, autor, tipo, texto, responde_a)
  VALUES (m.candidatura_id, 'candidato', 'resposta', t, p_mensagem)
  RETURNING id INTO nova;

  INSERT INTO public.candidatura_historico (candidatura_id, acao, para, por)
  VALUES (m.candidatura_id, 'resposta', coalesce(p_presenca, 'pergunta'), 'candidato');

  RETURN nova;
END;
$$;

-- 4. Marcar como lidas: cada lado marca as do outro ----------------------------------------

CREATE OR REPLACE FUNCTION public.marcar_mensagens_lidas(p_candidatura uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.candidaturas c WHERE c.id = p_candidatura AND c.user_id = auth.uid()) THEN
    UPDATE public.candidatura_mensagens SET lida_em = now()
     WHERE candidatura_id = p_candidatura AND autor = 'equipe' AND lida_em IS NULL;
  ELSIF public.is_rh_or_admin(auth.uid()) OR public.responsavel_pela_candidatura(p_candidatura, auth.uid()) THEN
    UPDATE public.candidatura_mensagens SET lida_em = now()
     WHERE candidatura_id = p_candidatura AND autor = 'candidato' AND lida_em IS NULL;
  ELSE
    RAISE EXCEPTION 'sem_permissao';
  END IF;
END;
$$;

-- 5. O sino do candidato ---------------------------------------------------------------------

-- Os avisos do candidato: recebimento, avanços de etapa (voltar não conta,
-- como no e-mail) e mensagens da equipe. `novo` = depois da última olhada.
CREATE OR REPLACE FUNCTION public.meus_avisos()
RETURNS TABLE (candidatura_id uuid, tipo text, texto text, vaga text, em timestamptz, novo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH minhas AS (
    SELECT c.id, c.protocolo, coalesce(v.titulo, 'Trabalhe Conosco') AS vaga
      FROM public.candidaturas c LEFT JOIN public.vagas v ON v.id = c.vaga_id
     WHERE c.user_id = auth.uid()
  ),
  visto AS (SELECT coalesce((SELECT avisos_vistos_em FROM public.candidatos WHERE user_id = auth.uid()), '-infinity'::timestamptz) AS em),
  ordem AS (SELECT ARRAY['recebida', 'analise', 'entrevista', 'resultado'] AS o),
  todos AS (
    SELECT h.candidatura_id, 'enviada'::text AS tipo, 'Recebemos sua candidatura · protocolo ' || m.protocolo AS texto, m.vaga, h.em
      FROM public.candidatura_historico h JOIN minhas m ON m.id = h.candidatura_id
     WHERE h.acao = 'enviada'
    UNION ALL
    SELECT h.candidatura_id, 'etapa',
           CASE h.para
             WHEN 'analise' THEN 'Sua candidatura está em análise'
             WHEN 'entrevista' THEN 'Você avançou para a entrevista'
             WHEN 'resultado:aprovado' THEN 'Você foi aprovado(a)'
             ELSE 'Saiu o resultado da sua candidatura'
           END,
           m.vaga, h.em
      FROM public.candidatura_historico h JOIN minhas m ON m.id = h.candidatura_id, ordem
     WHERE h.acao = 'etapa'
       AND (array_position(ordem.o, split_part(h.para, ':', 1)) > array_position(ordem.o, split_part(h.de, ':', 1))
            OR (split_part(h.para, ':', 1) = 'resultado' AND split_part(h.de, ':', 1) = 'resultado'))
       -- quando foi o convite que moveu, o aviso é o do convite
       AND NOT EXISTS (
         SELECT 1 FROM public.candidatura_mensagens cm
          WHERE cm.candidatura_id = h.candidatura_id AND cm.tipo = 'convite'
            AND h.para = 'entrevista' AND abs(extract(epoch FROM cm.created_at - h.em)) < 5
       )
    UNION ALL
    SELECT cm.candidatura_id, cm.tipo,
           CASE cm.tipo WHEN 'convite' THEN 'Convite para entrevista' WHEN 'pergunta' THEN 'O RH enviou uma pergunta' ELSE 'Nova mensagem do RH' END,
           m.vaga, cm.created_at
      FROM public.candidatura_mensagens cm JOIN minhas m ON m.id = cm.candidatura_id
     WHERE cm.autor = 'equipe'
  )
  SELECT t.candidatura_id, t.tipo, t.texto, t.vaga, t.em, t.em > visto.em AS novo
    FROM todos t, visto
   ORDER BY t.em DESC
   LIMIT 60;
$$;

CREATE OR REPLACE FUNCTION public.marcar_avisos_vistos()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.candidatos SET avisos_vistos_em = now() WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.enviar_mensagem(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.responder_mensagem(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_mensagens_lidas(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.meus_avisos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_avisos_vistos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_mensagem(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_mensagem(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_mensagens_lidas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meus_avisos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_avisos_vistos() TO authenticated;

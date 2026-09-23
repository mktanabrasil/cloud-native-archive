-- Enquetes (decisões de 23/09/2026, mockup aprovado).
--
-- A equipe (marketing e administração) cria a enquete no Painel e manda dois
-- links: /enquete/<slug> para votar e /enquete/<slug>/resultado para
-- acompanhar. Os dois são públicos, sem login, como a vitrine de eventos.
--
-- Quem vota se identifica pelo número do WhatsApp e um PIN de 4 dígitos
-- criado na hora (pedido da chefia: alguma autenticação, sem ser difícil; um
-- código pelo WhatsApp exigiria a API oficial paga). Um voto por número;
-- trocar pede o mesmo número e PIN; no prazo, congela.
--
-- Ninguém de fora escreve nas tabelas nem lê os votos: o voto entra pela
-- função `votar_enquete`, que valida tudo, e o resultado sai pela função
-- `enquete_resultado`, que devolve a contagem e, quando a enquete
-- identifica, nome e fim do número de quem votou. O PIN fica com hash
-- (pgcrypto) e nunca sai do banco.
--
-- Aplicar no SQL Editor do Studio ANTES de publicar o front.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. As enquetes ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.enquetes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  pergunta          text NOT NULL,
  texto             text NOT NULL DEFAULT '',
  -- [{ id, titulo, subtitulo, cor }], de 2 a 6
  opcoes            jsonb NOT NULL,
  -- [{ data: '2026-10-12', rotulo: 'Feriado', cor: 'azul' | null }]
  dias              jsonb NOT NULL DEFAULT '[]'::jsonb,
  mostrar_resultado boolean NOT NULL DEFAULT true,
  identificar       boolean NOT NULL DEFAULT true,
  permitir_troca    boolean NOT NULL DEFAULT true,
  encerra_em        timestamptz,
  encerrada_em      timestamptz,
  criada_por        text NOT NULL DEFAULT '',
  created_by        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT enquetes_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT enquetes_opcoes_check CHECK (jsonb_typeof(opcoes) = 'array' AND jsonb_array_length(opcoes) BETWEEN 2 AND 6)
);

COMMENT ON TABLE public.enquetes IS 'Enquetes criadas pela equipe; votação pública por link (23/09/2026).';

ALTER TABLE public.enquetes ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa com o link lê a enquete (a página de voto precisa dela).
DROP POLICY IF EXISTS enquetes_select_publico ON public.enquetes;
CREATE POLICY enquetes_select_publico
  ON public.enquetes FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

-- Só marketing e administração criam, editam, encerram e apagam.
DROP POLICY IF EXISTS enquetes_insert_marketing ON public.enquetes;
CREATE POLICY enquetes_insert_marketing
  ON public.enquetes FOR INSERT TO authenticated
  WITH CHECK (public.is_marketing_user(auth.uid()));

DROP POLICY IF EXISTS enquetes_update_marketing ON public.enquetes;
CREATE POLICY enquetes_update_marketing
  ON public.enquetes FOR UPDATE TO authenticated
  USING (public.is_marketing_user(auth.uid()))
  WITH CHECK (public.is_marketing_user(auth.uid()));

GRANT SELECT ON public.enquetes TO anon;
GRANT SELECT, INSERT, UPDATE ON public.enquetes TO authenticated;
GRANT ALL ON public.enquetes TO service_role;

-- 2. Os votos --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.votos_de_enquete (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquete_id  uuid NOT NULL REFERENCES public.enquetes (id) ON DELETE CASCADE,
  opcao_id    text NOT NULL,
  -- só dígitos, com DDD, sem 55. Enquete anônima: chave do aparelho ('ap:…').
  telefone    text NOT NULL,
  nome        text NOT NULL DEFAULT '',
  pin_hash    text,
  votado_em   timestamptz NOT NULL DEFAULT now(),
  alterado_em timestamptz,
  erros       integer NOT NULL DEFAULT 0,
  travado_ate timestamptz,
  UNIQUE (enquete_id, telefone)
);

COMMENT ON TABLE public.votos_de_enquete IS 'Um voto por número (ou por aparelho, na enquete anônima). PIN com hash; nunca sai do banco.';

ALTER TABLE public.votos_de_enquete ENABLE ROW LEVEL SECURITY;

-- A equipe lê a lista completa no app; ninguém de fora lê nem escreve direto.
DROP POLICY IF EXISTS votos_select_marketing ON public.votos_de_enquete;
CREATE POLICY votos_select_marketing
  ON public.votos_de_enquete FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));

GRANT SELECT ON public.votos_de_enquete TO authenticated;
GRANT ALL ON public.votos_de_enquete TO service_role;

CREATE INDEX IF NOT EXISTS votos_de_enquete_enquete_idx ON public.votos_de_enquete (enquete_id, votado_em);

-- 3. Votar -------------------------------------------------------------------------
--
-- Devolve jsonb: { ok: true, opcao_id, trocou } ou { ok: false, motivo },
-- com motivo em: 'nao_encontrada', 'encerrada', 'opcao_invalida',
-- 'dados_invalidos', 'pin_incorreto', 'travado', 'troca_nao_permitida'.

CREATE OR REPLACE FUNCTION public.votar_enquete(
  p_slug     text,
  p_opcao_id text,
  p_telefone text,
  p_nome     text,
  p_pin      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e        public.enquetes%ROWTYPE;
  v        public.votos_de_enquete%ROWTYPE;
  tel      text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_nome   text := left(btrim(coalesce(p_nome, '')), 80);
BEGIN
  SELECT * INTO e FROM public.enquetes WHERE slug = p_slug AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motivo', 'nao_encontrada'); END IF;

  IF e.encerrada_em IS NOT NULL OR (e.encerra_em IS NOT NULL AND e.encerra_em <= now()) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'encerrada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.opcoes) o WHERE o->>'id' = p_opcao_id) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'opcao_invalida');
  END IF;

  -- Com identificação: DDD + 8 ou 9 dígitos, nome e PIN de 4 dígitos.
  -- Sem identificação: a chave do aparelho vem no lugar do telefone ('ap:…').
  IF e.identificar THEN
    IF (length(tel) = 12 OR length(tel) = 13) AND left(tel, 2) = '55' THEN tel := substr(tel, 3); END IF;
    IF length(tel) NOT IN (10, 11) OR v_nome = '' OR coalesce(p_pin, '') !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
    END IF;
  ELSE
    tel := left(coalesce(p_telefone, ''), 80);
    IF tel !~ '^ap:[A-Za-z0-9_-]{8,}$' THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
    END IF;
  END IF;

  SELECT * INTO v FROM public.votos_de_enquete WHERE enquete_id = e.id AND telefone = tel FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.votos_de_enquete (enquete_id, opcao_id, telefone, nome, pin_hash)
    VALUES (e.id, p_opcao_id, tel, v_nome, CASE WHEN e.identificar THEN crypt(p_pin, gen_salt('bf', 8)) END);
    RETURN jsonb_build_object('ok', true, 'opcao_id', p_opcao_id, 'trocou', false);
  END IF;

  -- Já votou: é troca. Confere trava, PIN e permissão.
  IF v.travado_ate IS NOT NULL AND v.travado_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'travado', 'ate', v.travado_ate);
  END IF;

  IF e.identificar AND (v.pin_hash IS NULL OR v.pin_hash <> crypt(p_pin, v.pin_hash)) THEN
    -- Três erros seguidos travam por 10 minutos e zeram a conta.
    UPDATE public.votos_de_enquete
       SET erros       = CASE WHEN v.erros + 1 >= 3 THEN 0 ELSE v.erros + 1 END,
           travado_ate = CASE WHEN v.erros + 1 >= 3 THEN now() + interval '10 minutes' END
     WHERE id = v.id;
    RETURN jsonb_build_object('ok', false, 'motivo', 'pin_incorreto');
  END IF;

  IF v.opcao_id = p_opcao_id THEN
    RETURN jsonb_build_object('ok', true, 'opcao_id', p_opcao_id, 'trocou', false);
  END IF;

  IF NOT e.permitir_troca THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'troca_nao_permitida');
  END IF;

  UPDATE public.votos_de_enquete
     SET opcao_id = p_opcao_id, alterado_em = now(), erros = 0, travado_ate = NULL,
         nome = CASE WHEN v_nome = '' THEN public.votos_de_enquete.nome ELSE v_nome END
   WHERE id = v.id;
  RETURN jsonb_build_object('ok', true, 'opcao_id', p_opcao_id, 'trocou', true);
END;
$$;

REVOKE ALL ON FUNCTION public.votar_enquete(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.votar_enquete(text, text, text, text, text) TO anon, authenticated, service_role;

-- 4. Meu voto ------------------------------------------------------------------------
--
-- Para o aparelho lembrar: devolve a opção atual de um número, se o PIN
-- confere. { ok: true, opcao_id, nome } ou { ok: false, motivo }.

CREATE OR REPLACE FUNCTION public.meu_voto_na_enquete(p_slug text, p_telefone text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e   public.enquetes%ROWTYPE;
  v   public.votos_de_enquete%ROWTYPE;
  tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO e FROM public.enquetes WHERE slug = p_slug AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motivo', 'nao_encontrada'); END IF;
  IF e.identificar THEN
    IF (length(tel) = 12 OR length(tel) = 13) AND left(tel, 2) = '55' THEN tel := substr(tel, 3); END IF;
  ELSE
    tel := left(coalesce(p_telefone, ''), 80);
  END IF;
  SELECT * INTO v FROM public.votos_de_enquete WHERE enquete_id = e.id AND telefone = tel;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motivo', 'sem_voto'); END IF;
  IF e.identificar AND (v.pin_hash IS NULL OR v.pin_hash <> crypt(coalesce(p_pin, ''), v.pin_hash)) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'pin_incorreto');
  END IF;
  RETURN jsonb_build_object('ok', true, 'opcao_id', v.opcao_id, 'nome', v.nome);
END;
$$;

REVOKE ALL ON FUNCTION public.meu_voto_na_enquete(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.meu_voto_na_enquete(text, text, text) TO anon, authenticated, service_role;

-- 5. Resultado -----------------------------------------------------------------------
--
-- Público: contagem por opção e total. Com `identificar`, também nome e os
-- quatro últimos dígitos de quem votou (nunca o número inteiro). Se a
-- enquete não mostra o resultado e ainda está aberta, só o total sai —
-- a página de voto não vê a contagem; a de acompanhamento pede com
-- p_acompanhamento = true e vê tudo (o link é o segredo, como decidido).

CREATE OR REPLACE FUNCTION public.enquete_resultado(p_slug text, p_acompanhamento boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  e        public.enquetes%ROWTYPE;
  aberta   boolean;
  contagem jsonb;
  lista    jsonb;
  total    integer;
  ultimo   timestamptz;
BEGIN
  SELECT * INTO e FROM public.enquetes WHERE slug = p_slug AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  aberta := e.encerrada_em IS NULL AND (e.encerra_em IS NULL OR e.encerra_em > now());

  SELECT count(*), max(coalesce(alterado_em, votado_em)) INTO total, ultimo
    FROM public.votos_de_enquete WHERE enquete_id = e.id;

  IF NOT p_acompanhamento AND NOT e.mostrar_resultado AND aberta THEN
    RETURN jsonb_build_object('total', total, 'por_opcao', '{}'::jsonb, 'votantes', '[]'::jsonb, 'ultimo_voto_em', ultimo, 'oculto', true);
  END IF;

  SELECT coalesce(jsonb_object_agg(opcao_id, n), '{}'::jsonb) INTO contagem
    FROM (SELECT opcao_id, count(*) AS n FROM public.votos_de_enquete WHERE enquete_id = e.id GROUP BY opcao_id) c;

  IF e.identificar THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'nome', nome, 'fim', right(telefone, 4), 'opcao_id', opcao_id,
             'em', coalesce(alterado_em, votado_em), 'trocou', alterado_em IS NOT NULL)
             ORDER BY coalesce(alterado_em, votado_em) DESC), '[]'::jsonb)
      INTO lista
      FROM public.votos_de_enquete WHERE enquete_id = e.id;
  ELSE
    lista := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('total', total, 'por_opcao', contagem, 'votantes', lista, 'ultimo_voto_em', ultimo, 'oculto', false);
END;
$$;

REVOKE ALL ON FUNCTION public.enquete_resultado(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.enquete_resultado(text, boolean) TO anon, authenticated, service_role;

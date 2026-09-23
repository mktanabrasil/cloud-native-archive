-- Enquetes: o PIN não gravava (23/09/2026, primeiro teste real).
--
-- As funções de voto fixam `search_path = public`, mas no Supabase a extensão
-- pgcrypto mora no schema `extensions`: `crypt` e `gen_salt` não eram
-- encontrados na hora de guardar o PIN e o voto caía em "Não deu para
-- registrar". Aqui as duas funções voltam iguais, com `extensions` no
-- search_path. `enquete_resultado` não usa pgcrypto e fica como está.
--
-- Aplicar no SQL Editor do Studio. Vale de imediato, sem publicar o front.

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
SET search_path = public, extensions
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
SET search_path = public, extensions
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

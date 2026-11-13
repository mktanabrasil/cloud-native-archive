-- Calendário Anual: envio, revisão do marketing e autoria (13/11/2026).
--
-- 1. Balde privado `calendario-anual` para a foto da capa e o PDF aprovado.
--    Leem o marketing e quem está liberado no calendário; só o marketing grava.
-- 2. Autoria: quem acrescentou e quem mexeu por último em cada atividade, e
--    quem mexeu por último no tema, em cada percurso, em cada texto e em cada
--    "mês revisado". Quem grava o nome é o banco, a partir da conta de quem
--    está logado: a tela não manda nome nenhum.
--
-- O envio ao marketing não precisa de nada novo: a guarda do ano já deixa a
-- coordenadora passar de "preenchimento" para "revisão" e anota quem enviou.
--
-- Rodar no SQL Editor. Pode rodar de novo.

-- 1. Balde -------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('calendario-anual', 'calendario-anual', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS calendario_anual_arquivos_ler ON storage.objects;
CREATE POLICY calendario_anual_arquivos_ler
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'calendario-anual' AND (public.is_marketing_user(auth.uid()) OR public.eh_do_calendario()));

DROP POLICY IF EXISTS calendario_anual_arquivos_marketing ON storage.objects;
CREATE POLICY calendario_anual_arquivos_marketing
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'calendario-anual' AND public.is_marketing_user(auth.uid()))
  WITH CHECK (bucket_id = 'calendario-anual' AND public.is_marketing_user(auth.uid()));

-- 2. O nome de quem está logado -----------------------------------------------------
-- O nome dado na lista de acesso; senão, o do perfil da equipe; senão, o da conta.

CREATE OR REPLACE FUNCTION public.meu_nome_no_calendario()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(a.nome), '') FROM public.calendario_acessos a WHERE a.email = public.meu_email_no_auth()),
    (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.user_id = auth.uid()),
    (SELECT NULLIF(btrim(u.raw_user_meta_data->>'name'), '') FROM auth.users u WHERE u.id = auth.uid()),
    split_part(public.meu_email_no_auth(), '@', 1)
  );
$$;
REVOKE ALL ON FUNCTION public.meu_nome_no_calendario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meu_nome_no_calendario() TO authenticated;

-- 3. Autoria das atividades ---------------------------------------------------------

ALTER TABLE public.calendario_itens
  ADD COLUMN IF NOT EXISTS criado_por_nome text,
  ADD COLUMN IF NOT EXISTS alterado_por_nome text,
  ADD COLUMN IF NOT EXISTS alterado_em timestamptz;

CREATE OR REPLACE FUNCTION public.calendario_itens_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por := public.meu_email_no_auth();
    NEW.criado_por_nome := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.meu_nome_no_calendario() END;
    NEW.alterado_por_nome := NULL;
    NEW.alterado_em := NULL;
  END IF;
  -- Sem usuário (SQL Editor, a carga da base): passa como veio.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_marketing_user(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.tipo := 'atividade'; NEW.oculto := false; NEW.fonte := NULL;
      RETURN NEW;
    END IF;
    -- UPDATE: dia, ano e tipo não mudam; na base, só o "esconder do PDF".
    NEW.id := OLD.id; NEW.ano := OLD.ano; NEW.tipo := OLD.tipo; NEW.criado_por := OLD.criado_por; NEW.criado_em := OLD.criado_em;
    IF OLD.tipo <> 'atividade' THEN
      NEW.dia := OLD.dia; NEW.texto := OLD.texto; NEW.unidades := OLD.unidades; NEW.destaque := OLD.destaque; NEW.fonte := OLD.fonte;
      IF OLD.tipo = 'feriado' THEN NEW.oculto := false; END IF;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- A autoria não se reescreve; "mexeu por último" só quando algo mudou de fato.
    NEW.criado_por_nome := OLD.criado_por_nome;
    IF (NEW.dia, NEW.texto, NEW.unidades, NEW.destaque, NEW.oculto) IS DISTINCT FROM (OLD.dia, OLD.texto, OLD.unidades, OLD.destaque, OLD.oculto) THEN
      NEW.alterado_por_nome := public.meu_nome_no_calendario();
      NEW.alterado_em := now();
    ELSE
      NEW.alterado_por_nome := OLD.alterado_por_nome;
      NEW.alterado_em := OLD.alterado_em;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- As atividades que já existem: o nome a partir do e-mail gravado.
UPDATE public.calendario_itens i
   SET criado_por_nome = COALESCE(
         (SELECT NULLIF(btrim(a.nome), '') FROM public.calendario_acessos a WHERE a.email = i.criado_por),
         (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p JOIN auth.users u ON u.id = p.user_id WHERE lower(u.email) = i.criado_por),
         split_part(i.criado_por, '@', 1))
 WHERE i.criado_por IS NOT NULL AND i.criado_por_nome IS NULL;

-- 4. Autoria das partes do ano ------------------------------------------------------
-- { "tema": {nome, em}, "percurso:2": …, "texto:scfv": …, "revisado:2": …, "capa": … }

ALTER TABLE public.calendario_anual
  ADD COLUMN IF NOT EXISTS autoria jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.calendario_autoria(_old public.calendario_anual, _new public.calendario_anual)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  a jsonb := COALESCE(_old.autoria, '{}'::jsonb);
  marca jsonb := jsonb_build_object('nome', public.meu_nome_no_calendario(), 'em', now());
  k text;
  m int;
BEGIN
  IF _new.tema IS DISTINCT FROM _old.tema THEN a := a || jsonb_build_object('tema', marca); END IF;
  FOR m IN 1..12 LOOP
    IF (SELECT x FROM jsonb_array_elements(COALESCE(_new.percursos, '[]'::jsonb)) x WHERE (x->>'mes')::int = m LIMIT 1)
       IS DISTINCT FROM (SELECT x FROM jsonb_array_elements(COALESCE(_old.percursos, '[]'::jsonb)) x WHERE (x->>'mes')::int = m LIMIT 1) THEN
      a := a || jsonb_build_object('percurso:' || m, marca);
    END IF;
    IF (m = ANY(_new.meses_revisados)) IS DISTINCT FROM (m = ANY(_old.meses_revisados)) THEN
      a := a || jsonb_build_object('revisado:' || m, marca);
    END IF;
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(COALESCE(_new.textos, '{}'::jsonb)) UNION SELECT jsonb_object_keys(COALESCE(_old.textos, '{}'::jsonb)) LOOP
    IF _new.textos->k IS DISTINCT FROM _old.textos->k THEN a := a || jsonb_build_object('texto:' || k, marca); END IF;
  END LOOP;
  IF _new.capa_url IS DISTINCT FROM _old.capa_url THEN a := a || jsonb_build_object('capa', marca); END IF;
  RETURN a;
END;
$$;
REVOKE ALL ON FUNCTION public.calendario_autoria(public.calendario_anual, public.calendario_anual) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.calendario_anual_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.atualizado_por := public.meu_email_no_auth();
  -- Sem usuário (SQL Editor, função do servidor): passa como veio.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_marketing_user(auth.uid()) THEN
    -- A coordenadora só faz uma passagem de estado: enviar ao marketing.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'preenchimento' AND NEW.status = 'revisao' THEN
        NEW.enviado_em := now();
        NEW.enviado_por := public.meu_nome_no_calendario();
        NEW.observacao := NULL;
      ELSE
        NEW.status := OLD.status;
      END IF;
    END IF;
    NEW.ano := OLD.ano;
    NEW.capa_url := OLD.capa_url;
    NEW.aprovado_em := OLD.aprovado_em;
    NEW.aprovado_por := OLD.aprovado_por;
    NEW.pdf_url := OLD.pdf_url;
    IF NEW.status = OLD.status THEN
      NEW.observacao := OLD.observacao;
      NEW.enviado_em := OLD.enviado_em;
      NEW.enviado_por := OLD.enviado_por;
    END IF;
  END IF;
  -- A autoria é sempre calculada aqui, nunca a que a tela mandou.
  NEW.autoria := public.calendario_autoria(OLD, NEW);
  RETURN NEW;
END;
$$;

-- Conferência: o balde, as colunas novas e as políticas.
SELECT 'balde' AS item, (SELECT public::text FROM storage.buckets WHERE id = 'calendario-anual') AS valor
UNION ALL SELECT 'colunas da atividade', (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'calendario_itens' AND column_name IN ('criado_por_nome', 'alterado_por_nome', 'alterado_em'))
UNION ALL SELECT 'autoria do ano', (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'calendario_anual' AND column_name = 'autoria')
UNION ALL SELECT 'políticas do balde', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'calendario_anual_arquivos_%');

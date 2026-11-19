-- Calendário Anual como fichário digital (19/11/2026, PR 1 do fichário;
-- decisões do mockup do mesmo dia).
--
-- Depois de aprovado e impresso, o calendário continua vivo:
--   1. A gestão do Social segue mexendo SÓ no mês a mês (as atividades e o
--      "esconder do PDF" das datas). Tema, percursos, textos e "mês revisado"
--      continuam fechados: a regra do ano (pode_editar_calendario) não muda.
--   2. No fichário, cada gestão apaga e altera só as suas atividades: as que
--      ela acrescentou ou as que são só da unidade dela. As de "todas" ou de
--      mais de uma unidade, criadas por outra pessoa, só quem criou ou o
--      marketing. Antes da aprovação, nada muda.
--   3. A versão impressa fica guardada à parte (pdf_impresso_url e
--      impresso_em), na primeira aprovação. Reabrir e aprovar de novo não a
--      apaga nem a troca.
--   4. Toda mudança no mês a mês depois da impressão fica registrada em
--      calendario_alteracoes (o que entrou, saiu ou mudou, em que mês, quem e
--      quando), inclusive o que foi apagado: é dali que saem os meses
--      marcados e a lista do marketing.
--
-- Um gatilho e funções novos, à parte (as migrações não são a fonte da
-- verdade; não reescrevemos as guardas instaladas). As regras das atividades
-- são trocadas inteiras.
--
-- ORDEM: pode rodar antes ou depois do merge (o app novo funciona sem ele,
-- só sem o registro). Pode rodar de novo sem estragar nada.

-- 1. A versão impressa ---------------------------------------------------------------

ALTER TABLE public.calendario_anual
  ADD COLUMN IF NOT EXISTS pdf_impresso_url text,
  ADD COLUMN IF NOT EXISTS impresso_em timestamptz;

-- Guarda a primeira aprovação; ninguém além do marketing mexe nessas colunas.
CREATE OR REPLACE FUNCTION public.calendario_anual_impresso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_marketing_user(auth.uid()) THEN
    NEW.pdf_impresso_url := OLD.pdf_impresso_url;
    NEW.impresso_em := OLD.impresso_em;
  END IF;
  IF NEW.status = 'aprovado' AND NEW.pdf_url IS NOT NULL AND NEW.pdf_impresso_url IS NULL THEN
    NEW.pdf_impresso_url := NEW.pdf_url;
    NEW.impresso_em := COALESCE(NEW.aprovado_em, now());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.calendario_anual_impresso() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS calendario_anual_impresso ON public.calendario_anual;
CREATE TRIGGER calendario_anual_impresso BEFORE UPDATE ON public.calendario_anual
  FOR EACH ROW EXECUTE FUNCTION public.calendario_anual_impresso();

-- Um ano que já esteja aprovado quando este SQL rodar.
UPDATE public.calendario_anual
   SET pdf_impresso_url = pdf_url, impresso_em = COALESCE(aprovado_em, now())
 WHERE status = 'aprovado' AND pdf_url IS NOT NULL AND pdf_impresso_url IS NULL;

-- 2. Quem pode mexer nas atividades ---------------------------------------------------

-- A unidade da gestão que está logada, com a grafia das atividades; NULL para quem não é.
CREATE OR REPLACE FUNCTION public.minha_unidade_no_calendario()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE lower(btrim(p.unit)) WHEN 'dic' THEN 'DIC' WHEN 'nilópolis' THEN 'Nilópolis' WHEN 'santana' THEN 'Santana' END
    FROM public.profiles p
   WHERE p.user_id = auth.uid() AND p.is_active IS NOT FALSE AND p.permission_level = 'gestor_unidade'
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.status_do_calendario(_ano int)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT status FROM public.calendario_anual WHERE ano = _ano;
$$;

-- As atividades: o marketing sempre; a gestão em preenchimento e no fichário (aprovado).
CREATE OR REPLACE FUNCTION public.pode_editar_itens_do_calendario(_ano int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(auth.uid())
      OR (public.eh_do_calendario() AND public.status_do_calendario(_ano) IN ('preenchimento', 'aprovado'));
$$;

-- "As suas" no fichário: acrescentou, ou é só da unidade dela.
CREATE OR REPLACE FUNCTION public.atividade_e_minha(_criado_por text, _unidades text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_criado_por IS NOT NULL AND _criado_por = public.meu_email_no_auth())
      OR (cardinality(_unidades) = 1 AND _unidades[1] = public.minha_unidade_no_calendario());
$$;

REVOKE ALL ON FUNCTION public.minha_unidade_no_calendario() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.status_do_calendario(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_editar_itens_do_calendario(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atividade_e_minha(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_unidade_no_calendario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.status_do_calendario(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar_itens_do_calendario(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atividade_e_minha(text, text[]) TO authenticated;

DROP POLICY IF EXISTS calendario_itens_criar ON public.calendario_itens;
CREATE POLICY calendario_itens_criar ON public.calendario_itens FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_itens_do_calendario(ano));

DROP POLICY IF EXISTS calendario_itens_editar ON public.calendario_itens;
CREATE POLICY calendario_itens_editar ON public.calendario_itens FOR UPDATE TO authenticated
  USING (public.pode_editar_itens_do_calendario(ano)
         AND (public.is_marketing_user(auth.uid()) OR tipo <> 'atividade'
              OR public.status_do_calendario(ano) <> 'aprovado' OR public.atividade_e_minha(criado_por, unidades)))
  WITH CHECK (public.pode_editar_itens_do_calendario(ano));

DROP POLICY IF EXISTS calendario_itens_apagar ON public.calendario_itens;
CREATE POLICY calendario_itens_apagar ON public.calendario_itens FOR DELETE TO authenticated
  USING (public.pode_editar_itens_do_calendario(ano)
         AND (public.is_marketing_user(auth.uid())
              OR (tipo = 'atividade' AND (public.status_do_calendario(ano) <> 'aprovado' OR public.atividade_e_minha(criado_por, unidades)))));

-- 3. O registro das mudanças depois da impressão --------------------------------------

CREATE TABLE IF NOT EXISTS public.calendario_alteracoes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano       int NOT NULL REFERENCES public.calendario_anual (ano) ON DELETE CASCADE,
  mes       int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  dia       date NOT NULL,
  acao      text NOT NULL CHECK (acao IN ('entrou', 'saiu', 'mudou')),
  tipo      text NOT NULL,
  texto     text NOT NULL,
  unidades  text[] NOT NULL DEFAULT '{}',
  item_id   uuid,
  quem      text,
  em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendario_alteracoes_ano_em_idx ON public.calendario_alteracoes (ano, em);

ALTER TABLE public.calendario_alteracoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_alteracoes FROM anon, authenticated;
GRANT SELECT ON public.calendario_alteracoes TO authenticated;
GRANT ALL ON public.calendario_alteracoes TO service_role;
DROP POLICY IF EXISTS calendario_alteracoes_ler ON public.calendario_alteracoes;
CREATE POLICY calendario_alteracoes_ler ON public.calendario_alteracoes FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR public.eh_do_calendario());

-- Só depois da primeira impressão; mudar de dia conta como sair de um e entrar no outro.
CREATE OR REPLACE FUNCTION public.calendario_registrar_alteracao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  linha public.calendario_itens := COALESCE(NEW, OLD);
  quem text := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.meu_nome_no_calendario() END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.calendario_anual c WHERE c.ano = linha.ano AND c.impresso_em IS NOT NULL) THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.calendario_alteracoes (ano, mes, dia, acao, tipo, texto, unidades, item_id, quem)
    VALUES (NEW.ano, extract(month FROM NEW.dia)::int, NEW.dia, CASE WHEN NEW.oculto THEN 'saiu' ELSE 'entrou' END, NEW.tipo, NEW.texto, NEW.unidades, NEW.id, quem);
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT OLD.oculto THEN
      INSERT INTO public.calendario_alteracoes (ano, mes, dia, acao, tipo, texto, unidades, item_id, quem)
      VALUES (OLD.ano, extract(month FROM OLD.dia)::int, OLD.dia, 'saiu', OLD.tipo, OLD.texto, OLD.unidades, OLD.id, quem);
    END IF;
  ELSIF NEW.dia IS DISTINCT FROM OLD.dia THEN
    INSERT INTO public.calendario_alteracoes (ano, mes, dia, acao, tipo, texto, unidades, item_id, quem)
    VALUES (OLD.ano, extract(month FROM OLD.dia)::int, OLD.dia, 'saiu', OLD.tipo, OLD.texto, OLD.unidades, OLD.id, quem),
           (NEW.ano, extract(month FROM NEW.dia)::int, NEW.dia, 'entrou', NEW.tipo, NEW.texto, NEW.unidades, NEW.id, quem);
  ELSIF NEW.oculto IS DISTINCT FROM OLD.oculto THEN
    INSERT INTO public.calendario_alteracoes (ano, mes, dia, acao, tipo, texto, unidades, item_id, quem)
    VALUES (NEW.ano, extract(month FROM NEW.dia)::int, NEW.dia, CASE WHEN NEW.oculto THEN 'saiu' ELSE 'entrou' END, NEW.tipo, NEW.texto, NEW.unidades, NEW.id, quem);
  ELSIF (NEW.texto, NEW.unidades, NEW.destaque) IS DISTINCT FROM (OLD.texto, OLD.unidades, OLD.destaque) THEN
    INSERT INTO public.calendario_alteracoes (ano, mes, dia, acao, tipo, texto, unidades, item_id, quem)
    VALUES (NEW.ano, extract(month FROM NEW.dia)::int, NEW.dia, 'mudou', NEW.tipo, NEW.texto, NEW.unidades, NEW.id, quem);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.calendario_registrar_alteracao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS calendario_itens_registra ON public.calendario_itens;
CREATE TRIGGER calendario_itens_registra AFTER INSERT OR UPDATE OR DELETE ON public.calendario_itens
  FOR EACH ROW EXECUTE FUNCTION public.calendario_registrar_alteracao();

-- Conferência: as colunas da versão impressa, as regras das atividades, o registro e os gatilhos.
SELECT 'colunas da versão impressa' AS item, (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'calendario_anual' AND column_name IN ('pdf_impresso_url', 'impresso_em')) AS valor
UNION ALL SELECT 'regras das atividades', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendario_itens' AND policyname IN ('calendario_itens_criar', 'calendario_itens_editar', 'calendario_itens_apagar') AND (qual LIKE '%pode_editar_itens_do_calendario%' OR with_check LIKE '%pode_editar_itens_do_calendario%'))
UNION ALL SELECT 'tabela do registro', (to_regclass('public.calendario_alteracoes') IS NOT NULL)::text
UNION ALL SELECT 'gatilhos', (SELECT string_agg(tgname, ', ' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('calendario_anual_impresso', 'calendario_itens_registra'));

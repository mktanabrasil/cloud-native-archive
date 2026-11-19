-- Calendário Anual: as folhas extras do fichário (19/11/2026, PR 3 do
-- fichário; decisões do mockup do mesmo dia).
--
-- Uma folha a mais no fichário, no padrão do calendário: o cabeçalho, um
-- título, o texto que a gestão escrever (com **negrito** e "- " para lista) e,
-- se quiser, linhas para escrever à mão no resto da folha. Ela fica depois do
-- mês escolhido (ou no fim), entra no calendário inteiro nesse lugar e pode
-- ser baixada sozinha.
--
-- Quem pode: escrever, a mesma regra das atividades do mês a mês (a gestão do
-- Social em preenchimento e no fichário; o marketing sempre). Mudar e apagar,
-- só quem criou ou o marketing. A autoria quem grava é o banco.
--
-- ORDEM: pode rodar antes ou depois do merge do PR 3. Sem ela, a lista das
-- folhas extras aparece vazia e salvar avisa que não deu (as folhas só
-- aparecem para a gestão no fichário, depois da aprovação). Pode rodar de novo
-- sem estragar nada. Depende do SQL do fichário (20261120090000).

DO $$
BEGIN
  IF to_regprocedure('public.pode_editar_itens_do_calendario(integer)') IS NULL THEN
    RAISE EXCEPTION 'Rode antes o SQL 20261120090000_calendario_fichario.sql.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.calendario_folhas_extras (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano               int NOT NULL REFERENCES public.calendario_anual (ano) ON DELETE CASCADE,
  titulo            text NOT NULL,
  depois_do_mes     int,
  unidades          text[] NOT NULL DEFAULT '{}',
  texto             text NOT NULL DEFAULT '',
  pauta             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  criado_por        text,
  criado_por_nome   text,
  alterado_em       timestamptz,
  alterado_por_nome text,
  CONSTRAINT calendario_folhas_extras_titulo_check CHECK (length(btrim(titulo)) BETWEEN 1 AND 80),
  CONSTRAINT calendario_folhas_extras_mes_check CHECK (depois_do_mes IS NULL OR depois_do_mes BETWEEN 1 AND 12),
  CONSTRAINT calendario_folhas_extras_texto_check CHECK (length(texto) <= 3000),
  CONSTRAINT calendario_folhas_extras_unidades_check CHECK (unidades <@ ARRAY['DIC', 'Nilópolis', 'Santana']::text[])
);
CREATE INDEX IF NOT EXISTS calendario_folhas_extras_ano_idx ON public.calendario_folhas_extras (ano);

-- A autoria e o dono: o banco grava; quem não é do marketing não troca o dono nem o ano.
CREATE OR REPLACE FUNCTION public.calendario_folhas_extras_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_em := now();
    NEW.criado_por := public.meu_email_no_auth();
    NEW.criado_por_nome := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.meu_nome_no_calendario() END;
    NEW.alterado_em := NULL;
    NEW.alterado_por_nome := NULL;
    RETURN NEW;
  END IF;
  NEW.id := OLD.id;
  NEW.criado_em := OLD.criado_em;
  NEW.criado_por := OLD.criado_por;
  NEW.criado_por_nome := OLD.criado_por_nome;
  IF auth.uid() IS NOT NULL AND NOT public.is_marketing_user(auth.uid()) THEN NEW.ano := OLD.ano; END IF;
  IF (NEW.titulo, NEW.depois_do_mes, NEW.unidades, NEW.texto, NEW.pauta) IS DISTINCT FROM (OLD.titulo, OLD.depois_do_mes, OLD.unidades, OLD.texto, OLD.pauta) THEN
    NEW.alterado_em := now();
    NEW.alterado_por_nome := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.meu_nome_no_calendario() END;
  ELSE
    NEW.alterado_em := OLD.alterado_em;
    NEW.alterado_por_nome := OLD.alterado_por_nome;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.calendario_folhas_extras_guarda() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS calendario_folhas_extras_guarda ON public.calendario_folhas_extras;
CREATE TRIGGER calendario_folhas_extras_guarda BEFORE INSERT OR UPDATE ON public.calendario_folhas_extras
  FOR EACH ROW EXECUTE FUNCTION public.calendario_folhas_extras_guarda();

ALTER TABLE public.calendario_folhas_extras ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_folhas_extras FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_folhas_extras TO authenticated;
GRANT ALL ON public.calendario_folhas_extras TO service_role;

DROP POLICY IF EXISTS calendario_folhas_extras_ler ON public.calendario_folhas_extras;
CREATE POLICY calendario_folhas_extras_ler ON public.calendario_folhas_extras FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR public.eh_do_calendario());

DROP POLICY IF EXISTS calendario_folhas_extras_criar ON public.calendario_folhas_extras;
CREATE POLICY calendario_folhas_extras_criar ON public.calendario_folhas_extras FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_itens_do_calendario(ano));

DROP POLICY IF EXISTS calendario_folhas_extras_editar ON public.calendario_folhas_extras;
CREATE POLICY calendario_folhas_extras_editar ON public.calendario_folhas_extras FOR UPDATE TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR (public.pode_editar_itens_do_calendario(ano) AND criado_por = public.meu_email_no_auth()))
  WITH CHECK (public.is_marketing_user(auth.uid()) OR (public.pode_editar_itens_do_calendario(ano) AND criado_por = public.meu_email_no_auth()));

DROP POLICY IF EXISTS calendario_folhas_extras_apagar ON public.calendario_folhas_extras;
CREATE POLICY calendario_folhas_extras_apagar ON public.calendario_folhas_extras FOR DELETE TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR (public.pode_editar_itens_do_calendario(ano) AND criado_por = public.meu_email_no_auth()));

-- Conferência: a tabela, as quatro regras e o gatilho.
SELECT 'tabela' AS item, (to_regclass('public.calendario_folhas_extras') IS NOT NULL)::text AS valor
UNION ALL SELECT 'regras', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendario_folhas_extras')
UNION ALL SELECT 'gatilho', (SELECT tgname FROM pg_trigger WHERE tgname = 'calendario_folhas_extras_guarda');

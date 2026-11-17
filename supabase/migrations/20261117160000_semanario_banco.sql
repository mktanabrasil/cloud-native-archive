-- Semanário, PR 2 (17/11/2026): o banco.
--
-- O Semanário é o planejamento da semana de cada professora dos CEIs (e do
-- GOE), no modelo da Orientação Pedagógica. A professora preenche no app e
-- envia (até quarta); a orientadora pedagógica do CEI lê e dá a devolutiva
-- (até quinta), só com um comentário. O marketing lê todos.
--
-- Uma linha por professora e semana (a segunda-feira da semana). Quem é quem
-- vem do perfil (PR 1: vínculos "professora" e "orientacao_pedagogica", com a
-- unidade da Educação), nunca do que o navegador manda:
--   - a professora cria a dela; o banco põe a unidade e o nome dela;
--   - ela edita enquanto está em preenchimento; a avaliação das propostas
--     continua editável depois do envio (ela é escrita depois da semana);
--   - ela envia e pode desfazer o envio enquanto não houver devolutiva;
--   - a orientadora da unidade só escreve a devolutiva (do envio em diante);
--   - o marketing só lê.
--
-- Os avisos por e-mail (envio e devolutiva) vêm num PR próprio.
-- Pode rodar de novo sem estragar nada (a tabela só é criada se não existir).

-- 1. As unidades da Educação ---------------------------------------------------
-- A mesma lista de `journal_unit_of` (20261116120000) e de NEWS_UNITS
-- (src/lib/news/units.ts), pelo profileUnit. Unidade nova da Educação no
-- catálogo: acrescentar aqui também.
CREATE OR REPLACE FUNCTION public.eh_unidade_da_educacao(_unit text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT lower(btrim(coalesce(_unit, ''))) IN (
    'goe',
    'pierre weil', 'calmon', 'porto', 'são josé', 'anísio', 'capanema',
    'leonel', 'paulo freire', 'mayara masson', 'ferramola', 'vandir',
    'midori', 'eldorado', 'joão batista'
  );
$$;

-- A unidade da professora logada (ou NULL se ela não for professora ativa de um CEI/GOE).
CREATE OR REPLACE FUNCTION public.semanario_unidade_da_professora()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT btrim(p.unit) FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.is_active IS NOT FALSE
    AND p.bond_type = 'professora'
    AND public.eh_unidade_da_educacao(p.unit)
  LIMIT 1;
$$;

-- A pessoa logada é a orientadora pedagógica (ativa) desta unidade?
CREATE OR REPLACE FUNCTION public.eh_orientadora_de(_unidade text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_active IS NOT FALSE
      AND p.bond_type = 'orientacao_pedagogica'
      AND public.eh_unidade_da_educacao(p.unit)
      AND lower(btrim(p.unit)) = lower(btrim(coalesce(_unidade, '')))
  );
$$;

-- A pessoa logada é professora ativa? (desativada no Painel, deixa de mexer nos dela)
CREATE OR REPLACE FUNCTION public.semanario_sou_professora_ativa()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_active IS NOT FALSE
      AND p.bond_type = 'professora'
  );
$$;

REVOKE ALL ON FUNCTION public.semanario_sou_professora_ativa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.semanario_sou_professora_ativa() TO authenticated;
REVOKE ALL ON FUNCTION public.semanario_unidade_da_professora() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eh_orientadora_de(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eh_unidade_da_educacao(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.semanario_unidade_da_professora() TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_orientadora_de(text) TO authenticated;

-- 2. A tabela -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.semanarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professora_id     uuid NOT NULL DEFAULT auth.uid(),
  professora_nome   text NOT NULL DEFAULT '',
  unidade           text NOT NULL,
  semana            date NOT NULL,
  agrupamento       text NOT NULL DEFAULT '',
  -- {"seg": {"projeto", "proposta", "objetivo", "desenvolvimento"}, "ter": …, "sex": …}
  dias              jsonb NOT NULL DEFAULT '{}'::jsonb,
  formas_registro   text NOT NULL DEFAULT '',
  materiais         text NOT NULL DEFAULT '',
  avaliacao         text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'preenchimento',
  enviado_em        timestamptz,
  devolutiva        text,
  devolutiva_por    text,
  devolutiva_por_id uuid,
  devolutiva_em     timestamptz,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT semanarios_status_check CHECK (status IN ('preenchimento', 'enviado', 'com_devolutiva')),
  CONSTRAINT semanarios_semana_segunda CHECK (extract(isodow FROM semana) = 1),
  CONSTRAINT semanarios_semana_faixa CHECK (semana BETWEEN DATE '2026-01-01' AND DATE '2100-12-31'),
  CONSTRAINT semanarios_agrupamento_tamanho CHECK (length(agrupamento) <= 80),
  CONSTRAINT semanarios_textos_tamanho CHECK (length(formas_registro) <= 1500 AND length(materiais) <= 1500 AND length(avaliacao) <= 3000),
  CONSTRAINT semanarios_devolutiva_tamanho CHECK (devolutiva IS NULL OR length(devolutiva) <= 3000),
  CONSTRAINT semanarios_dias_objeto CHECK (jsonb_typeof(dias) = 'object'),
  CONSTRAINT semanarios_uma_por_semana UNIQUE (professora_id, semana, agrupamento)
);
CREATE INDEX IF NOT EXISTS semanarios_unidade_semana_idx ON public.semanarios (unidade, semana);
CREATE INDEX IF NOT EXISTS semanarios_professora_semana_idx ON public.semanarios (professora_id, semana DESC);

-- Os dias: só as cinco chaves, só os quatro campos, texto de até 1500 caracteres.
CREATE OR REPLACE FUNCTION public.semanario_dias_validos(_dias jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE
  d record;
  c record;
BEGIN
  IF jsonb_typeof(_dias) <> 'object' THEN RETURN false; END IF;
  FOR d IN SELECT key, value FROM jsonb_each(_dias) LOOP
    IF d.key NOT IN ('seg', 'ter', 'qua', 'qui', 'sex') OR jsonb_typeof(d.value) <> 'object' THEN RETURN false; END IF;
    FOR c IN SELECT key, value FROM jsonb_each(d.value) LOOP
      IF c.key NOT IN ('projeto', 'proposta', 'objetivo', 'desenvolvimento') OR jsonb_typeof(c.value) <> 'string' OR length(c.value #>> '{}') > 1500 THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.semanarios DROP CONSTRAINT IF EXISTS semanarios_dias_validos;
ALTER TABLE public.semanarios ADD CONSTRAINT semanarios_dias_validos CHECK (public.semanario_dias_validos(dias));

-- 3. A guarda --------------------------------------------------------------------
-- O que cada um pode mudar, decidido aqui e não na tela. Sem usuário (SQL
-- Editor, função do servidor), passa tudo.
CREATE OR REPLACE FUNCTION public.semanarios_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  minha_unidade text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    minha_unidade := public.semanario_unidade_da_professora();
    IF minha_unidade IS NULL THEN
      RAISE EXCEPTION 'Só a professora de um CEI (ou do GOE) cria um semanário.' USING ERRCODE = '42501';
    END IF;
    NEW.id := gen_random_uuid();
    NEW.professora_id := auth.uid();
    NEW.unidade := minha_unidade;
    NEW.agrupamento := btrim(coalesce(NEW.agrupamento, ''));
    NEW.professora_nome := coalesce(public.meu_nome_no_calendario(), '');
    NEW.status := 'preenchimento';
    NEW.enviado_em := NULL;
    NEW.devolutiva := NULL; NEW.devolutiva_por := NULL; NEW.devolutiva_por_id := NULL; NEW.devolutiva_em := NULL;
    NEW.criado_em := now();
    NEW.atualizado_em := now();
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.atualizado_em := now();
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- O que ninguém muda por aqui.
  NEW.id := OLD.id;
  NEW.professora_id := OLD.professora_id;
  NEW.professora_nome := OLD.professora_nome;
  NEW.unidade := OLD.unidade;
  NEW.semana := OLD.semana;
  NEW.criado_em := OLD.criado_em;

  IF auth.uid() = OLD.professora_id AND public.semanario_sou_professora_ativa() THEN
    -- A professora: a devolutiva não é dela.
    NEW.agrupamento := btrim(coalesce(NEW.agrupamento, ''));
    NEW.devolutiva := OLD.devolutiva; NEW.devolutiva_por := OLD.devolutiva_por;
    NEW.devolutiva_por_id := OLD.devolutiva_por_id; NEW.devolutiva_em := OLD.devolutiva_em;
    IF OLD.status <> 'preenchimento' THEN
      -- Enviado: só a avaliação continua aberta (ela é escrita depois da semana).
      NEW.agrupamento := OLD.agrupamento;
      NEW.dias := OLD.dias;
      NEW.formas_registro := OLD.formas_registro;
      NEW.materiais := OLD.materiais;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'preenchimento' AND NEW.status = 'enviado' THEN
        NEW.enviado_em := now();
      ELSIF OLD.status = 'enviado' AND NEW.status = 'preenchimento' AND OLD.devolutiva IS NULL THEN
        NEW.enviado_em := NULL; -- desfez o envio antes da devolutiva
      ELSE
        NEW.status := OLD.status;
      END IF;
    END IF;
    IF NEW.status = OLD.status THEN NEW.enviado_em := OLD.enviado_em; END IF;
    RETURN NEW;
  END IF;

  IF public.eh_orientadora_de(OLD.unidade) THEN
    -- A orientadora: só a devolutiva, e só depois do envio.
    NEW.agrupamento := OLD.agrupamento;
    NEW.dias := OLD.dias;
    NEW.formas_registro := OLD.formas_registro;
    NEW.materiais := OLD.materiais;
    NEW.avaliacao := OLD.avaliacao;
    NEW.enviado_em := OLD.enviado_em;
    IF OLD.status = 'preenchimento' THEN
      RAISE EXCEPTION 'A devolutiva vem depois do envio.' USING ERRCODE = '42501';
    END IF;
    NEW.devolutiva := NULLIF(btrim(coalesce(NEW.devolutiva, '')), '');
    IF NEW.devolutiva IS NULL THEN
      -- Apagou a devolutiva: volta a aguardar.
      NEW.devolutiva_por := NULL; NEW.devolutiva_por_id := NULL; NEW.devolutiva_em := NULL;
    ELSIF NEW.devolutiva IS DISTINCT FROM OLD.devolutiva THEN
      NEW.devolutiva_por := public.meu_nome_no_calendario();
      NEW.devolutiva_por_id := auth.uid();
      NEW.devolutiva_em := now();
    ELSE
      NEW.devolutiva_por := OLD.devolutiva_por; NEW.devolutiva_por_id := OLD.devolutiva_por_id; NEW.devolutiva_em := OLD.devolutiva_em;
    END IF;
    NEW.status := CASE WHEN NEW.devolutiva IS NULL THEN 'enviado' ELSE 'com_devolutiva' END;
    RETURN NEW;
  END IF;

  -- Mais ninguém escreve (a RLS já barra; isto é a segunda tranca).
  RAISE EXCEPTION 'Sem permissão para alterar este semanário.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS semanarios_guarda ON public.semanarios;
CREATE TRIGGER semanarios_guarda
  BEFORE INSERT OR UPDATE ON public.semanarios
  FOR EACH ROW EXECUTE FUNCTION public.semanarios_guarda();

-- 4. Quem lê e quem escreve (RLS) ----------------------------------------------------
ALTER TABLE public.semanarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.semanarios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semanarios TO authenticated;
GRANT ALL ON public.semanarios TO service_role;

DROP POLICY IF EXISTS semanarios_ler ON public.semanarios;
CREATE POLICY semanarios_ler ON public.semanarios FOR SELECT TO authenticated
  USING (professora_id = auth.uid() OR public.eh_orientadora_de(unidade) OR public.is_marketing_user(auth.uid()));

DROP POLICY IF EXISTS semanarios_criar ON public.semanarios;
CREATE POLICY semanarios_criar ON public.semanarios FOR INSERT TO authenticated
  WITH CHECK (public.semanario_unidade_da_professora() IS NOT NULL);

DROP POLICY IF EXISTS semanarios_editar ON public.semanarios;
CREATE POLICY semanarios_editar ON public.semanarios FOR UPDATE TO authenticated
  USING ((professora_id = auth.uid() AND public.semanario_sou_professora_ativa()) OR public.eh_orientadora_de(unidade))
  WITH CHECK ((professora_id = auth.uid() AND public.semanario_sou_professora_ativa()) OR public.eh_orientadora_de(unidade));

-- Apagar: só a professora, a própria, ainda em preenchimento.
DROP POLICY IF EXISTS semanarios_apagar ON public.semanarios;
CREATE POLICY semanarios_apagar ON public.semanarios FOR DELETE TO authenticated
  USING (professora_id = auth.uid() AND status = 'preenchimento' AND public.semanario_sou_professora_ativa());

-- Conferência: a tabela, a guarda e as quatro regras.
SELECT 'tabela semanarios' AS item, (to_regclass('public.semanarios') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'guarda', (count(*) > 0)::text FROM pg_trigger WHERE tgname = 'semanarios_guarda'
UNION ALL
SELECT 'regras (RLS)', count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'semanarios';

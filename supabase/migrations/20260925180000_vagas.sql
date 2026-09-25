-- Trabalhe Conosco, fase 1 (Parte 14 aprovada em 25/09/2026): o banco das vagas.
--
-- Hoje as vagas moram em dois widgets Elfsight e em um Google Forms por vaga.
-- A fase 1 traz as vagas para o app: o RH publica aqui e o site embute a
-- vitrine. Nenhum dado de candidato entra nesta fase: o botão "Candidatar-se"
-- continua indo para o Forms da vaga (`link_externo`) até a fase 2.
--
-- Decisões de 25/09: a vaga não tem unidade (área e cidade bastam; o RH define
-- a unidade no processo); as áreas são Social, Educação e Administração; sem
-- prazo por padrão, como hoje; quem gerencia é o vínculo "rh" do Painel ou admin.
--
-- Aplicar no SQL Editor do Studio ANTES de publicar o front.

-- 0. Quem gerencia vagas ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_rh_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT public.check_is_admin(_user_id)), false)
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND bond_type = 'rh' AND is_active = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_rh_or_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_rh_or_admin(uuid) TO authenticated, anon, service_role;

-- 1. As vagas --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vagas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,
  -- SOC-2026-031, EDU-2026-044, ADM-2026-002
  codigo             text NOT NULL UNIQUE,
  titulo             text NOT NULL,
  area               text NOT NULL,
  cidade             text NOT NULL DEFAULT 'Campinas/SP',
  modalidade         text NOT NULL DEFAULT 'presencial',
  contratacao        text NOT NULL DEFAULT 'clt',
  -- "40h semanais · tarde": texto livre, como o RH escreve hoje
  carga_horaria      text NOT NULL DEFAULT '',
  descricao          text NOT NULL DEFAULT '',
  -- listas de itens: ["Ensino Médio completo", ...]
  responsabilidades  jsonb NOT NULL DEFAULT '[]'::jsonb,
  requisitos         jsonb NOT NULL DEFAULT '[]'::jsonb,
  diferenciais       jsonb NOT NULL DEFAULT '[]'::jsonb,
  beneficios         jsonb NOT NULL DEFAULT '[]'::jsonb,
  complementares     text NOT NULL DEFAULT '',
  afirmativa_pcd     boolean NOT NULL DEFAULT false,
  aberta_pcd         boolean NOT NULL DEFAULT true,
  aprendizagem       boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'rascunho',
  publicada_em       timestamptz,
  encerrada_em       timestamptz,
  -- opcional: sem prazo, a vaga fica aberta até o RH encerrar
  prazo              timestamptz,
  -- o Forms atual; sai na fase 2
  link_externo       text,
  responsavel_id     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  versao             integer NOT NULL DEFAULT 1,
  created_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vagas_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT vagas_codigo_check CHECK (codigo ~ '^(SOC|EDU|ADM)-[0-9]{4}-[0-9]{3,}$'),
  CONSTRAINT vagas_area_check CHECK (area IN ('social', 'educacao', 'administracao')),
  CONSTRAINT vagas_modalidade_check CHECK (modalidade IN ('presencial', 'hibrido', 'remoto')),
  CONSTRAINT vagas_contratacao_check CHECK (contratacao IN ('clt', 'estagio', 'aprendiz', 'pj', 'temporario', 'voluntario')),
  CONSTRAINT vagas_status_check CHECK (status IN ('rascunho', 'revisao', 'publicada', 'pausada', 'encerrada', 'arquivada')),
  CONSTRAINT vagas_listas_check CHECK (
    jsonb_typeof(responsabilidades) = 'array' AND jsonb_typeof(requisitos) = 'array'
    AND jsonb_typeof(diferenciais) = 'array' AND jsonb_typeof(beneficios) = 'array'
  ),
  CONSTRAINT vagas_titulo_check CHECK (length(btrim(titulo)) BETWEEN 3 AND 120)
);

COMMENT ON TABLE public.vagas IS 'Vagas do Trabalhe Conosco; vitrine pública só das publicadas (fase 1, 25/09/2026).';

CREATE INDEX IF NOT EXISTS idx_vagas_status_area ON public.vagas (status, area);
CREATE INDEX IF NOT EXISTS idx_vagas_publicada_em ON public.vagas (publicada_em DESC);

ALTER TABLE public.vagas ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa vê a vaga publicada e dentro do prazo (se houver prazo).
DROP POLICY IF EXISTS vagas_select_publico ON public.vagas;
CREATE POLICY vagas_select_publico
  ON public.vagas FOR SELECT TO anon, authenticated
  USING (status = 'publicada' AND (prazo IS NULL OR prazo > now()));

-- RH e admin veem tudo, inclusive rascunho, encerrada e arquivada.
DROP POLICY IF EXISTS vagas_select_rh ON public.vagas;
CREATE POLICY vagas_select_rh
  ON public.vagas FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

DROP POLICY IF EXISTS vagas_insert_rh ON public.vagas;
CREATE POLICY vagas_insert_rh
  ON public.vagas FOR INSERT TO authenticated
  WITH CHECK (public.is_rh_or_admin(auth.uid()));

DROP POLICY IF EXISTS vagas_update_rh ON public.vagas;
CREATE POLICY vagas_update_rh
  ON public.vagas FOR UPDATE TO authenticated
  USING (public.is_rh_or_admin(auth.uid()))
  WITH CHECK (public.is_rh_or_admin(auth.uid()));

DROP POLICY IF EXISTS vagas_delete_rh ON public.vagas;
CREATE POLICY vagas_delete_rh
  ON public.vagas FOR DELETE TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

GRANT SELECT ON public.vagas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vagas TO authenticated;
GRANT ALL ON public.vagas TO service_role;

-- Toda edição: carimba a hora, soma a versão e marca publicada/encerrada.
CREATE OR REPLACE FUNCTION public.vagas_ao_gravar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.versao := OLD.versao + 1;
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.status = 'publicada' AND NEW.publicada_em IS NULL THEN
    NEW.publicada_em := now();
  END IF;
  IF NEW.status IN ('encerrada', 'arquivada') AND NEW.encerrada_em IS NULL THEN
    NEW.encerrada_em := now();
  ELSIF NEW.status NOT IN ('encerrada', 'arquivada') THEN
    NEW.encerrada_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vagas_ao_gravar ON public.vagas;
CREATE TRIGGER vagas_ao_gravar
BEFORE INSERT OR UPDATE ON public.vagas
FOR EACH ROW EXECUTE FUNCTION public.vagas_ao_gravar();

-- 2. As perguntas ----------------------------------------------------------------
--
-- vaga_id nulo = pergunta do banco, reaproveitável em qualquer vaga.

CREATE TABLE IF NOT EXISTS public.perguntas_de_vaga (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id      uuid REFERENCES public.vagas (id) ON DELETE CASCADE,
  texto        text NOT NULL,
  tipo         text NOT NULL DEFAULT 'texto_curto',
  opcoes       jsonb NOT NULL DEFAULT '[]'::jsonb,
  obrigatoria  boolean NOT NULL DEFAULT false,
  ordem        integer NOT NULL DEFAULT 0,
  -- termo sensível barrado na criação (a lista vem do app)
  bloqueada    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perguntas_de_vaga_tipo_check CHECK (tipo IN ('texto_curto', 'texto_longo', 'unica', 'multipla', 'sim_nao')),
  CONSTRAINT perguntas_de_vaga_opcoes_check CHECK (jsonb_typeof(opcoes) = 'array'),
  CONSTRAINT perguntas_de_vaga_texto_check CHECK (length(btrim(texto)) BETWEEN 3 AND 300)
);

COMMENT ON TABLE public.perguntas_de_vaga IS 'Perguntas de cada vaga e o banco reaproveitável (vaga_id nulo).';

CREATE INDEX IF NOT EXISTS idx_perguntas_de_vaga_vaga ON public.perguntas_de_vaga (vaga_id, ordem);

ALTER TABLE public.perguntas_de_vaga ENABLE ROW LEVEL SECURITY;

-- Público: só as perguntas de vaga publicada (a fase 2 mostra no formulário).
DROP POLICY IF EXISTS perguntas_de_vaga_select_publico ON public.perguntas_de_vaga;
CREATE POLICY perguntas_de_vaga_select_publico
  ON public.perguntas_de_vaga FOR SELECT TO anon, authenticated
  USING (vaga_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.vagas v
    WHERE v.id = vaga_id AND v.status = 'publicada' AND (v.prazo IS NULL OR v.prazo > now())
  ));

DROP POLICY IF EXISTS perguntas_de_vaga_select_rh ON public.perguntas_de_vaga;
CREATE POLICY perguntas_de_vaga_select_rh
  ON public.perguntas_de_vaga FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

DROP POLICY IF EXISTS perguntas_de_vaga_escrita_rh ON public.perguntas_de_vaga;
CREATE POLICY perguntas_de_vaga_escrita_rh
  ON public.perguntas_de_vaga FOR ALL TO authenticated
  USING (public.is_rh_or_admin(auth.uid()))
  WITH CHECK (public.is_rh_or_admin(auth.uid()));

GRANT SELECT ON public.perguntas_de_vaga TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perguntas_de_vaga TO authenticated;
GRANT ALL ON public.perguntas_de_vaga TO service_role;

DROP TRIGGER IF EXISTS update_perguntas_de_vaga_updated_at ON public.perguntas_de_vaga;
CREATE TRIGGER update_perguntas_de_vaga_updated_at
BEFORE UPDATE ON public.perguntas_de_vaga
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- O banco nasce com a pergunta que todo processo faz.
INSERT INTO public.perguntas_de_vaga (vaga_id, texto, tipo, opcoes, obrigatoria, ordem)
SELECT NULL, 'Como ficou sabendo da vaga?', 'unica',
  '["Site da ANA", "Instagram", "WhatsApp", "Indicação de alguém", "Outro"]'::jsonb, true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.perguntas_de_vaga WHERE vaga_id IS NULL AND texto = 'Como ficou sabendo da vaga?');

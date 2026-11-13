-- Calendário Anual dos educadores (pedido de 13/11/2026; mockup aprovado).
--
-- O PDF de todo ano (58 páginas) passa a ser preenchido no app pelas
-- coordenadoras do Social; o marketing revisa, aprova e libera o PDF final.
--
-- As coordenadoras entram com conta PRÓPRIA DO CALENDÁRIO, no mesmo esquema
-- da conta de candidato (28/09/2026): nasce com `conta: 'calendario'` nos
-- metadados e o desvio na `handle_new_user` não cria perfil, papel nem pedido
-- de acesso. Sem perfil, o banco não entrega nada da equipe (regra
-- `events_so_a_equipe_logada`, 13/11/2026). O que ela lê e grava aqui depende
-- de o e-mail estar em `calendario_acessos`, que só o marketing mexe.
--
-- Aplicar no SQL Editor ANTES de publicar o front. Pode rodar de novo.

-- 1. Quem entra -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendario_acessos (
  email      text PRIMARY KEY,
  nome       text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  criado_por text,
  CONSTRAINT calendario_acessos_email_check CHECK (email = lower(btrim(email)) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT calendario_acessos_nome_check CHECK (length(btrim(nome)) BETWEEN 1 AND 120)
);

-- 2. O calendário de um ano ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendario_anual (
  ano              int PRIMARY KEY,
  tema             text NOT NULL DEFAULT '',
  -- [{ "mes": 1..12, "tema": "...", "sugestoes": "..." }]
  percursos        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { "chave da seção": "texto" } (páginas 2 a 10 do PDF)
  textos           jsonb NOT NULL DEFAULT '{}'::jsonb,
  meses_revisados  int[] NOT NULL DEFAULT '{}',
  capa_url         text,
  status           text NOT NULL DEFAULT 'preenchimento',
  observacao       text,
  enviado_em       timestamptz,
  enviado_por      text,
  aprovado_em      timestamptz,
  aprovado_por     text,
  pdf_url          text,
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_por   text,
  CONSTRAINT calendario_anual_ano_check CHECK (ano BETWEEN 2026 AND 2100),
  CONSTRAINT calendario_anual_status_check CHECK (status IN ('preenchimento', 'revisao', 'aprovado')),
  CONSTRAINT calendario_anual_tema_check CHECK (length(tema) <= 120)
);

-- 3. O que vai em cada dia ------------------------------------------------------------
--
-- feriado e data: a base do ano (agenda do Google, datas relevantes). Só o
-- marketing cria e apaga; a coordenadora pode esconder uma data do PDF.
-- atividade: o que as coordenadoras acrescentam, com as unidades (vazio = todas).

CREATE TABLE IF NOT EXISTS public.calendario_itens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano        int NOT NULL REFERENCES public.calendario_anual (ano) ON DELETE CASCADE,
  dia        date NOT NULL,
  texto      text NOT NULL,
  tipo       text NOT NULL,
  unidades   text[] NOT NULL DEFAULT '{}',
  destaque   boolean NOT NULL DEFAULT true,
  oculto     boolean NOT NULL DEFAULT false,
  fonte      text,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  criado_por text,
  CONSTRAINT calendario_itens_tipo_check CHECK (tipo IN ('feriado', 'data', 'atividade')),
  CONSTRAINT calendario_itens_texto_check CHECK (length(btrim(texto)) BETWEEN 1 AND 120),
  CONSTRAINT calendario_itens_ano_check CHECK (extract(year FROM dia)::int = ano),
  CONSTRAINT calendario_itens_unidades_check CHECK (unidades <@ ARRAY['DIC', 'Nilópolis', 'Santana']::text[])
);
CREATE INDEX IF NOT EXISTS calendario_itens_ano_dia_idx ON public.calendario_itens (ano, dia);

-- 4. Quem é quem --------------------------------------------------------------------

-- O e-mail de quem está logado, lido do próprio Auth (não do que o navegador manda).
CREATE OR REPLACE FUNCTION public.meu_email_no_auth()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.eh_do_calendario()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.calendario_acessos a WHERE a.ativo AND a.email = public.meu_email_no_auth());
$$;

-- Pode mexer no ano: o marketing sempre; a coordenadora enquanto está em preenchimento.
CREATE OR REPLACE FUNCTION public.pode_editar_calendario(_ano int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(auth.uid())
      OR (public.eh_do_calendario() AND EXISTS (SELECT 1 FROM public.calendario_anual c WHERE c.ano = _ano AND c.status = 'preenchimento'));
$$;

REVOKE ALL ON FUNCTION public.meu_email_no_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eh_do_calendario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_editar_calendario(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meu_email_no_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_do_calendario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar_calendario(int) TO authenticated;

-- 5. Guardas: o que a coordenadora não muda nem por fora da tela -------------------------

CREATE OR REPLACE FUNCTION public.calendario_anual_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.atualizado_por := public.meu_email_no_auth();
  -- Sem usuário (SQL Editor, função do servidor) ou do marketing: passa.
  IF auth.uid() IS NULL OR public.is_marketing_user(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- A coordenadora só faz uma passagem de estado: enviar ao marketing.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'preenchimento' AND NEW.status = 'revisao' THEN
      NEW.enviado_em := now();
      NEW.enviado_por := public.meu_email_no_auth();
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
  IF NEW.status = OLD.status THEN NEW.observacao := OLD.observacao; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendario_anual_guarda ON public.calendario_anual;
CREATE TRIGGER calendario_anual_guarda BEFORE UPDATE ON public.calendario_anual
  FOR EACH ROW EXECUTE FUNCTION public.calendario_anual_guarda();

CREATE OR REPLACE FUNCTION public.calendario_itens_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.criado_por := public.meu_email_no_auth(); END IF;
  -- Sem usuário (SQL Editor, a carga da base) ou do marketing: passa.
  IF auth.uid() IS NULL OR public.is_marketing_user(auth.uid()) THEN RETURN NEW; END IF;
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendario_itens_guarda ON public.calendario_itens;
CREATE TRIGGER calendario_itens_guarda BEFORE INSERT OR UPDATE ON public.calendario_itens
  FOR EACH ROW EXECUTE FUNCTION public.calendario_itens_guarda();

-- 6. Regras ---------------------------------------------------------------------------

ALTER TABLE public.calendario_acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_anual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_itens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.calendario_acessos, public.calendario_anual, public.calendario_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_acessos, public.calendario_anual, public.calendario_itens TO authenticated;
GRANT ALL ON public.calendario_acessos, public.calendario_anual, public.calendario_itens TO service_role;

DROP POLICY IF EXISTS calendario_acessos_ler ON public.calendario_acessos;
CREATE POLICY calendario_acessos_ler ON public.calendario_acessos FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR email = public.meu_email_no_auth());
DROP POLICY IF EXISTS calendario_acessos_marketing ON public.calendario_acessos;
CREATE POLICY calendario_acessos_marketing ON public.calendario_acessos FOR ALL TO authenticated
  USING (public.is_marketing_user(auth.uid())) WITH CHECK (public.is_marketing_user(auth.uid()));

DROP POLICY IF EXISTS calendario_anual_ler ON public.calendario_anual;
CREATE POLICY calendario_anual_ler ON public.calendario_anual FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR public.eh_do_calendario());
DROP POLICY IF EXISTS calendario_anual_editar ON public.calendario_anual;
CREATE POLICY calendario_anual_editar ON public.calendario_anual FOR UPDATE TO authenticated
  USING (public.pode_editar_calendario(ano)) WITH CHECK (public.is_marketing_user(auth.uid()) OR public.eh_do_calendario());
DROP POLICY IF EXISTS calendario_anual_marketing ON public.calendario_anual;
CREATE POLICY calendario_anual_marketing ON public.calendario_anual FOR ALL TO authenticated
  USING (public.is_marketing_user(auth.uid())) WITH CHECK (public.is_marketing_user(auth.uid()));

DROP POLICY IF EXISTS calendario_itens_ler ON public.calendario_itens;
CREATE POLICY calendario_itens_ler ON public.calendario_itens FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()) OR public.eh_do_calendario());
DROP POLICY IF EXISTS calendario_itens_criar ON public.calendario_itens;
CREATE POLICY calendario_itens_criar ON public.calendario_itens FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_calendario(ano));
DROP POLICY IF EXISTS calendario_itens_editar ON public.calendario_itens;
CREATE POLICY calendario_itens_editar ON public.calendario_itens FOR UPDATE TO authenticated
  USING (public.pode_editar_calendario(ano)) WITH CHECK (public.pode_editar_calendario(ano));
DROP POLICY IF EXISTS calendario_itens_apagar ON public.calendario_itens;
CREATE POLICY calendario_itens_apagar ON public.calendario_itens FOR DELETE TO authenticated
  USING (public.pode_editar_calendario(ano) AND (tipo = 'atividade' OR public.is_marketing_user(auth.uid())));

-- 7. A conta do calendário não é equipe (desvio na handle_new_user) ----------------------
--
-- O mesmo enxerto da conta de candidato: lido da função instalada, não de uma
-- migração antiga. Sem perfil, sem papel, sem pedido de acesso no Painel.

DO $migracao$
DECLARE
  def    text;
  desvio text := $d$
    -- desvio_do_calendario (14/11/2026): conta do Calendário Anual não é equipe.
    IF NEW.raw_user_meta_data->>'conta' = 'calendario' THEN
        RETURN NEW;
    END IF;
$d$;
BEGIN
  def := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  IF position('desvio_do_calendario' IN def) > 0 THEN
    RAISE NOTICE 'handle_new_user já tem o desvio do calendário; nada a fazer.';
    RETURN;
  END IF;
  IF def !~* '\mBEGIN\M' THEN
    RAISE EXCEPTION 'Não achei o BEGIN da handle_new_user; nada foi alterado.';
  END IF;
  def := regexp_replace(def, '(\mBEGIN\M[ \t]*\r?\n)', '\1' || replace(desvio, '\', '\\'), 'i');
  EXECUTE def;
  RAISE NOTICE 'Desvio do calendário enxertado na handle_new_user.';
END
$migracao$;

-- 8. O ano de 2027, com a base ------------------------------------------------------------

INSERT INTO public.calendario_anual (ano, percursos) VALUES (2027, '[{"mes":1,"tema":"Novos começos","sugestoes":"Projeto Férias"},{"mes":2,"tema":"Cultivando o amor e o respeito","sugestoes":"Boas-vindas"},{"mes":3,"tema":"Pequenas atitudes, grandes mudanças","sugestoes":""},{"mes":4,"tema":"Gratidão","sugestoes":""},{"mes":5,"tema":"Juntos somos mais fortes","sugestoes":""},{"mes":6,"tema":"Cuidar do planeta é cuidar da vida","sugestoes":""},{"mes":7,"tema":"Projeto Férias","sugestoes":"Projeto Férias"},{"mes":8,"tema":"Sonhos que florescem","sugestoes":""},{"mes":9,"tema":"Gentileza floresce em todo tempo","sugestoes":""},{"mes":10,"tema":"Brincar é semear esperança","sugestoes":"Tarde da Alegria"},{"mes":11,"tema":"Raízes que nos sustentam","sugestoes":""},{"mes":12,"tema":"Colhendo o que plantamos","sugestoes":"Espetáculos de fim de ano"}]'::jsonb)
ON CONFLICT (ano) DO NOTHING;

INSERT INTO public.calendario_itens (ano, dia, texto, tipo, fonte)
SELECT 2027, b.dia::date, b.texto, b.tipo, b.fonte
FROM (VALUES
  ('2027-01-01', 'Ano Novo', 'feriado', 'Feriados do Brasil'),
  ('2027-01-24', 'Dia Internacional da Educação', 'data', 'Datas relevantes'),
  ('2027-02-05', 'Sexta-feira de Carnaval', 'data', 'Feriados do Brasil'),
  ('2027-02-06', 'Sábado de Carnaval', 'data', 'Feriados do Brasil'),
  ('2027-02-07', 'Domingo de Carnaval', 'data', 'Feriados do Brasil'),
  ('2027-02-08', 'Carnaval (segunda-feira)', 'feriado', 'Feriados do Brasil'),
  ('2027-02-09', 'Carnaval (terça-feira)', 'feriado', 'Feriados do Brasil'),
  ('2027-02-09', 'Dia da Internet Segura', 'data', 'Datas relevantes'),
  ('2027-02-10', 'Quarta-feira de Cinzas', 'data', 'Feriados do Brasil'),
  ('2027-02-11', 'Dia do Zelador', 'data', 'Calendário 2026'),
  ('2027-03-08', 'Dia Internacional da Mulher', 'data', 'Calendário 2026'),
  ('2027-03-15', 'Dia da Escola', 'data', 'Datas relevantes'),
  ('2027-03-21', 'Dia Mundial da Síndrome de Down', 'data', 'Datas relevantes'),
  ('2027-03-22', 'Dia Mundial da Água', 'data', 'Datas relevantes'),
  ('2027-03-26', 'Sexta-feira Santa', 'feriado', 'Feriados do Brasil'),
  ('2027-03-28', 'Páscoa', 'data', 'Feriados do Brasil'),
  ('2027-04-02', 'Dia Mundial de Conscientização do Autismo', 'data', 'Datas relevantes'),
  ('2027-04-06', 'Dia Internacional do Esporte', 'data', 'Datas relevantes'),
  ('2027-04-18', 'Dia Nacional do Livro Infantil', 'data', 'Datas relevantes'),
  ('2027-04-19', 'Dia dos Povos Indígenas', 'data', 'Datas relevantes'),
  ('2027-04-21', 'Tiradentes', 'feriado', 'Feriados do Brasil'),
  ('2027-04-22', 'Dia da Terra', 'data', 'Calendário 2026'),
  ('2027-04-23', 'Dia Mundial do Livro', 'data', 'Datas relevantes'),
  ('2027-04-28', 'Dia da Educação', 'data', 'Datas relevantes'),
  ('2027-05-01', 'Dia do Trabalho', 'feriado', 'Feriados do Brasil'),
  ('2027-05-09', 'Dia das Mães', 'data', 'Feriados do Brasil'),
  ('2027-05-10', 'Dia da Cozinheira', 'data', 'Calendário 2026'),
  ('2027-05-15', 'Dia do Assistente Social', 'data', 'Datas relevantes'),
  ('2027-05-16', 'Dia do Profissional de Limpeza', 'data', 'Calendário 2026'),
  ('2027-05-18', 'Combate ao Abuso e à Exploração Sexual de Crianças e Adolescentes', 'data', 'Datas relevantes'),
  ('2027-05-20', 'Dia do Pedagogo', 'data', 'Datas relevantes'),
  ('2027-05-25', 'Dia Nacional da Adoção', 'data', 'Datas relevantes'),
  ('2027-05-27', 'Corpus Christi', 'feriado', 'Feriados do Brasil'),
  ('2027-05-28', 'Dia do Educador e da Educadora · Dia Nacional do Brincar', 'data', 'Datas relevantes'),
  ('2027-06-05', 'Dia Mundial do Meio Ambiente', 'data', 'Datas relevantes'),
  ('2027-06-11', 'Dia Internacional do Brincar', 'data', 'Datas relevantes'),
  ('2027-06-12', 'Dia dos Namorados · Dia contra o Trabalho Infantil', 'data', 'Datas relevantes'),
  ('2027-06-21', 'Início do inverno', 'data', 'Calendário 2026'),
  ('2027-07-13', 'Aniversário do ECA', 'data', 'Datas relevantes'),
  ('2027-07-30', 'Dia contra o Tráfico de Pessoas', 'data', 'Calendário 2026'),
  ('2027-08-05', 'Renovo', 'data', 'Datas relevantes'),
  ('2027-08-08', 'Dia dos Pais', 'data', 'Feriados do Brasil'),
  ('2027-08-11', 'Dia do Estudante', 'data', 'Datas relevantes'),
  ('2027-08-12', 'Dia da Juventude', 'data', 'Calendário 2026'),
  ('2027-08-22', 'Dia do Coordenador Pedagógico', 'data', 'Datas relevantes'),
  ('2027-08-27', 'Dia do Psicólogo', 'data', 'Datas relevantes'),
  ('2027-08-28', 'Dia Nacional do Voluntariado', 'data', 'Datas relevantes'),
  ('2027-09-07', 'Independência do Brasil', 'feriado', 'Feriados do Brasil'),
  ('2027-09-08', 'Dia Internacional da Alfabetização', 'data', 'Datas relevantes'),
  ('2027-09-21', 'Dia de Luta da Pessoa com Deficiência', 'data', 'Datas relevantes'),
  ('2027-09-23', 'Dia das Línguas de Sinais · Início da primavera', 'data', 'Datas relevantes'),
  ('2027-09-30', 'Dia do Secretário', 'data', 'Calendário 2026'),
  ('2027-10-01', 'Dia da Pessoa Idosa', 'data', 'Datas relevantes'),
  ('2027-10-05', 'Dia Mundial dos Professores', 'data', 'Datas relevantes'),
  ('2027-10-12', 'Nossa Senhora Aparecida · Dia das Crianças', 'feriado', 'Feriados do Brasil'),
  ('2027-10-15', 'Dia do Professor', 'data', 'Datas relevantes'),
  ('2027-10-16', 'Dia Mundial da Alimentação', 'data', 'Datas relevantes'),
  ('2027-10-17', 'Dia de Erradicação da Pobreza', 'data', 'Datas relevantes'),
  ('2027-10-28', 'Dia do Servidor Público', 'data', 'Datas relevantes'),
  ('2027-10-29', 'Dia Nacional do Livro', 'data', 'Datas relevantes'),
  ('2027-10-31', 'Reforma Protestante', 'data', 'Calendário 2026'),
  ('2027-11-02', 'Finados', 'feriado', 'Feriados do Brasil'),
  ('2027-11-05', 'Dia contra a Violência e o Bullying na Escola', 'data', 'Datas relevantes'),
  ('2027-11-12', 'Dia do Diretor Escolar', 'data', 'Datas relevantes'),
  ('2027-11-15', 'Proclamação da República', 'feriado', 'Feriados do Brasil'),
  ('2027-11-18', 'Dia do Conselheiro Tutelar', 'data', 'Datas relevantes'),
  ('2027-11-19', 'Dia do Educador Social · Dia da Bandeira', 'data', 'Datas relevantes'),
  ('2027-11-20', 'Consciência Negra', 'feriado', 'Feriados do Brasil'),
  ('2027-11-25', 'Dia de Ação de Graças', 'data', 'Calendário 2026'),
  ('2027-12-05', 'Dia do Voluntário', 'data', 'Datas relevantes'),
  ('2027-12-08', 'Nossa Senhora da Conceição (Campinas)', 'feriado', 'Feriado de Campinas'),
  ('2027-12-10', 'Direitos Humanos', 'data', 'Calendário 2026'),
  ('2027-12-21', 'Início do verão', 'data', 'Calendário 2026'),
  ('2027-12-24', 'Noite de Natal', 'data', 'Feriados do Brasil'),
  ('2027-12-25', 'Natal', 'feriado', 'Feriados do Brasil')
) AS b(dia, texto, tipo, fonte)
WHERE NOT EXISTS (SELECT 1 FROM public.calendario_itens i WHERE i.ano = 2027 AND i.tipo IN ('feriado', 'data'));

-- Conferência: o ano, quantos itens de base, e o desvio.
SELECT 'ano 2027' AS item, (SELECT status FROM public.calendario_anual WHERE ano = 2027) AS valor
UNION ALL
SELECT 'feriados e datas', (SELECT count(*)::text FROM public.calendario_itens WHERE ano = 2027 AND tipo IN ('feriado', 'data'))
UNION ALL
SELECT 'desvio', (position('desvio_do_calendario' IN pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0)::text;

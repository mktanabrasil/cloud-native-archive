-- Administração › Voluntariado (18/11/2026, setor Administração, PR 4).
--
-- O Voluntariado dos eventos do dia a dia (o do Natal Feliz continua no
-- Marketing, com o formulário e a planilha dele). Quem cuida: o vínculo novo
-- "voluntariado" (pré-cadastrado no Painel) e o marketing.
--   - Eventos: os voluntários que as unidades indicaram no formulário
--     (`events.equipe_voluntarios`, PR 2), com o WhatsApp e o status:
--     confirmado ou a confirmar. O cadastro em si é feito em outra
--     plataforma; aqui é só o controle (pedido de 18/11).
--   - Voluntários: todos os que já apareceram nos eventos, com o status e os
--     eventos de cada um. Quem foi confirmado aparece confirmado nos próximos
--     eventos (mesmo nome e WhatsApp).
--
-- RODAR ANTES DO MERGE: o Painel passa a oferecer o vínculo "Voluntariado", e
-- sem a regra nova o banco recusa salvar a pessoa.
-- Pode rodar de novo sem estragar nada.

-- 1. O vínculo novo ----------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bond_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bond_type_check
  CHECK (bond_type IS NULL OR bond_type IN (
    'rh','financeiro','marketing','nota_fiscal','voluntariado',
    'gestao_social','educador',
    'orientacao_pedagogica','professora',
    'parceiro','usuario_comum'
  ));

-- Quem cuida do voluntariado: vínculo ativo, ou o marketing (que inclui o admin).
CREATE OR REPLACE FUNCTION public.eh_do_voluntariado(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_marketing_user(_uid) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _uid AND p.bond_type = 'voluntariado' AND p.is_active IS NOT FALSE
  );
$$;
REVOKE ALL ON FUNCTION public.eh_do_voluntariado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eh_do_voluntariado(uuid) TO authenticated;

-- 2. As confirmações ---------------------------------------------------------------------
-- O cadastro de verdade é feito em outra plataforma; aqui fica só o controle:
-- quem já foi confirmado. A pessoa é reconhecida pelo nome e pelo WhatsApp
-- (dois irmãos com o número da mãe são duas pessoas). O nome é comparado sem
-- acento, maiúscula nem espaço sobrando (`nome_chave`, preenchido pelo banco).
CREATE OR REPLACE FUNCTION public.voluntario_nome_chave(_nome text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT translate(lower(btrim(regexp_replace(normalize(coalesce(_nome, ''), NFC), '[[:space:]]+', ' ', 'g'))),
                   'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;

CREATE TABLE IF NOT EXISTS public.voluntarios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  nome_chave         text NOT NULL DEFAULT '',
  whatsapp           text NOT NULL,
  primeiro_evento_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  criado_por         uuid DEFAULT auth.uid(),
  criado_por_nome    text,
  CONSTRAINT voluntarios_nome_tamanho CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  CONSTRAINT voluntarios_whatsapp_formato CHECK (whatsapp ~ '^[0-9]{10,11}$'),
  CONSTRAINT voluntarios_pessoa_unica UNIQUE (whatsapp, nome_chave)
);
COMMENT ON TABLE public.voluntarios IS 'Voluntários dos eventos já confirmados (o cadastro é feito em outra plataforma). criado_* = quem confirmou e quando.';

-- Quem confirmou é o banco que diz (o nome do perfil de quem está logado).
CREATE OR REPLACE FUNCTION public.voluntarios_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.nome := btrim(regexp_replace(NEW.nome, '[[:space:]]+', ' ', 'g'));
  NEW.nome_chave := public.voluntario_nome_chave(NEW.nome);
  IF TG_OP = 'INSERT' THEN
    NEW.criado_em := now();
    IF auth.uid() IS NOT NULL THEN
      NEW.criado_por := auth.uid();
      NEW.criado_por_nome := public.meu_nome_no_calendario();
    END IF;
  ELSE
    NEW.criado_em := OLD.criado_em; NEW.criado_por := OLD.criado_por; NEW.criado_por_nome := OLD.criado_por_nome;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS voluntarios_guarda ON public.voluntarios;
CREATE TRIGGER voluntarios_guarda BEFORE INSERT OR UPDATE ON public.voluntarios
  FOR EACH ROW EXECUTE FUNCTION public.voluntarios_guarda();

ALTER TABLE public.voluntarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voluntarios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voluntarios TO authenticated;
GRANT ALL ON public.voluntarios TO service_role;
DROP POLICY IF EXISTS voluntarios_do_voluntariado ON public.voluntarios;
CREATE POLICY voluntarios_do_voluntariado ON public.voluntarios FOR ALL TO authenticated
  USING (public.eh_do_voluntariado(auth.uid()))
  WITH CHECK (public.eh_do_voluntariado(auth.uid()));

-- 3. Os voluntários indicados nos eventos ----------------------------------------------
-- Confirmados e concluídos, fora da lixeira, com voluntários, no período
-- (sem período: todos, para o histórico de cada voluntário).
CREATE OR REPLACE FUNCTION public.voluntariado_eventos(_de timestamptz DEFAULT NULL, _ate timestamptz DEFAULT NULL)
RETURNS TABLE (
  id uuid, title text, unit text, location text, start_datetime timestamptz, end_datetime timestamptz, status text, equipe_voluntarios jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.eh_do_voluntariado(auth.uid()) THEN
    RAISE EXCEPTION 'Só o Voluntariado vê os voluntários dos eventos.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.title::text, e.unit::text, e.location::text, e.start_datetime, e.end_datetime, e.status::text, e.equipe_voluntarios
      FROM public.events e
     WHERE e.deleted_at IS NULL
       AND e.status IN ('confirmado', 'concluido')
       AND jsonb_array_length(e.equipe_voluntarios) > 0
       AND (_ate IS NULL OR e.start_datetime < _ate)
       AND (_de IS NULL OR coalesce(e.end_datetime, e.start_datetime) >= _de)
     ORDER BY e.start_datetime;
END;
$$;
REVOKE ALL ON FUNCTION public.voluntariado_eventos(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voluntariado_eventos(timestamptz, timestamptz) TO authenticated;

-- Conferência: o vínculo na regra, a tabela, as funções.
SELECT 'vínculo voluntariado' AS item, (pg_get_constraintdef(oid) LIKE '%voluntariado%')::text AS valor
  FROM pg_constraint WHERE conname = 'profiles_bond_type_check'
UNION ALL
SELECT 'tabela voluntarios', (to_regclass('public.voluntarios') IS NOT NULL)::text
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc WHERE proname IN ('eh_do_voluntariado', 'voluntariado_eventos');

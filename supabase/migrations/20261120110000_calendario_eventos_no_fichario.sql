-- Calendário Anual: os eventos confirmados entram sozinhos no fichário
-- (19/11/2026, PR 4 do fichário; decisões do mockup do mesmo dia).
--
-- Depois que o calendário do ano foi aprovado e impresso, cada evento do
-- formulário que fica CONFIRMADO entra no mês a mês, como atividade:
--   - das unidades DIC, Nilópolis e Santana (com a sigla delas) e do Grupo
--     ANA Brasil (como TODAS); os da Administração ficam fora;
--   - públicos e internos; só o nome (sem horário);
--   - em todos os dias do evento (de vários dias, aparece em cada um).
-- O fichário acompanha o evento: mudou de data, muda de dia; mudou o nome ou
-- a unidade, muda no dia; cancelado, na lixeira ou apagado, sai. Pendente e
-- rascunho não entram. Cada uma dessas mudanças vai para o registro do que
-- mudou depois da impressão, como "Formulário de eventos".
--
-- No mês a mês ninguém da gestão mexe nessas atividades (só pelo evento).
-- Os eventos confirmados ANTES da impressão não entram sozinhos: eles já
-- estavam no calendário que as unidades preencheram.
--
-- Uma falha aqui nunca impede confirmar, mudar ou cancelar o evento: o erro
-- vira um aviso no log do banco.
--
-- ORDEM: pode rodar antes ou depois do merge do PR 4. Depende do SQL do
-- fichário (20261120090000). Pode rodar de novo sem estragar nada.

DO $$
BEGIN
  IF to_regclass('public.calendario_alteracoes') IS NULL THEN
    RAISE EXCEPTION 'Rode antes o SQL 20261120090000_calendario_fichario.sql.';
  END IF;
END $$;

-- 1. A atividade sabe de que evento veio.
ALTER TABLE public.calendario_itens ADD COLUMN IF NOT EXISTS evento_id uuid;
CREATE INDEX IF NOT EXISTS calendario_itens_evento_idx ON public.calendario_itens (evento_id) WHERE evento_id IS NOT NULL;

-- 2. A gestão não muda nem apaga a atividade que veio de um evento (o evento manda).
DROP POLICY IF EXISTS calendario_itens_editar ON public.calendario_itens;
CREATE POLICY calendario_itens_editar ON public.calendario_itens FOR UPDATE TO authenticated
  USING (public.pode_editar_itens_do_calendario(ano)
         AND (public.is_marketing_user(auth.uid())
              OR (evento_id IS NULL AND (tipo <> 'atividade' OR public.status_do_calendario(ano) <> 'aprovado' OR public.atividade_e_minha(criado_por, unidades)))))
  WITH CHECK (public.pode_editar_itens_do_calendario(ano)
         AND (public.is_marketing_user(auth.uid())
              OR (evento_id IS NULL AND (tipo <> 'atividade' OR public.status_do_calendario(ano) <> 'aprovado' OR public.atividade_e_minha(criado_por, unidades)))));

DROP POLICY IF EXISTS calendario_itens_apagar ON public.calendario_itens;
CREATE POLICY calendario_itens_apagar ON public.calendario_itens FOR DELETE TO authenticated
  USING (public.pode_editar_itens_do_calendario(ano)
         AND (public.is_marketing_user(auth.uid())
              OR (evento_id IS NULL AND tipo = 'atividade' AND (public.status_do_calendario(ano) <> 'aprovado' OR public.atividade_e_minha(criado_por, unidades)))));

-- 3. Pôr o fichário igual ao evento.
CREATE OR REPLACE FUNCTION public.calendario_sincronizar_evento(_id uuid, _apagado boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  e public.events;
  entra boolean;
  titulo text;
  das_unidades text[];
  inicio date;
  fim date;
  dias date[] := '{}';
  sub_antes text := current_setting('request.jwt.claim.sub', true);
  claims_antes text := current_setting('request.jwt.claims', true);
  mexidos uuid[];
BEGIN
  BEGIN
    IF NOT _apagado THEN SELECT * INTO e FROM public.events WHERE id = _id; END IF;
    entra := NOT _apagado AND e.id IS NOT NULL AND e.status = 'confirmado' AND e.deleted_at IS NULL
             AND e.unit IN ('DIC', 'Nilópolis', 'Santana', 'Grupo ANA Brasil') AND e.start_datetime IS NOT NULL;
    IF entra THEN
      titulo := left(btrim(regexp_replace(regexp_replace(coalesce(e.title, ''), '<br\s*/?>', ' ', 'gi'), '\s+', ' ', 'g')), 120);
      das_unidades := CASE WHEN e.unit = 'Grupo ANA Brasil' THEN '{}'::text[] ELSE ARRAY[e.unit] END;
      inicio := (e.start_datetime AT TIME ZONE 'America/Sao_Paulo')::date;
      -- O fim conta até o último segundo (termina à meia-noite = o dia de antes); no máximo 62 dias.
      fim := least(greatest(coalesce(((e.end_datetime - interval '1 second') AT TIME ZONE 'America/Sao_Paulo')::date, inicio), inicio), inicio + 61);
      IF titulo <> '' THEN
        SELECT coalesce(array_agg(g::date ORDER BY g), '{}') INTO dias
          FROM generate_series(inicio, fim, interval '1 day') g
         WHERE EXISTS (SELECT 1 FROM public.calendario_anual c WHERE c.ano = extract(year FROM g)::int AND c.impresso_em IS NOT NULL);
      END IF;
    END IF;

    -- Sem usuário enquanto mexe no calendário: as guardas das atividades deixam
    -- o banco gravar como veio, e quem confirmou não vira "dono" da atividade.
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);

    WITH fora AS (
      DELETE FROM public.calendario_itens i
       WHERE i.evento_id = _id AND NOT (i.dia = ANY (dias))
         AND EXISTS (SELECT 1 FROM public.calendario_anual c WHERE c.ano = i.ano AND c.impresso_em IS NOT NULL)
      RETURNING i.id
    ), mudou AS (
      UPDATE public.calendario_itens i SET texto = titulo, unidades = das_unidades
       WHERE i.evento_id = _id AND i.dia = ANY (dias) AND (i.texto, i.unidades) IS DISTINCT FROM (titulo, das_unidades)
      RETURNING i.id
    ), novos AS (
      INSERT INTO public.calendario_itens (ano, dia, texto, tipo, unidades, destaque, oculto, fonte, evento_id)
      SELECT extract(year FROM d)::int, d, titulo, 'atividade', das_unidades, true, false, 'Formulário de eventos', _id
        FROM unnest(dias) d
       WHERE NOT EXISTS (SELECT 1 FROM public.calendario_itens i WHERE i.evento_id = _id AND i.dia = d)
      RETURNING id
    )
    SELECT array_agg(id) INTO mexidos FROM (SELECT id FROM fora UNION ALL SELECT id FROM mudou UNION ALL SELECT id FROM novos) x;

    -- No registro, quem mexeu foi o formulário de eventos.
    IF mexidos IS NOT NULL THEN
      UPDATE public.calendario_alteracoes SET quem = 'Formulário de eventos'
       WHERE item_id = ANY (mexidos) AND quem IS NULL AND em >= now();
    END IF;

    PERFORM set_config('request.jwt.claim.sub', coalesce(sub_antes, ''), true);
    PERFORM set_config('request.jwt.claims', coalesce(claims_antes, ''), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub', coalesce(sub_antes, ''), true);
    PERFORM set_config('request.jwt.claims', coalesce(claims_antes, ''), true);
    RAISE WARNING 'calendário: não deu para pôr o evento % no fichário: %', _id, SQLERRM;
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.calendario_sincronizar_evento(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.events_no_fichario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calendario_sincronizar_evento(OLD.id, true);
    RETURN OLD;
  END IF;
  PERFORM public.calendario_sincronizar_evento(NEW.id, false);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.events_no_fichario() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_no_fichario ON public.events;
CREATE TRIGGER events_no_fichario
  AFTER INSERT OR DELETE OR UPDATE OF status, deleted_at, start_datetime, end_datetime, title, unit ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_no_fichario();

-- Conferência: a coluna nova, as regras e o gatilho.
SELECT 'coluna evento_id' AS item, (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'calendario_itens' AND column_name = 'evento_id') AS valor
UNION ALL SELECT 'regras com evento_id', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendario_itens' AND qual LIKE '%evento_id%')
UNION ALL SELECT 'gatilho', (SELECT tgname FROM pg_trigger WHERE tgname = 'events_no_fichario');

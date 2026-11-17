-- Semanário, PR 7 (17/11/2026): o pedido de acesso como Professora.
--
-- No "Solicitar acesso", a professora escolhe "Professora (Educação)" e o
-- CEI (ou o GOE). O pedido chega ao Painel, para o marketing, e ao Semanário
-- da orientadora pedagógica daquele CEI. Quem chegar primeiro aprova ou
-- recusa. Aprovar grava o vínculo "professora", o nível "usuário padrão" e a
-- unidade (função admin-approve-user, que lê tudo do pedido, nunca do
-- navegador).
--
-- A `handle_new_user` NÃO muda: o vínculo pedido é lido dos metadados da
-- conta por um gatilho próprio em `access_requests`.
-- Pode rodar de novo sem estragar nada.

-- 1. O vínculo pedido ----------------------------------------------------------------
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS requested_bond text;

-- No pedido novo, vem dos metadados do cadastro (só "professora", e só com
-- unidade da Educação). Pedido de professora é sempre de visualizador: o
-- gatilho antigo de aprovação (handle_access_request_approval) lê o papel
-- pedido, e um "admin" escrito à mão nos metadados não pode chegar até ele.
-- Depois, ninguém muda o vínculo pelo app.
CREATE OR REPLACE FUNCTION public.access_requests_vinculo_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  pedido text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT u.raw_user_meta_data->>'requested_bond' INTO pedido FROM auth.users u WHERE u.id = NEW.user_id;
    NEW.requested_bond := CASE
      WHEN pedido = 'professora' AND public.eh_unidade_da_educacao(NEW.requested_unit) THEN 'professora'
      ELSE NULL
    END;
  ELSIF auth.uid() IS NOT NULL THEN
    NEW.requested_bond := OLD.requested_bond;
  END IF;
  IF NEW.requested_bond = 'professora' THEN
    NEW.requested_role := 'viewer';
    NEW.requested_permission_level := 'visualizador';
    IF TG_OP = 'UPDATE' THEN NEW.requested_unit := OLD.requested_unit; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS access_requests_vinculo_pedido ON public.access_requests;
CREATE TRIGGER access_requests_vinculo_pedido
  BEFORE INSERT OR UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.access_requests_vinculo_pedido();

-- 2. O que a orientadora vê e faz --------------------------------------------------------
-- Os pedidos de professora pendentes do CEI dela (as regras de leitura de
-- access_requests continuam as de antes; isto é uma janela estreita).
CREATE OR REPLACE FUNCTION public.semanario_pedidos_de_professora()
RETURNS TABLE (id uuid, user_id uuid, name text, email text, requested_unit text, requested_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.user_id, r.name, r.email, r.requested_unit, r.requested_at
  FROM public.access_requests r
  WHERE r.status = 'pending'
    AND r.requested_bond = 'professora'
    AND public.eh_orientadora_de(r.requested_unit)
  ORDER BY r.requested_at;
$$;

-- Recusar um pedido de professora do CEI dela. Devolve false se não era dela,
-- ou se alguém já resolveu.
CREATE OR REPLACE FUNCTION public.semanario_recusar_pedido(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.access_requests r
     SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
   WHERE r.id = _id
     AND r.status = 'pending'
     AND r.requested_bond = 'professora'
     AND public.eh_orientadora_de(r.requested_unit);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.semanario_pedidos_de_professora() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.semanario_recusar_pedido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.semanario_pedidos_de_professora() TO authenticated;
GRANT EXECUTE ON FUNCTION public.semanario_recusar_pedido(uuid) TO authenticated;

-- Conferência: a coluna, o gatilho e as duas funções.
SELECT 'coluna requested_bond' AS item, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'access_requests' AND column_name = 'requested_bond'
)::text AS valor
UNION ALL
SELECT 'gatilho', (count(*) > 0)::text FROM pg_trigger WHERE tgname = 'access_requests_vinculo_pedido'
UNION ALL
SELECT 'funções', count(*)::text FROM pg_proc WHERE proname IN ('semanario_pedidos_de_professora', 'semanario_recusar_pedido');

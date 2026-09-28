-- Trabalhe Conosco, fase 2, PR 6: a conta do candidato (28/09/2026).
--
-- O candidato cria conta em /vagas/criar-conta com o mesmo Supabase Auth da
-- equipe. Sem cuidado, isso o faria virar "equipe": a `handle_new_user` cria
-- perfil, papel e um pedido de acesso pendente para toda conta nova, e cada
-- candidato apareceria no Painel pedindo para entrar no app.
--
-- Aqui:
--   1. a tabela `candidatos` (nome, e-mail, aceite dos termos);
--   2. a `handle_new_user` ganha, logo no começo, um desvio: conta marcada
--      com `conta = 'candidato'` nos metadados vai só para `candidatos` e sai,
--      sem perfil, sem papel e sem pedido de acesso.
--
-- O desvio é enxertado na função QUE ESTÁ INSTALADA, lida do próprio banco
-- (pg_get_functiondef), e não reescrito a partir de uma migração antiga: as
-- migrações deste repositório não são a fonte da verdade. Rodar duas vezes
-- não duplica (o marcador `desvio_do_candidato` é conferido antes).
--
-- Aplicar no SQL Editor do Studio ANTES de publicar o front.

-- 1. Candidatos ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.candidatos (
  user_id               uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  email                 text NOT NULL,
  -- quando e qual versão dos Termos e do Aviso de Privacidade a pessoa aceitou
  aceite_termos_em      timestamptz,
  aceite_termos_versao  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidatos_nome_check CHECK (length(btrim(nome)) BETWEEN 1 AND 120)
);

COMMENT ON TABLE public.candidatos IS 'Contas de candidato do Trabalhe Conosco; não são equipe (28/09/2026).';

ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;

-- O candidato vê e edita só a própria linha.
DROP POLICY IF EXISTS candidatos_select_proprio ON public.candidatos;
CREATE POLICY candidatos_select_proprio
  ON public.candidatos FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Reserva: se o gatilho não criou a linha, o próprio app cria no primeiro acesso.
DROP POLICY IF EXISTS candidatos_insert_proprio ON public.candidatos;
CREATE POLICY candidatos_insert_proprio
  ON public.candidatos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS candidatos_update_proprio ON public.candidatos;
CREATE POLICY candidatos_update_proprio
  ON public.candidatos FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RH e admin leem todos (a ficha do candidato vem no PR 10).
DROP POLICY IF EXISTS candidatos_select_rh ON public.candidatos;
CREATE POLICY candidatos_select_rh
  ON public.candidatos FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.candidatos TO authenticated;
GRANT ALL ON public.candidatos TO service_role;

DROP TRIGGER IF EXISTS update_candidatos_updated_at ON public.candidatos;
CREATE TRIGGER update_candidatos_updated_at
BEFORE UPDATE ON public.candidatos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. O desvio na handle_new_user -------------------------------------------------

DO $migracao$
DECLARE
  def    text;
  desvio text := $d$
    -- desvio_do_candidato (28/09/2026): conta do Trabalhe Conosco não é equipe.
    -- Vai só para `candidatos`; sem perfil, sem papel, sem pedido de acesso.
    IF NEW.raw_user_meta_data->>'conta' = 'candidato' THEN
        INSERT INTO public.candidatos (user_id, nome, email)
        VALUES (
            NEW.id,
            LEFT(COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)), 120),
            NEW.email
        )
        ON CONFLICT (user_id) DO NOTHING;
        RETURN NEW;
    END IF;
$d$;
BEGIN
  def := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  IF position('desvio_do_candidato' IN def) > 0 THEN
    RAISE NOTICE 'handle_new_user já tem o desvio do candidato; nada a fazer.';
    RETURN;
  END IF;
  -- Logo depois do primeiro BEGIN do corpo (o do DECLARE vem antes e não tem BEGIN).
  IF def !~* '\mBEGIN\M' THEN
    RAISE EXCEPTION 'Não achei o BEGIN da handle_new_user; nada foi alterado.';
  END IF;
  def := regexp_replace(def, '(\mBEGIN\M[ \t]*\r?\n)', '\1' || replace(desvio, '\', '\\'), 'i');
  EXECUTE def;
  RAISE NOTICE 'Desvio do candidato enxertado na handle_new_user.';
END
$migracao$;

-- Para conferir depois de rodar (deve voltar true):
-- SELECT position('desvio_do_candidato' IN pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0;

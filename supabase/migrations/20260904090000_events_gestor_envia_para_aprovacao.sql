-- Gestora envia para aprovação; admin geral completa e confirma.
--
-- Até aqui a única política de INSERT/UPDATE em `events` era
-- `events_admin_all`. A tela mostrava "Nova Programação" para gestores de
-- unidade e para "Eventos e Parceiros" (`canCreate`), mas o banco recusava:
-- "new row violates row-level security policy". Confirmado em 03/09/2026.
--
-- O modelo acordado em 03/09/2026:
--   1. A gestora preenche o que é da unidade e ENVIA. O evento nasce
--      `pendente` e `interno`, na unidade dela. Só isso o banco aceita dela.
--   2. O admin geral vê a lista de pendentes, completa o que só ele preenche
--      (slug, "onde este evento deve aparecer?") e CONFIRMA — ou DEVOLVE com
--      uma observação.
--   3. Depois de confirmado, a gestora não altera mais: mudar de novo é
--      pedir de novo (o admin pode voltar para pendente).
--
-- Quatro colunas novas registram o pedido: quando foi enviado, quem revisou,
-- quando, e a observação da devolução. `created_by` (texto, nome do perfil)
-- continua sendo "quem pediu".

-- 1. Colunas do pedido -------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by  text,
  ADD COLUMN IF NOT EXISTS review_note  text;

COMMENT ON COLUMN public.events.submitted_at IS 'Quando a unidade enviou para aprovação. Nulo = criado direto pelo admin.';
COMMENT ON COLUMN public.events.reviewed_at  IS 'Quando o admin geral confirmou ou devolveu.';
COMMENT ON COLUMN public.events.reviewed_by  IS 'Nome do admin que revisou (texto, como created_by).';
COMMENT ON COLUMN public.events.review_note  IS 'Observação da devolução, para a unidade ler.';

-- 2. Gestor grava na própria unidade, sempre como pendente e interno ----------

DROP POLICY IF EXISTS events_gestor_insert ON public.events;
CREATE POLICY events_gestor_insert
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_unit_access(unit)
    AND status = 'pendente'
    AND visibility = 'interno'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_active
    )
  );

-- 3. Gestor edita o que ainda não foi confirmado, sem publicar ---------------
--
-- USING: só linhas da própria unidade que ainda não estão confirmadas.
-- WITH CHECK: a linha continua na unidade dela, interna, e não vira
-- confirmada pelas mãos dela. Cancelar o próprio pedido é permitido.

DROP POLICY IF EXISTS events_gestor_update ON public.events;
CREATE POLICY events_gestor_update
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    public.has_unit_access(unit)
    AND status <> 'confirmado'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    public.has_unit_access(unit)
    AND status IN ('pendente', 'cancelado')
    AND visibility = 'interno'
  );

-- `events_admin_all` continua valendo para o admin geral: ele confirma,
-- publica, devolve e apaga. Nada aqui a toca.

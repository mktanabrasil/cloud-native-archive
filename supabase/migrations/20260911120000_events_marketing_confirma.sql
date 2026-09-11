-- A comunicação (vínculo "marketing") ganha sobre eventos o mesmo poder do admin.
--
-- Desde o PR #105 (10/09/2026) o front cria o evento já `confirmado` para
-- quem é admin ou marketing, e o painel "Aprovações pendentes" deixa o
-- marketing aprovar. Só que no banco a única política que aceita gravar
-- `confirmado` era `events_admin_all`, com `check_is_admin`. Um vínculo
-- marketing sem `admin_geral` receberia "permissão negada" ao criar ou
-- aprovar. Hoje (11/09/2026) as duas contas de marketing também são admin,
-- por isso ainda não quebrou — o próximo cadastro quebraria.
--
-- `public.is_marketing_user(uuid)` já existe (30/07/2026) e é exatamente o
-- predicado que o front chama de `isMarketing`: admin OU perfil ativo com
-- `bond_type = 'marketing'`. Os jornais já são gravados por ela. Aqui ela
-- passa a valer também para `events`, como uma política irmã da do admin.
--
-- Decisão de 11/09/2026: "marketing confirma de verdade".
--
-- Aplicar no SQL Editor do Supabase próprio (supabase.anabrasil.org) ANTES
-- de publicar o front — o front não muda de comportamento, só deixa de
-- prometer o que o banco recusaria.

DROP POLICY IF EXISTS events_marketing_all ON public.events;
CREATE POLICY events_marketing_all
  ON public.events
  FOR ALL
  TO authenticated
  USING (public.is_marketing_user(auth.uid()))
  WITH CHECK (public.is_marketing_user(auth.uid()));

-- As políticas do gestor (`events_gestor_insert`, `events_gestor_update`) e a
-- do admin (`events_admin_all`) continuam como estão. Políticas permissivas
-- somam: quem cai em qualquer uma passa.

-- Eventos: o "Concluído" público continua no site (13/11/2026).
--
-- O formulário promete que um evento concluído é "mantido no histórico", mas
-- a regra de leitura do visitante só aceitava `confirmado`: ao concluir, o
-- evento sumia de "Já aconteceram" e o link compartilhado passava a dizer
-- "não está mais disponível". Esta regra soma o concluído público, só leitura.
-- As colunas continuam as da vitrine (20261113180000).
--
-- Pode rodar de novo sem estragar nada.

DROP POLICY IF EXISTS events_concluidos_publicos ON public.events;
CREATE POLICY events_concluidos_publicos
  ON public.events FOR SELECT TO anon
  USING (status = 'concluido' AND visibility = 'publico' AND deleted_at IS NULL);

-- Conferência: uma linha, anon · SELECT.
SELECT policyname, array_to_string(roles, ',') AS papeis, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_concluidos_publicos';

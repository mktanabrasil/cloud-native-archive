-- Limites de texto em `events`.
--
-- Nenhuma coluna tinha CHECK: um título de 2.000 caracteres entrava, e
-- quebrava o banner público e o card. Os números são os mesmos de
-- `src/lib/events/limites.ts` — o formulário avisa antes, o banco garante.
--
-- Medido em 04/09/2026, antes de aplicar: maior título 87, maior localização
-- 21, maior descrição 574. Nenhuma linha viola; o CHECK entra validado.
--
-- Os nomes das constraints são lidos por `mensagemDeErro.ts` (código 23514)
-- para dizer qual campo passou. Renomear aqui pede mudar lá.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_title_limite;
ALTER TABLE public.events
  ADD CONSTRAINT events_title_limite CHECK (char_length(title) <= 120);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_location_limite;
ALTER TABLE public.events
  ADD CONSTRAINT events_location_limite CHECK (location IS NULL OR char_length(location) <= 160);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_description_limite;
ALTER TABLE public.events
  ADD CONSTRAINT events_description_limite CHECK (description IS NULL OR char_length(description) <= 1000);

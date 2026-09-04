-- A resposta do marketing ao pedido de cobertura.
--
-- Pedir cobertura (`marketing_coverage`) nunca garantiu presença: a equipe é
-- pequena e atende todas as unidades. Mas a unidade não recebia a resposta
-- pelo sistema -- só pelo WhatsApp. Esta coluna é a resposta:
--   NULL  -> a confirmar (o admin ainda não revisou)
--   true  -> marketing vai estar presente
--   false -> sem marketing; o registro é da unidade
-- Quando é false, a vaga do marketing sai da conta do transporte.
-- Decisão de 04/09/2026 (quadro 18 dos mockups).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS marketing_confirmed boolean;

COMMENT ON COLUMN public.events.marketing_confirmed IS 'Resposta ao pedido de cobertura: NULL a confirmar, true presente, false sem marketing.';

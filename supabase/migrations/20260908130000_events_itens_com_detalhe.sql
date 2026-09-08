-- Alimentação e equipamentos como lista de itens com detalhe.
--
-- Cada item ligado no formulário (Almoço, Lanche, Microfone…) passa a ter o
-- seu texto: para quantos, a que hora, quem fornece. Antes tudo ia para um
-- campo geral, misturado. Decisão de 08/09/2026 (quadro 21 dos mockups).
--
--   food_items      [{"item":"Almoço","detalhes":"60 crianças, 12h"},
--                    {"item":"Café dos voluntários","detalhes":"7h30","outro":true}]
--   equipment_items [{"item":"Microfone","detalhes":"2, sem fio"}]
--
-- `food_logistics` e `equipment_needed` (texto) continuam, derivados das
-- listas, para validação, filtros e telas antigas. `food_details` vira
-- "Observações gerais da alimentação" — para o que não é de um item só.
--
-- Sem dado a converter: a tabela foi zerada em 08/09/2026.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS food_items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.food_items      IS 'Itens de alimentação com detalhe: [{item, detalhes, outro?}]. food_logistics é derivado.';
COMMENT ON COLUMN public.events.equipment_items IS 'Itens de equipamento com detalhe: [{item, detalhes, outro?}]. equipment_needed é derivado.';

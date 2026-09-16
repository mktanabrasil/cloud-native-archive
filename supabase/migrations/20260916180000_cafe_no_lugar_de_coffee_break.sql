-- Varredura de 16/09/2026: "Coffee Break" vira "Café da manhã / da tarde" na
-- lista de alimentação do formulário. O valor é gravado dentro de cada evento
-- (food_items [{item, detalhes}] e o texto derivado food_logistics), então os
-- eventos existentes precisam acompanhar, senão o item marcado deixa de ser
-- reconhecido pela lista. Aplicar no SQL Editor do Studio.
UPDATE public.events
SET food_items = replace(food_items::text, 'Coffee Break', 'Café da manhã / da tarde')::jsonb,
    food_logistics = replace(coalesce(food_logistics, ''), 'Coffee Break', 'Café da manhã / da tarde')
WHERE food_items::text LIKE '%Coffee Break%' OR food_logistics LIKE '%Coffee Break%';

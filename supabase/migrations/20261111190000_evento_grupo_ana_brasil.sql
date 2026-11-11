-- Eventos (11/11/2026): a unidade "Grupo ANA Brasil" volta, só para eventos.
--
-- É o evento geral, com todas as unidades juntas (o Natal Feliz, por exemplo).
-- Ela existiu em maio de 2026 e foi fundida na "Administração" em julho
-- (20260707224345); os perfis continuam nas quatro unidades de sempre: esta
-- migração só amplia a regra da tabela de eventos.
--
-- Quem grava: a gestora continua gravando só na própria unidade
-- (events_gestor_insert usa has_unit_access); o evento do Grupo fica com a
-- administração e a comunicação, como o da Administração.
--
-- Pode rodar de novo sem estragar nada.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS check_valid_event_unit;
ALTER TABLE public.events ADD CONSTRAINT check_valid_event_unit
  CHECK (unit = ANY (ARRAY['DIC'::text, 'Nilópolis'::text, 'Santana'::text, 'Administração'::text, 'Grupo ANA Brasil'::text]));

-- Conferência: a regra nova (deve listar as cinco unidades).
SELECT pg_get_constraintdef(oid) AS regra
FROM pg_constraint
WHERE conname = 'check_valid_event_unit';

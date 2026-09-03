-- Espaço livre para a alimentação do evento.
--
-- As opções ("Almoço", "Lanche", "Nenhum") não cabem o que a equipe precisa
-- combinar: quantas pessoas, restrição alimentar, horário. Hoje isso não tem
-- onde ser escrito, e é parte do motivo de a logística de 70 eventos ter ido
-- parar dentro de `notes` como texto corrido — de onde ninguém consegue ler de
-- volta.
--
-- Coluna própria, e não concatenada em `food_logistics`: misturar escolha com
-- texto livre no mesmo campo é exatamente a doença que se quer evitar.
--
-- Aditiva e segura de rodar ANTES do código subir: o código atual ignora a
-- coluna nova, e o novo passa a preenchê-la.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS food_details text;

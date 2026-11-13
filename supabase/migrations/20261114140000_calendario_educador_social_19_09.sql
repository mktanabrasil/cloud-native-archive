-- Dia do Educador Social em 19/09 (13/11/2026, decisão do marketing).
--
-- A base de 2027 (20261114100000) trouxe da agenda do Google o item
-- "Dia do Educador Social · Dia da Bandeira" em 19/11. No calendário de 2026
-- o Educador Social fica em 19/09, e é essa data que vale. A Bandeira
-- continua em 19/11.
--
-- Rodar no SQL Editor: sem login (auth.uid() vazio), as guardas do calendário
-- deixam a base ser corrigida. Pode rodar de novo: não duplica.

UPDATE public.calendario_itens
   SET texto = 'Dia da Bandeira'
 WHERE ano = 2027 AND dia = '2027-11-19' AND tipo = 'data'
   AND texto = 'Dia do Educador Social · Dia da Bandeira';

INSERT INTO public.calendario_itens (ano, dia, texto, tipo, fonte)
SELECT 2027, DATE '2027-09-19', 'Dia do Educador Social', 'data', 'Calendário 2026'
 WHERE EXISTS (SELECT 1 FROM public.calendario_anual WHERE ano = 2027)
   AND NOT EXISTS (SELECT 1 FROM public.calendario_itens
                    WHERE ano = 2027 AND dia = '2027-09-19' AND texto ILIKE '%educador social%');

-- Conferência: 19/09 com o Educador Social, 19/11 só com a Bandeira.
SELECT dia, texto, tipo, fonte
  FROM public.calendario_itens
 WHERE ano = 2027 AND dia IN ('2027-09-19', '2027-11-19')
 ORDER BY dia;

-- Voluntariado do Natal Feliz (23/11/2026): inscrições reabertas até 26/11.
--
-- Eram até 18/11 (prorrogadas em 12/11); agora vão até 26/11 (quinta-feira),
-- 23h59 de Brasília. O formulário fechou em 19/11 e volta a abrir com este SQL.
--
-- Em vez de reescrever a função inteira, troca SÓ a data do prazo dentro da
-- `inscrever_voluntario` que está no banco agora: assim nada mais muda nela,
-- mesmo que alguém a tenha ajustado direto no painel.
--
-- Pode rodar de novo sem estragar nada.

DO $$
DECLARE
  def text := pg_get_functiondef('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text)'::regprocedure);
  nova text;
BEGIN
  IF position('2026-11-27 00:00:00' in def) > 0 THEN
    RAISE NOTICE 'O prazo já é 26/11: nada a fazer.';
    RETURN;
  END IF;
  IF position('2026-11-19 00:00:00' in def) = 0 THEN
    RAISE EXCEPTION 'Não achei o prazo de 18/11 na função inscrever_voluntario; nada foi mudado.';
  END IF;
  nova := replace(def, '2026-11-19 00:00:00', '2026-11-27 00:00:00');
  nova := replace(nova, '-- Prazo: até 18/11/2026, horário de Brasília (era 15/11; prorrogado em 12/11/2026).',
                        '-- Prazo: até 26/11/2026, horário de Brasília (era 15/11; prorrogado em 12/11 e em 23/11/2026).');
  EXECUTE nova;
END;
$$;

-- Conferência: as duas linhas devem mostrar true.
SELECT 'prazo até 26/11 na inscrição' AS item,
       (position('2026-11-27 00:00:00' in pg_get_functiondef('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text)'::regprocedure)) > 0)::text AS valor
UNION ALL
SELECT 'prazo de 18/11 saiu',
       (position('2026-11-19 00:00:00' in pg_get_functiondef('public.inscrever_voluntario(text, text, text, text, text, text, text, text, text, text, text, text)'::regprocedure)) = 0)::text;

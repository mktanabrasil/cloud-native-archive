-- Voluntariado do Natal Feliz (27/11/2026): inscrições prorrogadas até 28/11.
--
-- Eram até 26/11; agora vão até sábado, 28/11, 23h59 de Brasília. O formulário
-- fechou à meia-noite de 26/11 e volta a abrir com este SQL.
--
-- Como em 23/11, troca SÓ a data do prazo dentro da `inscrever_voluntario` que
-- está no banco. Desde os acompanhantes (23/11) a função tem 13 parâmetros, por
-- isso ela é achada pelo nome, e não pela lista de parâmetros.
--
-- Pode rodar de novo sem estragar nada.

DO $$
DECLARE
  f record;
  def text;
  nova text;
  trocadas int := 0;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'inscrever_voluntario' LOOP
    def := pg_get_functiondef(f.oid);
    IF position('2026-11-29 00:00:00' in def) > 0 THEN
      RAISE NOTICE 'Uma versão já está com o prazo de 28/11: nada a fazer nela.';
      CONTINUE;
    END IF;
    IF position('2026-11-27 00:00:00' in def) = 0 THEN
      RAISE NOTICE 'Uma versão não tem o prazo de 26/11; deixada como está.';
      CONTINUE;
    END IF;
    nova := replace(def, '2026-11-27 00:00:00', '2026-11-29 00:00:00');
    nova := replace(nova, '-- Prazo: até 26/11/2026, horário de Brasília (era 15/11; prorrogado em 12/11 e em 23/11/2026).',
                          '-- Prazo: até 28/11/2026, horário de Brasília (era 15/11; prorrogado em 12/11, 23/11 e 27/11/2026).');
    EXECUTE nova;
    trocadas := trocadas + 1;
  END LOOP;
  RAISE NOTICE 'Versões com o prazo trocado agora: %', trocadas;
END;
$$;

-- Conferência: deve mostrar uma linha por versão da função, com true nas duas colunas.
SELECT pg_get_function_identity_arguments(p.oid) AS parametros,
       (position('2026-11-29 00:00:00' in pg_get_functiondef(p.oid)) > 0) AS prazo_28_11,
       (position('2026-11-27 00:00:00' in pg_get_functiondef(p.oid)) = 0) AS prazo_26_11_saiu
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'inscrever_voluntario';

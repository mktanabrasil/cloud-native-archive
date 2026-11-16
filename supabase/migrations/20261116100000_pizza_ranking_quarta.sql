-- Pizza da Alegria: o ranking automático passa para as quartas, 8h (16/11/2026).
--
-- O banco passa a chamar a função toda quarta às 11h UTC (8h em Brasília);
-- era toda sexta. A função publicada junto (pizza-ranking/index.ts) só envia
-- nas quartas 18/11, 25/11 e 02/12, entre 7h45 e 9h. O agendamento mantém o
-- nome antigo, 'pizza-ranking-sexta' (trocar o nome pediria recriar o job).
--
-- Rodar no SQL Editor. Pode rodar de novo.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'pizza-ranking-sexta'),
  schedule := '0 11 * * 3'
);

-- Conferência: deve mostrar '0 11 * * 3' (o 3 é quarta-feira).
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'pizza-ranking-sexta';

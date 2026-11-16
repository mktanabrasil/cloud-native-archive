-- Pizza da Alegria: o ranking automático passa para as 8h da manhã (16/11/2026).
--
-- Até aqui o banco chamava a função toda sexta às 18h UTC (15h em Brasília).
-- Agora chama às 11h UTC, que são 8h em Brasília. A função publicada junto
-- (pizza-ranking/index.ts) só envia entre 7h45 e 9h; as duas mudanças
-- precisam estar no ar antes da próxima sexta.
--
-- Rodar no SQL Editor. Pode rodar de novo.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'pizza-ranking-sexta'),
  schedule := '0 11 * * 5'
);

-- Conferência: deve mostrar o agendamento '0 11 * * 5'. O "active" continua
-- como estava: quem liga e desliga o envio é o interruptor do painel.
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'pizza-ranking-sexta';

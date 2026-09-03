-- A coluna que faltava para o formulário conseguir salvar.
--
-- `marketing_coverage` é declarada em `AppEvent`, preenchida pelo formulário
-- (o "Cobertura" da solicitação de marketing) e exigida pela validação — mas
-- nunca existiu na tabela. Toda tentativa de criar evento pela tela morria com
--
--   PGRST204: Could not find the 'marketing_coverage' column of 'events'
--
-- e, como o código disparava o insert sem esperar a resposta, o diálogo fechava
-- em cima do erro: a pessoa via um toast e perdia tudo o que tinha digitado.
--
-- É por isso que os 108 eventos do banco nasceram todos no mesmo instante, de
-- uma carga inicial: criar pela tela nunca deu certo.
--
-- Aditiva e segura de rodar a qualquer momento. Sem ela o formulário continua
-- sem conseguir salvar -- agora avisando, em vez de perder o trabalho.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS marketing_coverage boolean NOT NULL DEFAULT false;

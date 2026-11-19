-- LIGA O CADEADO DAS SENHAS (19/11/2026, último passo das senhas).
--
-- Rodar SÓ DEPOIS de:
--   1. o SQL 20261119180000_senha_pelo_email.sql;
--   2. as funções senha-pedir e senha-resgatar publicadas (e admin-approve-user
--      republicada);
--   3. o app do PR 3 no ar (o "Esqueceu a senha?" novo).
-- Antes disso, quem é da equipe ficaria sem jeito de pegar a senha.
--
-- A partir daqui, contas da equipe (todas, menos administração geral e
-- marketing) não trocam a própria senha: ela vem do e-mail ("Gerar minha
-- senha") ou do Painel ("Gerar nova senha").
--
-- Para DESLIGAR, se precisar: UPDATE public.senhas_config SET ligado = false WHERE id = 1;

UPDATE public.senhas_config SET ligado = true, ligado_em = coalesce(ligado_em, now()) WHERE id = 1;

SELECT 'cadeado ligado' AS item, ligado::text AS valor, ligado_em::text AS desde FROM public.senhas_config WHERE id = 1;

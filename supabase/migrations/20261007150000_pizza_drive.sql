-- Pizza da Alegria, parte 2 (07/10/2026): a cópia para o Google Drive.
--
-- O banco e o Storage continuam sendo a fonte; o Drive compartilhado "Setor
-- Marketing" é o espelho organizado: Pizza da Alegria 2026 / Educação|Social
-- / unidade / pessoa / "PZ-NNNN · comprovante.ext" e "PZ-NNNN · Nome.pdf".
-- Quem copia é a função pizza-drive, com a conta Google que a comunicação
-- conectar no painel (mesmo caminho da Agenda dos eventos).

ALTER TABLE public.pizza_confirmacoes
  ADD COLUMN IF NOT EXISTS drive_erro        text,
  -- trava curta para duas cópias simultâneas não duplicarem os arquivos
  ADD COLUMN IF NOT EXISTS drive_tentando_em timestamptz;

-- A conexão com o Google: uma linha só. Só a função (chave de serviço) lê e
-- grava: a chave de renovação nunca chega ao navegador.
CREATE TABLE IF NOT EXISTS public.pizza_drive_conexao (
  id             integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refresh_token  text NOT NULL,
  google_email   text NOT NULL,
  drive_id       text NOT NULL,
  pasta_id       text NOT NULL,
  conectado_por  text,
  conectado_em   timestamptz NOT NULL DEFAULT now(),
  erro           text
);

ALTER TABLE public.pizza_drive_conexao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pizza_drive_conexao FROM anon, authenticated;
GRANT ALL ON public.pizza_drive_conexao TO service_role;

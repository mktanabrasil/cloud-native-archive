-- Voluntariado do Natal Feliz (21/10/2026): a planilha do Google que se
-- atualiza sozinha.
--
-- Decisão dele: uma planilha só, com o mesmo link sempre, para compartilhar
-- com a gestão. Cada inscrição nova entra como uma linha no fim; o app nunca
-- mexe no que já está lá, então a gestão pode acrescentar colunas à direita e
-- anotar. Apagar no app NÃO tira a linha da planilha (a gestão tira à mão).
-- Quem escreve é a função voluntariado-planilha, com a mesma conta Google
-- conectada no Drive da Pizza (pizza_drive_conexao).

-- Quando a linha entrou na planilha, e uma trava curta para duas chamadas
-- ao mesmo tempo não escreverem a mesma inscrição duas vezes.
ALTER TABLE public.voluntarios_natal
  ADD COLUMN IF NOT EXISTS planilha_em          timestamptz,
  ADD COLUMN IF NOT EXISTS planilha_tentando_em timestamptz;

-- A planilha: uma linha só. Só a função (chave de serviço) lê e grava.
CREATE TABLE IF NOT EXISTS public.voluntariado_planilha (
  id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  planilha_id   text NOT NULL,
  criada_por    text,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  erro          text
);

ALTER TABLE public.voluntariado_planilha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voluntariado_planilha FROM anon, authenticated;
GRANT ALL ON public.voluntariado_planilha TO service_role;

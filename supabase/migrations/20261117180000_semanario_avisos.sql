-- Semanário, PR 6 (17/11/2026): o registro dos avisos por e-mail.
--
-- A função `semanario-aviso` manda dois e-mails:
--   - envio: a professora enviou, vai para a orientadora pedagógica do CEI;
--   - devolutiva: a orientadora escreveu ou reescreveu, vai para a professora.
-- Cada acontecimento é avisado uma vez: a linha daqui é a reserva. A marca é o
-- `enviado_em` (envio) ou o `devolutiva_em` (devolutiva) do semanário naquele
-- momento; desfazer e enviar de novo, ou reescrever a devolutiva, dá marca
-- nova e avisa de novo.
--
-- Só a função (chave de serviço) lê e escreve aqui; o app não vê esta tabela.
-- Pode rodar de novo sem estragar nada.

CREATE TABLE IF NOT EXISTS public.semanario_avisos (
  semanario_id   uuid NOT NULL REFERENCES public.semanarios(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  marca          timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'enviando',
  destinatarios  text[] NOT NULL DEFAULT '{}',
  erro           text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (semanario_id, tipo, marca),
  CONSTRAINT semanario_avisos_tipo_check CHECK (tipo IN ('envio', 'devolutiva')),
  CONSTRAINT semanario_avisos_status_check CHECK (status IN ('enviando', 'enviado', 'sem_destinatario', 'falhou'))
);

ALTER TABLE public.semanario_avisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.semanario_avisos FROM anon, authenticated;
GRANT ALL ON public.semanario_avisos TO service_role;

-- Conferência: a tabela e a trava (RLS ligada, sem regra para o app).
SELECT 'tabela semanario_avisos' AS item, (to_regclass('public.semanario_avisos') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'RLS ligada', relrowsecurity::text FROM pg_class WHERE oid = 'public.semanario_avisos'::regclass;

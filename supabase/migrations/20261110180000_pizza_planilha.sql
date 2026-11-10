-- Pizza da Alegria (10/11/2026): a planilha do Google que se atualiza sozinha.
--
-- No lugar do "Baixar planilha" do painel, uma planilha "Pizza da Alegria
-- 2026 · Pedidos" na pasta da campanha no Drive (a mesma dos PDFs), só com a
-- tabela dos pedidos, nas cores da ANA. É só de leitura: a função pizza-drive
-- reescreve a aba Pedidos inteira a cada mudança, a partir do banco. Abas que a
-- equipe criar ficam intocadas.
--
-- Quem escreve é a função pizza-drive, com a conta Google já conectada no
-- painel (pizza_drive_conexao). Ela só reescreve quando algo mudou: o gatilho
-- abaixo marca a planilha como pendente a cada pedido novo, retirada ou
-- correção.
--
-- Pode rodar de novo sem estragar nada.

CREATE TABLE IF NOT EXISTS public.pizza_planilha (
  id             integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  planilha_id    text,                          -- criada pela função na primeira vez
  aba_id         integer,
  desenhada_em   timestamptz,                   -- quando as cores, larguras e regras foram aplicadas
  pendente       boolean NOT NULL DEFAULT true, -- há mudança que ainda não foi para a planilha
  escrevendo_em  timestamptz,                   -- trava curta: duas chamadas não escrevem juntas
  atualizada_em  timestamptz,
  erro           text
);

ALTER TABLE public.pizza_planilha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pizza_planilha FROM anon, authenticated;
GRANT ALL ON public.pizza_planilha TO service_role;

INSERT INTO public.pizza_planilha (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Marca a planilha como pendente. Só nas colunas que aparecem nela: as marcas
-- da cópia para o Drive (drive_*) não contam, senão cada cópia pediria outra
-- reescrita.
CREATE OR REPLACE FUNCTION public.pizza_planilha_marcar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pizza_planilha SET pendente = true WHERE id = 1 AND NOT pendente;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pizza_planilha_marcar() FROM PUBLIC;

DROP TRIGGER IF EXISTS pizza_planilha_novo ON public.pizza_confirmacoes;
CREATE TRIGGER pizza_planilha_novo
  AFTER INSERT OR DELETE ON public.pizza_confirmacoes
  FOR EACH STATEMENT EXECUTE FUNCTION public.pizza_planilha_marcar();

DROP TRIGGER IF EXISTS pizza_planilha_mudou ON public.pizza_confirmacoes;
CREATE TRIGGER pizza_planilha_mudou
  AFTER UPDATE OF numero, nome, unidade_id, unidade_nome, area, sabores, quantidade, total, forma,
                  retirada, retirada_em, mp_pagamento_id, mp_forma, mp_bandeira
  ON public.pizza_confirmacoes
  FOR EACH STATEMENT EXECUTE FUNCTION public.pizza_planilha_marcar();

COMMENT ON TABLE public.pizza_planilha IS 'Pizza da Alegria: a planilha do Google (só leitura) que a função pizza-drive reescreve a cada mudança (10/11/2026).';

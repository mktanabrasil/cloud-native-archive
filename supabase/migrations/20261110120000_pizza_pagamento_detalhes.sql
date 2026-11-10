-- Pizza da Alegria (10/11/2026): os dados do pagamento online para o comprovante.
--
-- Com o pagamento online, a pessoa baixa um comprovante em imagem e o Drive
-- recebe "PZ-XXXXX · comprovante.pdf". Os dois mostram a forma de pagamento e
-- a hora da aprovação, lidos da order no Mercado Pago pela função
-- pizza-pagamento (nunca do que a pessoa manda). A API de Orders não devolve o
-- final do cartão nem a data de aprovação: fica a bandeira e a hora em que o
-- nosso servidor viu o pagamento aprovado.
--
-- Só acrescenta colunas: pode rodar de novo sem estragar nada.

ALTER TABLE public.pizza_confirmacoes
  ADD COLUMN IF NOT EXISTS mp_forma       text,         -- credit_card | debit_card | bank_transfer | account_money
  ADD COLUMN IF NOT EXISTS mp_bandeira    text,         -- visa | master | elo | pix | account_money ...
  ADD COLUMN IF NOT EXISTS mp_aprovado_em timestamptz;  -- quando o servidor viu a aprovação

COMMENT ON COLUMN public.pizza_confirmacoes.mp_forma IS 'Pago online: payment_method.type da order no Mercado Pago (10/11/2026).';
COMMENT ON COLUMN public.pizza_confirmacoes.mp_bandeira IS 'Pago online: payment_method.id da order no Mercado Pago (10/11/2026).';
COMMENT ON COLUMN public.pizza_confirmacoes.mp_aprovado_em IS 'Pago online: quando a função pizza-pagamento viu o pagamento aprovado (10/11/2026).';

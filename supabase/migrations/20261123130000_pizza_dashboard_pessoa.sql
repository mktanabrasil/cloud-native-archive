-- Pizza da Alegria (23/11/2026): "Pessoas que mais compraram" no dashboard.
--
-- O dashboard junta os pedidos da mesma pessoa pelo WhatsApp, como o ranking
-- que vai ao grupo às sextas. Mas o número não pode ir para a tela (o link da
-- gestão abre sem login): cada pedido ganha só "pessoa", um número sem
-- significado (1, 2, 3…) igual para o mesmo WhatsApp. Sem WhatsApp, vem nulo,
-- e a página junta pelo nome e pela unidade.
--
-- Em vez de reescrever a função, acrescenta o campo na que está no banco.
-- Sem este SQL, o dashboard funciona e junta pelo nome e unidade.
-- Pode rodar de novo sem estragar nada.

DO $$
DECLARE
  def text := pg_get_functiondef('public.dados_do_dashboard_da_pizza(text)'::regprocedure);
  nova text;
BEGIN
  IF position('AS pessoa' in def) > 0 THEN
    RAISE NOTICE 'O dashboard já recebe a pessoa: nada a fazer.';
    RETURN;
  END IF;
  IF position('''nome'', c.nome,' in def) = 0 OR position('FROM public.pizza_confirmacoes c' in def) = 0 THEN
    RAISE EXCEPTION 'A função dados_do_dashboard_da_pizza não está como esperado; nada foi mudado.';
  END IF;
  nova := replace(def, '''nome'', c.nome,', '''nome'', c.nome, ''pessoa'', c.pessoa,');
  nova := replace(nova, 'FROM public.pizza_confirmacoes c',
    'FROM (SELECT c0.*, CASE WHEN nullif(btrim(c0.telefone), '''') IS NULL THEN NULL'
    || ' ELSE dense_rank() OVER (ORDER BY nullif(btrim(c0.telefone), '''') NULLS LAST) END AS pessoa'
    || ' FROM public.pizza_confirmacoes c0) c');
  EXECUTE nova;
END;
$$;

-- Conferência: deve mostrar true.
SELECT 'dashboard recebe a pessoa' AS item,
       (position('AS pessoa' in pg_get_functiondef('public.dados_do_dashboard_da_pizza(text)'::regprocedure)) > 0)::text AS valor;

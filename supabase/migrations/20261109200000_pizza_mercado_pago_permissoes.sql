-- Pizza da Alegria (09/11/2026): corrige as permissões de 20261109190000.
--
-- O Supabase dá EXECUTE às contas anon e authenticated em toda função nova
-- (privilégio padrão do schema public). O REVOKE ... FROM PUBLIC daquela
-- migração não tira essa permissão. Conferido pela API com a chave pública:
-- pizza_aprovar_online respondia "pedido_nao_encontrado" em vez de "permission
-- denied". Com isso, quem tivesse o id do próprio pedido (ele aparece no
-- endereço de volta do Mercado Pago) podia aprovar sem pagar.
--
-- Só a Edge Function `pizza-pagamento`, com a chave de serviço, chama estas
-- funções e escreve na tabela.

REVOKE EXECUTE ON FUNCTION public.pizza_novo_numero() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pizza_reservar_online(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pizza_aprovar_online(uuid, text, numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pizza_novo_numero() TO service_role;
GRANT EXECUTE ON FUNCTION public.pizza_reservar_online(text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.pizza_aprovar_online(uuid, text, numeric) TO service_role;

-- A tabela já tem RLS sem política de escrita, mas fica fechada também pelas permissões.
REVOKE ALL ON public.pizza_pedidos_online FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pizza_pedidos_online FROM authenticated;

-- Conferência (rodar depois): as três linhas devem vir com "false".
--   select p, has_function_privilege('anon', p, 'execute') as anon_executa
--   from unnest(array[
--     'public.pizza_novo_numero()',
--     'public.pizza_reservar_online(text, text, text, text, jsonb)',
--     'public.pizza_aprovar_online(uuid, text, numeric)'
--   ]) as p;

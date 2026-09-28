-- Excluir usuário no Painel dava "Edge Function returned a non-2xx status code"
-- (28/09/2026, conta "Usuário Teste").
--
-- A causa: colunas de histórico apontam para auth.users sem dizer o que fazer
-- quando a conta some (audit_logs.actor_id, events.created_by/updated_by,
-- access_requests.reviewed_by, ui_versions e system_configs...). O Postgres
-- então RECUSA apagar a conta de quem já fez qualquer coisa registrada, e o
-- Auth devolve erro para a função admin-delete-user.
--
-- A correção: toda chave estrangeira do schema public que aponta para
-- auth.users com "não fazer nada" (NO ACTION/RESTRICT) passa a SET NULL,
-- desde que a coluna aceite vazio. O histórico fica; só perde o nome de quem
-- fez. Coluna obrigatória (NOT NULL) não é tocada: aparece no aviso final,
-- para decidir caso a caso.
--
-- As chaves são lidas do banco (pg_constraint), não das migrações: as
-- migrações deste repositório não são a fonte da verdade. Rodar de novo não
-- muda nada, porque as já convertidas deixam de ser NO ACTION.
--
-- Aplicar no SQL Editor do Studio. Vale na hora, sem publicar o front.

DO $migracao$
DECLARE
  c            record;
  convertidas  text[] := '{}';
  obrigatorias text[] := '{}';
BEGIN
  FOR c IN
    SELECT con.conname,
           con.conrelid::regclass AS tabela,
           att.attname            AS coluna,
           att.attnotnull         AS obrigatoria
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
      AND con.confdeltype IN ('a', 'r')          -- NO ACTION ou RESTRICT
      AND array_length(con.conkey, 1) = 1
      AND con.connamespace = 'public'::regnamespace
  LOOP
    IF c.obrigatoria THEN
      obrigatorias := obrigatorias || format('%s.%s', c.tabela, c.coluna);
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tabela, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users (id) ON DELETE SET NULL',
                   c.tabela, c.conname, c.coluna);
    convertidas := convertidas || format('%s.%s', c.tabela, c.coluna);
  END LOOP;

  RAISE NOTICE 'Passaram a SET NULL: %', CASE WHEN cardinality(convertidas) = 0 THEN 'nenhuma' ELSE array_to_string(convertidas, ', ') END;
  IF cardinality(obrigatorias) > 0 THEN
    RAISE NOTICE 'Obrigatórias, NÃO mexidas (ainda travam a exclusão): %', array_to_string(obrigatorias, ', ');
  END IF;
END
$migracao$;

-- Para conferir (deve voltar vazio, ou só colunas obrigatórias):
-- SELECT con.conrelid::regclass AS tabela, att.attname AS coluna, att.attnotnull AS obrigatoria
-- FROM pg_constraint con
-- JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
-- WHERE con.contype = 'f' AND con.confrelid = 'auth.users'::regclass AND con.confdeltype IN ('a', 'r')
--   AND con.connamespace = 'public'::regnamespace;

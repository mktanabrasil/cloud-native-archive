-- Vínculo "Gestão Educação" (24/11/2026): a direção do CEI (ou do GOE).
--
-- Do lado da Educação, como a Gestão Social do lado do Social: nível Gestor,
-- unidade de um CEI ou do GOE. O acesso continua vindo do nível e da unidade
-- (Jornal Institucional da unidade e Jornais das unidades); o vínculo só
-- deixa a conta identificada no Painel.
--
-- ORDEM: rodar ANTES do merge (sem ele, o banco recusa salvar o vínculo novo).
-- Pode rodar de novo sem estragar nada.

-- Num bloco só: se a regra nova não puder entrar, a antiga fica como estava.
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bond_type_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_bond_type_check
    CHECK (bond_type IS NULL OR bond_type IN (
      'rh','financeiro','marketing','nota_fiscal','voluntariado','padrinhos','parceiros',
      'gestao_social','educador',
      'gestao_educacao','orientacao_pedagogica','professora',
      'parceiro','usuario_comum'
    ));
END;
$$;

-- Conferência: deve mostrar true.
SELECT 'vínculo gestao_educacao aceito' AS item, (pg_get_constraintdef(oid) LIKE '%gestao_educacao%')::text AS valor
  FROM pg_constraint WHERE conname = 'profiles_bond_type_check';

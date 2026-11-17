-- Semanário, PR 1 (17/11/2026): os vínculos da Educação.
--
-- Dois vínculos novos no Painel, para o Semanário: "orientacao_pedagogica"
-- (a orientadora pedagógica de um CEI, que dá a devolutiva) e "professora"
-- (quem preenche). As duas ficam com o nível de usuário padrão e a unidade do
-- CEI (ou do GOE) no perfil; o que cada uma vê no app vem do vínculo.
--
-- Só a regra da coluna muda: ela passa a aceitar os dois valores novos. Nada
-- mais no banco depende disso ainda; as tabelas do Semanário vêm no PR 2.
--
-- Rodar ANTES do merge: depois dele, o Painel já oferece os dois vínculos, e
-- sem esta regra o banco recusa salvar a pessoa. Rodar de novo não estraga nada.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bond_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bond_type_check
  CHECK (bond_type IS NULL OR bond_type IN (
    'rh','financeiro','marketing','nota_fiscal',
    'gestao_social','educador',
    'orientacao_pedagogica','professora',
    'parceiro','usuario_comum'
  ));

-- Conferência: a regra com os dez vínculos.
SELECT 'profiles_bond_type_check' AS item, pg_get_constraintdef(oid) AS valor
FROM pg_constraint WHERE conname = 'profiles_bond_type_check';

-- Move a logística presa em `notes` para as colunas próprias.
--
-- Em 21/05/2026 os eventos do sistema antigo entraram com toda a logística
-- num só texto, sempre no mesmo molde:
--
--   Alimentação: <texto>
--   Materiais: <texto>
--   Equipamento: <texto>
--
-- Eram 70 eventos, e as colunas `food_logistics`, `printed_materials` e
-- `equipment_needed` -- que o formulário e o detalhe já usam -- ficaram
-- vazias em todos. Esta migração desmonta o molde e limpa o `notes`, para a
-- mesma informação não aparecer duas vezes no painel.
--
-- Regras, sem adivinhar categoria:
--   * "não", "nada", "não teremos"  -> 'Nenhum'  (o valor que o formulário grava)
--   * "não", "esta ok" no equipamento -> 'Nenhum'
--   * qualquer outro texto vai como está: vira o texto de "Outra logística" /
--     "Outro equipamento" no formulário, onde pode ser reclassificado.
--
-- Só toca linhas que casam com o molde inteiro E cujas colunas de destino
-- ainda estão vazias -- rodar de novo não faz nada.
--
-- Aplicada em produção em 03/09/2026 via `supabase db query`; o arquivo é
-- registro. Cópia dos `notes` originais guardada antes de aplicar.

with p as (
  select id,
    trim(substring(notes from 'Alimentação: ((?:.|\n)*?)\nMateriais: ')) ali,
    trim(substring(notes from 'Materiais: ([^\n]*)')) mat,
    trim(substring(notes from 'Equipamento: ((?:.|\n)*)$')) equ
  from public.events
  where notes ~ '^Alimentação: (?:.|\n)*\nMateriais: [^\n]*\nEquipamento: (?:.|\n)*$'
    and coalesce(food_logistics, '') = ''
    and coalesce(printed_materials, '') = ''
    and coalesce(equipment_needed, '') = ''
)
update public.events e
set food_logistics    = case when p.ali ~* '^(n[ãa]o|nada)( teremos)?\.?$' then 'Nenhum' else p.ali end,
    printed_materials = nullif(p.mat, ''),
    equipment_needed  = case when p.equ ~* '^(n[ãa]o|esta ok)\.?$' then 'Nenhum' else p.equ end,
    notes             = null
from p
where e.id = p.id;

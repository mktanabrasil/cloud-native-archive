/**
 * O que um visitante sem sessão pode receber de um evento.
 *
 * A tela pública já mostrava só o necessário, mas a consulta pedia `*` — e o
 * servidor mandava a linha inteira. Em 02/09/2026 medi: 33 eventos públicos
 * chegando ao navegador de quem não estava logado com o `notes` preenchido em
 * 17 deles (alimentação, materiais, equipamento de som) e o `created_by` de
 * todos. Nada disso aparecia na tela; estava no tráfego, a um F12 de distância.
 *
 * Por isso a lista é de **permissão**, não de bloqueio: coluna nova nasce
 * privada, e só entra aqui quem for olhar e decidir que pode ser vista de fora.
 * O caminho contrário — enumerar o que esconder — esquece a próxima coluna.
 *
 * O que ficou de fora e por quê:
 *  - `notes`, `target_audience`, `support_team`, `food_logistics`,
 *    `equipment_needed`, `printed_materials`, `marketing_*`, `transport_*`,
 *    `partner*`, `attachments` — planejamento interno da equipe;
 *  - `created_by`, `updated_by` — identificam pessoas;
 *  - `has_conflict`, `event_type`, `external_id`, `created_at`, `updated_at` —
 *    a tela pública não usa.
 */
export const CAMPOS_PUBLICOS_DO_EVENTO = [
  'id',
  'title',
  'description',
  'unit',
  'location',
  'start_datetime',
  'end_datetime',
  'status',
  'visibility',
  'slug',
  'deleted_at',
  // Aparência do card e do banner.
  'custom_color',
  'banner_url_desktop',
  'banner_url_mobile',
  'banner_image_desktop',
  'banner_image_mobile',
  'banner_display_time',
  'event_logo_url',
  'use_logo_as_title',
  'full_height_title',
  'show_in_banner',
  'show_banner_fade',
  'show_banner_overlay',
  // Parcerias: isto é para ser visto — a escola divulga com quem fez.
  'has_unit_collaboration',
  'collaborating_units',
  'external_collaborators',
] as const;

/** No formato que o PostgREST espera no `select`. */
export const SELECT_PUBLICO = CAMPOS_PUBLICOS_DO_EVENTO.join(',');

export type Unit = 'DIC' | 'Nilópolis' | 'Santana' | 'Administração';

export type BondType =
  | 'rh'
  | 'financeiro'
  | 'marketing'
  | 'nota_fiscal'
  | 'gestao_social'
  | 'educador'
  | 'parceiro'
  | 'usuario_comum';

export type EventStatus = 'confirmado' | 'pendente' | 'cancelado' | 'concluido';

/**
 * "cobertura" saiu em 04/09/2026: não era tipo de evento, era o pedido de
 * marketing — que já existe como `marketing_coverage`. Duas verdades para o
 * mesmo fato. Os dados antigos (`interno`/`externo`, do sistema anterior)
 * viraram `programação interna`/`ação externa` na mesma migração.
 */
export type EventType = 'reunião' | 'evento institucional' | 'apresentação' | 'ação externa' | 'programação interna' | 'outro';

export type PermissionLevel = 'admin_geral' | 'gestor_unidade' | 'eventos_parceiros' | 'editor' | 'usuario_padrao';

export type PartnerType = 'padrinho' | 'doador' | 'empresa' | 'figura_publica' | 'outro' | '';

export interface Anexo {
  url: string;
  /** O nome que a pessoa deu ao arquivo — "oficio-secretaria.pdf", não "2rdksrr22q.png". */
  name: string;
  /** Em bytes. Zero quando não sabemos (anexo antigo). */
  size: number;
  /** MIME, quando o navegador informou. */
  type: string;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  unit: Unit;
  event_type: EventType;
  start_datetime: string;
  end_datetime: string;
  location: string;
  status: EventStatus;
  visibility: 'publico' | 'interno';
  has_conflict: boolean;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  notes: string;
  marketing_request: boolean;
  partner_involved: boolean;
  partner_type: PartnerType;
  partner_name: string;
  partners: Array<{ type: PartnerType; name: string }>;
  // Unit collaboration
  has_unit_collaboration: boolean;
  collaborating_units: Unit[];
  external_collaborators: Array<string | { name: string; details: string }>;
  /**
   * Anexos: os antigos são só a URL (nome aleatório na raiz do balde); os
   * novos trazem nome, tamanho e tipo. `normalizarAnexo()` iguala os dois.
   */
  attachments: Array<string | Anexo>;
  banner_url_desktop?: string;
  banner_url_mobile?: string;
  banner_image_desktop?: string;
  banner_image_mobile?: string;
  custom_color?: string;
  show_in_banner?: boolean;
  /** Vazio vira `null`: a coluna é única, e um segundo `''` colide com o primeiro. */
  slug?: string | null;
  use_logo_as_title?: boolean;
  event_logo_url?: string;
  show_banner_fade?: boolean;
  full_height_title?: boolean;
  banner_display_time?: number;
  show_banner_overlay?: boolean;
  deleted_at?: string;
  target_audience?: string;
  support_team?: string;
  food_logistics?: string;
  /** Texto livre da alimentação: quantas pessoas, restrição, horário. */
  food_details?: string;
  /** Cartaz, folder, lista que já existem: link ou descrição. Editado no bloco de marketing. */
  printed_materials?: string;
  equipment_needed?: string;
  marketing_items?: Array<{ type: 'cobertura' | 'demanda_grafica'; item: string; description: string }>;
  marketing_coverage?: boolean;
  /**
   * Resposta do admin ao pedido de cobertura: `null` a confirmar, `true`
   * presente, `false` sem marketing (registro pela unidade). Com `false`, a
   * vaga do marketing sai do transporte.
   */
  marketing_confirmed?: boolean | null;
  transport_needed?: boolean;
  transport_vehicle?: TransportVehicle | '';
  /** Segundo veículo quando o principal não cabe todo mundo. */
  transport_support_vehicle?: TransportVehicle | '' | null;
  transport_passengers?: number;
  /** Leva equipamentos/materiais volumosos: pede veículo de apoio. */
  transport_extra_equipment?: boolean;
  /** A frota da ANA (VAN + Kombi, 25 lugares) não basta: vai acionar apoio de fora. */
  transport_external_support?: boolean;
  /**
   * O pedido de aprovação. A gestora envia (`submitted_at`), o admin geral
   * confirma ou devolve (`reviewed_*`, `review_note`). Nulos num evento que
   * o admin criou direto.
   */
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_note?: string | null;
}

export type TransportVehicle = 'van' | 'kombi' | 'utilitario';

export const TRANSPORT_VEHICLES: { value: TransportVehicle; label: string; capacity: number }[] = [
  { value: 'van', label: 'VAN', capacity: 15 },
  { value: 'kombi', label: 'Kombi', capacity: 12 },
  { value: 'utilitario', label: 'Utilitário/Caminhão', capacity: 2 },
];

export const SYSTEM_COLORS = [
  '#484848',
  '#fbce00',
  '#81e2cf',
  '#01adff',
  '#f37964',
  '#f5dfbb',
  '#f0eee4',
  '#000000',
  '#1f2322',
];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  unit: Unit;
  permission_level: PermissionLevel;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  view_restrictions?: Unit[] | null;
  delegated_units?: Unit[] | null;
  is_beta_tester?: boolean;
  bond_type?: BondType | null;
  partner_category?: PartnerCategory | null;
}

export type PartnerCategory = 'padrinho_doador' | 'empresa' | 'figura_publica' | 'outros';

export const PARTNER_CATEGORIES: { value: PartnerCategory; label: string }[] = [
  { value: 'padrinho_doador', label: 'Padrinho/Doador' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'figura_publica', label: 'Figura Pública' },
  { value: 'outros', label: 'Outros' },
];

export const UNITS: Unit[] = ['DIC', 'Nilópolis', 'Santana', 'Administração'];

export const UNIT_COLORS: Record<Unit, string> = {
  'DIC': 'unit-dic',
  'Nilópolis': 'unit-nilopolis',
  'Santana': 'unit-santana',
  'Administração': 'unit-geral',
};

export const UNIT_BG_COLORS: Record<Unit, string> = {
  'DIC': 'bg-unit-dic',
  'Nilópolis': 'bg-unit-nilopolis',
  'Santana': 'bg-unit-santana',
  'Administração': 'bg-unit-geral',
};

export const EVENT_TYPES: EventType[] = ['reunião', 'evento institucional', 'apresentação', 'ação externa', 'programação interna', 'outro'];

export const EVENT_STATUSES: EventStatus[] = ['confirmado', 'pendente', 'cancelado', 'concluido'];

export const PARTNER_TYPES: { value: PartnerType; label: string }[] = [
  { value: 'padrinho', label: 'Padrinho' },
  { value: 'doador', label: 'Doador' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'figura_publica', label: 'Figura Pública' },
  { value: 'outro', label: 'Outro' },
];

export const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'admin_geral', label: 'Admin Geral' },
  { value: 'gestor_unidade', label: 'Gestor' },
  { value: 'eventos_parceiros', label: 'Eventos e Parceiros' },
  { value: 'editor', label: 'Editor (Apenas Edição)' },
  { value: 'usuario_padrao', label: 'Usuário Padrão (Visualizador)' },
];

// Vínculo do usuário — agrupado por categoria
export const BOND_LABELS: Record<BondType, string> = {
  rh: 'RH',
  financeiro: 'Financeiro',
  marketing: 'Marketing',
  nota_fiscal: 'Nota Fiscal',
  gestao_social: 'Gestão Social',
  educador: 'Educador',
  parceiro: 'Parceiro',
  usuario_comum: 'Usuário Comum',
};

export const BOND_GROUPS: { label: string; options: BondType[] }[] = [
  { label: 'Interno — Administrativo (Setor)', options: ['rh', 'financeiro', 'marketing', 'nota_fiscal'] },
  { label: 'Interno — Social (Unidade)', options: ['gestao_social', 'educador'] },
  { label: 'Externo', options: ['parceiro', 'usuario_comum'] },
];

// Regras de cascata: o vínculo determina o nível de acesso e a unidade.
// unitMode:
//   'fixed-admin' -> unidade sempre 'Administração' (travada)
//   'choose'      -> unidade escolhida livremente
//   'none'        -> nenhuma unidade (travada, valor vazio)
export type UnitMode = 'fixed-admin' | 'choose' | 'none';

export const BOND_RULES: Record<BondType, { permission_level: PermissionLevel; unitMode: UnitMode }> = {
  // Interno — Administrativo
  rh: { permission_level: 'gestor_unidade', unitMode: 'fixed-admin' },
  financeiro: { permission_level: 'gestor_unidade', unitMode: 'fixed-admin' },
  marketing: { permission_level: 'gestor_unidade', unitMode: 'fixed-admin' },
  nota_fiscal: { permission_level: 'gestor_unidade', unitMode: 'fixed-admin' },
  // Interno — Social
  gestao_social: { permission_level: 'gestor_unidade', unitMode: 'choose' },
  educador: { permission_level: 'usuario_padrao', unitMode: 'choose' },
  // Externo
  parceiro: { permission_level: 'usuario_padrao', unitMode: 'none' },
  usuario_comum: { permission_level: 'usuario_padrao', unitMode: 'none' },
};

// Rótulo de leitura da unidade no contexto de EVENTOS.
// 'Administração' é exibida como 'Grupo ANA Brasil' (globaliza todas as unidades),
// mas o valor gravado permanece 'Administração'.
export function eventUnitLabel(unit: string): string {
  return unit === 'Administração' ? 'Grupo ANA Brasil' : unit;
}



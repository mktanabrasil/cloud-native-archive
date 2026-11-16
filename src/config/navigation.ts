import { Briefcase, LayoutDashboard, Calendar, Users, History, BookOpen, FileSearch, Megaphone, ShoppingBasket, HeartHandshake, GraduationCap, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  managerOnly?: boolean;
  auditoriaOnly?: boolean;
  requireAuth?: boolean;
  mktOrAdminOnly?: boolean;
  marketingOnly?: boolean;
  /**
   * Só a Educação usa (o Jornal). Ela não é `marketingOnly`: a gestão de
   * unidade também entra, e `marketingOnly` é compartilhado com Auditoria,
   * Manual de Design, Portal da Transparência e Widgets, que continuam só da
   * comunicação.
   */
  journalOnly?: boolean;
  /**
   * Só RH e admin (vagas, 25/09/2026): o atalho para /vagas, onde eles veem
   * as abas Portal e Gestão. O candidato chega pelo endereço, sem menu.
   */
  rhOnly?: boolean;
  /**
   * O setor Social: toda a equipe (os Eventos são de todos), menos a gestão
   * da Educação, que vê só a Educação (16/11/2026).
   */
  setorSocial?: boolean;
  hidden?: boolean;
}

/**
 * O menu de cima são os SETORES (16/11/2026): Social, Educação, Vagas,
 * Marketing e Painel. Cada setor abre na sua primeira página, e as outras
 * páginas dele ficam na faixa logo abaixo da barra (`FaixaDoSetor`). As
 * páginas não mudaram de endereço; o que mudou foi só o menu.
 *
 * - Social: Eventos e Calendário Anual. A gestão da Educação não o vê.
 * - Educação: o Jornal e os Jornais das unidades (o feed dos finalizados),
 *   da comunicação e da gestão dos CEIs e do GOE. A gestão do Social (as
 *   NAVEs) não a vê.
 * - Marketing: as abas de sempre e o Mercado Solidário, que saiu do menu de
 *   cima e é só do marketing (o embed público do site não muda).
 * - Painel: na barra só para o marketing; os outros chegam ao próprio perfil
 *   pelo menu da foto.
 */
export const navItems: NavItem[] = [
  { to: '/', label: 'Social', icon: HeartHandshake, setorSocial: true },
  { to: '/visao-geral', label: 'Visão Geral', icon: LayoutDashboard, requireAuth: true, hidden: true },
  { to: '/calendario', label: 'Calendário', icon: Calendar, requireAuth: true, hidden: true },
  { to: '/jornal-institucional', label: 'Educação', icon: GraduationCap, requireAuth: true, journalOnly: true },
  { to: '/vagas', label: 'Vagas', icon: Briefcase, requireAuth: true, rhOnly: true },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, requireAuth: true, marketingOnly: true },
  { to: '/usuarios', label: 'Painel', icon: Users, requireAuth: true, marketingOnly: true },
  { to: '/mercado-solidario', label: 'Mercado Solidário', icon: ShoppingBasket, requireAuth: true, marketingOnly: true, hidden: true },
  { to: '/auditoria', label: 'Auditoria', icon: History, requireAuth: true, marketingOnly: true, hidden: true },
  { to: '/design-manual', label: 'Manual Design', icon: BookOpen, requireAuth: true, marketingOnly: true, hidden: true },
  { to: '/portal-transparencia', label: 'Portal Transparência', icon: FileSearch, requireAuth: true, marketingOnly: true, hidden: true },
  { to: '/admin-toolbox', label: 'Widgets', icon: LayoutDashboard, requireAuth: true, marketingOnly: true, hidden: true },
];

/* ---------- a faixa de cada setor ---------- */

export interface PaginaDoSetor {
  rotulo: string;
  /** Para onde o link leva (pode ter `?aba=`). */
  to: string;
  /** Esta página está aberta? Recebe o caminho e a busca do endereço. */
  aberta: (caminho: string, busca: URLSearchParams) => boolean;
  /** Só aparece para quem tem o Calendário Anual (marketing ou gestora liberada). */
  soComCalendario?: boolean;
}

/** O feed "Jornais das unidades", na Educação (16/11/2026). */
export const ROTA_DO_FEED_DO_JORNAL = '/jornais-das-unidades';

/** As rotas das páginas de Eventos (o hub e os endereços antigos dele). */
export const ROTAS_DE_EVENTOS = ['/', '/visao-geral', '/eventos', '/lixeira'];

const abaDoMarketing = (aba: string, rotaPropria?: string) => (caminho: string, busca: URLSearchParams) =>
  (caminho === '/marketing' && (busca.get('aba') ?? 'auditoria') === aba) || (!!rotaPropria && caminho.startsWith(rotaPropria));

/** As páginas de cada setor, na ordem da faixa. A chave é o `to` do setor. */
export const PAGINAS_DOS_SETORES: Record<string, PaginaDoSetor[]> = {
  '/': [
    { rotulo: 'Eventos', to: '/', aberta: (c) => ROTAS_DE_EVENTOS.includes(c) },
    { rotulo: 'Calendário Anual', to: '/calendario', aberta: (c) => c === '/calendario', soComCalendario: true },
  ],
  // O editor da unidade e o feed dos finalizados de todas (16/11/2026).
  '/jornal-institucional': [
    { rotulo: 'Jornal Institucional', to: '/jornal-institucional', aberta: (c) => c === '/jornal-institucional' },
    { rotulo: 'Jornais das unidades', to: ROTA_DO_FEED_DO_JORNAL, aberta: (c) => c === ROTA_DO_FEED_DO_JORNAL },
  ],
  '/marketing': [
    { rotulo: 'Mercado Solidário', to: '/mercado-solidario', aberta: (c) => c.startsWith('/mercado-solidario') },
    { rotulo: 'Pizza da Alegria', to: '/marketing?aba=pizza', aberta: abaDoMarketing('pizza', '/pizza-da-alegria/painel') },
    { rotulo: 'Voluntariado', to: '/marketing?aba=voluntariado', aberta: abaDoMarketing('voluntariado') },
    { rotulo: 'Enquetes', to: '/marketing?aba=enquetes', aberta: abaDoMarketing('enquetes') },
    { rotulo: 'Manual Design', to: '/marketing?aba=design-manual', aberta: abaDoMarketing('design-manual', '/design-manual') },
    { rotulo: 'Portal Transparência', to: '/marketing?aba=transparencia', aberta: abaDoMarketing('transparencia', '/portal-transparencia') },
    { rotulo: 'Widgets', to: '/marketing?aba=widgets', aberta: abaDoMarketing('widgets', '/admin-toolbox') },
    { rotulo: 'Auditoria', to: '/marketing?aba=auditoria', aberta: abaDoMarketing('auditoria', '/auditoria') },
  ],
};

/** Rotas que pertencem a cada setor além da própria (para saber qual está aberto). */
export const ROTAS_DO_SETOR: Record<string, string[]> = {
  '/': [...ROTAS_DE_EVENTOS, '/calendario'],
  '/jornal-institucional': ['/jornal-institucional', ROTA_DO_FEED_DO_JORNAL],
  '/marketing': ['/marketing', '/mercado-solidario', '/auditoria', '/design-manual', '/portal-transparencia', '/admin-toolbox', '/pizza-da-alegria/painel'],
};

/** O setor aberto pelo endereço (o `to` dele no menu), ou nada. */
export function setorDoCaminho(caminho: string): string | null {
  for (const [setor, rotas] of Object.entries(ROTAS_DO_SETOR)) {
    if (rotas.some(r => (r === '/' ? caminho === '/' : caminho === r || caminho.startsWith(`${r}/`)))) return setor;
  }
  return null;
}

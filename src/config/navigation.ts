import { Briefcase, Users, Megaphone, HeartHandshake, GraduationCap, type LucideIcon } from 'lucide-react';

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
 * Os endereços do app por setor (16/11/2026): `/social/…`, `/educacao/…`,
 * `/marketing/…` e `/painel`. Os endereços de antes continuam abrindo e levam
 * para estes (ver `REDIRECIONAMENTOS`). As páginas públicas (vagas,
 * programação, formulários, enquetes, vitrines) não mudaram de endereço.
 */
export const ROTAS = {
  eventos: '/social/eventos',
  calendario: '/social/calendario',
  jornal: '/educacao/jornal',
  jornaisDasUnidades: '/educacao/jornais-das-unidades',
  semanario: '/educacao/semanario',
  marketing: '/marketing',
  mercado: '/marketing/mercado-solidario',
  painel: '/painel',
} as const;

/** As abas do Marketing, cada uma no seu endereço: `/marketing/pizza`. */
export const ABAS_DO_MARKETING = ['auditoria', 'design-manual', 'transparencia', 'widgets', 'enquetes', 'pizza', 'voluntariado'] as const;
export type AbaDoMarketing = (typeof ABAS_DO_MARKETING)[number];
/** A aba que abre em `/marketing` sem nada depois, como antes. */
export const ABA_INICIAL_DO_MARKETING: AbaDoMarketing = 'auditoria';
export const rotaDoMarketing = (aba: AbaDoMarketing) => `${ROTAS.marketing}/${aba}`;

/**
 * Os endereços antigos e para onde vão. O resto do link (`?unidade=`,
 * `?tab=`, o `#` da confirmação de e-mail) vai junto. `/calendario` e
 * `/portal-transparencia` continuam sendo os endereços de volta cadastrados
 * fora do app (o e-mail de confirmação do Calendário Anual e o login do Google
 * no Portal), por isso são eles que esses fluxos usam.
 */
export const REDIRECIONAMENTOS: Record<string, string> = {
  '/social': ROTAS.eventos,
  '/visao-geral': `${ROTAS.eventos}?tela=visao-geral`,
  '/calendario': ROTAS.calendario,
  '/educacao': ROTAS.jornal,
  '/jornal-institucional': ROTAS.jornal,
  '/jornais-das-unidades': ROTAS.jornaisDasUnidades,
  '/usuarios': ROTAS.painel,
  '/mercado-solidario': ROTAS.mercado,
  '/auditoria': rotaDoMarketing('auditoria'),
  '/design-manual': rotaDoMarketing('design-manual'),
  '/portal-transparencia': rotaDoMarketing('transparencia'),
  '/admin-toolbox': rotaDoMarketing('widgets'),
};

/**
 * O menu de cima são os SETORES (16/11/2026): Social, Educação, Vagas,
 * Marketing e Painel. Cada setor abre na sua primeira página, e as outras
 * páginas dele ficam na faixa logo abaixo da barra (`FaixaDoSetor`).
 *
 * - Social: Eventos e Calendário Anual. A gestão da Educação não o vê.
 * - Educação: o Jornal e os Jornais das unidades (o feed dos finalizados),
 *   da comunicação e da gestão dos CEIs e do GOE. A gestão do Social (as
 *   NAVEs) não a vê.
 * - Marketing: as abas de sempre e o Mercado Solidário, só do marketing (o
 *   embed público do site não muda).
 * - Painel: na barra só para o marketing; os outros chegam ao próprio perfil
 *   pelo menu da foto.
 */
export const navItems: NavItem[] = [
  { to: ROTAS.eventos, label: 'Social', icon: HeartHandshake, setorSocial: true },
  { to: ROTAS.jornal, label: 'Educação', icon: GraduationCap, requireAuth: true, journalOnly: true },
  { to: '/vagas', label: 'Vagas', icon: Briefcase, requireAuth: true, rhOnly: true },
  { to: ROTAS.marketing, label: 'Marketing', icon: Megaphone, requireAuth: true, marketingOnly: true },
  { to: ROTAS.painel, label: 'Painel', icon: Users, requireAuth: true, marketingOnly: true },
];

/** A cor de cada setor: na barra, na doca, na faixa e nos atalhos da página inicial. */
export const COR_DO_SETOR: Record<string, string> = {
  [ROTAS.eventos]: '#01adff',
  [ROTAS.jornal]: '#f37964',
  '/vagas': '#81e2cf',
  [ROTAS.marketing]: '#fbce00',
  [ROTAS.painel]: '#8A938F',
};

/** O que decide quais setores a pessoa vê (tudo vem de `useUserRole`). */
export interface QuemVe {
  isAuthenticated: boolean;
  soEducacao?: boolean;
  canAccessJournal?: boolean;
  /** Professora, orientadora pedagógica ou marketing (17/11/2026). */
  temSemanario?: boolean;
  isRh?: boolean;
  /** Responsável por algum processo de vaga (passo 3, 19/10/2026). */
  souResponsavel?: boolean;
  isMarketing?: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
  canViewAuditoria?: boolean;
}

/**
 * Os setores que a pessoa vê, na ordem do menu. Uma regra só para a barra, a
 * doca e a página inicial (17/11/2026), para nunca discordarem.
 */
export function setoresVisiveis(q: QuemVe): NavItem[] {
  return navItems.filter(item => {
    // Regra para páginas escondidas (não aparecem no menu, acessadas por outra página)
    if (item.hidden) return false;
    // O Social é de todos, menos de quem vê só a Educação (16/11/2026).
    if (item.setorSocial) return !q.soEducacao;
    // Antes do `marketingOnly`: a Educação tem regra própria. A gestão entra
    // pelo Jornal; a professora e a orientadora, pelo Semanário (17/11/2026).
    if (item.journalOnly) return !!(q.canAccessJournal || q.temSemanario);
    // RH, ou quem é responsável por algum processo (passo 3, 19/10/2026).
    if (item.rhOnly) return !!(q.isRh || q.souResponsavel);
    if (item.marketingOnly) return !!q.isMarketing;
    if (item.adminOnly) return !!q.isAdmin;
    if (item.managerOnly) return !!(q.isAdmin || q.isManager);
    if (item.mktOrAdminOnly) return !!q.isAdmin;
    if (item.auditoriaOnly) return !!q.canViewAuditoria;
    if (item.requireAuth) return q.isAuthenticated;
    return true;
  });
}

/* ---------- a faixa de cada setor ---------- */

export interface PaginaDoSetor {
  rotulo: string;
  /** Para onde o link leva. */
  to: string;
  /** Esta página está aberta? Recebe o caminho do endereço. */
  aberta: (caminho: string) => boolean;
  /** Só aparece para quem tem o Calendário Anual (marketing ou gestora liberada). */
  soComCalendario?: boolean;
  /** Só para quem entra no Jornal (a comunicação e a gestão da Educação). */
  soComJornal?: boolean;
  /** Só para quem entra no Semanário (professora, orientadora, marketing). */
  soComSemanario?: boolean;
}

/** O que a pessoa pode abrir na faixa (vem de `useUserRole`). */
export interface PodeAbrir {
  temCalendario: boolean;
  canAccessJournal: boolean;
  temSemanario: boolean;
}

/** As páginas de um setor que a pessoa vê, na ordem da faixa. */
export function paginasVisiveis(setor: string, pode: PodeAbrir): PaginaDoSetor[] {
  return (PAGINAS_DOS_SETORES[setor] ?? []).filter(p =>
    (!p.soComCalendario || pode.temCalendario) &&
    (!p.soComJornal || pode.canAccessJournal) &&
    (!p.soComSemanario || pode.temSemanario));
}

/**
 * Para onde o setor leva na barra: a primeira página dele que a pessoa vê. A
 * professora entra na Educação pelo Semanário, não pelo Jornal (17/11/2026).
 */
export function destinoDoSetor(to: string, pode: PodeAbrir): string {
  // Só muda quando a página de entrada do setor é uma das da faixa e a
  // pessoa não a vê (a professora e o Jornal). O Marketing entra pela
  // Auditoria, que não está na faixa, e fica como sempre.
  const entradaNaFaixa = (PAGINAS_DOS_SETORES[to] ?? []).some(p => p.to === to);
  const paginas = paginasVisiveis(to, pode);
  if (!entradaNaFaixa || paginas.some(p => p.to === to)) return to;
  return paginas[0]?.to ?? to;
}

/** O feed "Jornais das unidades", na Educação (16/11/2026). */
export const ROTA_DO_FEED_DO_JORNAL = ROTAS.jornaisDasUnidades;

const abaAberta = (aba: AbaDoMarketing, rotaPropria?: string) => (caminho: string) =>
  caminho === rotaDoMarketing(aba) || (aba === ABA_INICIAL_DO_MARKETING && caminho === ROTAS.marketing) || (!!rotaPropria && caminho.startsWith(rotaPropria));

/** As páginas de cada setor, na ordem da faixa. A chave é o `to` do setor. */
export const PAGINAS_DOS_SETORES: Record<string, PaginaDoSetor[]> = {
  [ROTAS.eventos]: [
    // A programação pública (`/eventos`) também é dos Eventos para quem é da equipe.
    { rotulo: 'Eventos', to: ROTAS.eventos, aberta: (c) => c === ROTAS.eventos || c === '/eventos' },
    { rotulo: 'Calendário Anual', to: ROTAS.calendario, aberta: (c) => c === ROTAS.calendario, soComCalendario: true },
  ],
  // O editor da unidade e o feed dos finalizados de todas (16/11/2026).
  [ROTAS.jornal]: [
    { rotulo: 'Jornal Institucional', to: ROTAS.jornal, aberta: (c) => c === ROTAS.jornal, soComJornal: true },
    { rotulo: 'Jornais das unidades', to: ROTAS.jornaisDasUnidades, aberta: (c) => c === ROTAS.jornaisDasUnidades, soComJornal: true },
    // O planejamento da semana das professoras (17/11/2026).
    { rotulo: 'Semanário', to: ROTAS.semanario, aberta: (c) => c === ROTAS.semanario || c.startsWith(`${ROTAS.semanario}/`), soComSemanario: true },
  ],
  [ROTAS.marketing]: [
    { rotulo: 'Mercado Solidário', to: ROTAS.mercado, aberta: (c) => c === ROTAS.mercado },
    { rotulo: 'Pizza da Alegria', to: rotaDoMarketing('pizza'), aberta: abaAberta('pizza', '/pizza-da-alegria/painel') },
    { rotulo: 'Voluntariado', to: rotaDoMarketing('voluntariado'), aberta: abaAberta('voluntariado') },
    { rotulo: 'Enquetes', to: rotaDoMarketing('enquetes'), aberta: abaAberta('enquetes') },
    { rotulo: 'Manual Design', to: rotaDoMarketing('design-manual'), aberta: abaAberta('design-manual') },
    { rotulo: 'Portal Transparência', to: rotaDoMarketing('transparencia'), aberta: abaAberta('transparencia') },
    { rotulo: 'Widgets', to: rotaDoMarketing('widgets'), aberta: abaAberta('widgets') },
    { rotulo: 'Auditoria', to: rotaDoMarketing('auditoria'), aberta: abaAberta('auditoria') },
  ],
};

/** Os começos de endereço de cada setor (para saber qual está aberto). */
export const ROTAS_DO_SETOR: Record<string, string[]> = {
  [ROTAS.eventos]: ['/social', '/eventos'],
  [ROTAS.jornal]: ['/educacao'],
  [ROTAS.marketing]: [ROTAS.marketing, '/pizza-da-alegria/painel'],
};

/** O setor aberto pelo endereço (o `to` dele no menu), ou nada. */
export function setorDoCaminho(caminho: string): string | null {
  for (const [setor, rotas] of Object.entries(ROTAS_DO_SETOR)) {
    if (rotas.some(r => caminho === r || caminho.startsWith(`${r}/`))) return setor;
  }
  return null;
}

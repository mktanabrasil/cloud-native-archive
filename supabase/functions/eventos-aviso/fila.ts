/**
 * As regras da fila de avisos, sem rede nem Deno: o que entra, quem recebe e
 * como uma chamada reserva um aviso. Separadas do index.ts (13/11/2026) para
 * os testes do app (vitest) alcançarem; o index importa daqui.
 */

/**
 * As caixas da ANA que recebem sempre, lançado ou não. Espelho de
 * `SEMPRE_RECEBEM` em src/lib/events/avisos.ts. adm@ e financeiro@ entraram
 * em 13/11/2026 (pedido de 16/09).
 */
export const SEMPRE_RECEBEM = [
  'mkt@anabrasil.org',
  'contato@anabrasil.org',
  'parceiros@anabrasil.org',
  'eventos@anabrasil.org',
  'adm@anabrasil.org',
  'financeiro@anabrasil.org',
];

/**
 * Configuração dos avisos (PR 3, 16/09/2026), editada pelo Painel e guardada em
 * system_configs (chave 'avisos'). Espelho de src/lib/events/avisosConfig.ts.
 * - pre_lancamento: ligado = só as caixas fixas recebem e-mail (e, no modo
 *   robô, leem a agenda).
 * - extras: e-mails avulsos que recebem tudo quando lançado.
 * - excluidos: pessoas da regra que não recebem, mesmo lançado.
 */
export interface ConfigDeAvisos { pre_lancamento: boolean; extras: string[]; excluidos: string[]; atualizado_por?: string | null; atualizado_em?: string | null }
export interface Perfil { email: string | null; name: string | null; unit: string | null; is_active: boolean | null; permission_level: string | null }

export const normEmail = (e: string) => e.trim().toLowerCase();

/**
 * Em cópia nos e-mails dos setores (19/11/2026, pedido dele): todo e-mail
 * que vai para as listas do RH, do Voluntariado e do Financeiro leva adm@ e
 * financeiro@ em cópia. Espelho de `COPIA_DOS_SETORES` em
 * src/lib/events/avisos.ts.
 */
export const COPIA_DOS_SETORES = ['adm@anabrasil.org', 'financeiro@anabrasil.org'];

/** A cópia sem quem já está no "Para": ninguém recebe o mesmo e-mail duas vezes. */
export function copiaDosSetores(para: string[]): string[] {
  const ja = new Set(para.map(normEmail));
  return COPIA_DOS_SETORES.filter(e => !ja.has(e));
}

/**
 * A configuração a partir do que a leitura de `system_configs` devolveu.
 *
 * Erro na leitura = `null`: quem chama não envia nada e o aviso fica na fila
 * (13/11/2026). Antes o erro caía na variável do Coolify, que já foi removida,
 * e a função agia como "lançado e sem excluídos" — e-mail para a gestão no
 * pré-lançamento, ou para os excluídos depois dele.
 *
 * Sem linha (ou linha estranha): vale a variável `AVISOS_SO_EQUIPE`; sem ela,
 * pré-lançamento. Na dúvida, só as caixas fixas.
 */
export function configDaLeitura(
  linha: { value?: unknown } | null | undefined,
  erro: unknown,
  variavel: string | undefined,
): { config: ConfigDeAvisos | null; origem: 'painel' | 'variavel' | 'erro' } {
  if (erro) return { config: null, origem: 'erro' };
  const v = linha?.value as Record<string, unknown> | undefined;
  if (v && typeof v === 'object' && typeof v.pre_lancamento === 'boolean') {
    const lista = (xs: unknown) => (Array.isArray(xs) ? xs.map((x) => normEmail(String(x))) : []);
    return {
      config: {
        pre_lancamento: v.pre_lancamento,
        extras: lista(v.extras),
        excluidos: lista(v.excluidos),
        atualizado_por: (v.atualizado_por as string | null | undefined) ?? null,
        atualizado_em: (v.atualizado_em as string | null | undefined) ?? null,
      },
      origem: 'painel',
    };
  }
  const so = (variavel || '').trim().toLowerCase();
  return { config: { pre_lancamento: so !== 'false', extras: [], excluidos: [] }, origem: 'variavel' };
}

/**
 * Quem recebe o aviso de um evento: as caixas fixas; lançado, também a gestão
 * ativa da unidade (no Grupo, das três), quem criou e os avulsos — menos os
 * excluídos. Perfil sem nível de acesso fica de fora, como no Painel
 * (`listaDeDestinatarios`), para a lista que a tela mostra ser a que recebe.
 */
export function destinatarios(evento: { unit?: string | null; created_by?: string | null }, perfis: Perfil[], config: ConfigDeAvisos): string[] {
  const lista = new Set<string>(SEMPRE_RECEBEM);
  if (config.pre_lancamento) return Array.from(lista);
  const excluidos = new Set(config.excluidos);
  for (const p of perfis) {
    if (!p.email || p.is_active === false || !p.permission_level) continue;
    // Evento do Grupo ANA Brasil (11/11/2026) avisa as gestoras das três unidades.
    const daUnidade = !!p.unit && p.unit !== 'Administração' && p.permission_level !== 'usuario_padrao'
      && (p.unit === evento.unit || (evento.unit === 'Grupo ANA Brasil' && ['DIC', 'Nilópolis', 'Santana'].includes(p.unit)));
    const criou = !!p.name && !!evento.created_by && p.name.trim().toLowerCase() === String(evento.created_by).trim().toLowerCase();
    const email = normEmail(p.email);
    if ((daUnidade || criou) && !excluidos.has(email)) lista.add(email);
  }
  for (const e of config.extras) if (e && !excluidos.has(e)) lista.add(e);
  return Array.from(lista);
}

/** O mínimo do cliente do Supabase que a reserva usa (o de verdade serve). */
interface ClienteDaFila {
  from(tabela: string): {
    update(campos: Record<string, unknown>): {
      eq(coluna: string, valor: unknown): {
        eq(coluna: string, valor: unknown): { select(colunas: string): PromiseLike<{ data: unknown[] | null; error: unknown }> };
      };
    };
  };
}

/**
 * Reserva um aviso para esta chamada (13/11/2026).
 *
 * Toda gravação de evento chama a função, e duas chamadas que se cruzam liam os
 * mesmos pendentes: o e-mail saía duas vezes e a agenda ganhava um evento
 * duplicado (a cópia sem id ficava órfã). Agora cada chamada tenta avançar
 * `tentativas` a partir do valor que leu; o banco serializa a linha, e só uma
 * consegue. A outra pula o aviso. Se a que reservou cair no meio, o aviso
 * segue pendente com o número novo, e a próxima chamada reserva de novo.
 */
export async function reservar(admin: ClienteDaFila, aviso: { id: string; tentativas: number }): Promise<boolean> {
  const { data, error } = await admin.from('avisos_de_evento')
    .update({ tentativas: aviso.tentativas + 1 })
    .eq('id', aviso.id)
    .eq('tentativas', aviso.tentativas)
    .select('id');
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Quem recebe a devolução (13/11/2026, decisão dele): só quem enviou o evento,
 * achado pelo nome gravado em `created_by`, com perfil ativo e e-mail. No
 * pré-lançamento, ninguém. Os excluídos do Painel também ficam de fora.
 */
export function destinatariosDaDevolucao(evento: { created_by?: string | null }, perfis: Perfil[], config: ConfigDeAvisos): string[] {
  if (config.pre_lancamento) return [];
  const nome = String(evento.created_by || '').trim().toLowerCase();
  if (!nome) return [];
  const excluidos = new Set(config.excluidos);
  const p = perfis.find(x => !!x.email && x.is_active !== false && !!x.name && x.name.trim().toLowerCase() === nome);
  if (!p) return [];
  const email = normEmail(p.email!);
  return excluidos.has(email) ? [] : [email];
}

// ---------- A equipe do dia (18/11/2026, setor Administração, PR 5) ----------

/**
 * Quem recebe os e-mails da equipe do dia e do Financeiro: listas no Painel,
 * guardadas em system_configs ('avisos_equipe'). Espelho de
 * src/lib/events/avisosConfig.ts. A do Financeiro entrou em 19/11/2026.
 */
export interface ConfigDaEquipe { rh: string[]; voluntariado: string[]; financeiro: string[]; atualizado_por?: string | null; atualizado_em?: string | null }
export const CHAVE_DA_CONFIG_DA_EQUIPE = 'avisos_equipe';
export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** As listas a partir da linha lida (sem linha: as duas vazias). E-mails em minúsculas, válidos, sem repetir. */
export function configDaEquipeDaLeitura(linha: { value?: unknown } | null | undefined): ConfigDaEquipe {
  const v = (linha?.value ?? {}) as Record<string, unknown>;
  const lista = (xs: unknown) => Array.isArray(xs) ? Array.from(new Set(xs.map(x => normEmail(String(x))).filter(emailValido))) : [];
  return { rh: lista(v.rh), voluntariado: lista(v.voluntariado), financeiro: lista(v.financeiro), atualizado_por: (v.atualizado_por as string | null | undefined) ?? null, atualizado_em: (v.atualizado_em as string | null | undefined) ?? null };
}

export type TipoDaEquipe = 'equipe_rh' | 'equipe_voluntariado';
export const ehAvisoDaEquipe = (tipo: string): tipo is TipoDaEquipe => tipo === 'equipe_rh' || tipo === 'equipe_voluntariado';

/**
 * Quem recebe o aviso da equipe: a lista do Painel daquele setor. No
 * pré-lançamento, ninguém (como a devolução).
 */
export function destinatariosDaEquipe(tipo: TipoDaEquipe, equipe: ConfigDaEquipe, config: ConfigDeAvisos): string[] {
  if (config.pre_lancamento) return [];
  return [...(tipo === 'equipe_rh' ? equipe.rh : equipe.voluntariado)];
}

// ---------- O Financeiro (19/11/2026, PR 2 do Financeiro) ----------

/** O aviso das compras de um evento: ao confirmar e quando o pedido muda. */
export const ehAvisoDoFinanceiro = (tipo: string): tipo is 'financeiro' => tipo === 'financeiro';

/** Quem recebe: a lista do Financeiro no Painel. No pré-lançamento, ninguém. */
export function destinatariosDoFinanceiro(equipe: ConfigDaEquipe, config: ConfigDeAvisos): string[] {
  if (config.pre_lancamento) return [];
  return [...(equipe.financeiro ?? [])];
}

/**
 * O cancelamento (19/11/2026, decisão dele: "caso cancele o evento, todos
 * recebem o mesmo email"): o e-mail geral de "Evento cancelado" vai também
 * para as listas do Painel dos setores que o evento envolvia: RH se tinha
 * funcionários escalados, Voluntariado se tinha voluntários, Financeiro se
 * tinha compras da ANA. No pré-lançamento, ninguém a mais.
 */
export function listasNoCancelamento(
  envolvia: { funcionarios: boolean; voluntarios: boolean; compras: boolean }, equipe: ConfigDaEquipe | null, config: ConfigDeAvisos,
): string[] {
  if (!equipe || config.pre_lancamento) return [];
  return [
    ...(envolvia.funcionarios ? equipe.rh : []),
    ...(envolvia.voluntarios ? equipe.voluntariado : []),
    ...(envolvia.compras ? equipe.financeiro ?? [] : []),
  ];
}

/**
 * As listas a gravar a partir do que o Painel mandou. A lista que não veio
 * fica como estava: o app de antes (sem a lista do Financeiro) não a apaga.
 */
export function listasParaGravar(pedido: { rh?: unknown; voluntariado?: unknown; financeiro?: unknown }, atual: ConfigDaEquipe): Pick<ConfigDaEquipe, 'rh' | 'voluntariado' | 'financeiro'> {
  const limpa = (xs: unknown, antes: string[]) => Array.isArray(xs) ? Array.from(new Set(xs.map(x => normEmail(String(x))).filter(emailValido))) : antes;
  return { rh: limpa(pedido.rh, atual.rh), voluntariado: limpa(pedido.voluntariado, atual.voluntariado), financeiro: limpa(pedido.financeiro, atual.financeiro) };
}

/** O nome para comparar: sem acento, sem maiúscula, sem espaço sobrando (o mesmo do app e do banco). */
export const nomeChave = (nome: string) =>
  String(nome ?? '').replace(/\s+/g, ' ').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Só os dígitos do WhatsApp, sem o 55 do país. */
export function digitos(texto: string): string {
  const d = String(texto ?? '').replace(/\D/g, '');
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
}
export interface Voluntario { nome: string; whatsapp: string }
export const chaveDoVoluntario = (v: Voluntario) => `${digitos(v.whatsapp)}|${nomeChave(v.nome)}`;

export interface Mudanca<T> { atual: T[]; entraram: T[]; sairam: T[] }

/** Funcionários: quem entrou e quem saiu, pelo nome (sem acento nem maiúscula). */
export function mudancaDosFuncionarios(antes: unknown, agora: unknown): Mudanca<string> {
  const lista = (x: unknown) => (Array.isArray(x) ? x.map(String).map(s => s.trim()).filter(Boolean) : []);
  const a = lista(antes), n = lista(agora);
  const ka = new Set(a.map(nomeChave)), kn = new Set(n.map(nomeChave));
  return { atual: n, entraram: n.filter(x => !ka.has(nomeChave(x))), sairam: a.filter(x => !kn.has(nomeChave(x))) };
}

/** Voluntários: quem entrou e quem saiu, pelo nome e pelo WhatsApp. */
export function mudancaDosVoluntarios(antes: unknown, agora: unknown): Mudanca<Voluntario> {
  const lista = (x: unknown): Voluntario[] => (Array.isArray(x) ? x : [])
    .filter((v): v is Voluntario => !!v && typeof v === 'object' && typeof (v as Voluntario).nome === 'string')
    .map(v => ({ nome: v.nome.trim(), whatsapp: digitos(v.whatsapp) }));
  const a = lista(antes), n = lista(agora);
  const ka = new Set(a.map(chaveDoVoluntario)), kn = new Set(n.map(chaveDoVoluntario));
  return { atual: n, entraram: n.filter(x => !ka.has(chaveDoVoluntario(x))), sairam: a.filter(x => !kn.has(chaveDoVoluntario(x))) };
}

/**
 * O aviso de "Equipe alterada" em que ninguém entrou nem saiu (a unidade só
 * mudou a ordem, ou a grafia de um nome) não sai: é ignorado com o motivo.
 */
export function equipeSemMudanca(tipo: TipoDaEquipe, antes: Record<string, unknown> | null, agora: Record<string, unknown>): boolean {
  if (!antes) return false;
  const m = tipo === 'equipe_rh'
    ? mudancaDosFuncionarios(antes.equipe_funcionarios, agora.equipe_funcionarios)
    : mudancaDosVoluntarios(antes.equipe_voluntarios, agora.equipe_voluntarios);
  return m.entraram.length === 0 && m.sairam.length === 0;
}

import { SEMPRE_RECEBEM, type PerfilParaAviso } from './avisos';

/**
 * Configuração dos avisos, guardada em `system_configs` (chave 'avisos') e
 * editada pelo Painel (PR 3, 16/09/2026). A função `eventos-aviso` lê a mesma
 * chave a cada execução; a variável AVISOS_SO_EQUIPE do Coolify deixou de
 * mandar assim que a configuração existe.
 *
 * - `pre_lancamento`: ligado = só as quatro caixas fixas recebem e-mail.
 * - `extras`: e-mails avulsos, sem cadastro, que recebem tudo (no lançamento).
 * - `excluidos`: pessoas da regra que NÃO recebem, mesmo lançado.
 */
export interface ConfigDeAvisos {
  pre_lancamento: boolean;
  extras: string[];
  excluidos: string[];
  atualizado_por?: string | null;
  atualizado_em?: string | null;
}

export const CONFIG_PADRAO: ConfigDeAvisos = { pre_lancamento: true, extras: [], excluidos: [] };

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
export const normalizarEmail = (e: string) => e.trim().toLowerCase();

export type MotivoDoDestinatario = 'caixa_fixa' | 'gestao' | 'cria_eventos' | 'avulso';
export type EstadoDoDestinatario = 'recebe' | 'entra_no_lancamento' | 'nao_incluir';

export interface LinhaDeDestinatario {
  email: string;
  nome: string | null;
  motivo: MotivoDoDestinatario;
  /** A unidade, quando o motivo é gestão. */
  unidade: string | null;
  estado: EstadoDoDestinatario;
  /** Caixas fixas não podem ser excluídas nem removidas. */
  fixo: boolean;
}

/**
 * A lista que o Painel mostra: quem a regra alcança (caixas fixas, gestão ativa
 * por unidade, quem cria eventos), mais os avulsos, com o estado de cada um
 * diante da configuração. Em minúsculas, sem repetir; fixas primeiro.
 */
export function listaDeDestinatarios(perfis: PerfilParaAviso[], config: ConfigDeAvisos): LinhaDeDestinatario[] {
  const excluidos = new Set(config.excluidos.map(normalizarEmail));
  const estadoDe = (email: string, fixo: boolean): EstadoDoDestinatario => {
    if (fixo) return 'recebe';
    if (excluidos.has(email)) return 'nao_incluir';
    return config.pre_lancamento ? 'entra_no_lancamento' : 'recebe';
  };

  const linhas = new Map<string, LinhaDeDestinatario>();
  for (const fixo of SEMPRE_RECEBEM) linhas.set(fixo, { email: fixo, nome: null, motivo: 'caixa_fixa', unidade: null, estado: 'recebe', fixo: true });

  for (const p of perfis) {
    if (!p.email || p.is_active === false || !p.permission_level || p.permission_level === 'usuario_padrao') continue;
    const email = normalizarEmail(p.email);
    if (linhas.has(email)) continue;
    const gestao = !!p.unit && p.unit !== 'Administração';
    linhas.set(email, { email, nome: p.name, motivo: gestao ? 'gestao' : 'cria_eventos', unidade: gestao ? p.unit : null, estado: estadoDe(email, false), fixo: false });
  }

  for (const e of config.extras) {
    const email = normalizarEmail(e);
    if (!email || linhas.has(email)) continue;
    linhas.set(email, { email, nome: null, motivo: 'avulso', unidade: null, estado: estadoDe(email, false), fixo: false });
  }
  return Array.from(linhas.values());
}

/** Quem entra de fato ao desligar o pré-lançamento: os que hoje estão em "entra no lançamento". */
export const quemEntraNoLancamento = (linhas: LinhaDeDestinatario[]) => linhas.filter(l => l.estado === 'entra_no_lancamento').map(l => l.email);

export const ROTULO_DO_MOTIVO: Record<MotivoDoDestinatario, string> = {
  caixa_fixa: 'caixa fixa',
  gestao: 'gestão',
  cria_eventos: 'cria eventos',
  avulso: 'adicionado por você',
};

export const ROTULO_DO_ESTADO: Record<EstadoDoDestinatario, string> = {
  recebe: 'recebe',
  entra_no_lancamento: 'entra no lançamento',
  nao_incluir: 'não incluir',
};

/** Resumo do título: "4 hoje, 8 no lançamento". */
export function resumoDaLista(linhas: LinhaDeDestinatario[]): string {
  const hoje = linhas.filter(l => l.estado === 'recebe').length;
  const depois = hoje + linhas.filter(l => l.estado === 'entra_no_lancamento').length;
  return depois > hoje ? `${hoje} hoje, ${depois} no lançamento` : `${hoje} ${hoje === 1 ? 'pessoa' : 'pessoas'}`;
}

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

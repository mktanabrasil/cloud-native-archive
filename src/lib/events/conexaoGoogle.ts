/**
 * A conexão do app com o Google Agenda em nome de uma conta da ANA (16/09/2026).
 *
 * A função `eventos-aviso` guarda a conexão no servidor; aqui ficam as leituras
 * puras que o card do Painel e os testes usam para decidir o que mostrar.
 */

export interface ConexaoGoogle {
  google_email: string;
  calendar_id: string | null;
  calendar_nome: string | null;
  conectado_por: string;
  conectado_em: string;
  erro: string | null;
}

export interface EstadoDaAgenda {
  so_equipe: boolean;
  chave_configurada: boolean;
  oauth_configurado: boolean;
  /** 'conexao' = escrevendo na agenda escolhida; 'robo' = agenda do robô (transição); 'nenhum' = nada configurado. */
  modo: 'conexao' | 'robo' | 'nenhum';
  conexao: ConexaoGoogle | null;
  agendas: Array<{ chave: string; calendar_id: string; nome: string; compartilhada_com: string[] }>;
}

export type SituacaoDaConexao =
  | 'nao_conectado'      // nunca conectou: botão Conectar
  | 'sem_agenda'         // conectou, falta escolher a agenda
  | 'perdida'            // o Google desconectou: Reconectar
  | 'conectado';

export function situacaoDaConexao(estado: Pick<EstadoDaAgenda, 'conexao'>): SituacaoDaConexao {
  const c = estado.conexao;
  if (!c) return 'nao_conectado';
  if (c.erro) return 'perdida';
  if (!c.calendar_id) return 'sem_agenda';
  return 'conectado';
}

/** O que o Google devolveu na URL ao voltar: só vale se o `state` for nosso. */
export function retornoDoGoogle(search: string): { code: string; state: string } | null {
  const p = new URLSearchParams(search);
  const code = p.get('code');
  const state = p.get('state');
  if (!code || !state || !state.startsWith('agenda:')) return null;
  return { code, state };
}

/** "Abrir no Google" para uma agenda (id é o e-mail da agenda ou o @group.calendar.google.com). */
export const linkDaAgendaNoGoogle = (calendarId: string) => `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`;

/** Texto da confirmação de troca: quantos eventos saem da agenda antiga. */
export function textoDaTroca(naAgenda: number, nome: string): string {
  if (naAgenda === 0) return `Os próximos eventos confirmados entram em "${nome}".`;
  const n = naAgenda === 1 ? '1 evento sai' : `${naAgenda} eventos saem`;
  return `${n} da agenda antiga do robô ("ANA · Eventos"), que é apagada em seguida, e ${naAgenda === 1 ? 'entra' : 'entram'} em "${nome}" com a cor da unidade. Ninguém recebe e-mail por isso.`;
}

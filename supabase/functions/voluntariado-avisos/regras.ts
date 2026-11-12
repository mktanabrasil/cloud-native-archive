/**
 * Regras dos avisos da Central do Voluntário (13/11/2026), sem rede nem banco:
 * dá para testar à parte. A Central (src/lib/voluntariado/central.ts) e o
 * banco (voluntariado_e_para) usam a mesma regra de "para quem é".
 */

export const ENDERECO_DA_CENTRAL = '/voluntariado/natalfeliz26/central';

/** Um aviso que já saiu da hora há mais que isto não vai mais (não manda "começa às 7h" às 10h). */
export const TOLERANCIA_MIN = 20;

/** Área vazia = todos; turno vazio = todos; "dia todo" está em todos os turnos. */
export function ePara(areas: string[] | null, horarios: string[] | null, opcao1: string | null, horario: string | null): boolean {
  const a = areas ?? [];
  const h = horarios ?? [];
  return (a.length === 0 || (!!opcao1 && a.includes(opcao1)))
    && (h.length === 0 || !horario || horario === 'dia_todo' || h.includes(horario));
}

/** O WhatsApp como o formulário grava: só dígitos, sem o 55 do Brasil. */
export function whatsappDoFormulario(s: string | null | undefined): string {
  let v = String(s ?? '').replace(/\D/g, '');
  if ((v.length === 12 || v.length === 13) && v.startsWith('55')) v = v.slice(2);
  return v;
}

export interface Notificacao {
  titulo: string;
  texto: string;
  url: string;
  tag: string;
}

/** O que vai dentro da notificação (o service worker da Central lê estes campos). */
export function notificacaoDoAviso(a: { id: string; titulo: string; texto: string }): Notificacao {
  return { titulo: a.titulo, texto: a.texto, url: `${ENDERECO_DA_CENTRAL}?aviso=${a.id}`, tag: `aviso-${a.id}` };
}

export const BOAS_VINDAS: Notificacao = {
  titulo: 'Avisos ligados ✓',
  texto: 'Os lembretes do treinamento e do Natal Feliz vão chegar aqui.',
  url: ENDERECO_DA_CENTRAL,
  tag: 'boas-vindas',
};

/** O que fazer com a resposta do serviço de notificação do celular. */
export function resultadoDoEnvio(status: number): 'ok' | 'expirado' | 'falhou' {
  if (status === 404 || status === 410) return 'expirado'; // o celular desligou os avisos ou trocou de chave
  return status >= 200 && status < 300 ? 'ok' : 'falhou';
}

/** Manda em lotes, para não abrir centenas de conexões de uma vez. */
export async function emLotes<T, R>(itens: T[], tamanho: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(f))));
  return saida;
}

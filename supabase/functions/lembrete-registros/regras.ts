/**
 * O lembrete diário dos registros das unidades (24/11/2026, decisões dele).
 *
 * Vai ao grupo ANABRASIL PUBLICAÇÕES de segunda a sexta, às 10h em Brasília:
 *  1. a arte "Enviem os registros das unidades" com a mensagem;
 *  2. o modelo para copiar (Data, Atividade, Informações), numa mensagem só dele;
 *  3. às segundas, também a arte "Como enviar", com o passo a passo.
 * Cada dia útil tem a sua cor (as 5 do material dele); o "Como enviar" troca
 * de cor a cada semana.
 *
 * Só regras e texto, sem Deno nem rede: a função `lembrete-registros` e o
 * painel (Marketing › Lembretes) importam daqui, e a prévia mostra o que vai.
 */

export const HORA_DO_LEMBRETE = 10;
/** Segunda a sexta (getUTCDay: 1 = segunda … 5 = sexta). */
export const DIAS_DO_LEMBRETE = [1, 2, 3, 4, 5];
export const NOMES_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export type Cor = 'azul' | 'amarelo' | 'coral' | 'verde' | 'areia';
/** Na ordem dos dias: segunda azul (a arte base), terça amarelo… sexta areia. */
export const CORES: Cor[] = ['azul', 'amarelo', 'coral', 'verde', 'areia'];
export const NOME_DA_COR: Record<Cor, string> = { azul: 'Azul', amarelo: 'Amarelo', coral: 'Coral', verde: 'Verde-água', areia: 'Areia' };
export const HEX_DA_COR: Record<Cor, string> = { azul: '#01ADFF', amarelo: '#FBCE00', coral: '#F37964', verde: '#81E2CF', areia: '#F5DFBB' };

/** Os arquivos ficam no site, em public/lembretes/. */
export const arteDoLembrete = (cor: Cor) => `registros-${cor}.jpg`;
export const arteDoComoEnviar = (cor: Cor) => `como-enviar-${cor}.jpg`;

export const MENSAGEM_PADRAO = `⚠️ *LEMBRETE*

Olá, pessoal!

Reforçamos a importância de enviar os *registros das atividades das unidades* aqui no grupo de publicações. É com eles que divulgamos o trabalho do ANA Brasil nas *redes sociais* e nos *informativos institucionais*.

Para facilitar o nosso trabalho, enviem as *fotos e vídeos* junto com este modelo preenchido:

📅 *Data:*
🎨 *Atividade:*
📝 *Informações sobre a atividade:* (o que foi feito, quem participou, objetivo e algum momento marcante)

Contamos com a colaboração de toda a equipe para dar visibilidade ao trabalho que vem sendo feito. 💙

Agradecemos!`;

export const MODELO_PADRAO = `📅 *Data:*
🎨 *Atividade:*
📝 *Informações sobre a atividade:*`;

export const LEGENDA_DO_COMO_ENVIAR = '📲 *Como enviar os registros*: as fotos e os vídeos, e logo em seguida o modelo preenchido.';

/** "2026-11-24" → dia da semana (0 = domingo). A data é a de Brasília. */
export const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
export const ehDiaDoLembrete = (dia: string) => DIAS_DO_LEMBRETE.includes(diaDaSemana(dia));

/** A cor do dia útil (segunda azul … sexta areia); fora dele, null. */
export function corDoDia(dia: string): Cor | null {
  const d = diaDaSemana(dia);
  return d >= 1 && d <= 5 ? CORES[d - 1] : null;
}

/** A semana do ano (ISO), para o "Como enviar" trocar de cor a cada segunda. */
export function semanaDoAno(dia: string): number {
  const d = new Date(`${dia}T12:00:00Z`);
  const quinta = new Date(d);
  quinta.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const primeira = new Date(Date.UTC(quinta.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((quinta.getTime() - primeira.getTime()) / 864e5 - 3 + ((primeira.getUTCDay() + 6) % 7)) / 7);
}
export const corDoComoEnviar = (dia: string): Cor => CORES[semanaDoAno(dia) % CORES.length];

/** As mensagens do dia, na ordem em que vão ao grupo. Fora dos dias úteis, nenhuma. */
export type Peca = { tipo: 'imagem'; arquivo: string; legenda: string } | { tipo: 'texto'; texto: string };
export function pecasDoDia(dia: string, mensagem: string, modelo: string): Peca[] {
  const cor = corDoDia(dia);
  if (!cor) return [];
  const pecas: Peca[] = [{ tipo: 'imagem', arquivo: arteDoLembrete(cor), legenda: mensagem.trim() }];
  if (modelo.trim()) pecas.push({ tipo: 'texto', texto: modelo.trim() });
  if (diaDaSemana(dia) === 1) pecas.push({ tipo: 'imagem', arquivo: arteDoComoEnviar(corDoComoEnviar(dia)), legenda: LEGENDA_DO_COMO_ENVIAR });
  return pecas;
}

/** "2026-11-24" no fuso de Brasília. */
export const hojeEmBrasilia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/** O próximo dia útil cujo envio das 10h ainda não passou (em Brasília). */
export function proximoLembrete(agora: Date): string {
  const hora = String(HORA_DO_LEMBRETE).padStart(2, '0');
  let dia = hojeEmBrasilia(agora);
  for (let i = 0; i < 8; i++) {
    if (ehDiaDoLembrete(dia) && new Date(`${dia}T${hora}:00:00-03:00`).getTime() > agora.getTime()) return dia;
    const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); dia = d.toISOString().slice(0, 10);
  }
  return dia;
}

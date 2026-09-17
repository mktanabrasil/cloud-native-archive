/**
 * O mês da edição do Jornal, sem texto livre (varredura de 16/09/2026).
 *
 * `reference_month` continua sendo texto no banco — é o que a folha imprime
 * no cabeçalho e o que o filtro agrupa. O que muda é quem escreve: dois
 * seletores, mês e ano, gravando sempre no mesmo formato ("Setembro 2026").
 * Antes, "Julho/2026", "julho 2026" e "07/2026" viravam três meses no filtro.
 */

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export interface MesEAno { mes: number; ano: number }

/** "Setembro 2026" — o formato único gravado e exibido. */
export function formatarMes({ mes, ano }: MesEAno): string {
  return `${MESES[mes - 1]} ${ano}`;
}

/** O mês de hoje, para vir pré-marcado na criação. */
export function mesAtual(agora: Date = new Date()): MesEAno {
  return { mes: agora.getMonth() + 1, ano: agora.getFullYear() };
}

/**
 * Lê um texto de mês, novo ou antigo, de volta para os seletores. Aceita
 * "Setembro 2026", "Setembro/2026", "setembro de 2026", "09/2026" e "2026-09".
 * Devolve null para o que não dá para entender — o seletor fica vazio e o
 * texto original continua guardado até a pessoa escolher.
 */
export function interpretarMes(texto: string | null | undefined): MesEAno | null {
  if (!texto) return null;
  const t = texto.trim().toLowerCase().replace(/\s+de\s+/g, ' ');
  const nome = t.match(/^([a-zç]+)[\s/.-]+(\d{4})$/);
  if (nome) {
    const indice = MESES.findIndex((m) => m.toLowerCase() === nome[1]);
    if (indice >= 0) return { mes: indice + 1, ano: Number(nome[2]) };
    return null;
  }
  const mmAaaa = t.match(/^(\d{1,2})[\s/.-](\d{4})$/);
  const aaaaMm = t.match(/^(\d{4})-(\d{1,2})$/);
  const par = mmAaaa
    ? { mes: Number(mmAaaa[1]), ano: Number(mmAaaa[2]) }
    : aaaaMm
      ? { mes: Number(aaaaMm[2]), ano: Number(aaaaMm[1]) }
      : null;
  if (par && par.mes >= 1 && par.mes <= 12 && par.ano > 2000) return par;
  return null;
}

/** Os anos oferecidos: do ano passado até o próximo, mais o do valor atual se estiver fora. */
export function anosDisponiveis(atual?: MesEAno | null, hoje: Date = new Date()): number[] {
  const base = hoje.getFullYear();
  const anos = new Set([base - 1, base, base + 1]);
  if (atual) anos.add(atual.ano);
  return Array.from(anos).sort((a, b) => b - a);
}

/**
 * Ordena os meses do filtro do mais recente para o mais antigo; textos antigos
 * que não seguem o padrão ficam no fim, na ordem em que apareceram.
 */
export function ordenarMeses(textos: string[]): string[] {
  const conhecidos = textos.filter((t) => interpretarMes(t)).sort((a, b) => {
    const x = interpretarMes(a)!; const y = interpretarMes(b)!;
    return y.ano * 12 + y.mes - (x.ano * 12 + x.mes);
  });
  const outros = textos.filter((t) => !interpretarMes(t));
  return [...conhecidos, ...outros];
}

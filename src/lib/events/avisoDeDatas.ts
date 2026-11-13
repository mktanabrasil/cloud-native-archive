/**
 * Um aviso leve sobre as datas, que não impede salvar (13/11/2026).
 *
 * No celular, um ano errado no seletor fazia um evento de 12 meses — em
 * conflito com a unidade inteira — sem nenhum alerta. Aqui só se avisa: um
 * evento pode, sim, durar mais de uma semana (uma colônia de férias).
 */
export const DIAS_PARA_AVISAR = 7;

export function avisoDeDatas(inicio: string | null | undefined, fim: string | null | undefined, opcoes: { novo: boolean; agora?: Date }): string | null {
  if (!inicio) return null;
  const i = new Date(inicio);
  if (Number.isNaN(i.getTime())) return null;
  const agora = opcoes.agora ?? new Date();
  if (opcoes.novo && i.getTime() < agora.getTime() - 60 * 60 * 1000) return 'O início já passou. Confira o dia e o ano.';
  if (fim) {
    const f = new Date(fim);
    const dias = (f.getTime() - i.getTime()) / 86_400_000;
    if (!Number.isNaN(dias) && dias > DIAS_PARA_AVISAR) return `O evento dura ${Math.round(dias)} dias. Confira o término, principalmente o ano.`;
  }
  return null;
}

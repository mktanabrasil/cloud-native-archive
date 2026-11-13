import type { PassoTutorial } from '@/lib/journal/tutorial';

/**
 * O tutorial do Calendário Anual (13/11/2026, textos aprovados por ele).
 *
 * Dois roteiros, como no Jornal: o do início, no primeiro acesso, e o do mês
 * a mês, na primeira vez que ela abre um mês. Cada um abre sozinho uma vez
 * (o "já vi" fica por conta, em `tutoriais_vistos`) e volta pelo botão
 * "Ver o tutorial".
 */
export type RoteiroDoCalendario = 'calendario-inicio' | 'calendario-mes';

export const ROTEIROS_DO_CALENDARIO: Record<RoteiroDoCalendario, PassoTutorial[]> = {
  'calendario-inicio': [
    {
      alvo: 'cal-andamento',
      titulo: 'Aqui vocês montam o Calendário Anual',
      texto: 'O andamento mostra em que pé está: o preenchimento por vocês, a revisão do marketing e o PDF liberado.',
    },
    {
      alvo: 'cal-tema',
      titulo: 'Comecem pelo tema do ano',
      texto: 'Ele vai na capa do calendário.',
    },
    {
      alvo: 'cal-percursos',
      titulo: 'Os percursos',
      texto: 'O tema e as sugestões de atividades de cada mês. Vieram os de 2026: revisem e troquem o que mudou.',
    },
    {
      alvo: 'cal-mes',
      titulo: 'O mês a mês',
      texto: 'Aqui vocês acrescentam as atividades e os eventos das unidades. Os feriados e as datas relevantes do ano já estão lá.',
    },
    {
      alvo: 'cal-textos',
      titulo: 'Os textos do projeto',
      texto: 'As páginas 2 a 10 do PDF. Vieram os textos de 2026: revisem e troquem o que mudou.',
    },
    {
      alvo: 'cal-pdf',
      titulo: 'O PDF final',
      texto: 'É montado pelo marketing, no formato de sempre, e aparece aqui para baixar depois de aprovado.',
    },
    {
      alvo: 'cal-ajuda',
      titulo: 'Este tutorial não some',
      texto: 'Ele abre sozinho só na primeira vez. Depois, é só tocar em “Ver o tutorial” quando quiser rever.',
    },
  ],
  'calendario-mes': [
    {
      alvo: 'cal-tema-mes',
      titulo: 'O tema do mês',
      texto: 'Vai no título da página do mês, no PDF. A sugestão de atividade vai na tabela dos percursos.',
    },
    {
      alvo: 'cal-grade',
      titulo: 'O mês inteiro',
      texto: 'Os feriados aparecem em coral, as datas relevantes em cinza e as atividades de vocês em verde. Toquem num dia para abri-lo.',
    },
    {
      alvo: 'cal-dia',
      titulo: 'Para acrescentar',
      texto: 'Escrevam o que acontece, marquem as unidades (ou Todas) e se vai em negrito no PDF. Uma data relevante que não interessa pode ser escondida do PDF pelo olho; o feriado não sai.',
    },
    {
      alvo: 'cal-revisado',
      titulo: 'Terminou o mês?',
      texto: 'Marquem como revisado e passem para o próximo. O andamento, no início, mostra quantos meses faltam.',
    },
  ],
};

import type { PassoTutorial } from '@/lib/journal/tutorial';

/**
 * O tutorial do Calendário Anual (13/11/2026, textos aprovados por ele).
 *
 * Dois roteiros, como no Jornal: o do início, no primeiro acesso, e o do mês
 * a mês, na primeira vez que ela abre um mês. Cada um abre sozinho uma vez
 * (o "já vi" fica por conta, em `tutoriais_vistos`) e volta pelo botão
 * "Ver o tutorial".
 */
export type RoteiroDoCalendario = 'calendario-inicio' | 'calendario-mes' | 'calendario-fichario-inicio' | 'calendario-fichario-mes';

/**
 * O fichário digital (19/11/2026): depois de aprovado e impresso, dois
 * roteiros novos, com o "já vi" deles. Assim abrem sozinhos na primeira vez
 * no fichário, mesmo para quem já viu os do preenchimento.
 */
export const roteiroDoCalendario = (parte: string, fichario: boolean): RoteiroDoCalendario | null =>
  parte === 'inicio' ? (fichario ? 'calendario-fichario-inicio' : 'calendario-inicio')
    : parte === 'mes' ? (fichario ? 'calendario-fichario-mes' : 'calendario-mes')
      : null;

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
      titulo: 'A prévia e o envio',
      texto: 'Aqui vocês veem a prévia do PDF e, com o tema e os 12 meses revisados, enviam ao marketing. O PDF final aparece aqui para baixar depois de aprovado.',
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
  'calendario-fichario-inicio': [
    {
      alvo: 'cal-andamento',
      titulo: 'Agora o calendário é um fichário',
      texto: 'Ele foi aprovado e impresso, e continua aberto aqui: vocês acrescentam no mês a mês e imprimem só as folhas que mudarem. Tema, percursos e textos ficam como foram impressos.',
    },
    {
      alvo: 'cal-mes',
      titulo: 'Os meses que mudaram',
      texto: 'Cada mudança depois da impressão marca o mês em coral. Os eventos confirmados no formulário de eventos entram sozinhos, em todos os dias deles.',
    },
    {
      alvo: 'cal-pdf',
      titulo: 'Baixar para imprimir',
      texto: 'Escolham de quem (a sua unidade ou geral) e o quê: só as folhas que mudaram, que já vêm marcadas, ou o calendário inteiro. Sai pronto para a impressora preto e branco, com a sigla da unidade em cada atividade e a data no pé da folha.',
    },
    {
      alvo: 'cal-folhas',
      titulo: 'As folhas extras',
      texto: 'Uma folha a mais no fichário, no padrão do calendário: um roteiro, uma lista de contatos, o que precisarem. Fica depois do mês que escolherem e pode ser baixada sozinha.',
    },
    {
      alvo: 'cal-ajuda',
      titulo: 'Este tutorial não some',
      texto: 'Ele abre sozinho só na primeira vez. Depois, é só tocar em “Ver o tutorial” quando quiser rever.',
    },
  ],
  'calendario-fichario-mes': [
    {
      alvo: 'cal-grade',
      titulo: 'O mês, como está agora',
      texto: 'O que entrou depois da impressão tem contorno coral. O que tem o ícone de evento veio sozinho do formulário de eventos: para mudar, mudem o evento.',
    },
    {
      alvo: 'cal-dia',
      titulo: 'Para acrescentar ou tirar',
      texto: 'Acrescentem como antes. Cada gestão apaga só as suas atividades: as que acrescentou ou as que são só da sua unidade.',
    },
    {
      alvo: 'cal-mudancas',
      titulo: 'O que mudou neste mês',
      texto: 'A lista do que entrou e saiu desde a impressão. Daqui sai a folha deste mês para trocar no fichário.',
    },
  ],
};

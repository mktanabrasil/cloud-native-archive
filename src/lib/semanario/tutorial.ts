import type { PassoTutorial } from '@/lib/journal/tutorial';

/**
 * O tutorial do Semanário (PR 8, 17/11/2026), no molde do Calendário Anual.
 *
 * Três roteiros, cada um na sua tela:
 *  - `semanario-inicio`: o início da professora (ListaDaProfessora);
 *  - `semanario-ficha`: o preenchimento, na primeira vez que ela abre um
 *    semanário dela ainda em preenchimento (FichaDoSemanario);
 *  - `semanario-orientadora`: a lista do CEI da orientadora (ListaDaUnidade).
 * Cada um abre sozinho uma vez (o "já vi" fica por conta, em
 * `tutoriais_vistos`) e volta pelo botão "Ver o tutorial". Quando o alvo não
 * está na tela (no celular a folha ao lado não existe; a devolutiva só aparece
 * depois que vier), o cartão aparece no meio, sem holofote.
 *
 * Mudou a tela do Semanário? Releia estes textos (o teste pega a âncora
 * perdida; o passo que virou mentira, só lendo).
 */
export type RoteiroDoSemanario = 'semanario-inicio' | 'semanario-ficha' | 'semanario-orientadora';

export const ROTEIROS_DO_SEMANARIO: Record<RoteiroDoSemanario, PassoTutorial[]> = {
  'semanario-inicio': [
    {
      alvo: 'sem-semana',
      titulo: 'Aqui você faz o seu semanário',
      texto: 'O planejamento da semana, no modelo da Orientação Pedagógica. Aqui ficam as semanas em andamento: quantos dias estão preenchidos, a situação e, enquanto não for enviado, o prazo de envio (a quarta antes da semana).',
    },
    {
      alvo: 'sem-comecar',
      titulo: 'Para começar',
      texto: 'Escolha a semana e toque em “Começar”. É um semanário por agrupamento: se você tem dois, começa dois.',
    },
    {
      alvo: 'sem-devolutiva',
      titulo: 'A devolutiva',
      texto: 'Quando a orientadora pedagógica ler o seu semanário, a devolutiva dela aparece aqui. Ela também chega no seu e-mail.',
    },
    {
      alvo: 'sem-anteriores',
      titulo: 'As semanas anteriores',
      texto: 'Ficam guardadas aqui, com o botão para baixar o PDF de cada uma.',
    },
    {
      alvo: 'sem-ajuda',
      titulo: 'Este tutorial não some',
      texto: 'Ele abre sozinho só na primeira vez. Depois, é só tocar em “Ver o tutorial” quando quiser rever.',
    },
  ],
  'semanario-ficha': [
    {
      alvo: 'sem-gravacao',
      titulo: 'Salva sozinho',
      texto: 'Tudo o que você escreve é gravado na hora. Aqui aparece “Tudo salvo”; se a internet cair, aparece “Não salvou” e o botão para tentar de novo.',
    },
    {
      alvo: 'sem-cabecalho',
      titulo: 'O agrupamento',
      texto: 'Escreva como na escola: AG I A, AG I B, AG II… A professora e o período já vêm preenchidos.',
    },
    {
      alvo: 'sem-dias',
      titulo: 'Os cinco dias',
      texto: 'Toque num dia para abrir: projeto, proposta, objetivo e desenvolvimento. Ao lado do dia aparece quantos dos 4 campos já estão preenchidos.',
    },
    {
      alvo: 'sem-campos-da-semana',
      titulo: 'Para a semana toda',
      texto: 'As formas de registro e os materiais. A avaliação das propostas continua aberta depois do envio: preencha quando a semana acabar.',
    },
    {
      alvo: 'sem-folha',
      titulo: 'Como vai sair',
      texto: 'No computador, a página do PDF fica ao lado e se refaz enquanto você escreve; no celular, veja pela prévia. Texto comprido deixa a letra menor; se nem assim couber, um aviso diz qual quadro encurtar, e o envio espera.',
    },
    {
      alvo: 'sem-previa',
      titulo: 'A prévia',
      texto: 'As duas páginas do PDF, do jeito que a orientadora vai ver, com o botão para baixar.',
    },
    {
      alvo: 'sem-enviar',
      titulo: 'Enviar à orientadora',
      texto: 'Até quarta. Ela recebe um e-mail e responde por aqui. Enquanto ela não der a devolutiva, dá para desfazer o envio e mudar o planejamento.',
    },
    {
      alvo: 'sem-ajuda',
      titulo: 'Este tutorial não some',
      texto: 'Ele abre sozinho só na primeira vez. Depois, é só tocar em “Ver o tutorial” quando quiser rever.',
    },
  ],
  'semanario-orientadora': [
    {
      alvo: 'sem-semanas',
      titulo: 'Os semanários do seu CEI',
      texto: 'Abre na próxima semana, com os prazos: envio até quarta, devolutiva até quinta. Para ver uma semana anterior, toque nela.',
    },
    {
      alvo: 'sem-pedidos',
      titulo: 'Pedidos de acesso',
      texto: 'Quando uma professora do seu CEI pedir acesso ao app, o pedido aparece aqui em cima, para você aprovar ou recusar.',
    },
    {
      alvo: 'sem-lista',
      titulo: 'Quem já enviou',
      texto: 'Os que aguardam devolutiva vêm primeiro. A cada envio, você também recebe um e-mail com o link.',
    },
    {
      alvo: 'sem-painel',
      titulo: 'A devolutiva',
      texto: 'No computador, o semanário escolhido abre ao lado: o campo da devolutiva em cima (ele abre quando a professora envia) e a folha embaixo. No celular, tocar na lista abre o semanário inteiro.',
    },
    {
      alvo: 'sem-ajuda',
      titulo: 'Este tutorial não some',
      texto: 'Ele abre sozinho só na primeira vez. Depois, é só tocar em “Ver o tutorial” quando quiser rever.',
    },
  ],
};

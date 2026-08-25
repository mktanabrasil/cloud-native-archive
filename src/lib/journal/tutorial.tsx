import type { ReactNode } from 'react';

/**
 * Conteúdo do tutorial de primeiro acesso ao Jornal.
 *
 * Mora fora do componente porque o texto é o que se revisa: mexer numa palavra
 * não deveria exigir abrir a lógica do passo a passo.
 *
 * Cada passo carrega uma ideia só, com um esquema da região da tela. Esquema, e
 * não captura: captura envelhece a cada mudança de interface, e esta tela mudou
 * várias vezes só neste mês.
 */
export interface TutorialStep {
  titulo: string;
  /** Um parágrafo por ideia; `<strong>` destaca o que a pessoa vai procurar na tela. */
  corpo: ReactNode[];
  figura: ReactNode;
  legenda: string;
}

/*
 * Auxiliares de desenho. São funções que devolvem JSX, e não componentes, de
 * propósito: este arquivo é conteúdo, e declarar componentes aqui faria o
 * recarregamento a quente perder o estado do editor a cada ajuste de texto.
 */

const botao = (texto: ReactNode, solido = false) => (
  <span
    className={
      solido
        ? 'inline-block whitespace-nowrap rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground'
        : 'inline-block whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-foreground'
    }
  >
    {texto}
  </span>
);

const etiqueta = (tipo: 'rascunho' | 'finalizado') => (
  <span
    className={
      tipo === 'finalizado'
        ? 'inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200'
        : 'inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
    }
  >
    {tipo === 'finalizado' ? 'Finalizado' : 'Rascunho'}
  </span>
);

const cartao = (tipo: 'rascunho' | 'finalizado', chave: string) => (
  <div key={chave} className="flex-1 rounded-lg border border-border bg-card p-1.5">
    <div className="mb-1.5 h-8 rounded-sm bg-news-paper" />
    <div className="h-1 w-2/3 rounded-full bg-foreground/20" />
    <div className="mt-1.5">{etiqueta(tipo)}</div>
  </div>
);

export const JOURNAL_TUTORIAL: TutorialStep[] = [
  {
    titulo: 'Bem-vinda ao Jornal',
    corpo: [
      <>
        Aqui você monta o jornal da sua unidade, página por página, e no final baixa um PDF pronto
        para imprimir ou enviar pelo WhatsApp.
      </>,
      <>
        São <strong>oito telas rápidas</strong>. Pode sair quando quiser: o tutorial fica guardado no
        botão de ajuda, no topo, e você reabre quando precisar.
      </>,
      <>
        <strong>Nada se perde.</strong> O jornal salva sozinho a cada alteração — não existe botão de
        salvar para esquecer de apertar.
      </>,
    ],
    figura: botao('✓ Tudo salvo · 14:32'),
    legenda: 'O aviso no topo confirma que está tudo guardado.',
  },
  {
    titulo: 'A lista de edições',
    corpo: [
      <>
        Cada cartão é uma edição do jornal. A etiqueta colorida diz em que pé ela está:{' '}
        <strong>Rascunho</strong> enquanto está sendo montada, <strong>Finalizado</strong> quando
        você marca que terminou.
      </>,
      <>
        O botão <strong>Criar jornal</strong> começa uma edição nova, já com as páginas prontas do
        modelo escolhido. Em cada cartão você pode <strong>Abrir</strong>,{' '}
        <strong>Duplicar</strong> — útil para aproveitar o mês anterior — ou{' '}
        <strong>Excluir</strong>.
      </>,
    ],
    figura: (
      <div className="flex w-full gap-2">
        {cartao('rascunho', 'a')}
        {cartao('finalizado', 'b')}
        {cartao('rascunho', 'c')}
      </div>
    ),
    legenda: 'A etiqueta de cada cartão mostra o estado da edição.',
  },
  {
    titulo: 'As três áreas do editor',
    corpo: [
      <>
        Ao abrir uma edição, a tela se divide em três. À <strong>esquerda</strong> ficam as páginas
        do jornal. No <strong>meio</strong>, a folha em que você está trabalhando. À{' '}
        <strong>direita</strong>, o que dá para colocar e ajustar naquela página.
      </>,
      <>
        É sempre assim: você escolhe a página à esquerda, vê o resultado no meio e edita pela
        direita.
      </>,
    ],
    figura: (
      <div className="grid w-full grid-cols-[72px_1fr_88px] gap-2 text-center">
        {[
          { t: 'Páginas', s: 'escolha aqui', destaque: false },
          { t: 'A folha', s: 'o resultado', destaque: true },
          { t: 'Conteúdo', s: 'edite aqui', destaque: false },
        ].map((col) => (
          <div
            key={col.t}
            className={[
              'flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-2',
              col.destaque ? 'border-primary bg-primary/10' : 'border-border',
            ].join(' ')}
          >
            <span className="text-[10.5px] font-semibold text-foreground">{col.t}</span>
            <span className="text-[9.5px] text-muted-foreground">{col.s}</span>
          </div>
        ))}
      </div>
    ),
    legenda: 'Da esquerda para a direita: escolher, ver, editar.',
  },
  {
    titulo: 'As páginas da edição',
    corpo: [
      <>
        Na coluna da esquerda estão as miniaturas. Clique em uma para trabalhar nela. Embaixo de cada
        miniatura aparece <strong>✓ Completa</strong> ou <strong>● Pendente</strong> — pendente quer
        dizer que ainda falta preencher algum texto ou enviar alguma imagem naquela página.
      </>,
      <>
        Para incluir mais páginas, use <strong>Adicionar página</strong> e escolha o tipo: Capa,
        Matérias, Matéria completa, Galeria, Resultados e números, Contracapa ou Em branco.
      </>,
    ],
    figura: (
      <div className="flex items-start gap-3">
        <div className="w-[58px]">
          <div className="mb-1 h-10 rounded-sm border-2 border-primary bg-news-paper" />
          <span className="text-[9px] font-semibold text-primary">✓ Completa</span>
        </div>
        <div className="w-[58px]">
          <div className="mb-1 h-10 rounded-sm border border-border bg-news-paper" />
          <span className="text-[9px] text-muted-foreground">● Pendente</span>
        </div>
        <div className="self-center">
          {botao('+ Adicionar página')}
        </div>
      </div>
    ),
    legenda: 'O selo avisa se ainda falta alguma coisa na página.',
  },
  {
    titulo: 'Escrever e trocar as imagens',
    corpo: [
      <>
        Clique em qualquer parte da folha — um título, um parágrafo, uma foto — e as opções daquele
        item aparecem na coluna da direita. É ali que você troca o texto ou envia a imagem.
      </>,
      <>
        O jornal vem com o <strong>layout travado</strong>: você mexe no conteúdo, e o desenho da
        página fica protegido. É o modo recomendado, porque não tem como bagunçar o modelo sem
        querer.
      </>,
      <>
        Se precisar de mais liberdade, troque para <strong>Layout livre</strong> na barra acima da
        folha. Aí dá para mudar tamanho, posição e ordem dos blocos, e também incluir novos.
      </>,
    ],
    figura: (
      <div className="flex w-full flex-col items-center gap-1.5">
        <div className="h-4 w-3/4 rounded bg-foreground/10" />
        <div className="h-8 w-3/4 rounded bg-primary/30 ring-2 ring-primary" />
        <div className="h-4 w-3/4 rounded bg-foreground/10" />
        <span className="mt-1 text-[10px] text-muted-foreground">
          ↑ item selecionado abre na direita
        </span>
      </div>
    ),
    legenda: 'Clicar no item da folha é o começo de qualquer edição.',
  },
  {
    titulo: 'A aparência da folha',
    corpo: [
      <>
        As <strong>Formas ANA</strong> são as silhuetas coloridas dos cantos. Escolha uma e ela entra
        nos <strong>quatro cantos de todas as páginas</strong> de uma vez, já espelhada do jeito
        certo. Depois, se quiser, dá para trocar a cor de cada canto ou remover algum.
      </>,
      <>
        Em <strong>Opções da folha</strong> você escolhe o fundo do jornal inteiro: off-white
        institucional ou branco.
      </>,
      <>
        Tamanho e posição das formas são definidos pela identidade da ANA — você escolhe a forma e a
        cor, o resto o sistema resolve.
      </>,
    ],
    figura: (
      <div className="flex items-center gap-4">
        <div className="relative h-[104px] w-[78px] overflow-hidden rounded-sm border border-border bg-news-paper">
          <i className="absolute left-0 top-0 h-6 w-6 rounded-br-full bg-news-brand-1" />
          <i className="absolute right-0 top-0 h-6 w-6 rounded-bl-full bg-news-brand-1" />
          <i className="absolute bottom-0 left-0 h-6 w-6 rounded-tr-full bg-news-brand-1" />
          <i className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-full bg-news-brand-1" />
        </div>
        <div className="flex flex-col gap-1.5">
          {['bg-news-brand-1', 'bg-news-brand-4', 'bg-news-brand-2'].map((cor) => (
            <span key={cor} className={`h-5 w-5 rounded-full border border-border ${cor}`} />
          ))}
        </div>
      </div>
    ),
    legenda: 'Um clique veste os quatro cantos; a cor você ajusta depois.',
  },
  {
    titulo: 'Finalizar e baixar o PDF',
    corpo: [
      <>
        Quando o jornal estiver pronto, clique em <strong>Baixar PDF</strong>. Existem duas versões:{' '}
        <strong>impressão</strong>, com qualidade alta para a gráfica, e <strong>digital</strong>,
        mais leve para enviar por mensagem ou e-mail.
      </>,
      <>
        Clique também em <strong>Finalizar edição</strong>. Isso troca a etiqueta de Rascunho para{' '}
        <strong>Finalizado</strong>, e é assim que todo mundo enxerga, já na lista, que aquela edição
        está concluída.
      </>,
      <>
        Mudou de ideia ou achou um erro depois? O mesmo botão vira{' '}
        <strong>Reabrir como rascunho</strong>. Finalizar não tranca nada — o jornal continua
        editável.
      </>,
    ],
    figura: (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {botao('Baixar PDF', true)}
        {botao('✓ Finalizar edição', true)}
        {etiqueta('finalizado')}
      </div>
    ),
    legenda: 'Finalizar é um aviso para a equipe, não uma tranca.',
  },
  {
    titulo: 'Pronto, é isso!',
    corpo: [
      <>
        Você já sabe o suficiente para montar a primeira edição. O resto se aprende clicando — e,
        como tudo salva sozinho, não há risco em experimentar.
      </>,
      <>
        Este tutorial não vai aparecer de novo sozinho. Sempre que quiser rever, ele está no{' '}
        <strong>botão de ajuda</strong>, no topo da tela do Jornal.
      </>,
    ],
    figura: (
      <div className="flex items-center gap-2">
        {botao('? Ajuda')}
        <span className="text-[11px] text-muted-foreground">← o tutorial mora aqui</span>
      </div>
    ),
    legenda: 'Reabra quantas vezes precisar.',
  },
];

/**
 * O tutorial do Jornal — o que ele ensina, e o que ele lembra.
 *
 * São **dois percursos**, e não um só. A maquete mostrava um único caminho
 * atravessando a listagem e o editor, mas isso não sobrevive ao uso real: no
 * primeiro acesso a diretora está na lista e pode não ter jornal nenhum, então
 * não existe editor na tela para apontar. Apontar para o que não está lá
 * ensinaria a procurar um botão invisível.
 *
 * Por isso cada percurso abre no seu momento: a lista quando ela chega ao
 * Jornal, o editor quando ela abre uma edição pela primeira vez. Cada um é
 * curto o bastante para terminar.
 */

export type PercursoId = 'listagem' | 'editor';

export interface PassoTutorial {
  /** Valor do `data-tutorial` do elemento que recebe o holofote. */
  alvo: string;
  titulo: string;
  texto: string;
}

/**
 * Os passos.
 *
 * O texto fala do que ela ganha, não do que o controle é. "Salva sozinho" em
 * vez de "indicador de autosave" — quem lê não conhece o vocabulário, conhece
 * a preocupação.
 */
export const PERCURSOS: Record<PercursoId, PassoTutorial[]> = {
  listagem: [
    {
      alvo: 'unidade',
      titulo: 'Aqui ficam os jornais da sua unidade',
      texto:
        'Esta página mostra só as edições da sua unidade. Todo jornal que você criar já nasce ligado a ela.',
    },
    {
      alvo: 'criar',
      titulo: 'Comece por aqui',
      texto:
        'Dê um nome à edição e escolha um modelo: Padrão, Pedagógico, Eventos ou Em branco. Ele já vem com as páginas montadas.',
    },
    {
      alvo: 'lista',
      titulo: 'Suas edições ficam nesta lista',
      texto:
        'Abrir para continuar de onde parou, duplicar para aproveitar o mês passado, excluir se não for mais usar.',
    },
    {
      alvo: 'ajuda',
      titulo: 'Este tutorial não some',
      texto:
        'Ele abre sozinho só na primeira vez. Depois, é por este botão sempre que você quiser rever.',
    },
  ],
  editor: [
    {
      alvo: 'folha',
      titulo: 'Esta é a sua folha',
      texto:
        'Cabeçalho, rodapé, margens e cores já vêm prontos da identidade da ANA. Você cuida do conteúdo; a aparência não sai do lugar.',
    },
    {
      alvo: 'paginas',
      titulo: 'As páginas ficam aqui',
      texto:
        'Clique numa miniatura para trabalhar nela. O selo diz se a página está completa ou se ainda falta preencher alguma peça.',
    },
    {
      alvo: 'painel',
      titulo: 'Clique numa peça para editar',
      texto:
        'Cada texto e cada foto é uma peça. Ao clicar nela na folha, este painel mostra o que dá para trocar.',
    },
    {
      alvo: 'painel',
      titulo: 'Colocar uma foto',
      texto:
        'Clique no quadro da foto e use “Enviar imagem”. A legenda é opcional e aparece logo abaixo dela.',
    },
    {
      alvo: 'folha',
      titulo: 'A foto preenche o quadro',
      texto:
        'Ela não encolhe para caber: preenche o espaço e o que sobra fica de fora. Para mudar o que aparece, mude o tamanho do quadro — puxe a borda direita da peça para a largura, a de baixo para a altura. Dois cliques na borda de baixo voltam ao automático.',
    },
    {
      alvo: 'formato',
      titulo: 'O formato vem protegido',
      texto:
        'Assim você troca textos e fotos sem bagunçar o desenho. Para mover as peças de lugar, libere o formato aqui.',
    },
    {
      alvo: 'paginas',
      titulo: 'Precisa de mais espaço?',
      texto:
        'Adicione uma página e escolha o modelo dela: capa, matéria, galeria de fotos, agenda ou resultados.',
    },
    {
      alvo: 'salvo',
      titulo: 'Salva sozinho',
      texto:
        'Não existe botão de salvar. Este aviso confirma que está tudo guardado — pode fechar quando quiser.',
    },
    {
      alvo: 'status',
      titulo: 'Quando terminar',
      texto:
        'Marque como finalizado. É só uma etiqueta: dá para reabrir como rascunho depois, se precisar corrigir.',
    },
    {
      alvo: 'pdf',
      titulo: 'Gerar o PDF',
      texto:
        'Digital para enviar por mensagem, impressão para imprimir de verdade. Pronto — você fez um jornal.',
    },
  ],
};

/**
 * O "já vi" mora no navegador.
 *
 * É a escolha que não pede coluna nova nem migração — e `journals` já tem
 * bastante coisa. O preço: se ela trocar de computador, o tutorial abre de
 * novo. Para quem usa sempre a mesma máquina, isso nunca aparece; se as
 * diretoras passarem a alternar entre a escola e casa, vale mover para o
 * perfil.
 *
 * A mesma proteção de `pedidoEnviado`: navegador sem armazenamento não pode
 * derrubar a página. Sem a marca, o tutorial reabre — chato, não quebrado.
 */
const CHAVE: Record<PercursoId, string> = {
  listagem: 'ana_tutorial_jornal_listagem',
  editor: 'ana_tutorial_jornal_editor',
};

export function jaViu(percurso: PercursoId): boolean {
  try {
    return localStorage.getItem(CHAVE[percurso]) === '1';
  } catch {
    return false;
  }
}

export function marcarVisto(percurso: PercursoId): void {
  try {
    localStorage.setItem(CHAVE[percurso], '1');
  } catch {
    /* sem armazenamento: o tutorial reabre da próxima vez, e só */
  }
}

/** Faz o tutorial voltar a abrir sozinho. Serve para demonstrar a alguém. */
export function esquecerTutoriais(): void {
  try {
    (Object.keys(CHAVE) as PercursoId[]).forEach((p) => localStorage.removeItem(CHAVE[p]));
  } catch {
    /* idem */
  }
}

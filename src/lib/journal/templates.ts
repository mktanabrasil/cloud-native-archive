import type {
  BlockSpan,
  JournalBlock,
  JournalDecoration,
  JournalPage,
  JournalTemplate,
  TextStyleKey,
} from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function textBlock(
  style: TextStyleKey,
  content: string,
  span: BlockSpan = 6,
  align: 'left' | 'center' | 'right' = 'left',
): JournalBlock {
  return { id: uid(), kind: 'text', style, content, span, align };
}

export function imageBlock(span: BlockSpan = 6, ratio: '16/9' | '4/3' | '1/1' | '3/4' = '16/9'): JournalBlock {
  return { id: uid(), kind: 'image', url: '', caption: '', span, ratio, fit: 'cover' };
}

export function agendaBlock(): JournalBlock {
  return {
    id: uid(),
    kind: 'agenda',
    span: 6,
    items: [
      { id: uid(), date: '05/08', title: 'Reunião de equipe', time: '09h', place: 'Sede administrativa' },
      { id: uid(), date: '12/08', title: 'Ação social', time: '14h', place: 'NAVE DIC' },
    ],
  };
}

export function statBlock(value = '0', label = 'Indicador', span: BlockSpan = 2): JournalBlock {
  return { id: uid(), kind: 'stat', value, label, span };
}

/** Composição inicial de cada modelo de página (v1). */
export function createPage(template: JournalTemplate): JournalPage {
  const blocks: JournalBlock[] = (() => {
    switch (template) {
      case 'capa':
        return [
          textBlock('subtitulo', 'Jornal Institucional', 6, 'center'),
          textBlock('titulo_capa', 'Título da chamada principal', 6, 'center'),
          imageBlock(6, '16/9'),
          textBlock('chamada', 'Chamada secundária desta edição.', 3),
          textBlock('chamada', 'Outra chamada desta edição.', 3),
        ];
      case 'materias':
        return [
          textBlock('titulo_materia', 'Matéria principal'),
          imageBlock(6, '16/9'),
          textBlock('corpo', 'Escreva aqui o texto da matéria principal.'),
          imageBlock(3, '4/3'),
          imageBlock(3, '4/3'),
          textBlock('chamada', 'Chamada da primeira imagem.', 3),
          textBlock('chamada', 'Chamada da segunda imagem.', 3),
        ];
      case 'materia':
        return [
          textBlock('titulo_materia', 'Título da matéria'),
          textBlock('subtitulo', 'Subtítulo de apoio'),
          imageBlock(6, '16/9'),
          textBlock('corpo', 'Texto corrido da matéria.'),
          textBlock('destaque', 'Frase de destaque da matéria.'),
          textBlock('corpo', 'Continuação do texto da matéria.'),
        ];
      case 'galeria':
        return [
          textBlock('titulo_materia', 'Galeria de fotos'),
          textBlock('corpo', 'Breve introdução da galeria.'),
          imageBlock(6, '16/9'),
          imageBlock(3, '4/3'),
          imageBlock(3, '4/3'),
          imageBlock(3, '4/3'),
          imageBlock(3, '4/3'),
        ];
      case 'numeros':
        return [
          textBlock('titulo_materia', 'Resultados e números'),
          statBlock('1.200', 'Atendimentos'),
          statBlock('35', 'Ações realizadas'),
          statBlock('18', 'Parcerias ativas'),
          textBlock('corpo', 'Comentário sobre os indicadores do período.'),
        ];
      case 'contracapa':
        return [
          textBlock('titulo_materia', 'Mensagem institucional', 6, 'center'),
          textBlock('corpo', 'Texto de encerramento desta edição.', 6),
          textBlock('chamada', 'contato@anabrasil.org · @anabrasil', 6, 'center'),
        ];
      default:
        return [textBlock('corpo', 'Novo bloco de texto.')];
    }
  })();

  return { id: uid(), template, blocks };
}

export function createJournalPages(): JournalPage[] {
  return [createPage('capa'), createPage('materias'), createPage('galeria'), createPage('contracapa')];
}

export const TEMPLATE_OPTIONS: JournalTemplate[] = [
  'capa',
  'materias',
  'materia',
  'galeria',
  'numeros',
  'contracapa',
  'branco',
];

/* ------------------------------------------------------------------ *
 * Modelos completos de jornal (capa + internas, 6 páginas)
 * ------------------------------------------------------------------ */

export type JournalModelKey = 'padrao' | 'pedagogico' | 'eventos' | 'branco';

export interface JournalModel {
  key: JournalModelKey;
  name: string;
  description: string;
  /** Rótulos curtos das páginas — usados na prévia do seletor. */
  pageLabels: string[];
  build: () => JournalPage[];
}

/** Página montada a partir de um template base com blocos substituídos. */
function page(template: JournalTemplate, blocks: JournalBlock[]): JournalPage {
  return { id: uid(), template, blocks };
}

const coverPage = (titulo: string, chamada: string): JournalPage =>
  page('capa', [
    textBlock('subtitulo', 'Jornal Institucional', 6, 'center'),
    textBlock('titulo_capa', titulo, 6, 'center'),
    imageBlock(6, '16/9'),
    textBlock('chamada', chamada, 6, 'center'),
  ]);

const closingPage = (texto: string): JournalPage =>
  page('contracapa', [
    textBlock('titulo_materia', 'Mensagem institucional', 6, 'center'),
    textBlock('corpo', texto, 6),
    textBlock('chamada', 'contato@anabrasil.org · @anabrasil', 6, 'center'),
  ]);

const galleryPage = (titulo: string): JournalPage =>
  page('galeria', [
    textBlock('titulo_materia', titulo),
    imageBlock(3, '4/3'),
    imageBlock(3, '4/3'),
    imageBlock(3, '4/3'),
    imageBlock(3, '4/3'),
  ]);

export const JOURNAL_MODELS: JournalModel[] = [
  {
    key: 'padrao',
    name: 'Padrão',
    description: 'Capa, matéria principal, notícias, galeria, resultados e encerramento.',
    pageLabels: ['Capa', 'Matéria', 'Notícias', 'Galeria', 'Resultados', 'Fim'],
    build: () => [
      coverPage('Título da chamada principal', 'Chamada secundária desta edição.'),
      page('materia', [
        textBlock('titulo_materia', 'Matéria principal'),
        textBlock('subtitulo', 'Subtítulo de apoio'),
        imageBlock(6, '16/9'),
        textBlock('corpo', 'Escreva aqui o texto da matéria principal.'),
        textBlock('destaque', 'Frase de destaque da matéria.'),
      ]),
      page('materias', [
        textBlock('titulo_materia', 'Primeira notícia', 3),
        textBlock('titulo_materia', 'Segunda notícia', 3),
        imageBlock(3, '4/3'),
        imageBlock(3, '4/3'),
        textBlock('corpo', 'Texto da primeira notícia.', 3),
        textBlock('corpo', 'Texto da segunda notícia.', 3),
      ]),
      galleryPage('Galeria de registros'),
      page('numeros', [
        textBlock('titulo_materia', 'Resultados do período'),
        statBlock('1.200', 'Atendimentos'),
        statBlock('35', 'Ações realizadas'),
        statBlock('18', 'Parcerias ativas'),
        textBlock('corpo', 'Comentário sobre os indicadores do período.'),
      ]),
      closingPage('Texto de encerramento desta edição.'),
    ],
  },
  {
    key: 'pedagogico',
    name: 'Pedagógico',
    description: 'Capa, relato, objetivos, registros, falas das crianças e encerramento.',
    pageLabels: ['Capa', 'Relato', 'Objetivos', 'Registros', 'Falas', 'Fim'],
    build: () => [
      coverPage('Nome do projeto pedagógico', 'Turma · Período da atividade'),
      page('materia', [
        textBlock('titulo_materia', 'Relato da experiência'),
        imageBlock(6, '16/9'),
        textBlock('corpo', 'Conte como a atividade aconteceu.'),
      ]),
      page('materias', [
        textBlock('titulo_materia', 'Objetivos e aprendizados'),
        textBlock('subtitulo', 'Objetivos', 2),
        textBlock('subtitulo', 'Desenvolvimento', 2),
        textBlock('subtitulo', 'Aprendizados', 2),
        textBlock('corpo', 'O que se pretendia alcançar.', 2),
        textBlock('corpo', 'Como o trabalho foi conduzido.', 2),
        textBlock('corpo', 'O que as crianças aprenderam.', 2),
      ]),
      galleryPage('Registros fotográficos'),
      page('materias', [
        textBlock('titulo_materia', 'Falas e produções'),
        textBlock('destaque', '“Fala da criança.” — Nome, 5 anos', 3),
        textBlock('destaque', '“Outra fala da criança.” — Nome, 6 anos', 3),
        imageBlock(3, '4/3'),
        imageBlock(3, '4/3'),
      ]),
      closingPage('Mensagem de encerramento da equipe pedagógica.'),
    ],
  },
  {
    key: 'eventos',
    name: 'Eventos',
    description: 'Capa, contexto, principais momentos, galeria, resultados e encerramento.',
    pageLabels: ['Capa', 'Contexto', 'Momentos', 'Galeria', 'Resultados', 'Fim'],
    build: () => [
      coverPage('Nome do evento', 'Data · Local do evento'),
      page('materia', [
        textBlock('titulo_materia', 'Apresentação do evento'),
        imageBlock(6, '16/9'),
        textBlock('corpo', 'Contexto e objetivo da ação realizada.'),
      ]),
      page('materias', [
        textBlock('titulo_materia', 'Principais momentos'),
        imageBlock(2, '4/3'),
        imageBlock(2, '4/3'),
        imageBlock(2, '4/3'),
        textBlock('corpo', 'Momento 1.', 2),
        textBlock('corpo', 'Momento 2.', 2),
        textBlock('corpo', 'Momento 3.', 2),
      ]),
      galleryPage('Galeria do evento'),
      page('numeros', [
        textBlock('titulo_materia', 'Resultados e números'),
        statBlock('1.200', 'Participantes'),
        statBlock('35', 'Ações realizadas'),
        statBlock('18', 'Parcerias'),
        textBlock('corpo', 'Comentário sobre os resultados alcançados.'),
      ]),
      closingPage('Agradecemos a todos que participaram deste evento.'),
    ],
  },
  {
    key: 'branco',
    name: 'Em branco',
    description: 'Comece do zero com uma página livre.',
    pageLabels: ['Livre'],
    build: () => [createPage('branco')],
  },
];

export const findJournalModel = (key: JournalModelKey): JournalModel =>
  JOURNAL_MODELS.find((model) => model.key === key) ?? JOURNAL_MODELS[0];


/* ------------------------------------------------------------------ *
 * Formas ANA — propriedade do jornal, não da página
 * ------------------------------------------------------------------ */

/**
 * Grava as formas em todas as páginas de uma vez.
 *
 * A decoração vale para o jornal inteiro, mas mora dentro do JSON de `pages`
 * para não exigir coluna nova no banco. Como o valor é escrito por completo em
 * cada página, uma eventual divergência (por exemplo, uma página criada antes
 * da forma existir) se corrige na operação seguinte.
 *
 * Lista vazia grava `undefined`, que a serialização descarta — o campo some do
 * JSON em vez de ficar como array vazio.
 */
export function setDecorationsOnAllPages(
  pages: JournalPage[],
  decorations: JournalDecoration[],
): JournalPage[] {
  return pages.map((page) => ({
    ...page,
    decorations: decorations.length ? decorations : undefined,
  }));
}

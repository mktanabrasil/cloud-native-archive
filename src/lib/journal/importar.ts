import {
  TEXT_STYLE_LABELS,
  type BlockSpan,
  type JournalBlock,
  type JournalPage,
  type JournalTemplate,
  type TextStyleKey,
} from './types';
import { uid } from './templates';

/**
 * A fronteira entre o que a leitura automática devolveu e o que entra no banco.
 *
 * A resposta vem de fora — de um modelo, atravessando uma edge function — e não
 * pode ser gravada como veio. Tudo aqui é conferido de novo: função de texto
 * que não existe vira corpo, largura fora da grade é aparada para caber,
 * proporção desconhecida cai no padrão, bloco irreconhecível é descartado.
 *
 * Preferir aparar a recusar é decisão consciente: um jornal quase certo, que a
 * diretora corrige em trinta segundos, vale mais do que um erro que a manda de
 * volta ao começo.
 */

/** Tamanho máximo do anexo. Acima disso a requisição não passa. */
export const LIMITE_ARQUIVO_MB = 25;

/** Tetos contra resposta desgovernada — nenhum jornal real chega perto. */
const MAX_PAGINAS = 24;
const MAX_BLOCOS_POR_PAGINA = 30;

const TEMPLATES: JournalTemplate[] = [
  'capa',
  'materias',
  'materia',
  'galeria',
  'agenda',
  'numeros',
  'contracapa',
  'branco',
];

const ESTILOS = Object.keys(TEXT_STYLE_LABELS) as TextStyleKey[];
const ALINHAMENTOS = ['left', 'center', 'right', 'justify'] as const;
const PROPORCOES = ['16/9', '4/3', '1/1', '3/4'] as const;

type Alinhamento = (typeof ALINHAMENTOS)[number];
type Proporcao = (typeof PROPORCOES)[number];

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/** Largura sempre dentro da grade de seis colunas. */
const paraLargura = (valor: unknown, padrao: BlockSpan): BlockSpan => {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(6, Math.max(1, n)) as BlockSpan;
};

const umDe = <T extends string>(lista: readonly T[], valor: unknown, padrao: T): T =>
  typeof valor === 'string' && (lista as readonly string[]).includes(valor) ? (valor as T) : padrao;

/**
 * Um bloco vindo da leitura. Devolve `null` quando não sobra nada de útil —
 * um texto vazio ocuparia espaço na folha sem dizer nada.
 */
function normalizarBloco(bruto: unknown): JournalBlock | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const b = bruto as Record<string, unknown>;

  switch (b.tipo) {
    case 'texto': {
      const conteudo = texto(b.conteudo);
      if (!conteudo) return null;
      return {
        id: uid(),
        kind: 'text',
        style: umDe(ESTILOS, b.estilo, 'corpo'),
        content: conteudo,
        align: umDe<Alinhamento>(ALINHAMENTOS, b.alinhamento, 'left'),
        span: paraLargura(b.largura, 6),
      };
    }
    case 'imagem': {
      return {
        id: uid(),
        kind: 'image',
        // Sem URL de propósito: a foto vive dentro do arquivo de origem e a
        // diretora a solta no lugar já reservado. O bloco entra vazio para
        // guardar a posição, e a folha mostra o quadro "Imagem".
        url: '',
        caption: texto(b.legenda),
        span: paraLargura(b.largura, 6),
        ratio: umDe<Proporcao>(PROPORCOES, b.proporcao, '16/9'),
        fit: 'cover',
      };
    }
    case 'numero': {
      const valor = texto(b.valor);
      if (!valor) return null;
      return {
        id: uid(),
        kind: 'stat',
        value: valor,
        label: texto(b.rotulo),
        span: paraLargura(b.largura, 2),
      };
    }
    default:
      return null;
  }
}

export interface ResultadoImportacao {
  paginas: JournalPage[];
  /** Quantos blocos de imagem ficaram esperando a foto. */
  fotosPendentes: number;
  /** O que a leitura achou ambíguo, para a pessoa conferir. */
  observacoes: string;
}

/**
 * Converte a resposta bruta da leitura em páginas do Jornal.
 *
 * Nunca lança: entrada irreconhecível devolve zero páginas, e quem chama
 * decide o que dizer. Uma exceção aqui viraria uma tela branca no meio de uma
 * importação que já custou dinheiro e espera.
 */
export function normalizarImportacao(bruto: unknown): ResultadoImportacao {
  const vazio: ResultadoImportacao = { paginas: [], fotosPendentes: 0, observacoes: '' };
  if (!bruto || typeof bruto !== 'object') return vazio;

  const raiz = bruto as Record<string, unknown>;
  if (!Array.isArray(raiz.paginas)) return vazio;

  let fotosPendentes = 0;

  const paginas = raiz.paginas
    .slice(0, MAX_PAGINAS)
    .map((paginaBruta): JournalPage | null => {
      if (!paginaBruta || typeof paginaBruta !== 'object') return null;
      const p = paginaBruta as Record<string, unknown>;

      const blocos = (Array.isArray(p.blocos) ? p.blocos : [])
        .slice(0, MAX_BLOCOS_POR_PAGINA)
        .map(normalizarBloco)
        .filter((bloco): bloco is JournalBlock => bloco !== null);

      // Página sem nada é folha em branco com cabeçalho e rodapé: ninguém pediu.
      if (!blocos.length) return null;

      fotosPendentes += blocos.filter((bloco) => bloco.kind === 'image' && !bloco.url).length;

      return {
        id: uid(),
        template: umDe(TEMPLATES, p.template, 'materia'),
        blocks: blocos,
      };
    })
    .filter((pagina): pagina is JournalPage => pagina !== null);

  return { paginas, fotosPendentes, observacoes: texto(raiz.observacoes) };
}

/**
 * Confere o anexo antes de gastar uma chamada de IA.
 *
 * Devolve a mensagem de erro pronta para a tela, ou `null` quando está tudo
 * certo. A mensagem fala de arquivo, não de MIME type.
 */
export function conferirArquivo(arquivo: File | null | undefined): string | null {
  if (!arquivo) return 'Escolha um arquivo para continuar.';

  const ehPdf =
    arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
  if (!ehPdf) {
    return 'Por enquanto só dá para ler PDF. No Word, use “Salvar como” e escolha PDF.';
  }

  if (arquivo.size > LIMITE_ARQUIVO_MB * 1024 * 1024) {
    const mb = Math.round(arquivo.size / (1024 * 1024));
    return `Este arquivo tem ${mb} MB e o limite é ${LIMITE_ARQUIVO_MB} MB. Tente salvar o PDF com as fotos em qualidade menor.`;
  }

  if (arquivo.size === 0) return 'Este arquivo está vazio.';

  return null;
}

/** Lê o arquivo como base64 puro, sem o prefixo `data:` que a API não aceita. */
export function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não consegui ler este arquivo.'));
    leitor.onload = () => {
      const resultado = String(leitor.result ?? '');
      const virgula = resultado.indexOf(',');
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
    };
    leitor.readAsDataURL(arquivo);
  });
}

/** Frase curta sobre o que veio, para a tela de conferência. */
export function resumirImportacao(resultado: ResultadoImportacao): string {
  const { paginas, fotosPendentes } = resultado;
  if (!paginas.length) return 'Não consegui identificar conteúdo neste arquivo.';

  const blocos = paginas.reduce((total, pagina) => total + pagina.blocks.length, 0);
  const partes = [
    `${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}`,
    `${blocos} ${blocos === 1 ? 'peça de conteúdo' : 'peças de conteúdo'}`,
  ];
  if (fotosPendentes) {
    partes.push(`${fotosPendentes} ${fotosPendentes === 1 ? 'foto a colocar' : 'fotos a colocar'}`);
  }
  return partes.join(' · ');
}

import { describe, expect, it } from 'vitest';
import {
  conferirArquivo,
  normalizarImportacao,
  resumirImportacao,
  LIMITE_ARQUIVO_MB,
} from './importar';

/**
 * O normalizador é a fronteira entre uma resposta de fora e o nosso banco.
 *
 * Os casos abaixo não são hipóteses simpáticas: são as formas pelas quais uma
 * resposta pode chegar torta — campo faltando, valor fora do catálogo, largura
 * impossível, tipo desconhecido — e o que precisa acontecer com cada uma.
 */

/** Arquivo de mentira, com o tamanho que o teste precisar. */
function arquivo(nome: string, tipo: string, bytes: number): File {
  const f = new File(['x'], nome, { type: tipo });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('normalizar a importação', () => {
  it('monta páginas e blocos a partir de uma resposta bem formada', () => {
    const { paginas } = normalizarImportacao({
      paginas: [
        {
          template: 'capa',
          blocos: [
            { tipo: 'texto', estilo: 'titulo_capa', conteudo: 'Mutirão de saúde', largura: 6, alinhamento: 'center' },
            { tipo: 'imagem', proporcao: '16/9', legenda: 'Equipe de voluntários', largura: 6 },
          ],
        },
      ],
    });

    expect(paginas).toHaveLength(1);
    expect(paginas[0].template).toBe('capa');
    expect(paginas[0].blocks).toHaveLength(2);
    expect(paginas[0].blocks[0]).toMatchObject({
      kind: 'text', style: 'titulo_capa', content: 'Mutirão de saúde', span: 6, align: 'center',
    });
    expect(paginas[0].blocks[1]).toMatchObject({
      kind: 'image', ratio: '16/9', caption: 'Equipe de voluntários', url: '', fit: 'cover',
    });
  });

  it('dá um id próprio a cada página e a cada bloco', () => {
    const { paginas } = normalizarImportacao({
      paginas: [
        { template: 'materia', blocos: [{ tipo: 'texto', conteudo: 'a' }, { tipo: 'texto', conteudo: 'b' }] },
        { template: 'materia', blocos: [{ tipo: 'texto', conteudo: 'c' }] },
      ],
    });

    const ids = paginas.flatMap((p) => [p.id, ...p.blocks.map((b) => b.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  /** Aparar em vez de recusar: um jornal quase certo vale mais que um erro. */
  it('apara a largura para dentro da grade de seis colunas', () => {
    const { paginas } = normalizarImportacao({
      paginas: [{
        template: 'materia',
        blocos: [
          { tipo: 'texto', conteudo: 'largo demais', largura: 12 },
          { tipo: 'texto', conteudo: 'estreito demais', largura: 0 },
          { tipo: 'texto', conteudo: 'sem largura' },
          { tipo: 'texto', conteudo: 'largura absurda', largura: 'seis' },
        ],
      }],
    });

    expect(paginas[0].blocks.map((b) => b.span)).toEqual([6, 1, 6, 6]);
  });

  it('troca função de texto desconhecida por corpo, em vez de recusar a página', () => {
    const { paginas } = normalizarImportacao({
      paginas: [{ template: 'materia', blocos: [{ tipo: 'texto', estilo: 'manchete_gigante', conteudo: 'oi' }] }],
    });

    expect(paginas[0].blocks[0]).toMatchObject({ kind: 'text', style: 'corpo' });
  });

  it('troca modelo de página desconhecido por matéria', () => {
    const { paginas } = normalizarImportacao({
      paginas: [{ template: 'editorial', blocos: [{ tipo: 'texto', conteudo: 'oi' }] }],
    });

    expect(paginas[0].template).toBe('materia');
  });

  it('descarta bloco de tipo desconhecido e texto vazio', () => {
    const { paginas } = normalizarImportacao({
      paginas: [{
        template: 'materia',
        blocos: [
          { tipo: 'video', url: 'x' },
          { tipo: 'texto', conteudo: '   ' },
          { tipo: 'texto', conteudo: 'sobrevivi' },
          null,
          'lixo',
        ],
      }],
    });

    expect(paginas[0].blocks).toHaveLength(1);
    expect(paginas[0].blocks[0]).toMatchObject({ content: 'sobrevivi' });
  });

  /** Página sem bloco é folha em branco com cabeçalho e rodapé — ninguém pediu. */
  it('descarta página que ficou sem nenhum bloco', () => {
    const { paginas } = normalizarImportacao({
      paginas: [
        { template: 'capa', blocos: [{ tipo: 'video' }] },
        { template: 'materia', blocos: [{ tipo: 'texto', conteudo: 'única' }] },
      ],
    });

    expect(paginas).toHaveLength(1);
    expect(paginas[0].blocks[0]).toMatchObject({ content: 'única' });
  });

  it('conta as fotos que ficaram esperando', () => {
    const resultado = normalizarImportacao({
      paginas: [{
        template: 'galeria',
        blocos: [
          { tipo: 'imagem', largura: 3 },
          { tipo: 'imagem', largura: 3 },
          { tipo: 'texto', conteudo: 'legenda geral' },
        ],
      }],
    });

    expect(resultado.fotosPendentes).toBe(2);
  });

  it('aceita indicador e descarta o que veio sem valor', () => {
    const { paginas } = normalizarImportacao({
      paginas: [{
        template: 'numeros',
        blocos: [
          { tipo: 'numero', valor: '240', rotulo: 'Famílias', largura: 2 },
          { tipo: 'numero', rotulo: 'Sem valor' },
        ],
      }],
    });

    expect(paginas[0].blocks).toHaveLength(1);
    expect(paginas[0].blocks[0]).toMatchObject({ kind: 'stat', value: '240', label: 'Famílias', span: 2 });
  });

  /** Nunca lançar: uma exceção aqui viraria tela branca depois da espera. */
  it('não lança com entrada irreconhecível', () => {
    const casos = [null, undefined, 42, 'texto', {}, { paginas: 'nenhuma' }, { paginas: [null, 7] }];
    for (const caso of casos) {
      expect(() => normalizarImportacao(caso)).not.toThrow();
      expect(normalizarImportacao(caso).paginas).toEqual([]);
    }
  });

  it('não deixa uma resposta desgovernada virar jornal de mil páginas', () => {
    const muitas = Array.from({ length: 200 }, () => ({
      template: 'materia',
      blocos: [{ tipo: 'texto', conteudo: 'x' }],
    }));

    expect(normalizarImportacao({ paginas: muitas }).paginas.length).toBeLessThanOrEqual(24);
  });

  it('guarda as observações da leitura', () => {
    const { observacoes } = normalizarImportacao({
      paginas: [{ template: 'materia', blocos: [{ tipo: 'texto', conteudo: 'a' }] }],
      observacoes: '  A última página tinha uma tabela que não consegui montar.  ',
    });

    expect(observacoes).toBe('A última página tinha uma tabela que não consegui montar.');
  });
});

describe('conferir o arquivo antes de gastar uma chamada', () => {
  it('aceita PDF dentro do limite', () => {
    expect(conferirArquivo(arquivo('jornal.pdf', 'application/pdf', 2 * 1024 * 1024))).toBeNull();
  });

  it('aceita PDF pela extensão quando o navegador não informa o tipo', () => {
    expect(conferirArquivo(arquivo('jornal.PDF', '', 1024))).toBeNull();
  });

  /** A mensagem tem de ensinar a saída, não citar o formato aceito. */
  it('recusa Word explicando como converter', () => {
    const erro = conferirArquivo(arquivo('jornal.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024));
    expect(erro).toContain('Salvar como');
    expect(erro).not.toContain('MIME');
  });

  it('recusa arquivo grande dizendo o tamanho e o limite', () => {
    const erro = conferirArquivo(arquivo('grande.pdf', 'application/pdf', (LIMITE_ARQUIVO_MB + 5) * 1024 * 1024));
    expect(erro).toContain(String(LIMITE_ARQUIVO_MB));
    expect(erro).toContain('30 MB');
  });

  it('recusa arquivo vazio e ausência de arquivo', () => {
    expect(conferirArquivo(arquivo('vazio.pdf', 'application/pdf', 0))).toBeTruthy();
    expect(conferirArquivo(null)).toBeTruthy();
  });
});

/**
 * Fixture de campo, e não inventada: esta é a resposta que o `gemini-3.5-flash`
 * devolveu ao ler o jornal do GOE em 31/08/2026, encurtada nos textos longos.
 *
 * Existe porque um teste feito com dados que eu mesmo imaginei prova apenas que
 * o normalizador aceita o que eu imaginei. O que importa é ele aceitar o que a
 * API realmente manda — inclusive as formas que eu não previ, como o
 * `alinhamento: 'justify'` e as quebras de linha dentro do conteúdo.
 */
const RESPOSTA_REAL_DO_GEMINI = {
  paginas: [
    {
      template: 'capa',
      blocos: [
        { tipo: 'texto', estilo: 'titulo_capa', conteudo: 'DA HORTA À MESA:\nCOLHER, CUIDAR E SABOREAR', largura: 6, alinhamento: 'center' },
        { tipo: 'texto', estilo: 'subtitulo', conteudo: 'PROJETO HORTA: “COLHENDO DESCOBERTAS”', largura: 6, alinhamento: 'center' },
        { tipo: 'texto', estilo: 'subtitulo', conteudo: 'PROJETO ALIMENTAÇÃO SAUDÁVEL: “SABORES QUE EDUCAM”', largura: 6, alinhamento: 'center' },
        { tipo: 'texto', estilo: 'chamada', conteudo: 'Unidade: Grupo de Oração e Esperança - GOE\nEdição: Agosto/2026', largura: 6, alinhamento: 'center' },
      ],
    },
    {
      template: 'materia',
      blocos: [
        { tipo: 'texto', estilo: 'titulo_materia', conteudo: '1. A horta como espaço de descobertas', largura: 6, alinhamento: 'left' },
        { tipo: 'texto', estilo: 'corpo', conteudo: 'No Grupo de Oração e Esperança - GOE, a horta se transformou em um verdadeiro espaço de descobertas.', largura: 6, alinhamento: 'justify' },
        { tipo: 'texto', estilo: 'titulo_materia', conteudo: '2. O momento da colheita', largura: 6, alinhamento: 'left' },
        { tipo: 'texto', estilo: 'corpo', conteudo: 'Durante a colheita, exploraram cores, formas, aromas e texturas.', largura: 6, alinhamento: 'justify' },
      ],
    },
    {
      template: 'contracapa',
      blocos: [
        { tipo: 'texto', estilo: 'destaque', conteudo: 'Da terra para as pequenas mãos.\nDas pequenas mãos para a cozinha.', largura: 6, alinhamento: 'center' },
        { tipo: 'texto', estilo: 'chamada', conteudo: 'Grupo de Oração e Esperança - GOE', largura: 6, alinhamento: 'center' },
      ],
    },
  ],
  observacoes:
    'O documento original foi dividido em 3 páginas para manter a legibilidade.',
};

describe('a resposta que o Gemini devolveu de verdade', () => {
  it('atravessa o normalizador inteira, sem perder página nem peça', () => {
    const { paginas } = normalizarImportacao(RESPOSTA_REAL_DO_GEMINI);

    expect(paginas).toHaveLength(3);
    expect(paginas.map((p) => p.template)).toEqual(['capa', 'materia', 'contracapa']);
    expect(paginas.map((p) => p.blocks.length)).toEqual([4, 4, 2]);
  });

  it('aceita o alinhamento justificado, que só apareceu na resposta real', () => {
    const { paginas } = normalizarImportacao(RESPOSTA_REAL_DO_GEMINI);
    const corpo = paginas[1].blocks[1];

    expect(corpo).toMatchObject({ kind: 'text', style: 'corpo', align: 'justify' });
  });

  it('preserva a quebra de linha dentro do conteúdo', () => {
    const { paginas } = normalizarImportacao(RESPOSTA_REAL_DO_GEMINI);
    const titulo = paginas[0].blocks[0];

    expect(titulo.kind).toBe('text');
    if (titulo.kind === 'text') expect(titulo.content).toContain('\n');
  });

  it('guarda a observação da leitura', () => {
    expect(normalizarImportacao(RESPOSTA_REAL_DO_GEMINI).observacoes).toContain('3 páginas');
  });

  /** Nenhuma foto veio: o documento de teste não tinha imagem embutida. */
  it('não inventa foto pendente quando não veio imagem', () => {
    expect(normalizarImportacao(RESPOSTA_REAL_DO_GEMINI).fotosPendentes).toBe(0);
  });
});

describe('resumir para a tela', () => {
  it('conta páginas, peças e fotos pendentes', () => {
    const resumo = resumirImportacao(
      normalizarImportacao({
        paginas: [
          { template: 'capa', blocos: [{ tipo: 'texto', conteudo: 'a' }, { tipo: 'imagem' }] },
          { template: 'materia', blocos: [{ tipo: 'texto', conteudo: 'b' }] },
        ],
      }),
    );

    expect(resumo).toContain('2 páginas');
    expect(resumo).toContain('3 peças de conteúdo');
    expect(resumo).toContain('1 foto a colocar');
  });

  it('usa singular quando é uma página só', () => {
    const resumo = resumirImportacao(
      normalizarImportacao({ paginas: [{ template: 'capa', blocos: [{ tipo: 'texto', conteudo: 'a' }] }] }),
    );

    expect(resumo).toContain('1 página');
    expect(resumo).not.toContain('páginas');
  });

  it('avisa quando não veio nada', () => {
    expect(resumirImportacao(normalizarImportacao({}))).toContain('Não consegui identificar');
  });
});

import { describe, expect, it } from 'vitest';
import { ALTURA, LETRA_DO_MODELO, LETRA_MINIMA, diagramar, limparParaPdf, quebrar, repartir, type DadosDaFolha, type Medir } from './folha';

// Uma régua simples: cada letra mede meio corpo (negrito, um pouco mais).
const medir: Medir = (t, negrito, f) => t.length * f * (negrito ? 0.6 : 0.5);

const dia = (texto = 'texto') => ({ projeto: texto, proposta: texto, objetivo: texto, desenvolvimento: texto });
const dados = (campos: Partial<DadosDaFolha> = {}): DadosDaFolha => ({
  agrupamento: 'AG I B', professora: 'Professora Exemplo', periodo: '23/11 a 27/11',
  dias: {}, formas_registro: '', materiais: '', avaliacao: '', ...campos,
});

describe('quebrar', () => {
  it('continua o texto na linha do rótulo e quebra pela largura', () => {
    const linhas = quebrar([{ texto: 'PROJETO:', negrito: false, cor: 'r' }, { texto: ' um dois tres', negrito: false, cor: 't' }], 12 * 5, 10, medir);
    expect(linhas.map(l => l.map(p => p.texto).join(''))).toEqual(['PROJETO: um', 'dois tres']);
  });

  it('respeita a quebra de linha digitada e corta palavra maior que a linha', () => {
    const linhas = quebrar([{ texto: 'a\nbbbbbbbbbbbb', negrito: false, cor: 't' }], 5 * 5, 10, medir);
    expect(linhas.map(l => l.map(p => p.texto).join(''))).toEqual(['a', 'bbbbb', 'bbbbb', 'bb']);
  });

  it('a linha em branco digitada fica; as do fim, não', () => {
    const linhas = quebrar([{ texto: 'a\n\nb\n\n', negrito: false, cor: 't' }], 100, 10, medir);
    expect(linhas.map(l => l.map(p => p.texto).join(''))).toEqual(['a', '', 'b']);
  });
});

describe('limparParaPdf', () => {
  it('setas e vistos viram texto; emoji sai; o resto fica', () => {
    expect(limparParaPdf('Roda → mural ✓ 😀 fim — “ok” • …')).toBe('Roda -> mural (ok) fim — “ok” • …');
  });
});

describe('repartir', () => {
  it('a sobra leva cada quadro de volta à altura do modelo', () => {
    expect(repartir([50, 50], [100, 60], 160)).toEqual([100, 60]);
  });
  it('sem sobra, cada um fica com o que precisa', () => {
    expect(repartir([120, 60], [100, 60], 150)).toEqual([120, 60]);
  });
});

describe('diagramar', () => {
  it('vazio: a letra do modelo, sem nada cheio, e os quadros perto das alturas do modelo', () => {
    const f = diagramar(dados(), medir);
    expect(f.tamanho).toBe(LETRA_DO_MODELO);
    expect(f.cheios).toEqual([]);
    const seg = f.quadros.find(q => q.chave === 'seg')!;
    expect(seg.altura).toBeCloseTo(125.5, 0);
    // As duas colunas vão até o fim da página.
    for (const chave of ['qua', 'avaliacao']) {
      const q = f.quadros.find(x => x.chave === chave)!;
      expect(q.y + q.altura).toBeCloseTo(ALTURA, 0);
    }
  });

  it('o rótulo e o texto da professora saem na mesma linha', () => {
    const f = diagramar(dados({ dias: { seg: dia('Identidade') } }), medir);
    const seg = f.quadros.find(q => q.chave === 'seg')!;
    expect(seg.linhas[0].trechos[0].texto).toBe('2ª FEIRA');
    expect(seg.linhas[1].trechos.map(t => t.texto)).toEqual(['PROJETO:', ' Identidade']);
  });

  it('texto longo: a letra diminui na folha toda, sem passar da página', () => {
    const f = diagramar(dados({ dias: { seg: dia('palavra '.repeat(60)), ter: dia(), qua: dia() } }), medir);
    expect(f.tamanho).toBeLessThan(LETRA_DO_MODELO);
    expect(f.tamanho).toBeGreaterThanOrEqual(LETRA_MINIMA);
    expect(f.cheios).toEqual([]);
    const qua = f.quadros.find(q => q.chave === 'qua')!;
    expect(qua.y + qua.altura).toBeLessThanOrEqual(ALTURA + 0.01);
  });

  it('nem com a letra mínima: aponta o dia que passou', () => {
    const f = diagramar(dados({ dias: { ter: dia('palavra '.repeat(400)) } }), medir);
    expect(f.tamanho).toBe(LETRA_MINIMA);
    expect(f.cheios).toEqual(['3ª FEIRA']);
  });

  it('materiais longos na coluna da direita também são apontados', () => {
    const f = diagramar(dados({ materiais: 'papel '.repeat(900) }), medir);
    expect(f.cheios).toContain('MATERIAIS UTILIZADOS PARA A PROPOSTA DA SEMANA');
  });

  it('nome que não cabe nem com a letra mínima: cortado com reticências, sem passar da coluna', () => {
    const nome = 'Nome '.repeat(30).trim();
    const f = diagramar(dados({ professora: nome }), medir);
    const p = f.linhasFixas.find(l => l.chave === 'professora')!;
    expect(p.tamanho).toBe(LETRA_MINIMA);
    const texto = p.linhas[0].trechos[1].texto;
    expect(texto.endsWith('…')).toBe(true);
    expect(texto.length).toBeGreaterThan(20);
    expect(medir('PROFESSORA:', true, p.tamanho) + medir(texto, false, p.tamanho)).toBeLessThanOrEqual(417.5 - 2 * 8.3);
  });

  it('agrupamento comprido diminui só a própria linha', () => {
    const f = diagramar(dados({ agrupamento: 'A'.repeat(80) }), medir);
    const ag = f.linhasFixas.find(l => l.chave === 'agrupamento')!;
    expect(ag.tamanho).toBeLessThan(LETRA_DO_MODELO);
    expect(f.tamanho).toBe(LETRA_DO_MODELO);
  });
});

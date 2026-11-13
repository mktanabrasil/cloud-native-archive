import { describe, it, expect } from 'vitest';
import { blocosDe, quebrarEmLinhas, trechosDe, trocarMarcas } from './marcacao';
import { SECOES_DO_TEXTO, corpoDaSecao } from './textosBase';

describe('marcação dos textos', () => {
  it('troca {ano}, {tema} e {TEMA}; sem tema, deixa o lembrete', () => {
    expect(trocarMarcas('PROJETO {ano} - {TEMA}: “{tema}”', 2027, 'Raízes que nos sustentam'))
      .toBe('PROJETO 2027 - RAÍZES QUE NOS SUSTENTAM: “Raízes que nos sustentam”');
    expect(trocarMarcas('“{tema}”', 2027, '  ')).toBe('“[tema do ano]”');
  });

  it('negrito entre asteriscos duplos; asterisco sem par fica como está', () => {
    expect(trechosDe('a **b** c')).toEqual([{ texto: 'a ', negrito: false }, { texto: 'b', negrito: true }, { texto: ' c', negrito: false }]);
    expect(trechosDe('5 ** 2')).toEqual([{ texto: '5 ** 2', negrito: false }]);
  });

  it('linha vira parágrafo, "- " vira item, linha em branco vira um respiro só', () => {
    const b = blocosDe('Primeiro\n\n\n- um\n• dois\nÚltimo\n\n');
    expect(b.map(x => x.tipo)).toEqual(['paragrafo', 'respiro', 'item', 'item', 'paragrafo']);
  });

  it('quebra as linhas pela largura medida, sem espaço sobrando no começo', () => {
    const medir = (t: string) => t.length * 10;
    const linhas = quebrarEmLinhas([{ texto: 'aa bb cc dd', negrito: false }], 55, medir);
    expect(linhas.map(l => l.map(p => p.texto).join(' '))).toEqual(['aa bb', 'cc dd']);
    expect(linhas[1][0].espacoAntes).toBe(false);
  });
});

describe('os textos de 2026', () => {
  it('ids únicos, a primeira seção abre página, e o corpo escrito vence o de 2026', () => {
    const ids = SECOES_DO_TEXTO.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SECOES_DO_TEXTO[0].novaPagina).toBe(true);
    expect(SECOES_DO_TEXTO.filter(s => s.novaPagina)).toHaveLength(9);
    expect(corpoDaSecao({ scfv: 'Novo' }, 'scfv')).toBe('Novo');
    expect(corpoDaSecao({}, 'scfv')).toMatch(/^Trata-se de um serviço/);
  });
});

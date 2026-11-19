import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { montarCelula, prefixoDasUnidades, CORAL } from './grade';
import { itensDaFolha, linhasDoTema, montarPdf, type Imagem, type RecursosDoPdf } from './gerar';
import type { AnoDoCalendario, ItemDoCalendario } from '../regras';

describe('a célula do dia', () => {
  const item = (c: Partial<ItemDoCalendario>): ItemDoCalendario => ({ id: 'x', ano: 2027, dia: '2027-04-21', texto: 'Tiradentes', tipo: 'feriado', unidades: [], destaque: true, oculto: false, fonte: null, ...c });
  const medir = (t: string, _e: string, tam: number) => t.length * tam * 0.6;

  it('dia sem nada: só o número, em traço fino', () => {
    const c = montarCelula(5, [], 104, 60, medir);
    expect(c.linhas).toEqual([{ texto: '5', estilo: 'light', cor: '#000000', dy: 0 }]);
  });

  it('feriado: número, texto em maiúsculas e "FERIADO" embaixo, em coral', () => {
    const c = montarCelula(21, [item({})], 104, 60, medir);
    expect(c.linhas.map(l => l.texto)).toEqual(['21 - TIRADENTES', 'FERIADO']);
    expect(c.linhas.every(l => l.cor === CORAL && l.estilo === 'bold')).toBe(true);
  });

  it('atividade começa com a sigla da unidade (impressão sem cor); o segundo item não repete o número', () => {
    expect(prefixoDasUnidades(['Santana'])).toBe('SAN · ');
    expect(prefixoDasUnidades(['DIC', 'Santana'])).toBe('DIC+SAN · ');
    expect(prefixoDasUnidades(['DIC', 'Nilópolis', 'Santana'])).toBe('TODAS · ');
    expect(prefixoDasUnidades([])).toBe('TODAS · ');
    const c = montarCelula(19, [item({ tipo: 'data', texto: 'Dia X' }), item({ tipo: 'atividade', texto: 'Festa', unidades: ['DIC'], destaque: false })], 300, 60, medir);
    expect(c.linhas.map(l => [l.texto, l.estilo])).toEqual([['19 - DIA X', 'light'], ['DIC · FESTA', 'normal']]);
    const nil = montarCelula(12, [item({ tipo: 'atividade', texto: 'Passeio', unidades: ['Nilópolis'] })], 300, 60, medir);
    expect(nil.linhas[0].texto).toBe('12 - NIL · PASSEIO');
  });

  it('texto grande diminui a letra; o que não cabe nem assim marca a célula como cheia', () => {
    const longo = item({ tipo: 'atividade', texto: 'palavra '.repeat(12) });
    expect(montarCelula(3, [longo], 104, 60, medir).tamanho).toBeLessThan(10);
    const enorme = item({ tipo: 'atividade', texto: 'palavra '.repeat(80) });
    expect(montarCelula(3, [enorme], 104, 60, medir).cheia).toBe(true);
  });
});

describe('o tema na capa', () => {
  it('quebra depois da vírgula, como em 2026, ou ao meio', () => {
    expect(linhasDoTema('Plantando hoje, o amanhã que sonhamos')).toEqual(['“PLANTANDO HOJE,', 'O AMANHÃ QUE SONHAMOS”']);
    expect(linhasDoTema('Juntos somos mais fortes')).toEqual(['“JUNTOS SOMOS', 'MAIS FORTES”']);
    expect(linhasDoTema('Gratidão')).toEqual(['“GRATIDÃO”']);
    expect(linhasDoTema('')).toEqual([]);
  });
});

describe('o PDF inteiro', () => {
  const raiz = path.resolve(__dirname, '../../../../public');
  const fonte = (n: string) => fs.readFileSync(path.join(raiz, 'fontes', n)).toString('base64');
  // PNG de 1×1 px: as peças reais não mudam a paginação.
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const peca: Imagem = { dados: png, formato: 'PNG', largura: 1, altura: 1 };
  const recursos: RecursosDoPdf = {
    fontes: { light: fonte('poppins-light.ttf'), normal: fonte('poppins-regular.ttf'), medium: fonte('poppins-medium.ttf'), bold: fonte('poppins-bold.ttf') },
    rodapeCapa: peca, logoCabecalho: peca, aviaoCabecalho: peca, logoMes: peca, aviaoMes: peca, capa: null,
  };
  const ano = (textos: Record<string, string> = {}): AnoDoCalendario => ({
    ano: 2027, tema: 'Raízes que nos sustentam', percursos: [], textos, meses_revisados: [], capa_url: null, status: 'preenchimento',
    observacao: null, enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null,
  });

  it('58 páginas com os textos de 2026: capa, 9 de texto, 3 por mês e 12 em branco', () => {
    const r = montarPdf(jsPDF, ano(), [], recursos);
    expect(r.paginasDeTexto).toBe(9);
    expect(r.paginas).toBe(1 + 9 + 36 + 12);
  });

  it('só as folhas pedidas, para o fichário: a grade de dois meses, ou com as anotações', () => {
    expect(montarPdf(jsPDF, ano(), [], recursos, { partes: { capa: false, textos: false, meses: [6, 3], anotacoes: false, fim: false } }).paginas).toBe(2);
    expect(montarPdf(jsPDF, ano(), [], recursos, { partes: { capa: false, textos: false, meses: [3], anotacoes: true, fim: false } }).paginas).toBe(3);
    expect(montarPdf(jsPDF, ano(), [], recursos, { partes: { meses: [] } }).paginas).toBe(1 + 9 + 12);
  });

  it('a folha de uma unidade: as atividades dela e as de todas; feriados e datas ficam', () => {
    const at = (texto: string, unidades: string[], tipo: ItemDoCalendario['tipo'] = 'atividade'): ItemDoCalendario => ({ id: texto, ano: 2027, dia: '2027-03-10', texto, tipo, unidades, destaque: true, oculto: false, fonte: null });
    const lista = [at('Reunião', ['DIC']), at('Passeio', ['Nilópolis']), at('Acampamento', []), at('Formação', ['DIC', 'Santana']), at('Dia da Escola', [], 'data'), at('Escondida', [], 'data')];
    lista[5].oculto = true;
    expect(itensDaFolha(lista, 2027, 'DIC').map(i => i.texto)).toEqual(['Reunião', 'Acampamento', 'Formação', 'Dia da Escola']);
    expect(itensDaFolha(lista, 2027, null).map(i => i.texto)).toEqual(['Reunião', 'Passeio', 'Acampamento', 'Formação', 'Dia da Escola']);
    const r = montarPdf(jsPDF, ano(), lista, recursos, { partes: { capa: false, textos: false, meses: [3], anotacoes: false, fim: false }, unidade: 'DIC', atualizadaEm: '2027-03-03T12:00:00Z' });
    expect(r.paginas).toBe(1);
  });

  it('texto que não cabe continua na página seguinte, sem cortar nada', () => {
    // ~40 linhas de 15 pt: passa do pé de uma página (cabem 34).
    const r = montarPdf(jsPDF, ano({ 'quem-somos': 'Parágrafo comprido de teste. '.repeat(150) + '\n' + 'Outro parágrafo. '.repeat(150) }), [], recursos);
    expect(r.paginasDeTexto).toBe(10);
    expect(r.paginas).toBe(59);
  });
});

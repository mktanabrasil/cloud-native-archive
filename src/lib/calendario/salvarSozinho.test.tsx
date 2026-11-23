import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { juntarPercursos, juntarTextos, mesesRevisadosCom, percursosCompletos, percursosNaTela, type AnoDoCalendario } from './regras';
import { linhasDoTema } from './pdf/gerar';
import { temaSemAspas, trocarMarcas } from './pdf/marcacao';

/** Salvar sozinho sem apagar o que outra coordenadora salvou (23/11/2026). */
describe('juntar com a versão mais nova do banco', () => {
  const P = (mes: number, tema: string, sugestoes = '') => ({ mes, tema, sugestoes });

  it('percursos: grava só os meses que eu mudei; os outros ficam como a outra pessoa deixou', () => {
    const base = [P(1, 'A'), P(2, 'B')];
    const meus = [P(1, 'A mudado '), P(2, 'B')];
    const atuais = [P(1, 'A'), P(2, 'B da outra coordenadora')];
    const r = juntarPercursos(atuais, base, meus);
    expect(r[0]).toEqual(P(1, 'A mudado'));
    expect(r[1]).toEqual(P(2, 'B da outra coordenadora'));
    expect(r).toHaveLength(12);
  });

  it('percursos na tela: o que eu não mexi passa a mostrar o que veio do banco', () => {
    const naTela = [P(1, 'meu rascunho'), P(2, 'B')];
    const t = percursosNaTela(naTela, [P(1, 'A'), P(2, 'B')], [P(1, 'A'), P(2, 'B novo')]);
    expect(t[0].tema).toBe('meu rascunho');
    expect(t[1].tema).toBe('B novo');
  });

  it('textos: aplica o que eu mudei ou tirei e mantém as chaves das outras', () => {
    const base = { metodologia: 'velha', avaliacao: 'x' };
    const meus = { metodologia: 'nova' }; // tirei a avaliação (voltou ao texto de 2026)
    const atuais = { metodologia: 'velha', avaliacao: 'x', justificativa: 'da outra' };
    expect(juntarTextos(atuais, base, meus)).toEqual({ metodologia: 'nova', justificativa: 'da outra' });
  });

  it('textos: o que eu não mexi não sobrescreve o que a outra salvou depois', () => {
    expect(juntarTextos({ justificativa: 'nova da outra' }, { justificativa: 'antiga' }, { justificativa: 'antiga' })).toEqual({ justificativa: 'nova da outra' });
  });

  it('meses revisados: marca e desmarca na lista mais nova', () => {
    expect(mesesRevisadosCom([1, 3], 2, true)).toEqual([1, 2, 3]);
    expect(mesesRevisadosCom([1, 2, 3], 2, false)).toEqual([1, 3]);
    expect(mesesRevisadosCom([2], 2, true)).toEqual([2]);
  });
});

describe('correções da revisão (23/11/2026)', () => {
  const P = (mes: number, tema: string, sugestoes = '') => ({ mes, tema, sugestoes });

  it('campo a campo: o meu tema não apaga as sugestões que a outra salvou no mesmo mês', () => {
    const r = juntarPercursos([P(3, 'A', 'sugestão da outra')], [P(3, 'A', '')], [P(3, 'A mudado', '')]);
    expect(r[2]).toEqual(P(3, 'A mudado', 'sugestão da outra'));
    const t = percursosNaTela([P(3, 'meu', '')], [P(3, 'A', '')], [P(3, 'A', 'da outra')]);
    expect(t[2]).toEqual(P(3, 'meu', 'da outra'));
  });

  it('desfazer durante o salvamento: com a base no que foi enviado, a tela não volta', () => {
    const enviadoBase = juntarPercursos([P(1, 'A')], [P(1, 'A')], [P(1, 'AB')]); // base vira o enviado
    const t = percursosNaTela([P(1, 'A')], enviadoBase, [P(1, 'AB')]);
    expect(t[0].tema).toBe('A'); // continua o que está na tela; vai no próximo salvamento
  });

  it('unidade nova criada pelas duas: o texto já escrito pela outra não vira vazio', () => {
    expect(juntarTextos({ 'ana-4': 'texto da outra' }, {}, { 'ana-4': '' })).toEqual({ 'ana-4': 'texto da outra' });
    expect(juntarTextos({ 'ana-4': '' }, {}, { 'ana-4': 'o meu' })).toEqual({ 'ana-4': 'o meu' });
  });

  it('aspas: só tira quando o tema inteiro está entre aspas', () => {
    expect(temaSemAspas('Somos “família”')).toBe('Somos “família”');
    expect(temaSemAspas('Plantando o "amanhã"')).toBe('Plantando o "amanhã"');
    expect(temaSemAspas('"a" e "b"')).toBe('"a" e "b"');
    expect(temaSemAspas('““Duplo””')).toBe('Duplo');
  });
});

describe('o tema com aspas no PDF', () => {
  it('tira as aspas de fora: o PDF põe as dele', () => {
    expect(temaSemAspas('“Nossa História, Nossos Vínculos, Nosso Futuro”')).toBe('Nossa História, Nossos Vínculos, Nosso Futuro');
    expect(temaSemAspas('"Raízes"')).toBe('Raízes');
    expect(temaSemAspas('  Sem aspas  ')).toBe('Sem aspas');
    expect(temaSemAspas('Meio "com" aspas')).toBe('Meio "com" aspas');
    expect(trocarMarcas('PERCURSOS - {ano} - “{TEMA}”', 2027, '“Nossa História”')).toBe('PERCURSOS - 2027 - “NOSSA HISTÓRIA”');
    expect(linhasDoTema('“Nossa História, Nossos Vínculos, Nosso Futuro”')).toEqual(['“NOSSA HISTÓRIA,', 'NOSSOS VÍNCULOS, NOSSO FUTURO”']);
  });
});

describe('os percursos salvam sozinhos', () => {
  const ANO = {
    ano: 2027, tema: '', percursos: percursosCompletos([]), textos: {}, meses_revisados: [], capa_url: null, status: 'preenchimento',
    observacao: null, enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null,
  } as unknown as AnoDoCalendario;

  it('grava 1,5 s depois de parar de digitar, juntando com o banco, e mostra "Tudo salvo"', async () => {
    vi.resetModules();
    const doBanco = { ...ANO, percursos: percursosCompletos([{ mes: 2, tema: 'Fevereiro da outra', sugestoes: '' }]) };
    const salvarAno = vi.fn(async (_a: number, c: Partial<AnoDoCalendario>) => ({ ...doBanco, ...c }));
    vi.doMock('@/lib/calendario/api', () => ({
      salvarAnoJuntando: async (a: number, juntar: (x: AnoDoCalendario) => Partial<AnoDoCalendario>) => salvarAno(a, juntar(doBanco)),
    }));
    const { PercursosDoAno } = await import('@/components/calendario/PercursosDoAno');
    vi.useFakeTimers();
    try {
      const onAno = vi.fn();
      render(<PercursosDoAno ano={ANO} editavel onAno={onAno} />);
      fireEvent.change(screen.getByLabelText('Tema de Janeiro'), { target: { value: 'Expedição do Tempo' } });
      expect(screen.getByRole('button', { name: 'Salvar agora' })).toBeEnabled();
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(salvarAno).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(600); });
      await act(async () => { await Promise.resolve(); });
      expect(salvarAno).toHaveBeenCalledTimes(1);
      const gravado = salvarAno.mock.calls[0][1].percursos!;
      expect(gravado[0].tema).toBe('Expedição do Tempo');
      expect(gravado[1].tema).toBe('Fevereiro da outra');
      expect(onAno).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.doUnmock('@/lib/calendario/api');
    }
  });

  it('"Salvar agora" grava na hora', async () => {
    vi.resetModules();
    const salvarAno = vi.fn(async (_a: number, c: Partial<AnoDoCalendario>) => ({ ...ANO, ...c }));
    vi.doMock('@/lib/calendario/api', () => ({ salvarAnoJuntando: async (a: number, j: (x: AnoDoCalendario) => Partial<AnoDoCalendario>) => salvarAno(a, j(ANO)) }));
    const { PercursosDoAno } = await import('@/components/calendario/PercursosDoAno');
    let ano = ANO;
    const { rerender } = render(<PercursosDoAno ano={ano} editavel onAno={(a) => { ano = a; }} />);
    fireEvent.change(screen.getByLabelText('Sugestões de Março'), { target: { value: 'Eu com a cidade' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await waitFor(() => expect(salvarAno).toHaveBeenCalledTimes(1));
    rerender(<PercursosDoAno ano={ano} editavel onAno={(a) => { ano = a; }} />);
    expect(await screen.findByRole('button', { name: 'Tudo salvo' })).toBeDisabled();
    vi.doUnmock('@/lib/calendario/api');
  });
});

describe('o salvar sozinho não entra em laço', () => {
  it('salvou e nada mudou durante o salvamento: não grava de novo, mesmo se "mudou" continuar', async () => {
    const { useSalvarSozinho } = await import('@/hooks/useSalvarSozinho');
    const salvar = vi.fn(async () => {});
    function Tela() {
      // "mudou" fica sempre verdadeiro (como o título apagado antes da correção).
      const { estado } = useSalvarSozinho({ chave: 'x', mudou: true, salvar, espera: 50 });
      return <p data-testid="estado">{estado}</p>;
    }
    vi.useFakeTimers();
    try {
      render(<Tela />);
      for (let i = 0; i < 10; i++) await act(async () => { vi.advanceTimersByTime(100); await Promise.resolve(); });
      expect(salvar).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});

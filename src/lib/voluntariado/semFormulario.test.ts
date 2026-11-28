import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const { areaDoTexto, horarioDoTexto, linhasDaPlanilha, numerosDoTexto, unidadeDoTexto, vinculoDoTexto } = await import('./semFormulario');
const { eDoGrupo, eGestor, semInscricao, eSoDoMeuGrupo } = await import('./central');

/** Quem entrou sem o formulário (28/11/2026). */

describe('as etiquetas da planilha', () => {
  it('reconhece as 12 áreas pelo nome da planilha e pelo do formulário', () => {
    expect(areaDoTexto('Cozinha / Servimento Refeições')).toBe('cozinha');
    expect(areaDoTexto('Montagem/Desmontagem Espaços')).toBe('montagem');
    expect(areaDoTexto('Decoração')).toBe('decoracao');
    expect(areaDoTexto('Limpeza Pré')).toBe('limpeza_pre');
    expect(areaDoTexto('Brinquedos Infláveis')).toBe('inflaveis');
    expect(areaDoTexto('Estações')).toBe('estacoes');
    expect(areaDoTexto('Louvor Kids')).toBe('louvor_kids');
    expect(areaDoTexto('Som')).toBe('som');
    expect(areaDoTexto('Recreação Kids')).toBe('recreacao_kids');
    expect(areaDoTexto('Presentes Kids')).toBe('presentes_kids');
    expect(areaDoTexto('CCII')).toBe('ccii');
    expect(areaDoTexto('Crianças Atípicas')).toBe('atipicas');
    expect(areaDoTexto('')).toBeNull();
    expect(areaDoTexto('Sonoplastia')).toBeNull();
  });

  it('horário, vínculo e unidade', () => {
    expect(horarioDoTexto('Manhã')).toBe('manha');
    expect(horarioDoTexto('Pós-Evento')).toBe('pos_evento');
    expect(horarioDoTexto('Dia todo')).toBe('dia_todo');
    expect(horarioDoTexto('Dia anterior')).toBe('dia_anterior');
    expect(horarioDoTexto('')).toBeNull();
    expect(vinculoDoTexto('Funcionário(a) ANA', false)).toBe('funcionario');
    expect(vinculoDoTexto('Alcance JNI', false)).toBe('alcance');
    expect(vinculoDoTexto('INCC', false)).toBe('alcance');
    expect(vinculoDoTexto('Voluntário(a)', true)).toBe('comunidade');
    expect(vinculoDoTexto('', true)).toBe('funcionario');
    expect(vinculoDoTexto('', false)).toBe('comunidade');
    expect(unidadeDoTexto('Grupo de Oração Esperança')?.id).toBe('goe');
    expect(unidadeDoTexto('Escritório (ADM)')?.id).toBe('escritorio-adm');
    expect(unidadeDoTexto('GOE')?.id).toBe('goe');
    expect(unidadeDoTexto('Unidade X')).toBeNull();
  });
});

describe('linhas coladas da planilha', () => {
  const L = (...c: string[]) => c.join('\t');
  const texto = [
    L('Nome', 'Área / Setor', 'Horário', 'WhatsApp', 'Vínculo', 'Unidade', '2ª opção', 'Indicado por', 'Igreja', 'Protocolo'),
    L('Leonardo Garbo', 'Cozinha / Servimento Refeições', 'Manhã', '(19) 99355-8242', 'Funcionário(a) ANA', 'Grupo de Oração Esperança', '', '', '', 'VL-7K2Q9'),
    L('Maria das Graças', 'Decoração', 'Dia anterior', '(19) 98888-7777', 'Voluntário(a)', '', 'Cozinha / Servimento Refeições'),
    L('João Lima', 'Som', '', '19 97777-6666', 'Alcance JNI'),
    L('Ana Souza', 'Estações', 'Tarde', '(19) 96666-5555', 'Funcionário(a) ANA', 'Escritório (ADM)'),
    L('Sem Telefone', 'Som', '', ''),
    L('Área Estranha', 'Sonoplastia', '', '(19) 95555-4444'),
    L('Já Inscrita', 'Som', '', '(19) 94444-3333'),
    L('Repetida', 'Som', '', '(19) 98888-7777'),
    L('Funcionária Sem Unidade', 'Som', '', '(19) 93333-2222', 'Funcionário(a) ANA'),
    '',
  ].join('\n');
  const r = linhasDaPlanilha(texto, ['19944443333']);

  it('entra só quem não tem protocolo, com área reconhecida e WhatsApp novo', () => {
    expect(r.entram.map((e) => e.cadastro.nome)).toEqual(['Maria das Graças', 'João Lima', 'Ana Souza']);
    expect(r.entram[0].cadastro).toMatchObject({ whatsapp: '19988887777', vinculo: 'comunidade', opcao1: 'decoracao', opcao2: 'cozinha', horario: 'dia_anterior', unidadeId: null });
    expect(r.entram[1].cadastro).toMatchObject({ vinculo: 'alcance', opcao1: 'som', horario: null });
    expect(r.entram[2].cadastro).toMatchObject({ vinculo: 'funcionario', unidadeId: 'escritorio-adm', opcao1: 'estacoes', horario: 'tarde' });
  });

  it('diz por que cada linha ficou de fora', () => {
    const motivo = (n: string) => r.ignoradas.find((i) => i.nome === n)?.motivo;
    expect(motivo('Leonardo Garbo')).toMatch(/protocolo/);
    expect(motivo('Sem Telefone')).toMatch(/WhatsApp/);
    expect(motivo('Área Estranha')).toMatch(/não reconhecida/);
    expect(motivo('Já Inscrita')).toMatch(/já está inscrito/);
    expect(motivo('Repetida')).toMatch(/repetido/);
    expect(motivo('Funcionária Sem Unidade')).toMatch(/sem unidade/);
  });
});

describe('números do grupo geral', () => {
  it('um por linha, em qualquer formato, com ou sem nome; sem repetir', () => {
    const n = numerosDoTexto('Maria Souza · (19) 99999-8888\n+55 19 98888-7777\nJoão: 19977776666\n(19) 99999-8888\nlixo 123\n');
    expect(n).toEqual([
      { whatsapp: '19999998888', nome: 'Maria Souza' },
      { whatsapp: '19988887777', nome: null },
      { whatsapp: '19977776666', nome: 'João' },
    ]);
  });
});

describe('a Central para quem está só no grupo', () => {
  const doGrupo = { vinculo: 'grupo' as const, opcao1: null, horario: null };
  it('não é gestor, não tem inscrição e não ganha o selo "Para você"', () => {
    expect(eDoGrupo(doGrupo)).toBe(true);
    expect(eGestor(doGrupo)).toBe(false);
    expect(semInscricao(doGrupo)).toBe(true);
    expect(eSoDoMeuGrupo({ areas: ['cozinha'], horarios: [] }, doGrupo)).toBe(false);
  });
});

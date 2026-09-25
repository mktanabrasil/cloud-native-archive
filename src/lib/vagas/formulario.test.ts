import { describe, expect, it } from 'vitest';
import { FORMULARIO_VAZIO, avisosDaRevisao, dadosParaGravar, faltasDoPasso, faltasParaSalvar, itensDoTexto, perguntasParaGravar, termosDoFormulario, type FormularioDaVaga } from './formulario';
import { procurarTermos } from './termos';

const pronto: FormularioDaVaga = {
  ...FORMULARIO_VAZIO,
  titulo: '  Educador Social   de Música ',
  area: 'social',
  carga_horaria: '40h',
  descricao: 'Oficinas de música.',
  requisitos: ['Ensino Médio completo', '  '],
  link_externo: 'https://forms.gle/abc',
};

describe('passos', () => {
  it('cada passo pede o seu mínimo', () => {
    expect(faltasDoPasso(0, FORMULARIO_VAZIO)).toEqual(['Escreva o título da vaga.', 'Escolha a área.']);
    expect(faltasDoPasso(1, FORMULARIO_VAZIO)).toEqual(['Conte o que a pessoa vai fazer.']);
    expect(faltasDoPasso(2, FORMULARIO_VAZIO)).toEqual(['Inclua pelo menos um requisito.']);
    expect(faltasDoPasso(3, { ...pronto, link_externo: 'forms.gle/abc' })).toEqual(['O link do formulário precisa começar com https://']);
    expect(faltasParaSalvar(pronto)).toEqual([]);
  });

  it('pergunta de escolha precisa de duas opções', () => {
    const f = { ...pronto, perguntas: [{ texto: 'Qual turno?', tipo: 'unica' as const, opcoes: ['Manhã', ''], obrigatoria: true }] };
    expect(faltasDoPasso(4, f)).toEqual(['A pergunta 1 precisa de pelo menos duas opções.']);
  });
});

describe('termos que barram publicar', () => {
  it('acha gênero, idade, aparência e estado civil, com o campo', () => {
    const achados = procurarTermos({ 'Título': 'Auxiliar de Cozinha (feminina)', 'Requisitos': ['Idade entre 18 e 30 anos', 'Boa aparência', 'Solteira'] });
    expect(achados.map(a => [a.campo, a.motivo])).toEqual([
      ['Título', 'gênero'], ['Requisitos', 'idade'], ['Requisitos', 'aparência'], ['Requisitos', 'estado civil'],
    ]);
  });

  it('não confunde palavras parecidas', () => {
    expect(procurarTermos({ t: 'Educação sexual para adolescentes; casa de acolhimento; corrida' })).toEqual([]);
    expect(termosDoFormulario(pronto)).toEqual([]);
  });
});

describe('gravar', () => {
  it('vaga nova ganha endereço e código livres, e o texto é limpo', () => {
    const d = dadosParaGravar(pronto, 'publicada', null, [{ slug: 'educador-social-de-musica', codigo: 'SOC-2026-007' }], 2026);
    expect(d.slug).toBe('educador-social-de-musica-2');
    expect(d.codigo).toBe('SOC-2026-008');
    expect(d.titulo).toBe('Educador Social de Música');
    expect(d.requisitos).toEqual(['Ensino Médio completo']);
    expect(d.prazo).toBeNull();
  });

  it('editando, endereço e código não mudam', () => {
    const d = dadosParaGravar({ ...pronto, titulo: 'Outro título' }, 'publicada', { slug: 'a', codigo: 'SOC-2026-001' }, [], 2026);
    expect([d.slug, d.codigo]).toEqual(['a', 'SOC-2026-001']);
  });

  it('prazo vira fim do dia; aprendiz e afirmativa arrastam os marcadores', () => {
    const d = dadosParaGravar({ ...pronto, prazo: '2026-10-30', contratacao: 'aprendiz', afirmativa_pcd: true, aberta_pcd: false }, 'rascunho', null, [], 2026);
    expect(d.prazo).toBe('2026-10-30T23:59:00-03:00');
    expect(d.aprendizagem).toBe(true);
    expect(d.aberta_pcd).toBe(true);
  });

  it('perguntas vazias saem; opções só nas de escolha', () => {
    const f = { ...pronto, perguntas: [{ texto: ' ', tipo: 'texto_curto' as const, opcoes: [], obrigatoria: false }, { texto: 'Tem CNH?', tipo: 'sim_nao' as const, opcoes: ['x'], obrigatoria: true }] };
    expect(perguntasParaGravar(f)).toEqual([{ texto: 'Tem CNH?', tipo: 'sim_nao', opcoes: [], obrigatoria: true }]);
  });

  it('avisos da revisão', () => {
    expect(avisosDaRevisao({ ...pronto, link_externo: '', beneficios: [] })).toHaveLength(2);
  });
});

describe('colar lista', () => {
  it('uma linha por item, sem marcadores', () => {
    expect(itensDoTexto('• Ensino Médio\n- CNH B\n3) Disponibilidade\n\n')).toEqual(['Ensino Médio', 'CNH B', 'Disponibilidade']);
  });
});

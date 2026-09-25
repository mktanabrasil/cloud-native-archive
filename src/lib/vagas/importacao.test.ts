import { describe, expect, it } from 'vitest';
import { dadosDaImportacao, linhasDaImportacao } from './importacao';
import { SEMENTE } from './semente';
import { procurarTermos } from './termos';

describe('a semente das vagas do site', () => {
  it('traz as 42 do site: 24 do Social e 18 da Educação', () => {
    expect(SEMENTE).toHaveLength(42);
  });

  it('todo Forms é um link forms.gle e toda vaga tem requisito', () => {
    for (const s of SEMENTE) {
      expect(s.link_externo, s.titulo).toMatch(/^https:\/\/forms\.gle\/[A-Za-z0-9]+$/);
      expect(s.requisitos.length, s.titulo).toBeGreaterThan(0);
    }
  });

  it('nenhum título com caixa alta ou gênero, e nenhum termo que barre publicar', () => {
    for (const s of SEMENTE) {
      expect(s.titulo, s.titulo).not.toMatch(/^[A-ZÀ-Ú .()|–-]{6,}$/);
      expect(procurarTermos({ t: s.titulo, r: s.requisitos, d: s.diferenciais ?? [], x: s.responsabilidades ?? [] }), s.titulo).toEqual([]);
    }
  });

  it('as três duplicadas apontam para uma vaga que existe, com o mesmo Forms', () => {
    const dup = SEMENTE.filter(s => s.duplicadaDe);
    expect(dup.map(d => d.titulo)).toEqual(['Assistente de Recursos Humanos', 'Jovem Aprendiz', 'Vagas para Pessoas com Deficiência']);
    for (const d of dup) {
      const original = SEMENTE.find(s => !s.duplicadaDe && s.titulo === d.duplicadaDe)!;
      expect(original.link_externo).toBe(d.link_externo);
    }
  });
});

describe('linhas da importação', () => {
  it('sugere 39: tudo menos as três duplicadas', () => {
    const linhas = linhasDaImportacao(SEMENTE, []);
    expect(linhas.filter(l => l.sugerida)).toHaveLength(39);
  });

  it('o que já entrou vem marcado como importado, pelo título, área e Forms', () => {
    const zelador = SEMENTE.find(s => s.titulo === 'Zelador' && s.area === 'educacao')!;
    const linhas = linhasDaImportacao(SEMENTE, [{ titulo: 'Zelador', area: 'educacao', link_externo: zelador.link_externo }]);
    const l = linhas.filter(x => x.jaImportada);
    expect(l.map(x => [x.item.titulo, x.item.area])).toEqual([['Zelador', 'educacao']]);
    // Serviços Gerais usa o mesmo Forms, mas é outra vaga
    expect(linhas.find(x => x.item.titulo === 'Auxiliar de Serviços Gerais')!.jaImportada).toBe(false);
  });
});

describe('dados para gravar', () => {
  it('endereço com a área quando a mesma vaga existe nas duas; códigos em sequência por área', () => {
    const itens = SEMENTE.filter(s => ['Zelador', 'Auxiliar de Cozinha'].includes(s.titulo));
    const d = dadosDaImportacao(itens, 'publicada', [{ slug: 'x', codigo: 'EDU-2026-004' }], 2026);
    expect(d.map(x => [x.slug, x.codigo])).toEqual([
      ['auxiliar-de-cozinha', 'SOC-2026-001'],
      ['zelador', 'SOC-2026-002'],
      ['auxiliar-de-cozinha-educacao', 'EDU-2026-005'],
      ['zelador-educacao', 'EDU-2026-006'],
    ]);
    expect(d.every(x => x.status === 'publicada' && x.prazo === null && x.cidade === 'Campinas/SP')).toBe(true);
  });

  it('as 39 sugeridas geram endereços e códigos únicos', () => {
    const itens = linhasDaImportacao(SEMENTE, []).filter(l => l.sugerida).map(l => l.item);
    const d = dadosDaImportacao(itens, 'publicada', []);
    expect(new Set(d.map(x => x.slug)).size).toBe(39);
    expect(new Set(d.map(x => x.codigo)).size).toBe(39);
    expect(d.find(x => x.titulo === 'Jovem Aprendiz')).toMatchObject({ contratacao: 'aprendiz', aprendizagem: true });
    expect(d.find(x => x.titulo === 'Vagas para Pessoas com Deficiência')).toMatchObject({ afirmativa_pcd: true });
  });
});

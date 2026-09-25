import { describe, expect, it } from 'vitest';
import { paraVaga } from './api';
import { FILTRO_VAZIO, casaComBusca, contagemPorArea, enderecoDoFiltro, filtrarVagas, filtroDoEndereco, vagasNoPlural } from './vitrine';

const vaga = (o: Record<string, unknown>) => paraVaga({ id: String(o.slug), status: 'publicada', ...o });
const VAGAS = [
  vaga({ slug: 'educador-social-de-musica', titulo: 'Educador Social de Música', area: 'social', requisitos: ['Ensino Médio completo'] }),
  vaga({ slug: 'professor-de-educacao-infantil', titulo: 'Professor de Educação Infantil', area: 'educacao', afirmativa_pcd: true }),
  vaga({ slug: 'jovem-aprendiz-administrativo', titulo: 'Jovem Aprendiz Administrativo', area: 'administracao', contratacao: 'aprendiz' }),
];

describe('busca', () => {
  it('sem acento e sem caixa, todas as palavras', () => {
    expect(casaComBusca(VAGAS[0], 'MUSICA educador')).toBe(true);
    expect(casaComBusca(VAGAS[0], 'musica professor')).toBe(false);
    expect(casaComBusca(VAGAS[0], 'ensino medio')).toBe(true);
    expect(casaComBusca(VAGAS[0], '   ')).toBe(true);
  });
});

describe('filtros', () => {
  it('área, aprendiz e PcD', () => {
    expect(filtrarVagas(VAGAS, FILTRO_VAZIO)).toHaveLength(3);
    expect(filtrarVagas(VAGAS, { ...FILTRO_VAZIO, area: 'educacao' }).map(v => v.slug)).toEqual(['professor-de-educacao-infantil']);
    expect(filtrarVagas(VAGAS, { ...FILTRO_VAZIO, especial: 'aprendiz' }).map(v => v.slug)).toEqual(['jovem-aprendiz-administrativo']);
    expect(filtrarVagas(VAGAS, { ...FILTRO_VAZIO, especial: 'pcd' }).map(v => v.slug)).toEqual(['professor-de-educacao-infantil']);
  });

  it('conta por área e esconde a área sem vaga', () => {
    expect(contagemPorArea(VAGAS.slice(0, 2))).toEqual([{ area: 'social', total: 1 }, { area: 'educacao', total: 1 }]);
    expect(vagasNoPlural(1)).toBe('1 vaga');
    expect(vagasNoPlural(42)).toBe('42 vagas');
  });
});

describe('filtro no endereço', () => {
  it('vai e volta, e ignora valor desconhecido', () => {
    const f = { busca: 'professor', area: 'educacao' as const, especial: 'pcd' as const };
    expect(filtroDoEndereco(enderecoDoFiltro(f))).toEqual(f);
    expect(filtroDoEndereco(new URLSearchParams('area=sede&so=x'))).toEqual(FILTRO_VAZIO);
  });
});

describe('leitura da linha do banco', () => {
  it('listas vazias e itens em branco somem', () => {
    const v = paraVaga({ id: '1', slug: 'a', requisitos: ['Ensino Médio', '  '], beneficios: null });
    expect(v.requisitos).toEqual(['Ensino Médio']);
    expect(v.beneficios).toEqual([]);
  });
});

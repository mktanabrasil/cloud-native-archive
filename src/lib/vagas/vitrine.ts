import { AREAS, type Area, type Vaga } from './modelo';

/**
 * A vitrine do portal: busca e filtros, sem tocar no banco (as vagas
 * publicadas chegam todas de uma vez; são dezenas, não milhares).
 */

export type FiltroEspecial = 'aprendiz' | 'pcd';

export interface FiltroDaVitrine {
  busca: string;
  area: Area | null;
  especial: FiltroEspecial | null;
}

export const FILTRO_VAZIO: FiltroDaVitrine = { busca: '', area: null, especial: null };

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Todas as palavras da busca aparecem no título, na descrição ou nos requisitos. */
export function casaComBusca(v: Vaga, busca: string): boolean {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = semAcento([v.titulo, v.codigo, v.descricao, v.carga_horaria, ...v.requisitos].join(' '));
  return palavras.every(p => alvo.includes(p));
}

export function filtrarVagas(vagas: Vaga[], f: FiltroDaVitrine): Vaga[] {
  return vagas.filter(v =>
    (f.area === null || v.area === f.area)
    && (f.especial !== 'aprendiz' || v.aprendizagem || v.contratacao === 'aprendiz')
    && (f.especial !== 'pcd' || v.afirmativa_pcd)
    && casaComBusca(v, f.busca));
}

/** Quantas vagas abertas por área, para os blocos do topo. Áreas sem vaga ficam de fora. */
export function contagemPorArea(vagas: Vaga[]): Array<{ area: Area; total: number }> {
  return AREAS.map(area => ({ area, total: vagas.filter(v => v.area === area).length })).filter(a => a.total > 0);
}

/** "1 vaga" / "12 vagas" */
export const vagasNoPlural = (n: number) => `${n} ${n === 1 ? 'vaga' : 'vagas'}`;

/** O filtro no endereço (?area=educacao&q=professor&so=pcd), para dar para compartilhar e para o embed do GOE. */
export function filtroDoEndereco(p: URLSearchParams): FiltroDaVitrine {
  const area = p.get('area');
  const so = p.get('so');
  return {
    busca: p.get('q') ?? '',
    area: (AREAS as readonly string[]).includes(area ?? '') ? (area as Area) : null,
    especial: so === 'aprendiz' || so === 'pcd' ? so : null,
  };
}

export function enderecoDoFiltro(f: FiltroDaVitrine): URLSearchParams {
  const p = new URLSearchParams();
  if (f.area) p.set('area', f.area);
  if (f.especial) p.set('so', f.especial);
  if (f.busca.trim()) p.set('q', f.busca.trim());
  return p;
}

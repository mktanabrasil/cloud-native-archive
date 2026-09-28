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

/**
 * Programas por lei (28/09/2026): Jovem Aprendiz e a vaga afirmativa para
 * pessoas com deficiência vão no fim da vitrine, separados, com os ícones
 * oficiais. Uma vaga comum que só está "aberta a PcD" continua entre as
 * demais: programa é a vaga de aprendizagem ou a vaga afirmativa geral.
 */
export type Programa = 'aprendiz' | 'pcd';

export function programaDaVaga(v: Pick<Vaga, 'titulo' | 'contratacao' | 'aprendizagem' | 'afirmativa_pcd'>): Programa | null {
  if (v.contratacao === 'aprendiz' || v.aprendizagem) return 'aprendiz';
  if (v.afirmativa_pcd && /defici[eê]ncia|\bpcd\b/i.test(v.titulo)) return 'pcd';
  return null;
}

/** As vagas comuns primeiro; os programas depois, Jovem Aprendiz antes de PcD. */
export function separarProgramas<T extends Pick<Vaga, 'titulo' | 'contratacao' | 'aprendizagem' | 'afirmativa_pcd'>>(lista: T[]): { comuns: T[]; programas: T[] } {
  const ordem: Record<Programa, number> = { aprendiz: 0, pcd: 1 };
  const programas = lista.filter(v => programaDaVaga(v)).sort((a, b) => ordem[programaDaVaga(a)!] - ordem[programaDaVaga(b)!]);
  return { comuns: lista.filter(v => !programaDaVaga(v)), programas };
}

/** Grade ou lista: a escolha fica no aparelho (sem armazenamento, volta à grade). */
export type Vista = 'grade' | 'lista';
const CHAVE_VISTA = 'vagas-vista';
export function vistaGuardada(): Vista {
  try { return localStorage.getItem(CHAVE_VISTA) === 'lista' ? 'lista' : 'grade'; } catch { return 'grade'; }
}
export function guardarVista(v: Vista): void {
  try { localStorage.setItem(CHAVE_VISTA, v); } catch { /* segue sem guardar */ }
}

import type { DadosDaVaga } from './api';
import { ROTULO_DA_AREA, proximoCodigo, slugDaVaga, slugLivre, type StatusDaVaga, type Vaga } from './modelo';
import type { VagaDaSemente } from './semente';
import { procurarTermos, type Achado } from './termos';

/**
 * A importação das vagas do site (fase 1, tela 31b), sem tocar no banco:
 * o que já entrou, o que vem marcado e como cada linha vira uma vaga.
 */

export interface LinhaDaImportacao {
  item: VagaDaSemente;
  /** Já existe uma vaga com o mesmo título, área e Forms. */
  jaImportada: boolean;
  termos: Achado[];
  /** Vem marcada: não é duplicada, não entrou antes e não tem termo barrado. */
  sugerida: boolean;
}

const mesma = (v: Pick<Vaga, 'titulo' | 'area' | 'link_externo'>, s: VagaDaSemente) =>
  v.link_externo === s.link_externo && v.titulo === s.titulo && v.area === s.area;

export function linhasDaImportacao(semente: VagaDaSemente[], existentes: Array<Pick<Vaga, 'titulo' | 'area' | 'link_externo'>>): LinhaDaImportacao[] {
  return semente.map(item => {
    const jaImportada = existentes.some(v => mesma(v, item));
    const termos = procurarTermos({ 'Título': item.titulo, 'Requisitos': item.requisitos, 'Diferenciais': item.diferenciais ?? [], 'No dia a dia': item.responsabilidades ?? [] });
    return { item, jaImportada, termos, sugerida: !item.duplicadaDe && !jaImportada && termos.length === 0 };
  });
}

/**
 * As linhas para gravar, na ordem. Endereço: o título; se já houver (a mesma
 * vaga nas duas áreas), o título com a área ("zelador-educacao"). Código: o
 * próximo da área no ano, contando os que esta mesma leva já pegou.
 */
export function dadosDaImportacao(
  itens: VagaDaSemente[],
  status: StatusDaVaga,
  existentes: Array<Pick<Vaga, 'slug' | 'codigo'>>,
  ano: number = new Date().getFullYear(),
): DadosDaVaga[] {
  const slugs = existentes.map(e => e.slug);
  const codigos = existentes.map(e => e.codigo);
  return itens.map(s => {
    const base = slugDaVaga(s.titulo);
    const comArea = slugDaVaga(`${s.titulo} ${ROTULO_DA_AREA[s.area]}`);
    const slug = !slugs.includes(base) ? base : !slugs.includes(comArea) ? comArea : slugLivre(comArea, slugs);
    const codigo = proximoCodigo(s.area, ano, codigos);
    slugs.push(slug); codigos.push(codigo);
    const contratacao = s.contratacao ?? 'clt';
    return {
      slug, codigo, titulo: s.titulo, area: s.area, cidade: 'Campinas/SP', modalidade: 'presencial', contratacao,
      carga_horaria: '', descricao: '', complementares: '',
      responsabilidades: s.responsabilidades ?? [], requisitos: s.requisitos, diferenciais: s.diferenciais ?? [], beneficios: [],
      afirmativa_pcd: s.afirmativa_pcd ?? false, aberta_pcd: true, aprendizagem: s.aprendizagem ?? contratacao === 'aprendiz',
      status, prazo: null, link_externo: s.link_externo,
    };
  });
}

/**
 * Regras puras da API de notícias (25/11/2026). A função `noticias` e os testes
 * do app importam daqui. As notícias moram no Drive compartilhado Setor
 * Marketing (pasta do blog): unidade › ano › "AAAA-MM-DD — Título", cada uma
 * com post.json, capa, fotos/ e videos/.
 */
import { compararNomes, palavrasDaBusca, paraBusca, slugDe, slugLivre } from '../transparencia/regras.ts';

export { slugLivre };

/** As unidades das notícias, com os mesmos endereços (slug) da transparência. */
export const UNIDADES: Record<string, { slug: string; nome: string }> = {
  'Ana Dic': { slug: 'ana-dic', nome: 'Ana Dic' },
  'Ana Jardim Santana': { slug: 'ana-jardim-santana', nome: 'Ana Jardim Santana' },
  'Ana Piauí': { slug: 'ana-piaui', nome: 'Ana Piauí' },
  'Aninha Cancela': { slug: 'aninha-cancela', nome: 'Aninha Cancela' },
  'Ana Jardim Nilópolis': { slug: 'ana-jardim-nilopolis', nome: 'Ana Jardim Nilópolis' },
  'Ana Oziel': { slug: 'ana-oziel', nome: 'Ana Oziel' },
  'Grupo de Oração Esperança': { slug: 'grupo-de-oracao-esperanca', nome: 'Grupo de Oração Esperança' },
  'ANA Brasil (institucional)': { slug: 'institucional', nome: 'ANA Brasil' },
};
/** A unidade pelo nome da pasta (ou do post.json); desconhecida vira um slug do próprio nome. */
export function unidadeDe(nome: string | null | undefined): { slug: string; nome: string } {
  const n = (nome ?? '').trim();
  return UNIDADES[n] ?? { slug: slugDe(n || 'institucional'), nome: n || 'ANA Brasil' };
}

/** Pasta de post: "2026-10-28 — Título" (o travessão separa a data). */
export function lerNomeDaPasta(nome: string): { data: string | null; titulo: string } {
  const m = nome.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)$/);
  return m ? { data: m[1], titulo: m[2].trim() } : { data: null, titulo: nome.trim() };
}

/** Endereço da notícia: do slug antigo do WordPress (sem emoji) ou do título. */
export function slugDaNoticia(titulo: string, slugAntigo?: string | null): string {
  let base = '';
  if (slugAntigo) { try { base = slugDe(decodeURIComponent(slugAntigo)); } catch { base = slugDe(slugAntigo); } }
  if (!base || base === 'unidade') base = slugDe(titulo);
  return base.slice(0, 90).replace(/-+$/, '') || 'noticia';
}

/** Tamanho para a tela e para a miniatura, mantendo a proporção (o maior lado vira `max`). */
export function escala(w: number | null, h: number | null, max: number): { w: number; h: number } | null {
  if (!w || !h) return null;
  if (Math.max(w, h) <= max) return { w, h };
  const f = max / Math.max(w, h);
  return { w: Math.round(w * f), h: Math.round(h * f) };
}
export const LADO_TELA = 1600;
export const LADO_MINI = 400;

/** Primeiro parágrafo, curto, para a lista de notícias. */
export function resumoDe(texto: string[], max = 220): string {
  const p = (texto.find((t) => t.trim()) ?? '').replace(/\s+/g, ' ').trim();
  return p.length > max ? `${p.slice(0, max).replace(/\s+\S*$/, '')}…` : p;
}

/** O que o post.json traz (backup do WordPress e, depois, a ferramenta do app). */
export interface PostJson {
  versao?: number;
  id?: number;
  titulo?: string;
  data?: string;
  slug?: string;
  link_original?: string;
  unidade?: string;
  unidades?: string[];
  texto_paragrafos?: string[];
  na_lista?: boolean;
  fixada?: boolean;
  /** Descrição de cada foto para leitor de tela, pelo nome do arquivo. */
  descricoes?: Record<string, string>;
}

/** Notícia pronta, como a API guarda (sem endereços: a base pode mudar). */
export interface MidiaGuardada { tipo: 'foto' | 'video'; chave: string; nome: string; w: number | null; h: number | null; duracao: number | null; alt: string }
export interface NoticiaGuardada {
  slug: string;
  titulo: string;
  data: string;
  unidade: string;
  unidades: string[];
  texto: string[];
  capa: MidiaGuardada | null;
  midias: MidiaGuardada[];
  na_lista: boolean;
  fixada: boolean;
}

/** Monta a notícia a partir do post.json e da pasta. Os campos obrigatórios caem no nome da pasta se faltarem. */
export function montarNoticia(j: PostJson, pasta: { nome: string; unidadePasta: string }): Omit<NoticiaGuardada, 'slug' | 'capa' | 'midias'> {
  const daPasta = lerNomeDaPasta(pasta.nome);
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const dataValida = (v: unknown) => {
    const d = texto(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const x = new Date(`${d}T00:00:00Z`);
    return !isNaN(+x) && x.toISOString().slice(0, 10) === d ? d : null;
  };
  const titulo = texto(j.titulo) || daPasta.titulo;
  const data = dataValida(j.data) ?? dataValida(daPasta.data) ?? '1970-01-01';
  const principal = unidadeDe(texto(j.unidade) || pasta.unidadePasta);
  const extras = Array.isArray(j.unidades) ? j.unidades.map(texto).filter(Boolean) : [];
  const todas = [principal.slug, ...extras.map((u) => unidadeDe(u).slug)].filter((x, i, a) => a.indexOf(x) === i);
  const paragrafos = Array.isArray(j.texto_paragrafos) ? j.texto_paragrafos.map(texto).filter(Boolean) : [];
  return { titulo, data, unidade: principal.slug, unidades: todas, texto: paragrafos, na_lista: j.na_lista !== false, fixada: j.fixada === true };
}

/** Manchete: a fixada mais recente; sem fixada, a mais recente da lista. */
export function manchete<T extends { data: string; na_lista: boolean; fixada: boolean; slug: string }>(lista: T[]): T | null {
  const vis = lista.filter((n) => n.na_lista);
  const ordem = (a: T, b: T) => b.data.localeCompare(a.data) || a.slug.localeCompare(b.slug);
  return [...vis.filter((n) => n.fixada)].sort(ordem)[0] ?? [...vis].sort(ordem)[0] ?? null;
}

/** Busca nas notícias: título (vale mais), texto e unidade. Mesmas regras da busca da transparência. */
export function buscarNoticias<T extends { titulo: string; texto: string[]; unidade: string; unidades: string[]; data: string; na_lista: boolean }>(
  lista: T[], q: string, nomes: Record<string, string>, opcoes: { unidade?: string; limite?: number } = {},
): { total: number; resultados: T[] } {
  const palavras = palavrasDaBusca(q);
  if (!palavras.length) return { total: 0, resultados: [] };
  const achados: { n: T; pontos: number }[] = [];
  for (const n of lista) {
    if (!n.na_lista) continue;
    if (opcoes.unidade && !n.unidades.includes(opcoes.unidade)) continue;
    const titulo = paraBusca(n.titulo);
    const resto = paraBusca(`${n.texto.join(' ')} ${n.unidades.map((u) => nomes[u] ?? u).join(' ')}`);
    let pontos = 0;
    let todas = true;
    for (const w of palavras) {
      if (titulo.includes(` ${w}`)) pontos += 3;
      else if (titulo.includes(w)) pontos += 2;
      else if (resto.includes(w)) pontos += 1;
      else { todas = false; break; }
    }
    if (todas) achados.push({ n, pontos });
  }
  achados.sort((a, b) => b.pontos - a.pontos || b.n.data.localeCompare(a.n.data) || compararNomes(a.n.titulo, b.n.titulo));
  const limite = Math.min(Math.max(Number.isFinite(opcoes.limite) ? (opcoes.limite as number) : 20, 1), 100);
  return { total: achados.length, resultados: achados.slice(0, limite).map((x) => x.n) };
}

export const ehImagem = (mime: string | undefined) => !!mime && /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(mime);
export const ehVideo = (mime: string | undefined) => !!mime && /^video\//.test(mime);

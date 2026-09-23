import type { Enquete } from './modelo';

/** Os dois links de uma enquete. */
export function linksDaEnquete(slug: string, origem: string = typeof window !== 'undefined' ? window.location.origin : 'https://app.anabrasil.org'): { votar: string; resultado: string } {
  return { votar: `${origem}/enquete/${slug}`, resultado: `${origem}/enquete/${slug}/resultado` };
}

/** O slug a partir da pergunta: "Qual folga você prefere?" → "qual-folga-voce-prefere". */
export function slugDaPergunta(pergunta: string): string {
  return pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '') || 'enquete';
}

/** O texto que vai no WhatsApp com o link de voto. */
export function textoDoWhatsAppDaEnquete(e: Pick<Enquete, 'pergunta' | 'slug' | 'encerra_em'>, origem?: string): string {
  const { votar } = linksDaEnquete(e.slug, origem);
  const prazo = e.encerra_em ? ` Vale até ${new Date(e.encerra_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.` : '';
  return `*${e.pergunta}*\nVote pelo link (leva 10 segundos, um voto por pessoa):\n${votar}${prazo}`;
}

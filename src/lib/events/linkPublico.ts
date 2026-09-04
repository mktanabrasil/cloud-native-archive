/**
 * O endereço que de fato abre um evento na página pública.
 *
 * O formulário escrevia `anabrasil.com/eventos/<slug>` em quatro lugares —
 * um endereço que não existe (o domínio responde 404). O link real, o mesmo
 * que o botão "Copiar link" do detalhe já usava, é a página pública desta
 * aplicação com `?slug=`. Um lugar só para os dois.
 */
export function linkPublicoDoEvento(slugOuId: string, origem: string = window.location.origin): string {
  return `${origem}/eventos?slug=${encodeURIComponent(slugOuId)}`;
}

/** Só o que aparece antes do slug, para o prefixo do campo. */
export function prefixoDoLinkPublico(origem: string = window.location.origin): string {
  return `${origem.replace(/^https?:\/\//, '')}/eventos?slug=`;
}

/**
 * O próximo sufixo quando o slug colide com um evento que a pessoa não vê.
 *
 * A unicidade do formulário é conferida contra os eventos carregados. Quem
 * enxerga só a própria unidade pode escolher um slug que outra unidade já
 * usa; o banco recusa (`events_slug_key`). Em vez de desistir, avançamos o
 * sufixo e tentamos de novo: `hope-day` → `hope-day-2` → `hope-day-3`.
 */
export function proximoSlug(slug: string): string {
  const m = slug.match(/^(.*)-(\d+)$/);
  if (m) return `${m[1]}-${Number(m[2]) + 1}`;
  return `${slug}-2`;
}

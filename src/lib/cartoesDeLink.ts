/**
 * O cartão que aparece ao colar um link no WhatsApp (25/09/2026, opção 1).
 *
 * O WhatsApp não roda o app: lê só as marcações `og:` do HTML que o servidor
 * entrega. E o servidor entrega o mesmo `index.html` para todo endereço, com
 * o cartão da programação de eventos. O link da enquete chegava no grupo como
 * "Programação de Eventos", com a foto do desfile.
 *
 * Solução sem servidor novo: no build, o `index.html` ganha cópias com outro
 * cartão (`enquete.html`, `enquete-resultado.html`), e o `.htaccess` manda os
 * endereços `/enquete/...` para elas. O app carrega igual, porque é o mesmo
 * HTML com os mesmos scripts; só o cabeçalho muda.
 *
 * O cartão é genérico (não mostra a pergunta de cada enquete): isso exigiria
 * montar o HTML por enquete no servidor, a opção 2 do mockup.
 *
 * Desde 25/09/2026 vale para todas as páginas: cada uma tem o seu cartão, e
 * a foto do desfile saiu. O cartão da raiz e da vitrine é o do próprio
 * index.html (programação). As regras que mandam cada endereço para o seu
 * arquivo estão no public/.htaccess, e o teste confere que as duas listas
 * batem.
 */

export interface CartaoDeLink {
  /** Nome do arquivo gerado no build, ao lado do index.html. */
  arquivo: string;
  /** A regra do .htaccess que manda os endereços para este arquivo. */
  regra: string;
  titulo: string;
  descricao: string;
  /** Caminho público da imagem 1200×630. */
  imagem: string;
  imagemAlt: string;
}

export const ORIGEM = 'https://app.anabrasil.org';

export const CARTOES_DE_LINK: CartaoDeLink[] = [
  {
    arquivo: 'enquete-resultado.html',
    regra: 'RewriteRule ^enquete/[^/]+/resultado/?$ /enquete-resultado.html [L]',
    titulo: 'Resultado da enquete · ANA Brasil',
    descricao: 'Acompanhe ao vivo: os votos atualizam sozinhos, sem entrar no app.',
    imagem: '/og-enquete-resultado.jpg',
    imagemAlt: 'Resultado da enquete da ANA Brasil, ao vivo',
  },
  {
    arquivo: 'enquete.html',
    regra: 'RewriteRule ^enquete/ /enquete.html [L]',
    titulo: 'Enquete · ANA Brasil',
    descricao: 'Toque para votar. É rápido: um voto por pessoa, e dá para trocar até o prazo.',
    imagem: '/og-enquete.jpg',
    imagemAlt: 'Enquete da ANA Brasil: sua opinião conta aqui',
  },
  {
    arquivo: 'mercado.html',
    regra: 'RewriteRule ^mercado-solidario(-publico)?/?$ /mercado.html [L]',
    titulo: 'Mercado Solidário · ANA Brasil',
    descricao: 'Juntos podemos transformar alimentos em esperança: comida de qualidade na mesa de quem precisa.',
    imagem: '/og-mercado.jpg',
    imagemAlt: 'Mercado Solidário da ANA Brasil: alimento que vira esperança',
  },
  {
    arquivo: 'transparencia.html',
    regra: 'RewriteRule ^portal-transparencia(-publico)?/?$ /transparencia.html [L]',
    titulo: 'Portal da Transparência · ANA Brasil',
    descricao: 'Relatórios e prestação de contas da ANA Brasil.',
    imagem: '/og-transparencia.jpg',
    imagemAlt: 'Portal da Transparência da ANA Brasil',
  },
  {
    arquivo: 'jornal.html',
    regra: 'RewriteRule ^jornal-institucional/?$ /jornal.html [L]',
    titulo: 'Jornal Institucional · ANA Brasil',
    descricao: 'As notícias das unidades, nas edições do jornal da ANA Brasil.',
    imagem: '/og-jornal.jpg',
    imagemAlt: 'Jornal Institucional da ANA Brasil',
  },
  {
    // As páginas da equipe: pedem login e têm um cartão só.
    arquivo: 'app.html',
    regra: 'RewriteRule ^(login|redefinir-senha|auth/confirm|visao-geral|calendario|usuarios|auditoria|design-manual|marketing|admin-toolbox|email-preview)/?$ /app.html [L]',
    titulo: 'ANA Brasil · Área da equipe',
    descricao: 'O app da ANA Brasil: eventos, jornal e comunicação das unidades. Entre com a sua conta.',
    imagem: '/og-app.jpg',
    imagemAlt: 'O app da ANA Brasil',
  },
];

const escapar = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Troca o conteúdo de uma marcação `<meta {atributo}="{nome}" content="...">`. */
function trocarMeta(html: string, atributo: 'property' | 'name', nome: string, valor: string): string {
  const re = new RegExp(`(<meta\\s+${atributo}="${nome.replace(/[.:]/g, '\\$&')}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`cartoesDeLink: <meta ${atributo}="${nome}"> não está no index.html`);
  return html.replace(re, `$1${escapar(valor)}$2`);
}

/**
 * O index.html com o cabeçalho de outro cartão. Falha alto se alguma
 * marcação esperada sumir do index.html: um build com cartão errado é pior
 * que um build quebrado, porque ninguém percebe.
 */
export function comCartao(indexHtml: string, c: CartaoDeLink, origem = ORIGEM): string {
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${escapar(c.titulo)}</title>`);
  html = trocarMeta(html, 'name', 'description', c.descricao);
  html = trocarMeta(html, 'property', 'og:title', c.titulo);
  html = trocarMeta(html, 'property', 'og:description', c.descricao);
  html = trocarMeta(html, 'property', 'og:image', origem + c.imagem);
  html = trocarMeta(html, 'property', 'og:image:alt', c.imagemAlt);
  html = trocarMeta(html, 'name', 'twitter:title', c.titulo);
  html = trocarMeta(html, 'name', 'twitter:description', c.descricao);
  html = trocarMeta(html, 'name', 'twitter:image', origem + c.imagem);
  // Sem og:url: o da vitrine apontava tudo para /eventos, e o WhatsApp
  // agrupava os cartões por ele. Sem a marcação, vale o próprio link.
  html = html.replace(/\s*<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, '');
  return html;
}

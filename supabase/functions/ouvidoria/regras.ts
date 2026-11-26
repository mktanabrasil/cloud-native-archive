/**
 * Regras puras da Ouvidoria do site (26/11/2026). A função `ouvidoria` e os
 * testes do app importam daqui.
 *
 * O formulário do site (/ouvidoria/) manda um POST multipart com uma parte só,
 * `dados`, em JSON: { tipo, mensagem, identificado, pagina, nome?, email? }.
 * Quem não se identifica: guardamos só o tipo, a mensagem e a hora (a página
 * promete anonimato), sem IP nem nada de quem enviou.
 */

export const TIPOS = ['elogio', 'sugestao', 'reclamacao', 'denuncia', 'mensagem'] as const;
export type Tipo = (typeof TIPOS)[number];
export const NOME_DO_TIPO: Record<Tipo, string> = {
  elogio: 'Elogio', sugestao: 'Sugestão', reclamacao: 'Reclamação', denuncia: 'Denúncia', mensagem: 'Mensagem',
};
export const MAX_MENSAGEM = 3000;
export const MAX_NOME = 80;
export const MAX_EMAIL = 120;

/** Para onde vai cada mensagem (decisão de 26/11/2026): a ouvidoria, com cópia para a Vivi. */
export const PARA = 'ouvidoria@anabrasil.org';
export const COPIA = ['adm@anabrasil.org'];

export interface Mensagem {
  tipo: Tipo;
  mensagem: string;
  identificado: boolean;
  nome: string | null;
  email: string | null;
}

const sim = (v: unknown) => v === true || v === 'true' || v === 'sim' || v === 1 || v === '1';
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
/** Tira caracteres de controle (menos quebra de linha e tab) e espaços nas pontas. */
/** Corta em caracteres inteiros (um emoji nunca fica pela metade). */
const cortar = (s: string, max: number) => Array.from(s).slice(0, max).join('');
const limpo = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim();
export const emailValido = (s: string) => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(s);

/**
 * Lê o que o site mandou. Devolve a mensagem pronta para guardar, ou o motivo
 * da recusa. `robo` é o campo-isca: um campo que pessoas não veem; se vier
 * preenchido, é robô (e a resposta finge que deu certo, sem guardar nada).
 */
export function lerEnvio(bruto: unknown): { ok: true; mensagem: Mensagem } | { ok: false; erro: string } | { ok: 'robo' } {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { ok: false, erro: 'Envio inválido.' };
  const d = bruto as Record<string, unknown>;
  for (const isca of ['site', 'website', 'empresa', 'url']) if (texto(d[isca]).trim()) return { ok: 'robo' };
  const tipo = (TIPOS as readonly string[]).includes(texto(d.tipo)) ? (d.tipo as Tipo) : 'mensagem';
  const mensagem = limpo(texto(d.mensagem));
  if (!mensagem) return { ok: false, erro: 'A mensagem está vazia.' };
  if (mensagem.length > MAX_MENSAGEM) return { ok: false, erro: `A mensagem passa de ${MAX_MENSAGEM} caracteres.` };
  const identificado = sim(d.identificado);
  if (!identificado) return { ok: true, mensagem: { tipo, mensagem, identificado: false, nome: null, email: null } };
  const nome = cortar(limpo(texto(d.nome)).replace(/\s+/g, ' '), MAX_NOME) || null;
  // O e-mail é opcional e só serve para a ouvidoria responder: se não conferir (ex.: "maria@gmail"),
  // a mensagem vale mesmo assim; o e-mail vai junto, marcado, e não vira "responder para".
  const email = cortar(limpo(texto(d.email)).replace(/\s+/g, '').toLowerCase(), MAX_EMAIL) || null;
  return { ok: true, mensagem: { tipo, mensagem, identificado: true, nome, email } };
}

/** OUV-2026-0042 */
export const protocolo = (ano: number, n: number) => `OUV-${ano}-${String(n).padStart(4, '0')}`;

/** Data e hora de Brasília: "26/11/2026, 09:14". */
export function quandoEmBrasilia(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}`;
}

/** Assunto: "[Ouvidoria] DENÚNCIA · OUV-2026-0042". */
export const assuntoDoEmail = (tipo: Tipo, prot: string) => `[Ouvidoria] ${NOME_DO_TIPO[tipo].toLocaleUpperCase('pt-BR')} · ${prot}`;

const COR: Record<Tipo, [string, string]> = {
  elogio: ['#1f7a5c', '#e3f5ee'], sugestao: ['#1d5f8a', '#e2f1fb'], reclamacao: ['#9a5b00', '#fdf1d8'], denuncia: ['#a33224', '#fde6e2'], mensagem: ['#4b5350', '#eceeed'],
};
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface Email { assunto: string; texto: string; html: string; responderPara: string | null }

/** O e-mail que chega na ouvidoria (sem nada de quem enviou, quando é anônima). */
export function montarEmail(m: Mensagem, prot: string, recebidaEm: string | Date): Email {
  const quando = quandoEmBrasilia(recebidaEm);
  const confere = !!m.email && emailValido(m.email);
  const quem = m.identificado
    ? [m.nome ? `Nome: ${m.nome}` : null, m.email ? (confere ? `E-mail: ${m.email}` : `E-mail informado (parece incompleto, confira antes de responder): ${m.email}`) : 'E-mail: (não informado)'].filter(Boolean).join('\n')
    : 'Pediu anonimato. Nenhum dado de quem enviou foi guardado.';
  const texto = [
    `Ouvidoria · ANA Brasil — ${NOME_DO_TIPO[m.tipo]}`,
    `Protocolo ${prot} · recebida em ${quando}, pelo site`,
    '',
    m.mensagem,
    '',
    ...(m.identificado ? ['Quem enviou:', quem] : [`Quem enviou: ${quem}`]),
    '',
    !m.identificado ? 'Mensagem anônima: não há para quem responder.' : confere ? 'Para responder, é só responder este e-mail: a resposta vai para quem enviou.' : 'Sem um e-mail que confira: a resposta precisa ser feita por outro meio.',
    '—',
    'E-mail automático do app do ANA Brasil. A mensagem fica guardada como garantia; ela não aparece no app.',
  ].join('\n');
  const [cor, fundo] = COR[m.tipo];
  const quemHtml = m.identificado
    ? `${m.nome ? `${escapar(m.nome)}<br>` : ''}${m.email ? (confere ? `<a href="mailto:${escapar(m.email)}" style="color:#1d5f8a">${escapar(m.email)}</a>` : `${escapar(m.email)} <i>(parece incompleto: confira antes de responder)</i>`) : '(e-mail não informado)'}`
    : 'pediu anonimato. Nenhum dado de quem enviou foi guardado.';
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:#eef0ee;font-family:Arial,Helvetica,sans-serif;color:#1f2322">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1f2322;color:#ffffff;padding:16px 20px;font-size:18px;font-weight:bold">Ouvidoria · ANA Brasil
<span style="float:right;font-size:12px;font-weight:bold;color:${cor};background:${fundo};border-radius:999px;padding:4px 10px">${NOME_DO_TIPO[m.tipo]}</span></td></tr>
<tr><td style="padding:20px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px;font-size:13px;color:#555">Protocolo <b style="font-family:monospace;color:#1f2322">${prot}</b> · recebida em ${quando}, pelo site</p>
<div style="border-left:4px solid ${cor};background:#faf7f6;border-radius:10px;padding:14px 16px;white-space:pre-wrap">${escapar(m.mensagem)}</div>
<p style="margin:14px 0 0;font-size:13px;color:#555"><b style="color:#1f2322">Quem enviou:</b> ${quemHtml}</p>
${m.identificado && confere ? '<p style="margin:10px 0 0;font-size:13px;color:#555">Para responder, é só responder este e-mail: a resposta vai para quem enviou.</p>' : ''}
</td></tr>
<tr><td style="border-top:1px solid #eee;padding:12px 20px;font-size:11.5px;color:#777">E-mail automático do app do ANA Brasil. A mensagem fica guardada como garantia; ela não aparece no app.</td></tr>
</table></body></html>`;
  return { assunto: assuntoDoEmail(m.tipo, prot), texto, html, responderPara: m.identificado && confere ? m.email : null };
}

/** Próxima tentativa depois de uma falha: 5, 10, 20, 40 min… até 6 h. */
export const esperaDepoisDaFalha = (tentativas: number) => Math.min(5 * 2 ** Math.max(0, tentativas - 1), 360) * 60_000;

/**
 * Limite contra robôs, só em memória (nada é gravado nem registrado): até
 * `porChave` envios por chave e `total` no geral, numa janela de `janelaMs`.
 * A chave é o endereço de quem chama, que fica só aqui, por alguns minutos.
 */
export class Limitador {
  private porChaveMap = new Map<string, number[]>();
  private todos: number[] = [];
  private porChave: number;
  private total: number;
  private janelaMs: number;
  constructor(porChave = 5, total = 120, janelaMs = 10 * 60_000) { this.porChave = porChave; this.total = total; this.janelaMs = janelaMs; }
  permitir(chave: string, agora = Date.now()): boolean {
    const desde = agora - this.janelaMs;
    this.todos = this.todos.filter((t) => t > desde);
    const meus = (this.porChaveMap.get(chave) ?? []).filter((t) => t > desde);
    if (meus.length >= this.porChave || this.todos.length >= this.total) { this.porChaveMap.set(chave, meus); return false; }
    meus.push(agora); this.todos.push(agora); this.porChaveMap.set(chave, meus);
    if (this.porChaveMap.size > 5000) for (const [k, v] of this.porChaveMap) if (!v.some((t) => t > desde)) this.porChaveMap.delete(k);
    return true;
  }
}

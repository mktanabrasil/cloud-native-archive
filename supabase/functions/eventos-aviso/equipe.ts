/**
 * Os e-mails da equipe do dia (18/11/2026, setor Administração, PR 5; mockup
 * aprovado no mesmo dia): o mesmo card dos avisos de evento, com a capa da
 * unidade, mas a lista de nomes vem primeiro, em destaque. Quando, onde e quem
 * pediu ficam embaixo. RH: os funcionários escalados. Voluntariado: os
 * voluntários, com o WhatsApp e se já foram confirmados no painel.
 * "Equipe alterada": quem entrou e quem saiu, mais a lista de agora.
 *
 * Sem rede nem Deno: o index.ts monta o e-mail com isto, e os testes do app
 * (vitest) alcançam. Sem .ics: a equipe não muda a agenda de ninguém.
 */
import { chaveDoVoluntario, mudancaDosFuncionarios, mudancaDosVoluntarios, type Mudanca, type TipoDaEquipe, type Voluntario } from './fila.ts';

type Evento = Record<string, any>;
export interface AvisoDaEquipe { tipo: TipoDaEquipe; evento: Evento; antes: Evento | null }

const FUSO = 'America/Sao_Paulo';
const FONTE = "Poppins, Arial, Helvetica, sans-serif";
const FRASE_DA_ANA = 'Construindo oportunidades para transformar vidas e inspirar voos mais altos.';
const CORES_DA_UNIDADE: Record<string, string> = {
  'DIC': '#01adff', 'Nilópolis': '#81e2cf', 'Santana': '#fbce00', 'Administração': '#f37964', 'Grupo ANA Brasil': '#484848',
};
/** As cores do mockup: o lilás do RH e o laranja do Voluntariado. */
const DO_SETOR = {
  equipe_rh: { fundo: '#efedfd', tinta: '#5b4bd6', topo: 'Equipe dos eventos · RH', painel: 'Abrir no painel do RH' },
  equipe_voluntariado: { fundo: '#fdf0e5', tinta: '#b85d15', topo: 'Voluntários nos eventos', painel: 'Abrir no painel do Voluntariado' },
} as const;
const SELO_CONFIRMADO = { rotulo: 'Confirmado', bg: '#e4f4ec', fg: '#1e7a4a', borda: '#a9dcc0' };
const SELO_ALTERADA = { rotulo: 'Equipe alterada', bg: '#fdf3d6', fg: '#8a5a00', borda: '#f1d98a' };

const tituloEmTexto = (t: string) => String(t || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const escape = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...opts }).format(new Date(iso));
const dataCurta = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit' });
const dataLonga = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' });
const mesCurto = (iso: string) => fmt(iso, { month: 'short' }).replace('.', '');
const diaDoMes = (iso: string) => fmt(iso, { day: '2-digit' });
const semanaCurta = (iso: string) => fmt(iso, { weekday: 'short' }).replace('.', '');
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const semana = (iso: string) => maiuscula(fmt(iso, { weekday: 'long' }).replace('-feira', ''));

/** "AAAA-MM" do evento, para o painel abrir no mês certo. */
const mesDoEvento = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}`;
};
const variosDias = (e: Evento) => !!e.end_datetime && dataLonga(e.start_datetime) !== dataLonga(e.end_datetime);

/** "Sábado, 22/11 · 09:00 às 12:00"; vários dias: "de 22/11 às 09:00 a 23/11 às 17:00". */
export function quandoDaEquipe(e: Evento): string {
  const i = e.start_datetime, f = e.end_datetime;
  if (variosDias(e)) return `de ${dataCurta(i)} às ${hora(i)} a ${dataCurta(f)} às ${hora(f)}`;
  return `${semana(i)}, ${dataCurta(i)} · ${hora(i)} às ${hora(f || i)}`;
}

/** Fim de semana ou vários dias: o RH costuma tratar como banco de horas. */
export function atencaoDoRh(e: Evento): string | null {
  if (variosDias(e)) return 'Evento de vários dias: confira as horas de cada dia';
  const d = fmt(e.start_datetime, { weekday: 'long' });
  if (/s[áa]bado/i.test(d)) return 'Sábado: fora do expediente';
  if (/domingo/i.test(d)) return 'Domingo: fora do expediente';
  return null;
}

export function linkDoPainel(a: AvisoDaEquipe, site: string): string {
  const mes = mesDoEvento(a.evento.start_datetime);
  return a.tipo === 'equipe_rh' ? `${site}/administracao/rh?tela=eventos&mes=${mes}` : `${site}/administracao/voluntariado?mes=${mes}`;
}

export function assuntoDaEquipe(a: AvisoDaEquipe): string {
  const e = a.evento;
  const alterada = !!a.antes;
  const prefixo = a.tipo === 'equipe_rh' ? (alterada ? 'Equipe alterada' : 'Equipe do dia') : (alterada ? 'Voluntários alterados' : 'Voluntários do dia');
  return `${prefixo}: ${tituloEmTexto(e.title)} · ${dataCurta(e.start_datetime)} · ${e.unit}`;
}

const whatsapp = (d: string) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d);

/** A mudança da lista deste aviso (sem "antes", tudo é "atual" e ninguém entrou nem saiu). */
function mudanca(a: AvisoDaEquipe): Mudanca<string> | Mudanca<Voluntario> {
  const campo = a.tipo === 'equipe_rh' ? 'equipe_funcionarios' : 'equipe_voluntarios';
  const m = a.tipo === 'equipe_rh' ? mudancaDosFuncionarios(a.antes?.[campo] ?? a.evento[campo], a.evento[campo]) : mudancaDosVoluntarios(a.antes?.[campo] ?? a.evento[campo], a.evento[campo]);
  return m;
}

/** O que o Gmail mostra ao lado do assunto. */
export function previaDaEquipe(a: AvisoDaEquipe): string {
  const m = mudanca(a);
  const n = m.atual.length;
  const quem = a.tipo === 'equipe_rh' ? (n === 1 ? '1 funcionário' : `${n} funcionários`) : (n === 1 ? '1 voluntário' : `${n} voluntários`);
  if (a.antes) {
    const conta = (k: number, um: string, varios: string) => (k === 0 ? '' : k === 1 ? `1 ${um}` : `${k} ${varios}`);
    const partes = [conta(m.entraram.length, 'entrou', 'entraram'), conta(m.sairam.length, 'saiu', 'saíram')].filter(Boolean);
    return `${partes.join(', ')} · agora ${quem} · ${quandoDaEquipe(a.evento)}`;
  }
  return `${quem} · ${quandoDaEquipe(a.evento)} · ${a.evento.location || 'Unidade ' + a.evento.unit}`;
}

function capa(e: Evento, cor: string): string {
  const escura = cor === '#484848';
  const tinta = escura ? '#fefdfb' : '#191b1a';
  const banner = e.banner_url_desktop || e.banner_image_desktop || e.banner_url_mobile || e.banner_image_mobile;
  const selo = (fundo: string, texto: string) => `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${fundo};color:${texto};font-size:12px;font-weight:600">${escape(e.unit || '')}</span>`;
  if (banner) {
    return `<div style="border-bottom:4px solid ${cor};background:#e6e1d9">
      <img src="${escape(banner)}" width="600" alt="" style="display:block;width:100%;height:auto;max-height:240px;object-fit:cover">
    </div>
    <div style="padding:14px 24px 0">${selo(cor, tinta)}</div>`;
  }
  const tamanho = tituloEmTexto(e.title).length < 30 ? '28px' : '22px';
  return `<div style="background:${cor};padding:18px 22px 20px">
    <div style="margin-bottom:22px">${escura ? selo('rgba(254,253,251,.92)', '#191b1a') : selo('rgba(25,27,26,.85)', '#fefdfb')}</div>
    <div style="font-size:${tamanho};font-weight:800;line-height:1.05;text-transform:uppercase;color:${tinta};letter-spacing:-.01em;word-break:break-word;font-family:${FONTE}">${escape(tituloEmTexto(e.title))}</div>
  </div>`;
}

function blocoDeData(e: Evento): string {
  const i = e.start_datetime;
  return `<td style="width:64px;vertical-align:top;padding-right:14px">
    <div style="border:1px solid #e6e1d9;border-radius:10px;text-align:center;overflow:hidden;background:#fefdfb">
      <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:#fefdfb;background:#191b1a;padding:3px 0">${escape(mesCurto(i))}</div>
      <div style="font-size:26px;font-weight:800;line-height:1.1;padding:6px 0 2px;color:#191b1a">${diaDoMes(i)}</div>
      <div style="font-size:10px;color:#474747;padding-bottom:6px">${escape(semanaCurta(i))}</div>
    </div></td>`;
}

/** Uma pessoa da lista, em HTML. */
function pessoaHtml(tipo: TipoDaEquipe, p: string | Voluntario, confirmados: Set<string> | null, estilo = ''): string {
  if (tipo === 'equipe_rh') return `<span style="${estilo}">${escape(p as string)}</span>`;
  const v = p as Voluntario;
  const aConfirmar = confirmados && !confirmados.has(chaveDoVoluntario(v));
  return `<span style="${estilo}">${escape(v.nome)}</span> <span style="color:#474747">· ${escape(whatsapp(v.whatsapp))}</span>${aConfirmar ? ' <b style="color:#8a5a00">· a confirmar</b>' : ''}`;
}
const pessoaTexto = (tipo: TipoDaEquipe, p: string | Voluntario, confirmados: Set<string> | null) => {
  if (tipo === 'equipe_rh') return p as string;
  const v = p as Voluntario;
  return `${v.nome} · ${whatsapp(v.whatsapp)}${confirmados && !confirmados.has(chaveDoVoluntario(v)) ? ' · a confirmar' : ''}`;
};

/**
 * O HTML do e-mail. `confirmados`: as chaves (nome + WhatsApp) já confirmadas
 * no painel do Voluntariado; `null` quando não deu para ler (sem o selo).
 */
export function corpoDaEquipeHtml(a: AvisoDaEquipe, site: string, confirmados: Set<string> | null = null): string {
  const e = a.evento;
  const cor = CORES_DA_UNIDADE[e.unit] || '#f37964';
  const s = DO_SETOR[a.tipo];
  const st = a.antes ? SELO_ALTERADA : SELO_CONFIRMADO;
  const m = mudanca(a);
  const comBanner = !!(e.banner_url_desktop || e.banner_image_desktop || e.banner_url_mobile || e.banner_image_mobile);
  const rotuloDaLista = a.tipo === 'equipe_rh' ? 'FUNCIONÁRIOS ESCALADOS' : 'VOLUNTÁRIOS';
  const item = (p: string | Voluntario, estilo = '') => `<li style="margin:0 0 4px">${pessoaHtml(a.tipo, p, confirmados, estilo)}</li>`;

  let mudou = '';
  if (a.antes) {
    const grupo = (titulo: string, cor: string, pessoas: (string | Voluntario)[], estilo: string) => pessoas.length === 0 ? '' : `
      <div style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:${cor};margin-bottom:4px">${titulo}</div>
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.45;color:#191b1a">${pessoas.map(p => item(p, estilo)).join('')}</ul></div>`;
    mudou = grupo(`ENTRARAM · ${m.entraram.length}`, '#1e7a4a', m.entraram, 'font-weight:600') + grupo(`SAÍRAM · ${m.sairam.length}`, '#b3261e', m.sairam, 'text-decoration:line-through;color:#474747');
  }
  const lista = m.atual.length
    ? `<ol style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;color:#191b1a;font-weight:600">${(m.atual as (string | Voluntario)[]).map(p => item(p)).join('')}</ol>`
    : `<p style="margin:0;font-size:14px;color:#474747">${a.tipo === 'equipe_rh' ? 'Nenhum funcionário escalado agora.' : 'Nenhum voluntário indicado agora.'}</p>`;

  const linha = (k: string, v: string) => `<tr><td style="width:110px;padding:8px 0;border-top:1px solid #efece6;color:#474747;vertical-align:top;font-size:14px">${k}</td><td style="padding:8px 0;border-top:1px solid #efece6;vertical-align:top;font-size:14px;color:#191b1a">${v}</td></tr>`;
  let linhas = linha('Quando', `<b>${escape(quandoDaEquipe(e))}</b>`);
  linhas += linha('Onde', escape(e.location || 'Unidade ' + (e.unit || '')));
  const pedidoEm = e.submitted_at || e.created_at;
  if (e.created_by) linhas += linha('Pedido por', escape(e.created_by) + (pedidoEm ? `, em ${dataCurta(pedidoEm)}` : ''));
  if (a.antes && (e.updated_by || e.updated_at)) linhas += linha('Alterado por', escape(e.updated_by || 'a unidade') + (e.updated_at ? `, em ${dataCurta(e.updated_at)} às ${hora(e.updated_at)}` : ''));
  const atencao = a.tipo === 'equipe_rh' ? atencaoDoRh(e) : null;
  if (atencao) linhas += linha('Atenção', `<b style="color:#8a5a00">${escape(atencao)}</b>`);

  const porque = a.tipo === 'equipe_rh' ? 'está na lista do RH no Painel do app' : 'está na lista do Voluntariado no Painel do app';
  const legenda = a.tipo === 'equipe_voluntariado' && confirmados && (m.atual as Voluntario[]).some(v => !confirmados.has(chaveDoVoluntario(v)))
    ? `<p style="margin:8px 0 0;font-size:12px;color:#474747">"A confirmar": ainda não marcado como confirmado no painel do Voluntariado.</p>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(assuntoDaEquipe(a))}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:#f8f6f3">${escape(previaDaEquipe(a))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
      <td style="vertical-align:middle;padding-left:10px;font-size:12px;color:#474747">${s.topo}</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden">
      ${capa(e, cor)}
      <div style="padding:18px 24px 8px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${st.bg};color:${st.fg};border:1px solid ${st.borda};font-size:12px;font-weight:600;margin-bottom:12px">${st.rotulo}</span>
        ${comBanner ? `<div style="font-size:21px;font-weight:700;line-height:1.2;color:#191b1a;letter-spacing:-.01em;margin:0 0 12px">${escape(tituloEmTexto(e.title))}</div>` : ''}
        <div style="background:${s.fundo};border-radius:10px;padding:14px 16px;margin:0 0 14px">
          ${mudou}
          <div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:${s.tinta};margin-bottom:6px">${a.antes ? `${rotuloDaLista} AGORA` : rotuloDaLista} · ${m.atual.length}</div>
          ${lista}
          ${legenda}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          ${blocoDeData(e)}
          <td style="vertical-align:top"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${linhas}</table></td>
        </tr></table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px"><tr>
          <td><a href="${linkDoPainel(a, site)}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:15px;padding:13px 18px;border-radius:8px;font-family:${FONTE}">${s.painel}</a></td>
        </tr></table>
      </div>
      <div style="padding:12px 24px 16px;font-size:12px;color:#474747;border-top:1px solid #efece6;margin-top:14px;line-height:1.5">Você recebe este e-mail porque ${porque}. Se a lista mudar, chega um novo aviso.</div>
    </div>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a;font-size:13px">ANA Brasil</b><br>
    ${FRASE_DA_ANA}<br>
    <a href="https://anabrasil.org" style="color:#191b1a;text-decoration:none">anabrasil.org</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/anabrasilorg" style="color:#191b1a;text-decoration:none">@anabrasilorg</a><br>
    <span style="color:#8a8f8b">Aviso automático do sistema de eventos.</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** A versão em texto puro. */
export function corpoDaEquipeTexto(a: AvisoDaEquipe, site: string, confirmados: Set<string> | null = null): string {
  const e = a.evento;
  const m = mudanca(a);
  const pt = (p: string | Voluntario) => pessoaTexto(a.tipo, p, confirmados);
  const l: string[] = [previaDaEquipe(a), '', `ANA Brasil · ${DO_SETOR[a.tipo].topo}`, '', a.antes ? 'EQUIPE ALTERADA' : 'EVENTO CONFIRMADO', tituloEmTexto(e.title), `Unidade ${e.unit}`, ''];
  if (a.antes) {
    if (m.entraram.length) l.push('Entraram:', ...(m.entraram as (string | Voluntario)[]).map(p => `+ ${pt(p)}`), '');
    if (m.sairam.length) l.push('Saíram:', ...(m.sairam as (string | Voluntario)[]).map(p => `- ${pt(p)}`), '');
  }
  l.push(`${a.tipo === 'equipe_rh' ? 'Funcionários escalados' : 'Voluntários'}${a.antes ? ' agora' : ''} (${m.atual.length}):`);
  if (m.atual.length) l.push(...(m.atual as (string | Voluntario)[]).map((p, i) => `${i + 1}. ${pt(p)}`));
  else l.push('Ninguém agora.');
  l.push('', `Quando: ${quandoDaEquipe(e)}`, `Onde: ${e.location || 'Unidade ' + e.unit}`);
  if (e.created_by) l.push(`Pedido por: ${e.created_by}`);
  const atencao = a.tipo === 'equipe_rh' ? atencaoDoRh(e) : null;
  if (atencao) l.push(`Atenção: ${atencao}`);
  l.push('', `${DO_SETOR[a.tipo].painel}: ${linkDoPainel(a, site)}`, '', 'Aviso automático do sistema de eventos da ANA Brasil.');
  return l.join('\n');
}

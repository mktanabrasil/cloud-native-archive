import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, e não denomailer: em 14/09/2026 o denomailer tropeçou na
// negociação da porta 587 ("invalid cmd") e o erro escapou por uma promessa
// solta, derrubou o worker inteiro e o aviso nunca virou "falhou". O
// nodemailer negocia 587 (STARTTLS) e 465 (TLS direto) sem drama, e o erro
// volta pela promessa que a gente espera.
import nodemailer from 'npm:nodemailer@6.9.16';

// Rede de segurança: nada que escape de uma biblioteca pode derrubar o worker.
// O aviso fica na fila e o painel mostra "Reenviar".
addEventListener('unhandledrejection', (e) => { console.error('[eventos-aviso] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[eventos-aviso] erro solto:', e.error); e.preventDefault(); });

/**
 * Envia os avisos por e-mail que o banco enfileirou em `avisos_de_evento`.
 *
 * Quem chama:
 *  - o banco, via pg_net, com o header `x-avisos-segredo` (opcional);
 *  - o app, logo depois de salvar um evento (JWT de quem salvou);
 *  - o botão "Reenviar" do painel de detalhe (JWT + `aviso_id`).
 * Em todos os casos processa o que estiver pendente (e o `aviso_id` pedido,
 * mesmo que já tenha falhado), envia pelo SMTP da ANA e grava o resultado.
 *
 * Destinatários (decisão de 14/09/2026): sempre mkt@, contato@, parceiros@ e
 * eventos@anabrasil.org; os perfis ativos da unidade do evento; quem criou.
 *
 * Segundo passo (15/09/2026): a Agenda do Google. O robô (conta de serviço,
 * GOOGLE_SA_KEY) é dono de UMA agenda — "ANA · Eventos", só da equipe — que
 * ele cria na primeira execução e guarda em `agendas_google`. Cada aviso vira
 * criar/atualizar/remover o evento nela; o id fica em `events.google_event_id`.
 * A agenda é compartilhada como leitura com as caixas fixas e com a gestão
 * cadastrada por unidade (mesma regra do e-mail). O tipo "atualizado"
 * (título/descrição/visibilidade/unidade) só mexe na agenda, sem e-mail.
 *
 * A agenda pública "Programação ANA" existiu por algumas horas em 15/09 e foi
 * descartada (decisão do mesmo dia): o que é público vai para o site, não
 * para uma agenda paralela. Se a linha `publica` ainda existir, o robô apaga
 * a agenda no Google e limpa os rastros (ver `garantirAgendas`).
 *
 * Segredos (Coolify): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * AVISOS_REMETENTE, AVISOS_SEGREDO, SITE_URL (padrão https://app.anabrasil.org),
 * GOOGLE_SA_KEY (JSON inteiro da conta de serviço; sem ela a agenda é ignorada).
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-avisos-segredo',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SEMPRE_RECEBEM = ['mkt@anabrasil.org', 'contato@anabrasil.org', 'parceiros@anabrasil.org', 'eventos@anabrasil.org'];
/**
 * Chave de lançamento (15/09/2026): enquanto AVISOS_SO_EQUIPE=true no Coolify,
 * e-mail e agenda ficam SÓ com as quatro caixas fixas — a gestão das unidades e
 * quem criou entram quando a ferramenta for lançada (basta remover a variável).
 */
const SO_EQUIPE = (Deno.env.get('AVISOS_SO_EQUIPE') || '').trim().toLowerCase() === 'true';
const FUSO = 'America/Sao_Paulo';

type Evento = Record<string, any>;
type TipoDeAviso = 'confirmado' | 'cancelado' | 'alterado' | 'atualizado';
interface Aviso { id: string; event_id: string; tipo: TipoDeAviso; evento: Evento; antes: Evento | null; tentativas: number; status: string; agenda_status: string }
interface Perfil { email: string | null; name: string | null; unit: string | null; is_active: boolean | null; permission_level: string | null }

// ---------- texto ----------
const tituloEmTexto = (t: string) => (t || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...opts }).format(new Date(iso));
const dataCurta = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit' });
const dataLonga = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
const diaSemana = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hora = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' });
const mesmoDia = (a: string, b: string) => dataLonga(a) === dataLonga(b);

function quando(e: Evento): string {
  const i = e.start_datetime, f = e.end_datetime;
  if (!f || mesmoDia(i, f)) return `${dataLonga(i)}, das ${hora(i)} às ${hora(f || i)}`;
  return `de ${dataLonga(i)} às ${hora(i)} a ${dataLonga(f)} às ${hora(f)}`;
}

function destinatarios(evento: Evento, perfis: Perfil[]): string[] {
  const lista = new Set<string>(SEMPRE_RECEBEM);
  if (SO_EQUIPE) return Array.from(lista);
  for (const p of perfis) {
    if (!p.email || p.is_active === false) continue;
    const daUnidade = !!p.unit && p.unit === evento.unit && p.unit !== 'Administração' && p.permission_level !== 'usuario_padrao';
    const criou = !!p.name && !!evento.created_by && p.name.trim().toLowerCase() === String(evento.created_by).trim().toLowerCase();
    if (daUnidade || criou) lista.add(p.email.trim().toLowerCase());
  }
  return Array.from(lista);
}

function assunto(a: Aviso): string {
  const e = a.evento;
  const prefixo = a.tipo === 'confirmado' ? 'Confirmado' : a.tipo === 'cancelado' ? 'Cancelado' : 'Nova data';
  return `${prefixo}: ${tituloEmTexto(e.title)} · ${dataCurta(e.start_datetime)} · ${e.unit}`;
}

function linkDoEvento(e: Evento, site: string): string {
  return e.visibility === 'publico' && e.slug ? `${site}/eventos?slug=${encodeURIComponent(e.slug)}` : `${site}/?tela=calendario`;
}

// ---------- HTML na identidade do app (mockup aprovado em 15/09/2026) ----------
//
// Peça por peça do app: cabeçalho com o logo e "anabrasil"; o card da vitrine
// como capa (banner 16:9 quando houver, senão a cor da unidade com o título em
// caixa alta); o bloco de data da visão Lista do calendário; selo de status
// verde-suave/coral/âmbar; botão menta com texto escuro; rodapé público.
// Uma coluna de 600 px, cores fixas (o Gmail escuro inverte e-mails que seguem
// o tema), fontes com fallback, tabelas para o Outlook.

const CORES_DA_UNIDADE: Record<string, string> = {
  'DIC': '#01adff',
  'Nilópolis': '#81e2cf',
  'Santana': '#fbce00',
  'Administração': '#f37964',
};
const ESTILO_DO_STATUS = {
  confirmado: { rotulo: 'Confirmado', bg: '#e4f4ec', fg: '#1e7a4a', borda: '#a9dcc0' },
  cancelado: { rotulo: 'Cancelado', bg: '#fdeae6', fg: '#b3261e', borda: '#f3b8ad' },
  alterado: { rotulo: 'Data alterada', bg: '#fdf3d6', fg: '#8a5a00', borda: '#f1d98a' },
} as const;
const FONTE = "Poppins, Arial, Helvetica, sans-serif";
const FRASE_DA_ANA = 'Construindo oportunidades para transformar vidas e inspirar voos mais altos.';

const mesCurto = (iso: string) => fmt(iso, { month: 'short' }).replace('.', '');
const diaDoMes = (iso: string) => fmt(iso, { day: '2-digit' });
const semanaCurta = (iso: string) => fmt(iso, { weekday: 'short' }).replace('.', '');
const semanaLonga = (iso: string) => { const t = fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };
const horaCurta = (iso: string) => hora(iso).replace(':00', 'h').replace(':', 'h');

/** O trecho que o Gmail mostra ao lado do assunto. */
function previa(a: Aviso): string {
  const e = a.evento;
  const quandoCurto = `${dataCurta(e.start_datetime)}, das ${horaCurta(e.start_datetime)} às ${horaCurta(e.end_datetime || e.start_datetime)}`;
  if (a.tipo === 'cancelado') return `Estava marcado para ${dataCurta(e.start_datetime)} · ${e.location || 'Unidade ' + e.unit}`;
  if (a.tipo === 'alterado') return `Agora é ${quandoCurto} · ${e.location || 'Unidade ' + e.unit}`;
  return `${quandoCurto} · ${e.location || 'Unidade ' + e.unit}`;
}

function blocoDeData(e: Evento, cancelado: boolean): string {
  const i = e.start_datetime;
  return `<td style="width:64px;vertical-align:top;padding-right:14px">
    <div style="border:1px solid #e6e1d9;border-radius:10px;text-align:center;overflow:hidden;background:#fefdfb${cancelado ? ';opacity:.55' : ''}">
      <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:#fefdfb;background:#191b1a;padding:3px 0">${escape(mesCurto(i))}</div>
      <div style="font-size:26px;font-weight:800;line-height:1.1;padding:6px 0 2px;color:#191b1a${cancelado ? ';text-decoration:line-through' : ''}">${diaDoMes(i)}</div>
      <div style="font-size:10px;color:#474747;padding-bottom:6px">${escape(semanaCurta(i))}</div>
    </div></td>`;
}

function capa(e: Evento, cor: string): string {
  const banner = e.banner_url_desktop || e.banner_image_desktop || e.banner_url_mobile || e.banner_image_mobile;
  const selo = (fundo: string, texto: string) => `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${fundo};color:${texto};font-size:12px;font-weight:600">${escape(e.unit || '')}</span>`;
  if (banner) {
    return `<div style="border-bottom:4px solid ${cor};background:#e6e1d9">
      <img src="${escape(banner)}" width="600" alt="" style="display:block;width:100%;height:auto;max-height:340px;object-fit:cover">
    </div>
    <div style="padding:14px 24px 0">${selo(cor, '#191b1a')}</div>`;
  }
  const tamanho = tituloEmTexto(e.title).length < 30 ? '30px' : '24px';
  return `<div style="background:${cor};padding:20px 22px 22px">
    <div style="margin-bottom:26px">${selo('rgba(25,27,26,.85)', '#fefdfb')}</div>
    <div style="font-size:${tamanho};font-weight:800;line-height:1.05;text-transform:uppercase;color:#191b1a;letter-spacing:-.01em;word-break:break-word;font-family:${FONTE}">${escape(tituloEmTexto(e.title))}</div>
  </div>`;
}

function corpoHtml(a: Aviso, site: string, linkAgenda?: string | null): string {
  const e = a.evento;
  const cor = CORES_DA_UNIDADE[e.unit] || '#f37964';
  const st = ESTILO_DO_STATUS[a.tipo];
  const comBanner = !!(e.banner_url_desktop || e.banner_image_desktop || e.banner_url_mobile || e.banner_image_mobile);
  const quem = e.reviewed_by || e.updated_by || 'a administração';
  const quandoQuem = e.reviewed_at || e.updated_at ? `${quem}, em ${dataLonga(e.reviewed_at || e.updated_at)} às ${hora(e.reviewed_at || e.updated_at)}` : quem;
  const linha = (k: string, v: string) => `<tr><td style="width:120px;padding:9px 0;border-top:1px solid #efece6;color:#474747;vertical-align:top;font-size:14px">${k}</td><td style="padding:9px 0;border-top:1px solid #efece6;vertical-align:top;font-size:14px;color:#191b1a">${v}</td></tr>`;

  let linhas = '';
  if (a.tipo === 'alterado' && a.antes) {
    linhas += linha('Antes', `<s style="color:#474747">${escape(quando(a.antes))}${a.antes.location !== e.location ? ' · ' + escape(a.antes.location || '') : ''}</s>`);
    linhas += linha('Agora', `<b>${escape(quando(e))}</b>`);
  } else {
    linhas += linha(a.tipo === 'cancelado' ? 'Estava marcado' : 'Quando', `<b>${escape(quando(e))}</b>`);
  }
  linhas += linha('Onde', escape(e.location || 'Unidade ' + (e.unit || '')));
  if (a.tipo === 'confirmado') linhas += linha('Visibilidade', e.visibility === 'publico' ? 'Público · aparece no site' : 'Interno · só a equipe');
  linhas += linha(a.tipo === 'confirmado' ? 'Confirmado por' : a.tipo === 'cancelado' ? 'Cancelado por' : 'Alterado por', escape(quandoQuem));
  if (a.tipo === 'cancelado' && e.review_note) linhas += linha('Motivo', escape(e.review_note));
  if (a.tipo === 'confirmado' && e.description) linhas += linha('Descrição', escape(e.description).replace(/\n/g, '<br>'));

  const acaoIcs = a.tipo === 'cancelado' ? 'Remover da minha agenda' : a.tipo === 'alterado' ? 'Atualizar na minha agenda' : 'Adicionar à minha agenda';
  const link = linkDoEvento(e, site);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(assunto(a))}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:#f8f6f3">${escape(previa(a))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
      <td style="vertical-align:middle;padding-left:10px;font-size:12px;color:#474747">Programação de eventos</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden">
      ${capa(e, cor)}
      <div style="padding:20px 24px 8px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${st.bg};color:${st.fg};border:1px solid ${st.borda};font-size:12px;font-weight:600;margin-bottom:12px">${st.rotulo}</span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          ${blocoDeData(e, a.tipo === 'cancelado')}
          <td style="vertical-align:top">
            ${comBanner ? `<div style="font-size:21px;font-weight:700;line-height:1.2;color:#191b1a;letter-spacing:-.01em;margin:2px 0 4px">${escape(tituloEmTexto(e.title))}</div>` : ''}
            <div style="font-size:16px;font-weight:600;color:#191b1a;line-height:1.3">${escape(semanaLonga(e.start_datetime))}</div>
            <div style="font-size:14px;color:#474747;margin-top:2px">das ${hora(e.start_datetime)} às ${hora(e.end_datetime || e.start_datetime)} · ${escape(e.location || 'Unidade ' + (e.unit || ''))}</div>
          </td>
        </tr></table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border-collapse:collapse">${linhas}</table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px"><tr>
          <td><a href="${link}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:15px;padding:13px 18px;border-radius:8px;font-family:${FONTE}">Ver o evento</a></td>
          ${linkAgenda && a.tipo !== 'cancelado' ? `<td style="width:10px"></td><td style="width:44%"><a href="${linkAgenda}" style="display:block;text-align:center;background:#fefdfb;color:#191b1a;border:1px solid #d9d4cc;text-decoration:none;font-weight:600;font-size:15px;padding:12px 16px;border-radius:8px;font-family:${FONTE}">Abrir na agenda</a></td>` : ''}
        </tr></table>
        <p style="margin:10px 0 0;font-size:13px;text-align:center;color:#474747">
          <span style="color:#191b1a;font-weight:600">📎 ${acaoIcs}</span> <span style="color:#8a8f8b">(anexo evento.ics)</span>
          ${a.tipo !== 'cancelado' ? `&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${site}/?tela=calendario" style="color:#191b1a;font-weight:600;text-decoration:underline">Calendário da equipe</a>` : ''}
        </p>
      </div>
      <div style="padding:12px 24px 16px;font-size:12px;color:#474747;border-top:1px solid #efece6;margin-top:14px;line-height:1.5">Você recebe este e-mail porque é da equipe da ANA, da gestão da unidade ${escape(e.unit || '')}, ou criou o evento.</div>
    </div>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a;font-size:13px">ANA Brasil</b><br>
    ${FRASE_DA_ANA}<br>
    <a href="https://anabrasil.org" style="color:#191b1a;text-decoration:none">anabrasil.org</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/anabrasilorg" style="color:#191b1a;text-decoration:none">@anabrasilorg</a><br>
    <span style="color:#8a8f8b">Aviso automático do sistema de eventos. Se algo estiver errado, edite o evento no app e um novo aviso será enviado.</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function corpoTexto(a: Aviso, site: string, linkAgenda?: string | null): string {
  const e = a.evento;
  const selo = a.tipo === 'confirmado' ? 'EVENTO CONFIRMADO' : a.tipo === 'cancelado' ? 'EVENTO CANCELADO' : 'DATA ALTERADA';
  const l: string[] = [previa(a), ``, `ANA Brasil · Programação de eventos`, ``, selo, tituloEmTexto(e.title), `Unidade ${e.unit} · ${diaSemana(e.start_datetime)}`, ``];
  if (a.tipo === 'alterado' && a.antes) { l.push(`Antes: ${quando(a.antes)}`); l.push(`Agora: ${quando(e)}`); }
  else l.push(`${a.tipo === 'cancelado' ? 'Estava marcado' : 'Quando'}: ${quando(e)}`);
  l.push(`Onde: ${e.location || e.unit}`);
  if (a.tipo === 'cancelado' && e.review_note) l.push(`Motivo: ${e.review_note}`);
  if (a.tipo === 'confirmado' && e.description) l.push(``, e.description);
  l.push(``, `Ver o evento: ${linkDoEvento(e, site)}`);
  if (linkAgenda && a.tipo !== 'cancelado') l.push(`Abrir na agenda do Google: ${linkAgenda}`);
  l.push(`Calendário da equipe: ${site}/?tela=calendario`, ``, `Aviso automático do sistema de eventos da ANA Brasil.`);
  return l.join('\n');
}

/** Um .ics padrão: o mesmo UID em toda mudança, para a agenda atualizar em vez de duplicar. */
function ics(a: Aviso, site: string): string {
  const e = a.evento;
  const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const esc = (s: string) => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const seq = Math.max(0, (e.updated_at ? Math.floor(new Date(e.updated_at).getTime() / 1000) : 0) % 2147483647);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ANA Brasil//Eventos//PT', `METHOD:${a.tipo === 'cancelado' ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:evento-${e.id}@anabrasil.org`,
    `SEQUENCE:${seq}`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(e.start_datetime)}`,
    `DTEND:${utc(e.end_datetime || e.start_datetime)}`,
    `SUMMARY:${esc(tituloEmTexto(e.title))}`,
    `LOCATION:${esc(e.location || e.unit || '')}`,
    `DESCRIPTION:${esc((e.description || '') + '\n' + linkDoEvento(e, site))}`,
    `URL:${linkDoEvento(e, site)}`,
    `STATUS:${a.tipo === 'cancelado' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

// ---------- Agenda do Google ----------
//
// Sem biblioteca: um JWT RS256 assinado com a chave da conta de serviço vira
// um access token, e a API REST do Calendar faz o resto. Menos dependência,
// menos surpresa no runtime.

interface ChaveDoRobo { client_email: string; private_key: string; token_uri?: string }
const ESCOPO_AGENDA = 'https://www.googleapis.com/auth/calendar';
const API_AGENDA = 'https://www.googleapis.com/calendar/v3';
const NOME_DA_AGENDA = 'ANA · Eventos';
/**
 * Um evento no Google só aceita uma das 11 cores fixas da paleta dele (colorId).
 * Aqui vai a mais próxima da cor de cada unidade no app (src/index.css):
 * DIC azul-céu → 7 Pavão; Nilópolis verde-água → 2 Sálvia; Santana amarelo →
 * 5 Banana; Administração coral → 4 Flamingo (não Tangerina: o coral da ANA
 * está a ~22 de distância do Flamingo e a ~80 da Tangerina, em RGB).
 */
const COR_GOOGLE_DA_UNIDADE: Record<string, string> = { 'DIC': '7', 'Nilópolis': '2', 'Santana': '5', 'Administração': '4' };
const SEMPRE_LEEM = SEMPRE_RECEBEM;

const b64url = (dados: ArrayBuffer | string) => {
  const bin = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let str = ''; bin.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function tokenDoRobo(chave: ChaveDoRobo): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({ iss: chave.client_email, scope: ESCOPO_AGENDA, aud: chave.token_uri || 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 }));
  const pem = chave.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${cabecalho}.${corpo}`));
  const jwt = `${cabecalho}.${corpo}.${b64url(assinatura)}`;
  const r = await fetch(chave.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!r.ok) throw new Error(`Google não deu token ao robô: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token as string;
}

async function google(token: string, metodo: string, caminho: string, corpo?: unknown): Promise<any> {
  const r = await fetch(`${API_AGENDA}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (r.status === 204) return null;
  const texto = await r.text();
  if (!r.ok) {
    const e = new Error(`Google ${r.status} em ${metodo} ${caminho}: ${texto.slice(0, 300)}`) as Error & { status: number };
    e.status = r.status; throw e;
  }
  return texto ? JSON.parse(texto) : null;
}

/** Quem lê as agendas: as caixas fixas e a gestão ativa de alguma unidade (mesma regra do e-mail). */
function leitoresDasAgendas(perfis: Perfil[]): string[] {
  const lista = new Set<string>(SEMPRE_LEEM);
  if (SO_EQUIPE) return Array.from(lista);
  for (const p of perfis) {
    if (!p.email || p.is_active === false) continue;
    const gere = p.permission_level && p.permission_level !== 'usuario_padrao';
    if (gere) lista.add(p.email.trim().toLowerCase());
  }
  return Array.from(lista);
}

/**
 * Garante que as duas agendas existem (cria na primeira vez) e que todo mundo
 * que deve ler já recebeu o compartilhamento — e que quem NÃO deve mais ler
 * (saiu da lista, ou a chave de lançamento está ligada) perde o acesso.
 * Idempotente: roda a cada chamada, mas só fala com o Google quando falta algo.
 */
async function garantirAgendas(admin: any, token: string, perfis: Perfil[]): Promise<{ equipe: string }> {
  const { data: linhas } = await admin.from('agendas_google').select('chave, calendar_id, compartilhada_com');
  const atuais = new Map<string, { calendar_id: string; compartilhada_com: string[] }>((linhas || []).map((l: any) => [l.chave, l]));
  const ids = {} as { equipe: string };

  // Sobra de 15/09: a agenda pública. Apagar a agenda no Google leva junto os
  // eventos que estavam nela; aqui só limpamos a linha e os ids nos eventos.
  const publica = atuais.get('publica');
  if (publica) {
    try {
      await google(token, 'DELETE', `/calendars/${encodeURIComponent(publica.calendar_id)}`);
    } catch (e) {
      if ((e as { status?: number }).status !== 404 && (e as { status?: number }).status !== 410) throw e;
    }
    await admin.from('events').update({ google_public_event_id: null, google_public_event_link: null }).not('google_public_event_id', 'is', null);
    await admin.from('agendas_google').delete().eq('chave', 'publica');
    console.log('[agenda] agenda pública "Programação ANA" apagada no Google');
  }

  for (const chave of ['equipe'] as const) {
    let linha = atuais.get(chave);
    if (!linha) {
      const criada = await google(token, 'POST', '/calendars', { summary: NOME_DA_AGENDA, timeZone: FUSO, description: 'Eventos confirmados no app da ANA Brasil. Edite no app, não aqui.' });
      linha = { calendar_id: criada.id, compartilhada_com: [] };
      await admin.from('agendas_google').insert({ chave, calendar_id: criada.id, nome: NOME_DA_AGENDA, compartilhada_com: [] });
    }
    ids[chave] = linha.calendar_id;

    const leitores = leitoresDasAgendas(perfis);
    const faltam = leitores.filter(e => !linha!.compartilhada_com.includes(e));
    const sobram = linha.compartilhada_com.filter(e => !leitores.includes(e));
    if (faltam.length === 0 && sobram.length === 0) continue;

    let lista = [...linha.compartilhada_com];
    for (const email of faltam) {
      try {
        await google(token, 'POST', `/calendars/${encodeURIComponent(linha.calendar_id)}/acl?sendNotifications=true`, { role: 'reader', scope: { type: 'user', value: email } });
        lista.push(email);
      } catch (e) { console.warn(`[agenda] não consegui compartilhar ${chave} com ${email}:`, e instanceof Error ? e.message : e); }
    }
    for (const email of sobram) {
      // A regra de acesso de uma pessoa tem id fixo "user:<e-mail>". 404 = já não tinha.
      try {
        await google(token, 'DELETE', `/calendars/${encodeURIComponent(linha.calendar_id)}/acl/${encodeURIComponent('user:' + email)}`);
        lista = lista.filter(e => e !== email);
      } catch (e) {
        if ((e as { status?: number }).status === 404) lista = lista.filter(x => x !== email);
        else console.warn(`[agenda] não consegui revogar ${chave} de ${email}:`, e instanceof Error ? e.message : e);
      }
    }
    await admin.from('agendas_google').update({ compartilhada_com: lista }).eq('chave', chave);
  }
  return ids;
}

// ---------- conexão em nome da eventos@ (OAuth, 16/09/2026) ----------
//
// Em vez de o robô ter agenda própria, o app escreve na agenda que a equipe
// já usa ("Eventos ANA Brasil"), como a própria eventos@. Uma pessoa admin
// conecta uma vez pelo Painel; a chave de renovação fica em
// `user_google_tokens` (linha da pessoa que conectou) e o resto da conexão
// em `system_configs` (chave 'agenda_google'). Enquanto não houver conexão
// com agenda escolhida, o robô (GOOGLE_SA_KEY) continua valendo.

const OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
const OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
const CHAVE_DA_CONEXAO = 'agenda_google';

interface Conexao {
  user_id: string;
  google_email: string;
  calendar_id: string | null;
  calendar_nome: string | null;
  conectado_por: string;
  conectado_em: string;
  erro: string | null;
}

async function lerConexao(admin: any): Promise<Conexao | null> {
  const { data } = await admin.from('system_configs').select('value').eq('key', CHAVE_DA_CONEXAO).maybeSingle();
  const v = data?.value;
  return v && typeof v === 'object' && v.user_id ? (v as Conexao) : null;
}

/** `por` é o id (uuid) de quem mexeu, ou null quando é o sistema: a coluna updated_by referencia auth.users. */
async function gravarConexao(admin: any, c: Conexao | null, por: string | null) {
  if (!c) {
    const { error } = await admin.from('system_configs').delete().eq('key', CHAVE_DA_CONEXAO);
    if (error) throw new Error(`não consegui apagar a conexão: ${error.message}`);
    return;
  }
  const { error } = await admin.from('system_configs').upsert({ key: CHAVE_DA_CONEXAO, value: c, updated_at: new Date().toISOString(), updated_by: por }, { onConflict: 'key' });
  if (error) throw new Error(`não consegui gravar a conexão: ${error.message}`);
}

/** Troca a chave de renovação por um token de acesso. invalid_grant = o Google desconectou (senha trocada, acesso revogado). */
async function tokenDaConexao(admin: any, c: Conexao): Promise<string> {
  const { data } = await admin.from('user_google_tokens').select('refresh_token').eq('user_id', c.user_id).maybeSingle();
  if (!data?.refresh_token) throw new Error('conexão sem chave de renovação: reconecte no Painel');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const motivo = j.error === 'invalid_grant' ? 'o Google desconectou a conta: reconecte no Painel' : `Google não renovou o acesso: ${r.status} ${JSON.stringify(j).slice(0, 200)}`;
    if (!c.erro) await gravarConexao(admin, { ...c, erro: motivo }, null);
    throw new Error(motivo);
  }
  if (c.erro) await gravarConexao(admin, { ...c, erro: null }, null);
  return j.access_token as string;
}

/** Só admin geral conecta, troca a agenda e desconecta. */
async function ehAdmin(admin: any, userId: string): Promise<boolean> {
  const { data: papel } = await admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  if (papel?.role === 'admin') return true;
  const { data: perfil } = await admin.from('profiles').select('permission_level').eq('id', userId).maybeSingle();
  return perfil?.permission_level === 'admin_geral';
}

const semSegredo = (c: Conexao | null) => c ? { google_email: c.google_email, calendar_id: c.calendar_id, calendar_nome: c.calendar_nome, conectado_por: c.conectado_por, conectado_em: c.conectado_em, erro: c.erro } : null;

function corpoDoEventoGoogle(e: Evento, site: string) {
  const quem = e.reviewed_by || e.updated_by || e.created_by || '';
  const quando = e.reviewed_at || e.updated_at;
  const rodape = [quem ? `Confirmado por ${quem}${quando ? ' em ' + dataLonga(quando) : ''}.` : '', `Ver no app da ANA: ${linkDoEvento(e, site)}`].filter(Boolean).join('\n');
  return {
    summary: tituloEmTexto(e.title),
    description: [e.description || '', '', rodape, '· via app'].join('\n').trim(),
    location: e.location || (e.unit ? `Unidade ${e.unit}` : undefined),
    start: { dateTime: new Date(e.start_datetime).toISOString(), timeZone: FUSO },
    end: { dateTime: new Date(e.end_datetime || e.start_datetime).toISOString(), timeZone: FUSO },
    colorId: COR_GOOGLE_DA_UNIDADE[e.unit] || '8',
    source: { title: 'App ANA Brasil', url: linkDoEvento(e, site) },
    extendedProperties: { private: { anaEventId: e.id, anaUnit: e.unit || '' } },
    transparency: 'transparent',
    guestsCanInviteOthers: false,
    guestsCanModify: false,
  };
}

/** Cria ou atualiza numa agenda; devolve id e link. Se o id guardado sumiu no Google, recria. */
async function gravarNaAgenda(token: string, calendarId: string, idAtual: string | null, corpo: unknown): Promise<{ id: string; link: string }> {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  if (idAtual) {
    try {
      const r = await google(token, 'PATCH', `${base}/${encodeURIComponent(idAtual)}`, corpo);
      if (r?.status !== 'cancelled') return { id: r.id, link: r.htmlLink };
    } catch (e) { if ((e as any).status !== 404 && (e as any).status !== 410) throw e; }
  }
  const r = await google(token, 'POST', base, corpo);
  return { id: r.id, link: r.htmlLink };
}

async function removerDaAgenda(token: string, calendarId: string, id: string | null) {
  if (!id) return;
  try { await google(token, 'DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`); }
  catch (e) { if ((e as any).status !== 404 && (e as any).status !== 410) throw e; }
}

/** O passo "agenda" de um aviso. Devolve o link da agenda da equipe, quando houver. */
async function sincronizarAgenda(admin: any, token: string, ids: { equipe: string }, a: Aviso, site: string): Promise<string | null> {
  // o evento como está AGORA no banco (o aviso guarda uma foto; os ids do Google vivem na linha)
  const { data: atual } = await admin.from('events').select('id, title, description, unit, location, start_datetime, end_datetime, status, visibility, deleted_at, slug, created_by, updated_by, updated_at, reviewed_by, reviewed_at, google_event_id').eq('id', a.event_id).maybeSingle();
  const e: Evento = atual || a.evento;
  const confirmado = e.status === 'confirmado' && !e.deleted_at;

  if (a.tipo === 'cancelado' || !confirmado) {
    await removerDaAgenda(token, ids.equipe, e.google_event_id);
    await admin.from('events').update({ google_event_id: null, google_event_link: null }).eq('id', a.event_id);
    return null;
  }

  const corpo = corpoDoEventoGoogle(e, site);
  const equipe = await gravarNaAgenda(token, ids.equipe, e.google_event_id, corpo);
  await admin.from('events').update({ google_event_id: equipe.id, google_event_link: equipe.link }).eq('id', a.event_id);
  return equipe.link;
}

// ---------- entrada ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SITE = (Deno.env.get('SITE_URL') || 'https://app.anabrasil.org').replace(/\/$/, '');
  const SEGREDO = Deno.env.get('AVISOS_SEGREDO') || '';

  // Quem chama: o banco (segredo) ou alguém logado da equipe (JWT).
  const segredoOk = !!SEGREDO && req.headers.get('x-avisos-segredo') === SEGREDO;
  let pedidoPor = 'banco';
  let usuarioId: string | null = null;
  if (!segredoOk) {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data, error } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
    if (error || !data?.user) return json({ error: 'Não autorizado.' }, 401);
    pedidoPor = data.user.email || data.user.id;
    usuarioId = data.user.id;
  }

  let corpo: {
    aviso_id?: string; estado?: boolean; carga?: boolean; reaplicar?: boolean;
    oauth_url?: boolean; oauth_code?: string; state?: string; listar_agendas?: boolean;
    escolher_agenda?: { calendar_id: string; nome: string }; desconectar?: boolean;
  } = {};
  try { corpo = await req.json(); } catch { /* sem corpo: processa os pendentes */ }

  const admin = createClient(SUPABASE_URL, SERVICE);
  const chaveBruta = Deno.env.get('GOOGLE_SA_KEY');

  // { estado: true }: o card do Painel pergunta como está a agenda. Só leitura.
  if (corpo.estado) {
    const { data: agendas } = await admin.from('agendas_google').select('chave, calendar_id, nome, compartilhada_com');
    const conexao = await lerConexao(admin);
    const modo = conexao?.calendar_id ? 'conexao' : chaveBruta ? 'robo' : 'nenhum';
    return json({ so_equipe: SO_EQUIPE, chave_configurada: !!chaveBruta, oauth_configurado: !!OAUTH_CLIENT_ID && !!OAUTH_CLIENT_SECRET, modo, conexao: semSegredo(conexao), agendas: agendas || [] });
  }

  // ----- conexão em nome da eventos@: só admin, só pessoa logada -----
  const pedeConexao = corpo.oauth_url || corpo.oauth_code || corpo.listar_agendas || corpo.escolher_agenda || corpo.desconectar;
  if (pedeConexao) try {
    if (!usuarioId) return json({ error: 'Conectar a agenda é ação de uma pessoa logada.' }, 403);
    if (!(await ehAdmin(admin, usuarioId))) return json({ error: 'Só a administração geral conecta a agenda.' }, 403);
    if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) return json({ error: 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET não estão no servidor.' }, 500);
    const redirect = `${SITE}/`;

    if (corpo.oauth_url) {
      const state = `agenda:${usuarioId}:${Date.now()}`;
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: OAUTH_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: ESCOPO_AGENDA,
        access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', login_hint: 'eventos@anabrasil.org', hd: 'anabrasil.org', state,
      });
      return json({ url });
    }

    if (corpo.oauth_code) {
      const [marca, dono] = String(corpo.state || '').split(':');
      if (marca !== 'agenda' || dono !== usuarioId) return json({ error: 'Este retorno do Google não é desta pessoa. Comece de novo em "Conectar".' }, 400);
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: corpo.oauth_code, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET, redirect_uri: redirect, grant_type: 'authorization_code' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.refresh_token) return json({ error: `O Google não devolveu a chave de renovação: ${j.error_description || j.error || r.status}. Comece de novo em "Conectar".` }, 400);
      const primaria = await google(j.access_token, 'GET', '/calendars/primary');
      const anterior = await lerConexao(admin);
      const { error: erroToken } = await admin.from('user_google_tokens').upsert({ user_id: usuarioId, refresh_token: j.refresh_token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (erroToken) return json({ error: `não consegui guardar a chave de renovação: ${erroToken.message}` }, 500);
      const conexao: Conexao = { user_id: usuarioId, google_email: primaria.id, calendar_id: anterior?.calendar_id ?? null, calendar_nome: anterior?.calendar_nome ?? null, conectado_por: pedidoPor, conectado_em: new Date().toISOString(), erro: null };
      await gravarConexao(admin, conexao, usuarioId);
      console.log(`[agenda] ${pedidoPor} conectou o Google como ${primaria.id}`);
      return json({ conexao: semSegredo(conexao) });
    }

    const conexao = await lerConexao(admin);
    if (corpo.desconectar) {
      if (conexao) await admin.from('user_google_tokens').delete().eq('user_id', conexao.user_id);
      await gravarConexao(admin, null, usuarioId);
      console.log(`[agenda] ${pedidoPor} desconectou o Google`);
      return json({ conexao: null });
    }
    if (!conexao) return json({ error: 'Conecte o Google Agenda primeiro.' }, 400);
    const token = await tokenDaConexao(admin, conexao);

    if (corpo.listar_agendas) {
      const lista = await google(token, 'GET', '/users/me/calendarList?minAccessRole=writer&showHidden=true');
      const agendas = ((lista?.items || []) as any[]).map(a => ({ id: a.id, nome: a.summaryOverride || a.summary, cor: a.backgroundColor || null, primaria: !!a.primary, papel: a.accessRole }));
      return json({ google_email: conexao.google_email, agendas });
    }

    if (corpo.escolher_agenda) {
      const { calendar_id, nome } = corpo.escolher_agenda;
      // A transição: os eventos saem da agenda do robô, que é apagada, e a
      // carga inicial recoloca todos os confirmados na agenda escolhida.
      const { data: doRobo } = await admin.from('agendas_google').select('chave, calendar_id').eq('chave', 'equipe').maybeSingle();
      if (doRobo && chaveBruta) {
        try {
          const tokenRobo = await tokenDoRobo(JSON.parse(chaveBruta) as ChaveDoRobo);
          try { await google(tokenRobo, 'DELETE', `/calendars/${encodeURIComponent(doRobo.calendar_id)}`); }
          catch (e) { if ((e as { status?: number }).status !== 404 && (e as { status?: number }).status !== 410) throw e; }
          console.log('[agenda] agenda do robô "ANA · Eventos" apagada no Google');
        } catch (e) { console.warn('[agenda] não consegui apagar a agenda do robô:', e instanceof Error ? e.message : e); }
      }
      await admin.from('agendas_google').delete().eq('chave', 'equipe');
      await admin.from('events').update({ google_event_id: null, google_event_link: null }).not('google_event_id', 'is', null);
      await gravarConexao(admin, { ...conexao, calendar_id, calendar_nome: nome, erro: null }, usuarioId);
      console.log(`[agenda] ${pedidoPor} escolheu a agenda "${nome}" (${calendar_id})`);
      corpo.carga = true; // segue para a carga inicial, abaixo
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[agenda] conexão:', msg);
    return json({ error: msg }, 500);
  }

  // { carga: true }: carga inicial — todo confirmado que ainda não está no
  // Google vira um aviso "confirmado" com e-mail já ignorado (ninguém recebe
  // e-mail de novo) e agenda pendente; a fila abaixo faz o resto.
  if (corpo.carga) {
    if (pedidoPor === 'banco') return json({ error: 'A carga inicial é pedida por uma pessoa logada.' }, 403);
    const { data: faltam } = await admin.from('events').select('*').eq('status', 'confirmado').is('deleted_at', null).is('google_event_id', null);
    const linhas = (faltam || []).map((e: any) => ({ event_id: e.id, tipo: 'confirmado', evento: e, antes: null, status: 'ignorado', erro: 'carga inicial: sem e-mail', agenda_status: 'pendente' }));
    if (linhas.length > 0) {
      const { error } = await admin.from('avisos_de_evento').insert(linhas);
      if (error) return json({ error: error.message }, 500);
    }
    console.log(`[agenda] carga inicial pedida por ${pedidoPor}: ${linhas.length} evento(s) enfileirado(s)`);
  }

  // { reaplicar: true }: regrava no Google todo confirmado que já está lá
  // (cor, texto, local), sem e-mail — para quando a regra de montagem muda.
  if (corpo.reaplicar) {
    if (pedidoPor === 'banco') return json({ error: 'Reaplicar é pedido por uma pessoa logada.' }, 403);
    const { data: presentes } = await admin.from('events').select('*').eq('status', 'confirmado').is('deleted_at', null).not('google_event_id', 'is', null);
    const linhas = (presentes || []).map((e: any) => ({ event_id: e.id, tipo: 'atualizado', evento: e, antes: null, status: 'ignorado', erro: 'reaplicar na agenda: sem e-mail', agenda_status: 'pendente' }));
    if (linhas.length > 0) {
      const { error } = await admin.from('avisos_de_evento').insert(linhas);
      if (error) return json({ error: error.message }, 500);
    }
    console.log(`[agenda] reaplicar pedido por ${pedidoPor}: ${linhas.length} evento(s) enfileirado(s)`);
  }

  // Os pendentes, mais o aviso pedido (Reenviar), mesmo que já tenha falhado.
  const COLUNAS = 'id, event_id, tipo, evento, antes, tentativas, status, agenda_status';
  const { data: pendentes, error: erroFila } = await admin
    .from('avisos_de_evento').select(COLUNAS)
    .or('status.eq.pendente,agenda_status.eq.pendente').order('criado_em', { ascending: true }).limit(corpo.carga || corpo.reaplicar ? 200 : 20);
  if (erroFila) return json({ error: erroFila.message }, 500);
  const fila: Aviso[] = [...(pendentes as Aviso[] || [])];
  // Reenviar: o aviso pedido entra mesmo que já tenha falhado, nos dois passos.
  let forcado: string | null = null;
  if (corpo.aviso_id && !fila.some(a => a.id === corpo.aviso_id)) {
    const { data: um } = await admin.from('avisos_de_evento').select(COLUNAS).eq('id', corpo.aviso_id).maybeSingle();
    if (um) { fila.push(um as Aviso); forcado = um.id; }
  }

  const { data: perfis } = await admin.from('profiles').select('email, name, unit, is_active, permission_level');

  // Agenda do Google: só com a chave do robô. Sem ela, o passo é "ignorado" e
  // o painel não mostra nada de agenda — o e-mail segue normal.
  let agenda: { token: string; ids: { equipe: string } } | null = null;
  let erroDaAgenda: string | null = null;
  const conexao = await lerConexao(admin);
  if (conexao?.calendar_id) {
    try {
      const token = await tokenDaConexao(admin, conexao);
      agenda = { token, ids: { equipe: conexao.calendar_id } };
    } catch (e) {
      erroDaAgenda = e instanceof Error ? e.message : String(e);
      console.error('[agenda] conexão indisponível nesta chamada:', erroDaAgenda);
    }
  } else if (chaveBruta) {
    try {
      const chave = JSON.parse(chaveBruta) as ChaveDoRobo;
      const token = await tokenDoRobo(chave);
      const ids = await garantirAgendas(admin, token, (perfis as Perfil[]) || []);
      agenda = { token, ids };
    } catch (e) {
      erroDaAgenda = e instanceof Error ? e.message : String(e);
      console.error('[agenda] indisponível nesta chamada:', erroDaAgenda);
    }
  }

  if (fila.length === 0) return json({ processados: 0, agenda: agenda ? 'ok' : (erroDaAgenda || 'sem chave') });

  // 465 = TLS direto; 587 = STARTTLS. SMTP_TLS só força, quando existir.
  const porta = Number(Deno.env.get('SMTP_PORT') || 587);
  const tlsEnv = Deno.env.get('SMTP_TLS');
  const tlsDireto = tlsEnv ? tlsEnv !== 'false' : porta === 465;
  const smtp = {
    host: Deno.env.get('SMTP_HOST') || '',
    port: porta,
    secure: tlsDireto,
    requireTLS: !tlsDireto,
    auth: { user: Deno.env.get('SMTP_USER') || '', pass: Deno.env.get('SMTP_PASS') || '' },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  };
  const remetente = Deno.env.get('AVISOS_REMETENTE') || 'ANA Brasil · Eventos <eventos@anabrasil.org>';

  const resultado: Record<string, string> = {};
  for (const a of fila) {
    const para = destinatarios(a.evento, (perfis as Perfil[]) || []);
    const precisaEmail = a.status === 'pendente' || (forcado === a.id && a.status === 'falhou');
    const precisaAgenda = a.agenda_status === 'pendente' || (forcado === a.id && a.agenda_status === 'falhou');
    let linkAgenda: string | null = a.evento.google_event_link || null;

    // ----- passo 2: agenda -----
    if (precisaAgenda) {
      if (!agenda) {
        if (!chaveBruta && !conexao?.calendar_id) await admin.from('avisos_de_evento').update({ agenda_status: 'ignorado', agenda_erro: 'agenda não configurada (conecte o Google no Painel)' }).eq('id', a.id);
        else await admin.from('avisos_de_evento').update({ agenda_status: 'falhou', agenda_erro: (erroDaAgenda || 'agenda indisponível').slice(0, 500) }).eq('id', a.id);
      } else {
        try {
          const link = await sincronizarAgenda(admin, agenda.token, agenda.ids, a, SITE);
          linkAgenda = link;
          await admin.from('avisos_de_evento').update({ agenda_status: 'enviado', agenda_erro: null, agenda_em: new Date().toISOString(), agenda_link: link }).eq('id', a.id);
          resultado[a.id + ':agenda'] = 'enviado';
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await admin.from('avisos_de_evento').update({ agenda_status: 'falhou', agenda_erro: msg.slice(0, 500) }).eq('id', a.id);
          resultado[a.id + ':agenda'] = `falhou: ${msg}`;
        }
      }
    }

    // ----- passo 1: e-mail -----
    if (!precisaEmail) continue;
    try {
      if (!smtp.host || !smtp.auth.user) throw new Error('SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)');
      const transporte = nodemailer.createTransport(smtp);
      try {
        await transporte.sendMail({
          from: remetente,
          to: para,
          subject: assunto(a),
          text: corpoTexto(a, SITE, linkAgenda),
          html: corpoHtml(a, SITE, linkAgenda),
          attachments: [{ filename: 'evento.ics', contentType: 'text/calendar; charset=utf-8; method=' + (a.tipo === 'cancelado' ? 'CANCEL' : 'PUBLISH'), content: ics(a, SITE) }],
        });
      } finally {
        transporte.close();
      }
      await admin.from('avisos_de_evento').update({ status: 'enviado', destinatarios: para, erro: null, tentativas: a.tentativas + 1, enviado_em: new Date().toISOString() }).eq('id', a.id);
      resultado[a.id] = 'enviado';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from('avisos_de_evento').update({ status: 'falhou', destinatarios: para, erro: msg.slice(0, 500), tentativas: a.tentativas + 1 }).eq('id', a.id);
      resultado[a.id] = `falhou: ${msg}`;
    }
  }

  return json({ processados: fila.length, pedidoPor, resultado });
});

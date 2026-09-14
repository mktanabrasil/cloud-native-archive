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
 * Segredos (Coolify): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * AVISOS_REMETENTE (ex.: "ANA Brasil · Eventos <eventos@anabrasil.org>"),
 * AVISOS_SEGREDO, SITE_URL (padrão https://app.anabrasil.org).
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-avisos-segredo',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SEMPRE_RECEBEM = ['mkt@anabrasil.org', 'contato@anabrasil.org', 'parceiros@anabrasil.org', 'eventos@anabrasil.org'];
const FUSO = 'America/Sao_Paulo';

type Evento = Record<string, any>;
interface Aviso { id: string; event_id: string; tipo: 'confirmado' | 'cancelado' | 'alterado'; evento: Evento; antes: Evento | null; tentativas: number }
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

function corpoHtml(a: Aviso, site: string): string {
  const e = a.evento;
  const cor = a.tipo === 'confirmado' ? '#0f6e63' : a.tipo === 'cancelado' ? '#b3261e' : '#9a5b00';
  const seloBg = a.tipo === 'confirmado' ? '#e3f3ea' : a.tipo === 'cancelado' ? '#fbe9e7' : '#fff1dc';
  const selo = a.tipo === 'confirmado' ? 'Evento confirmado' : a.tipo === 'cancelado' ? 'Evento cancelado' : 'Data alterada';
  const quem = e.reviewed_by || e.updated_by || 'a administração';
  const quandoQuem = e.reviewed_at || e.updated_at ? `${quem}, em ${dataLonga(e.reviewed_at || e.updated_at)} às ${hora(e.reviewed_at || e.updated_at)}` : quem;
  const linha = (k: string, v: string) => `<tr><td style="padding:9px 0;border-top:1px solid #eee;color:#6b6f6c;width:110px;vertical-align:top">${k}</td><td style="padding:9px 0;border-top:1px solid #eee;vertical-align:top">${v}</td></tr>`;

  let linhas = '';
  if (a.tipo === 'alterado' && a.antes) {
    linhas += linha('Antes', `<s>${escape(quando(a.antes))}${a.antes.location !== e.location ? ` · ${escape(a.antes.location || '')}` : ''}</s>`);
    linhas += linha('Agora', `<b>${escape(quando(e))}</b>`);
  } else {
    linhas += linha(a.tipo === 'cancelado' ? 'Estava marcado' : 'Quando', `<b>${escape(quando(e))}</b>`);
  }
  linhas += linha('Onde', escape(e.location || e.unit || ''));
  if (a.tipo === 'confirmado') linhas += linha('Visibilidade', e.visibility === 'publico' ? 'Público · aparece no site' : 'Interno · só a equipe');
  linhas += linha(a.tipo === 'confirmado' ? 'Confirmado por' : a.tipo === 'cancelado' ? 'Cancelado por' : 'Alterado por', escape(quandoQuem));
  if (a.tipo === 'cancelado' && e.review_note) linhas += linha('Motivo', escape(e.review_note));
  if (a.tipo === 'confirmado' && e.description) linhas += linha('Descrição', escape(e.description).replace(/\n/g, '<br>'));

  const ics = a.tipo === 'cancelado' ? 'remove o evento da sua agenda, se você o adicionou.' : a.tipo === 'alterado' ? 'atualiza a data na sua agenda.' : 'adiciona à sua agenda (Google, Outlook, iPhone) com um toque.';

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1b1b1b">
<div style="padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e6e3dd">
<div style="height:6px;background:${cor}"></div>
<div style="padding:18px 24px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f6c;font-weight:700">ANA Brasil · Programação de eventos</div>
<span style="display:inline-block;margin:14px 24px 0;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${seloBg};color:${cor}">${selo}</span>
<h1 style="font-size:22px;line-height:1.25;margin:10px 24px 4px">${escape(tituloEmTexto(e.title))}</h1>
<p style="margin:0 24px 16px;color:#6b6f6c;font-size:14px">Unidade ${escape(e.unit || '')} · ${escape(diaSemana(e.start_datetime))}</p>
<table style="width:calc(100% - 48px);margin:0 24px;border-collapse:collapse;font-size:14px">${linhas}</table>
<p style="margin:18px 24px 4px"><a href="${linkDoEvento(e, site)}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:${cor};color:#fff;font-weight:700;text-decoration:none;font-size:14px">Ver o evento</a>
${a.tipo !== 'cancelado' ? `<a href="${site}/?tela=calendario" style="display:inline-block;margin-left:8px;padding:11px 18px;border-radius:8px;background:#fff;color:#0f6e63;border:1px solid #0f6e63;font-weight:700;text-decoration:none;font-size:14px">Abrir no calendário da equipe</a>` : ''}</p>
<p style="font-size:12px;color:#6b6f6c;margin:8px 24px 0">Em anexo: <b>evento.ics</b> — ${ics}</p>
<p style="margin:14px 24px 0;font-size:13px;color:#6b6f6c">Você recebe este e-mail porque é da equipe da ANA, da gestão da unidade ${escape(e.unit || '')}, ou criou o evento.</p>
<div style="margin:20px 0 0;padding:14px 24px;background:#faf9f6;font-size:12px;color:#8a8f8b;line-height:1.5">ANA Brasil · anabrasil.org · Aviso automático do sistema de eventos. Se algo estiver errado, edite o evento no app, e um novo aviso será enviado.</div>
</div></div></body></html>`;
}

function corpoTexto(a: Aviso, site: string): string {
  const e = a.evento;
  const selo = a.tipo === 'confirmado' ? 'EVENTO CONFIRMADO' : a.tipo === 'cancelado' ? 'EVENTO CANCELADO' : 'DATA ALTERADA';
  const l: string[] = [`ANA Brasil · Programação de eventos`, ``, selo, tituloEmTexto(e.title), `Unidade ${e.unit} · ${diaSemana(e.start_datetime)}`, ``];
  if (a.tipo === 'alterado' && a.antes) { l.push(`Antes: ${quando(a.antes)}`); l.push(`Agora: ${quando(e)}`); }
  else l.push(`${a.tipo === 'cancelado' ? 'Estava marcado' : 'Quando'}: ${quando(e)}`);
  l.push(`Onde: ${e.location || e.unit}`);
  if (a.tipo === 'cancelado' && e.review_note) l.push(`Motivo: ${e.review_note}`);
  if (a.tipo === 'confirmado' && e.description) l.push(``, e.description);
  l.push(``, `Ver o evento: ${linkDoEvento(e, site)}`, `Calendário da equipe: ${site}/?tela=calendario`, ``, `Aviso automático do sistema de eventos da ANA Brasil.`);
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
  if (!segredoOk) {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data, error } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
    if (error || !data?.user) return json({ error: 'Não autorizado.' }, 401);
    pedidoPor = data.user.email || data.user.id;
  }

  let corpo: { aviso_id?: string } = {};
  try { corpo = await req.json(); } catch { /* sem corpo: processa os pendentes */ }

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Os pendentes, mais o aviso pedido (Reenviar), mesmo que já tenha falhado.
  const { data: pendentes, error: erroFila } = await admin
    .from('avisos_de_evento').select('id, event_id, tipo, evento, antes, tentativas')
    .eq('status', 'pendente').order('criado_em', { ascending: true }).limit(20);
  if (erroFila) return json({ error: erroFila.message }, 500);
  const fila: Aviso[] = [...(pendentes as Aviso[] || [])];
  if (corpo.aviso_id && !fila.some(a => a.id === corpo.aviso_id)) {
    const { data: um } = await admin.from('avisos_de_evento').select('id, event_id, tipo, evento, antes, tentativas').eq('id', corpo.aviso_id).maybeSingle();
    if (um) fila.push(um as Aviso);
  }
  if (fila.length === 0) return json({ processados: 0 });

  const { data: perfis } = await admin.from('profiles').select('email, name, unit, is_active, permission_level');

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
    try {
      if (!smtp.host || !smtp.auth.user) throw new Error('SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)');
      const transporte = nodemailer.createTransport(smtp);
      try {
        await transporte.sendMail({
          from: remetente,
          to: para,
          subject: assunto(a),
          text: corpoTexto(a, SITE),
          html: corpoHtml(a, SITE),
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

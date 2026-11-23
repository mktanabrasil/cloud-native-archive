/**
 * O e-mail do feedback novo (23/11/2026, PR 1 do feedback do app): vai ao
 * marketing a cada feedback que chega pelo botão "Dar feedback".
 *
 * Só texto e HTML, sem Deno nem rede: o teste do app (vitest) importa daqui.
 * Os nomes dos tipos seguem `src/lib/feedback/regras.ts` (o teste confere).
 */

export interface FeedbackDoEmail {
  id: string;
  autor_nome: string;
  autor_email: string | null;
  tipo: string;
  texto: string;
  setor: string | null;
  pagina: string | null;
  aparelho: string | null;
  navegador: string | null;
  criado_em: string;
}

export interface Email { assunto: string; html: string; texto: string }

const FONTE = 'Poppins, Arial, Helvetica, sans-serif';
const FUSO = 'America/Sao_Paulo';
const FRASE_DA_ANA = 'Construindo oportunidades para transformar vidas e inspirar voos mais altos.';

/** Os quatro tipos, com as cores do selo (as mesmas do app). */
export const TIPOS_DO_EMAIL: Record<string, { nome: string; bg: string; fg: string; borda: string }> = {
  ideia: { nome: 'Ideia ou melhoria', bg: '#fdf3d6', fg: '#8a5a00', borda: '#f1d98a' },
  erro: { nome: 'Algo não funcionou', bg: '#fde3dd', fg: '#a53a26', borda: '#f3b9ab' },
  falta: { nome: 'Sinto falta de algo', bg: '#e5f4fd', fg: '#0b5f8a', borda: '#a8d8f3' },
  elogio: { nome: 'Elogio', bg: '#d9f3ec', fg: '#1e5a4d', borda: '#9fdcc9' },
};

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Um instante no fuso de Brasília: "segunda, 23/11 às 10:42". */
export function quando(instante: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  return `${String(p.weekday).replace('-feira', '')}, ${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}

/** "Social › Calendário Anual"; sem setor, "Fora dos setores". */
export const ondeFoi = (f: Pick<FeedbackDoEmail, 'setor' | 'pagina'>) =>
  [f.setor?.trim(), f.pagina?.trim()].filter(Boolean).join(' › ') || 'Fora dos setores';

/** "Celular · Chrome". */
export const aparelhoDoFeedback = (f: Pick<FeedbackDoEmail, 'aparelho' | 'navegador'>) =>
  [f.aparelho === 'celular' ? 'Celular' : f.aparelho === 'computador' ? 'Computador' : '', f.navegador?.trim()].filter(Boolean).join(' · ') || 'Não informado';

/** O resumo do assunto: a primeira linha, até 60 letras. */
export function resumo(texto: string, max = 60): string {
  const linha = texto.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ');
  return linha.length > max ? `${linha.slice(0, max - 1).trimEnd()}…` : linha;
}

export const linkDaCaixa = (site: string) => `${site}/painel?tab=feedback`;

const linha = (k: string, v: string) =>
  `<tr><td style="width:110px;padding:9px 0;border-top:1px solid #efece6;color:#474747;vertical-align:top;font-size:14px">${k}</td><td style="padding:9px 0;border-top:1px solid #efece6;vertical-align:top;font-size:14px;color:#191b1a">${v}</td></tr>`;

/** Para o marketing: chegou um feedback. `comPrint`: o print vai anexado. */
export function emailDoFeedbackNovo(f: FeedbackDoEmail, site: string, comPrint = false): Email {
  const t = TIPOS_DO_EMAIL[f.tipo] ?? TIPOS_DO_EMAIL.ideia;
  const onde = ondeFoi(f);
  const nome = f.autor_nome.trim() || 'Alguém da equipe';
  const assunto = `Feedback · ${t.nome} · ${onde}: ${resumo(f.texto)}`;
  const previa = `${nome} mandou um feedback em ${onde}.`;
  const link = linkDaCaixa(site);
  const chegou = quando(f.criado_em);
  const quem = f.autor_email ? `${escape(nome)} · <a href="mailto:${escape(f.autor_email)}" style="color:#191b1a">${escape(f.autor_email)}</a>` : escape(nome);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(assunto)}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:#f8f6f3">${escape(previa)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
      <td style="vertical-align:middle;padding-left:10px;font-size:12px;color:#474747">Feedback do app</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden">
      <div style="padding:22px 24px 8px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${t.bg};color:${t.fg};border:1px solid ${t.borda};font-size:12px;font-weight:600;margin-bottom:12px">${escape(t.nome)}</span>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#191b1a"><b>${escape(nome)}</b> mandou um feedback em <b>${escape(onde)}</b>.</p>
        <div style="border-left:4px solid ${t.fg};background:${t.bg};border-radius:0 10px 10px 0;padding:12px 16px;margin:0 0 16px">
          <div style="font-size:15px;line-height:1.5;color:#191b1a">${escape(f.texto.trim()).replace(/\r?\n/g, '<br>')}</div>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;border-collapse:collapse">${
          linha('Quem', quem) + linha('Onde', escape(onde)) + linha('Quando', escape(chegou)) + linha('Aparelho', escape(aparelhoDoFeedback(f)))
          + (comPrint ? linha('Print', 'Anexado a este e-mail') : '')
        }</table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px"><tr>
          <td><a href="${escape(link)}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:15px;padding:13px 18px;border-radius:8px;font-family:${FONTE}">Abrir a caixa de feedback</a></td>
        </tr></table>
        <p style="margin:10px 0 0;font-size:13px;text-align:center;color:#474747;line-height:1.5">Para falar direto com quem mandou, é só responder a este e-mail.</p>
      </div>
      <div style="padding:12px 24px 16px;font-size:12px;color:#474747;border-top:1px solid #efece6;margin-top:14px;line-height:1.5">Você recebe este e-mail porque o marketing cuida do feedback do app.</div>
    </div>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a;font-size:13px">ANA Brasil</b><br>
    ${FRASE_DA_ANA}<br>
    <a href="https://anabrasil.org" style="color:#191b1a;text-decoration:none">anabrasil.org</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/anabrasilorg" style="color:#191b1a;text-decoration:none">@anabrasilorg</a><br>
    <span style="color:#8a8f8b">Aviso automático do feedback do app.</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const texto = [
    previa, '', 'ANA Brasil · Feedback do app', '', t.nome.toUpperCase(), '',
    f.texto.trim(), '',
    `Quem: ${nome}${f.autor_email ? ` · ${f.autor_email}` : ''}`,
    `Onde: ${onde}`,
    `Quando: ${chegou}`,
    `Aparelho: ${aparelhoDoFeedback(f)}`,
    ...(comPrint ? ['Print: anexado a este e-mail'] : []), '',
    `Abrir a caixa de feedback: ${link}`, '', 'Para falar direto com quem mandou, é só responder a este e-mail.',
  ].join('\n');
  return { assunto, html, texto };
}

// --- PR 2 (23/11/2026): o marketing mudou a situação ou respondeu --------------------------

/** Os nomes das situações (os mesmos de `src/lib/feedback/regras.ts`; o teste confere). */
export const SITUACOES_DO_EMAIL: Record<string, { nome: string; bg: string; fg: string; borda: string }> = {
  novo: { nome: 'Novo', bg: '#e5f4fd', fg: '#0b5f8a', borda: '#a8d8f3' },
  analise: { nome: 'Em análise', bg: '#fdf3d6', fg: '#8a5a00', borda: '#f1d98a' },
  feito: { nome: 'Feito', bg: '#d9f3ec', fg: '#1e5a4d', borda: '#9fdcc9' },
  nao: { nome: 'Não vamos fazer', bg: '#f1efea', fg: '#474747', borda: '#dcd7ce' },
};

export interface RespostaDoEmail extends FeedbackDoEmail {
  situacao: string;
  resposta: string | null;
  respondido_por: string | null;
}

/** A frase de cada situação, para quem mandou. */
const FRASE_DA_SITUACAO: Record<string, string> = {
  novo: 'O seu feedback voltou para a fila do marketing.',
  analise: 'O marketing está analisando o seu feedback.',
  feito: 'O que você pediu foi feito.',
  nao: 'O marketing leu e decidiu não fazer agora.',
};

/** Para quem mandou: a situação nova e, se houver, a resposta do marketing. */
export function emailDaResposta(f: RespostaDoEmail, site: string): Email {
  const s = SITUACOES_DO_EMAIL[f.situacao] ?? SITUACOES_DO_EMAIL.analise;
  const t = TIPOS_DO_EMAIL[f.tipo] ?? TIPOS_DO_EMAIL.ideia;
  const onde = ondeFoi(f);
  const resposta = (f.resposta ?? '').trim();
  const assunto = `Seu feedback: ${s.nome} · ${resumo(f.texto, 50)}`;
  const frase = FRASE_DA_SITUACAO[f.situacao] ?? 'O marketing atualizou o seu feedback.';
  const previa = resposta ? `${frase} Resposta: ${resumo(resposta, 80)}` : frase;
  const quem = f.respondido_por?.trim() || 'Marketing';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(assunto)}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:#f8f6f3">${escape(previa)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
      <td style="vertical-align:middle;padding-left:10px;font-size:12px;color:#474747">Feedback do app</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden">
      <div style="padding:22px 24px 8px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${s.bg};color:${s.fg};border:1px solid ${s.borda};font-size:12px;font-weight:600;margin-bottom:12px">${escape(s.nome)}</span>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#191b1a">${escape(frase)}</p>
        ${resposta ? `<div style="border-left:4px solid #1e5a4d;background:#eef8f5;border-radius:0 10px 10px 0;padding:12px 16px;margin:0 0 16px">
          <div style="font-size:12px;font-weight:600;color:#1e5a4d;letter-spacing:.02em;margin-bottom:4px">RESPOSTA DE ${escape(quem.toUpperCase())}</div>
          <div style="font-size:15px;line-height:1.5;color:#191b1a">${escape(resposta).replace(/\r?\n/g, '<br>')}</div>
        </div>` : ''}
        <div style="font-size:12px;font-weight:600;color:#474747;margin:0 0 6px">O QUE VOCÊ MANDOU · ${escape(t.nome.toUpperCase())}</div>
        <div style="border:1px solid #efece6;border-radius:10px;padding:12px 16px;margin:0 0 12px;font-size:14px;line-height:1.5;color:#474747">${escape(f.texto.trim()).replace(/\r?\n/g, '<br>')}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;border-collapse:collapse">${
          linha('Onde', escape(onde)) + linha('Enviado', escape(quando(f.criado_em)))
        }</table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px"><tr>
          <td><a href="${escape(site)}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:15px;padding:13px 18px;border-radius:8px;font-family:${FONTE}">Abrir o app</a></td>
        </tr></table>
        <p style="margin:10px 0 0;font-size:13px;text-align:center;color:#474747;line-height:1.5">No app, o botão "Dar feedback" mostra todos os seus feedbacks e a situação de cada um.</p>
      </div>
      <div style="padding:12px 24px 16px;font-size:12px;color:#474747;border-top:1px solid #efece6;margin-top:14px;line-height:1.5">Você recebe este e-mail porque mandou este feedback pelo app.</div>
    </div>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a;font-size:13px">ANA Brasil</b><br>
    ${FRASE_DA_ANA}<br>
    <a href="https://anabrasil.org" style="color:#191b1a;text-decoration:none">anabrasil.org</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/anabrasilorg" style="color:#191b1a;text-decoration:none">@anabrasilorg</a><br>
    <span style="color:#8a8f8b">Aviso automático do feedback do app.</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const texto = [
    previa, '', 'ANA Brasil · Feedback do app', '', s.nome.toUpperCase(), frase, '',
    ...(resposta ? [`Resposta de ${quem}:`, resposta, ''] : []),
    `O que você mandou (${t.nome}):`, f.texto.trim(), '',
    `Onde: ${onde}`, `Enviado: ${quando(f.criado_em)}`, '',
    `Abrir o app: ${site}`, '', 'No app, o botão "Dar feedback" mostra todos os seus feedbacks e a situação de cada um.',
  ].join('\n');
  return { assunto, html, texto };
}

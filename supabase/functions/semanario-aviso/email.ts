/**
 * Os dois e-mails do Semanário (PR 6, 17/11/2026), no desenho dos avisos de
 * eventos (`eventos-aviso`, corpoDevolucao) e do mockup aprovado:
 *
 *  - envio: a professora enviou, vai para a orientadora pedagógica do CEI;
 *  - devolutiva: a orientadora escreveu (ou reescreveu), vai para a professora.
 *
 * Só texto e HTML, sem Deno nem rede: o teste do app (vitest) importa daqui.
 * As datas seguem `src/lib/semanario/regras.ts` (o teste confere que batem).
 */

export interface SemanarioDoEmail {
  id: string;
  professora_nome: string;
  unidade: string;
  semana: string; // a segunda-feira, AAAA-MM-DD
  agrupamento: string;
  dias: Record<string, Record<string, string> | undefined>;
  enviado_em: string | null;
  devolutiva: string | null;
  devolutiva_por: string | null;
  devolutiva_em: string | null;
}

export interface Email { assunto: string; html: string; texto: string }

const FONTE = 'Poppins, Arial, Helvetica, sans-serif';
const FUSO = 'America/Sao_Paulo';
const FRASE_DA_ANA = 'Construindo oportunidades para transformar vidas e inspirar voos mais altos.';
/** O coral da Educação, na capa. */
const COR_DA_EDUCACAO = '#f37964';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// --- datas (as mesmas contas de regras.ts) -----------------------------------------
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex']] as const;
const CAMPOS_DO_DIA = ['projeto', 'proposta', 'objetivo', 'desenvolvimento'];

const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
const somarDias = (iso: string, n: number) => { const d = paraData(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** "23 a 27 de novembro", "30 de novembro a 4 de dezembro", com o ano quando a semana vira o ano. */
export function periodoPorExtenso(semana: string): string {
  const ini = paraData(semana), fim = paraData(somarDias(semana, 4));
  const [di, mi, ai] = [ini.getUTCDate(), ini.getUTCMonth(), ini.getUTCFullYear()];
  const [df, mf, af] = [fim.getUTCDate(), fim.getUTCMonth(), fim.getUTCFullYear()];
  if (ai !== af) return `${di} de ${MESES[mi]} de ${ai} a ${df} de ${MESES[mf]} de ${af}`;
  if (mi !== mf) return `${di} de ${MESES[mi]} a ${df} de ${MESES[mf]}`;
  return `${di} a ${df} de ${MESES[mf]}`;
}
/** "23 a 27/11", para o assunto. */
export function periodoDoAssunto(semana: string): string {
  const fim = somarDias(semana, 4);
  const f = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return semana.slice(5, 7) === fim.slice(5, 7) ? `${semana.slice(8, 10)} a ${f(fim)}` : `${f(semana)} a ${f(fim)}`;
}
/** "quinta, 19/11". */
export const diaComSemana = (iso: string) => `${SEMANA[paraData(iso).getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** A devolutiva vai até a quinta anterior à semana. */
export const prazoDaDevolutiva = (semana: string) => somarDias(semana, -4);

/** Um instante no fuso de Brasília: "quarta, 18/11 às 16:20". */
export function quando(instante: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  return `${String(p.weekday).replace('-feira', '')}, ${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}

/** "CEI Anísio"; o GOE fica GOE. */
export const nomeDaUnidade = (u: string) => (/^goe$/i.test(u.trim()) ? 'GOE' : `CEI ${u.trim()}`);
const agrupamentoOu = (a: string) => a.trim() || 'Sem agrupamento';
const diaCompleto = (d: Record<string, string> | undefined) => !!d && CAMPOS_DO_DIA.every((c) => (d[c] ?? '').trim().length > 0);

// --- peças ----------------------------------------------------------------------------
const linha = (k: string, v: string) =>
  `<tr><td style="width:130px;padding:9px 0;border-top:1px solid #efece6;color:#474747;vertical-align:top;font-size:14px">${k}</td><td style="padding:9px 0;border-top:1px solid #efece6;vertical-align:top;font-size:14px;color:#191b1a">${v}</td></tr>`;

/** Os cinco dias, verdes quando completos. */
function pilulasDosDias(s: SemanarioDoEmail): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px"><tr>${DIAS.map(([chave, rotulo], i) => {
    const ok = diaCompleto(s.dias?.[chave]);
    return `<td style="padding-right:6px"><span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;background:${ok ? '#d9f3ec' : '#f1efea'};color:${ok ? '#1e5a4d' : '#8a8f8b'}">${rotulo} ${somarDias(s.semana, i).slice(8, 10)}</span></td>`;
  }).join('')}</tr></table>`;
}

interface Partes {
  assunto: string; previa: string; capa: string;
  selo: { rotulo: string; bg: string; fg: string; borda: string };
  texto: string; destaque: string; linhas: string; botao: string; link: string; nota: string; motivo: string; rodape: string;
}

function montarHtml(p: Partes, s: SemanarioDoEmail, site: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(p.assunto)}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:#f8f6f3">${escape(p.previa)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
      <td style="vertical-align:middle;padding-left:10px;font-size:12px;color:#474747">Semanário · Educação</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden">
      <div style="background:${COR_DA_EDUCACAO};padding:20px 22px 22px">
        <div style="margin-bottom:26px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(25,27,26,.85);color:#fefdfb;font-size:12px;font-weight:600">${escape(p.capa)}</span></div>
        <div style="font-size:28px;font-weight:800;line-height:1.05;text-transform:uppercase;color:#191b1a;letter-spacing:-.01em">Semanário<br>${escape(periodoPorExtenso(s.semana))}</div>
      </div>
      <div style="padding:20px 24px 8px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${p.selo.bg};color:${p.selo.fg};border:1px solid ${p.selo.borda};font-size:12px;font-weight:600;margin-bottom:12px">${escape(p.selo.rotulo)}</span>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#191b1a">${p.texto}</p>
        ${p.destaque}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;border-collapse:collapse">${p.linhas}</table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px"><tr>
          <td><a href="${escape(p.link)}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:15px;padding:13px 18px;border-radius:8px;font-family:${FONTE}">${escape(p.botao)}</a></td>
        </tr></table>
        <p style="margin:10px 0 0;font-size:13px;text-align:center;color:#474747;line-height:1.5">${escape(p.nota)}</p>
      </div>
      <div style="padding:12px 24px 16px;font-size:12px;color:#474747;border-top:1px solid #efece6;margin-top:14px;line-height:1.5">${escape(p.motivo)}</div>
    </div>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a;font-size:13px">ANA Brasil</b><br>
    ${FRASE_DA_ANA}<br>
    <a href="https://anabrasil.org" style="color:#191b1a;text-decoration:none">anabrasil.org</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/anabrasilorg" style="color:#191b1a;text-decoration:none">@anabrasilorg</a><br>
    <span style="color:#8a8f8b">${escape(p.rodape)}</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export const linkDoSemanario = (s: { id: string }, site: string) => `${site}/educacao/semanario/${s.id}`;

/** Para a orientadora: a professora enviou. */
export function emailDoEnvio(s: SemanarioDoEmail, site: string): Email {
  const nome = s.professora_nome.trim() || 'A professora';
  const periodo = periodoPorExtenso(s.semana);
  const completos = DIAS.filter(([c]) => diaCompleto(s.dias?.[c])).length;
  const assunto = `Semanário enviado: ${nome} · ${agrupamentoOu(s.agrupamento)} · ${periodoDoAssunto(s.semana)}`;
  const previa = `${nome} enviou o semanário do ${agrupamentoOu(s.agrupamento)} para a semana de ${periodo}.`;
  const link = linkDoSemanario(s, site);
  const enviado = s.enviado_em ? quando(s.enviado_em) : '';
  const prazo = diaComSemana(prazoDaDevolutiva(s.semana));
  const html = montarHtml({
    assunto, previa, capa: `${nomeDaUnidade(s.unidade)} · ${agrupamentoOu(s.agrupamento)}`,
    selo: { rotulo: 'Enviado para revisão', bg: '#e5f4fd', fg: '#0b5f8a', borda: '#a8d8f3' },
    texto: `<b>${escape(nome)}</b> enviou o semanário da semana de ${escape(periodo)}. Ele está pronto para a sua leitura e devolutiva.`,
    destaque: pilulasDosDias(s),
    linhas: linha('Professora', escape(nome)) + linha('Agrupamento', escape(agrupamentoOu(s.agrupamento))) + linha('Período', escape(periodo))
      + (enviado ? linha('Enviado em', escape(enviado)) : '') + linha('Devolutiva até', `<b>${escape(prazo)}</b>`),
    botao: 'Abrir e revisar o semanário', link,
    nota: 'O botão abre o semanário no app, com a página do PDF e o campo da devolutiva.',
    motivo: `Você recebe este e-mail porque é a orientadora pedagógica do ${nomeDaUnidade(s.unidade)}.`,
    rodape: 'Aviso automático do Semanário. A devolutiva é dada pelo app.',
  }, s, site);
  const texto = [
    previa, '', 'ANA Brasil · Semanário · Educação', '', 'ENVIADO PARA REVISÃO', `Semanário · ${periodo}`, `${nomeDaUnidade(s.unidade)} · ${agrupamentoOu(s.agrupamento)}`, '',
    `${nome} enviou o semanário da semana de ${periodo}. Ele está pronto para a sua leitura e devolutiva.`, '',
    `Dias completos: ${completos} de 5`,
    ...(enviado ? [`Enviado em: ${enviado}`] : []),
    `Devolutiva até: ${prazo}`, '',
    `Abrir e revisar o semanário: ${link}`, '', 'Aviso automático do Semanário. A devolutiva é dada pelo app.',
  ].join('\n');
  return { assunto, html, texto };
}

/** Para a professora: a orientadora deixou (ou reescreveu) a devolutiva. */
export function emailDaDevolutiva(s: SemanarioDoEmail, site: string, reescrita = false): Email {
  const periodo = periodoPorExtenso(s.semana);
  const assunto = `${reescrita ? 'Devolutiva atualizada' : 'Devolutiva do semanário'} · ${agrupamentoOu(s.agrupamento)} · ${periodoDoAssunto(s.semana)}`;
  const previa = `${reescrita ? 'A orientadora pedagógica atualizou a devolutiva' : 'A orientadora pedagógica deixou uma devolutiva'} no seu semanário da semana de ${periodo}.`;
  const link = linkDoSemanario(s, site);
  const de = [s.devolutiva_por?.trim(), s.devolutiva_em ? `em ${quando(s.devolutiva_em)}` : ''].filter(Boolean).join(', ');
  const devolutiva = (s.devolutiva ?? '').trim();
  const html = montarHtml({
    assunto, previa, capa: `${nomeDaUnidade(s.unidade)} · ${agrupamentoOu(s.agrupamento)}`,
    selo: { rotulo: reescrita ? 'Devolutiva atualizada' : 'Devolutiva da orientadora', bg: '#fdf3d6', fg: '#8a5a00', borda: '#f1d98a' },
    texto: reescrita
      ? 'A orientadora pedagógica <b>atualizou a devolutiva</b> do seu semanário. Este é o texto de agora.'
      : 'A orientadora pedagógica leu o seu semanário e deixou uma <b>devolutiva</b>.',
    destaque: `<div style="border-left:4px solid #8a5a00;background:#fdf3d6;border-radius:0 10px 10px 0;padding:12px 16px;margin:0 0 16px">
          <div style="font-size:12px;font-weight:600;color:#8a5a00;letter-spacing:.02em;margin-bottom:4px">DEVOLUTIVA DA ORIENTADORA PEDAGÓGICA</div>
          <div style="font-size:15px;line-height:1.5;color:#191b1a">${escape(devolutiva).replace(/\n/g, '<br>')}</div>
        </div>`,
    linhas: linha('Agrupamento', escape(agrupamentoOu(s.agrupamento))) + linha('Período', escape(periodo)) + (de ? linha('Devolutiva de', escape(de)) : ''),
    botao: 'Abrir o semanário', link,
    nota: 'O botão abre o semanário no app, com a devolutiva no topo.',
    motivo: 'Você recebe este e-mail porque enviou este semanário pelo app.',
    rodape: 'Aviso automático do Semanário. Responda pelo app.',
  }, s, site);
  const texto = [
    previa, '', 'ANA Brasil · Semanário · Educação', '', reescrita ? 'DEVOLUTIVA ATUALIZADA' : 'DEVOLUTIVA DA ORIENTADORA', `Semanário · ${periodo}`, `${nomeDaUnidade(s.unidade)} · ${agrupamentoOu(s.agrupamento)}`, '',
    'Devolutiva da orientadora pedagógica:', devolutiva, '',
    ...(de ? [`Devolutiva de: ${de}`, ''] : []),
    `Abrir o semanário: ${link}`, '', 'Aviso automático do Semanário. Responda pelo app.',
  ].join('\n');
  return { assunto, html, texto };
}

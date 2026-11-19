/**
 * O e-mail "Gerar minha senha" (19/11/2026, PR 3 das senhas). Sem rede nem
 * Deno: o index.ts monta com isto, e os testes do app (vitest) alcançam.
 * Cores fixas (o Gmail escuro inverte e-mails que seguem o tema), uma coluna,
 * tabelas para o Outlook, como os outros e-mails do app.
 */
export type Motivo = 'esqueci' | 'aprovado';

const FONTE = "Poppins, Arial, Helvetica, sans-serif";
const escape = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const linkDaSenha = (site: string, token: string) => `${site}/senha-nova?t=${encodeURIComponent(token)}`;

export function assuntoDaSenha(motivo: Motivo): string {
  return motivo === 'aprovado' ? 'Seu acesso ao app ANA Brasil foi aprovado' : 'Sua senha nova no app ANA Brasil';
}

const textos = (motivo: Motivo, nome: string | null) => {
  const ola = nome ? `Olá, ${nome.split(' ')[0]}!` : 'Olá!';
  return motivo === 'aprovado'
    ? { titulo: ola, corpo: 'Seu pedido de acesso ao app da ANA Brasil foi aprovado. Para entrar, toque no botão abaixo: o app gera a sua senha e mostra na tela.', depois: 'Guarde a senha. Se esquecer, é só tocar em "Esqueceu a senha?" na tela de entrada.' }
    : { titulo: ola, corpo: 'Alguém pediu uma senha nova para esta conta no app da ANA Brasil. Se foi você, toque no botão abaixo: o app gera a senha e mostra na tela.', depois: 'Não foi você? Ignore este e-mail: nada muda na sua conta, e a senha de agora continua valendo.' };
};

export function corpoDaSenhaHtml(site: string, token: string, motivo: Motivo, nome: string | null): string {
  const t = textos(motivo, nome);
  const link = linkDaSenha(site, token);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(assuntoDaSenha(motivo))}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;padding:24px">
      <div style="font-size:20px;font-weight:700;margin:0 0 10px">${escape(t.titulo)}</div>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.55">${escape(t.corpo)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td>
        <a href="${link}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:16px;padding:14px 18px;border-radius:8px;font-family:${FONTE}">Gerar minha senha</a>
      </td></tr></table>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#474747">O botão vale por 1 hora e funciona uma vez. A senha tem 9 letras, maiúsculas e minúsculas, como <b style="font-family:monospace;color:#191b1a">FdGhJiuPn</b>.</p>
      <p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#474747">${escape(t.depois)}</p>
    </div>
  </td></tr>
  <tr><td style="padding:18px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a">ANA Brasil</b><br>
    <span style="color:#8a8f8b">E-mail automático do app. A senha nunca vai escrita por e-mail.</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function corpoDaSenhaTexto(site: string, token: string, motivo: Motivo, nome: string | null): string {
  const t = textos(motivo, nome);
  return [t.titulo, '', t.corpo, '', `Gerar minha senha: ${linkDaSenha(site, token)}`, '', 'O link vale por 1 hora e funciona uma vez.', t.depois, '', 'ANA Brasil · e-mail automático do app.'].join('\n');
}

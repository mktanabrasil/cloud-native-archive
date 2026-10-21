import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// nodemailer, como em eventos-aviso: o denomailer derrubava o worker na porta 587.
import nodemailer from 'npm:nodemailer@6.9.16';

addEventListener('unhandledrejection', (e) => { console.error('[candidatura-confirmacao] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[candidatura-confirmacao] erro solto:', e.error); e.preventDefault(); });

/**
 * Os e-mails do Trabalhe Conosco para o candidato.
 *
 * 1. Confirmação (PR 8, 06/10/2026): o app chama logo depois de o candidato
 *    enviar, com o JWT DELE e o `candidatura_id`. Uma vez por candidatura
 *    (`confirmacao_enviada_em`).
 * 2. Mudança de etapa (PR 9, 09/10/2026): o painel do RH chama com
 *    `{ candidatura_id, aviso: true }` e o JWT de quem moveu (precisa ser RH
 *    ou admin). Avisa a etapa atual (Análise, Entrevista, Aprovado ou Não
 *    selecionado) uma vez cada (`etapa_avisada`). Voltar etapa não chama.
 *
 * 3. Responsável nomeado (passo 3, 19/10/2026): `{ responsavel_vaga_id }`.
 * 5. Teste de modelo (passo 7, 21/10/2026): `{ teste_modelo }`, só o RH;
 *    manda a prévia com valores de exemplo para o e-mail de quem pediu.
 *    Desde o passo 7, todos os textos vêm dos modelos (email_modelos).
 * 4. Mensagem da equipe (passo 5, 20/10/2026): `{ mensagem_id }`, chamado
 *    pelo RH ou pelo responsável logo depois de `enviar_mensagem`. Uma vez
 *    por mensagem (`email_enviado_em`).
 *
 * Para o candidato, o destinatário é sempre o e-mail da conta do candidato,
 * lido pela chave de serviço; nunca um endereço vindo do pedido.
 *
 * Segredos (Coolify, os mesmos dos avisos de eventos): SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SITE_URL. Remetente: VAGAS_REMETENTE ou
 * "ANA Brasil · Trabalhe Conosco <SMTP_USER>".
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Mensagem { assunto: string; titulo: string; paragrafos: string[]; destaque?: { rotulo: string; valor: string; rodape: string }; cor?: string }

// --- Modelos de e-mail (passo 7, 21/10/2026) ------------------------------------------
// O RH edita assunto, título e texto em Vagas › Modelos de e-mail (tabela
// email_modelos); os campos entre chaves são trocados aqui. Se a linha não
// existir, vale o texto embutido abaixo (o mesmo que a migração semeou).

type ChaveDoModelo = 'confirmacao' | 'analise' | 'entrevista' | 'aprovado' | 'nao_selecionado' | 'convite' | 'pergunta' | 'recado' | 'responsavel';
interface Texto { assunto: string; titulo: string; texto: string }

const PADRAO: Record<ChaveDoModelo, Texto> = {
  confirmacao: { assunto: 'Candidatura recebida · {vaga} · {protocolo}', titulo: 'Recebemos sua candidatura, {nome}.', texto: '{vaga}\n\nPróximos passos: o RH analisa as candidaturas. Se você avançar, avisamos pelo app e por e-mail.' },
  analise: { assunto: 'Sua candidatura está em análise · {vaga}', titulo: '{nome}, sua candidatura está em análise.', texto: 'O RH começou a analisar a sua candidatura para {vaga} (protocolo {protocolo}).\n\nSe você avançar, avisamos por aqui de novo.' },
  entrevista: { assunto: 'Você avançou para a entrevista · {vaga}', titulo: 'Boa notícia, {nome}: você avançou para a entrevista.', texto: 'Sua candidatura para {vaga} (protocolo {protocolo}) passou para a etapa de entrevista.\n\nO RH vai entrar em contato pelo WhatsApp do seu perfil para combinar dia e horário. Confira se o número está certo.' },
  aprovado: { assunto: 'Você foi aprovado(a) · {vaga}', titulo: 'Parabéns, {nome}! Você foi aprovado(a).', texto: 'Você foi aprovado(a) no processo para {vaga} (protocolo {protocolo}).\n\nO RH vai entrar em contato com os próximos passos.' },
  nao_selecionado: { assunto: 'Resultado da sua candidatura · {vaga}', titulo: '{nome}, obrigado por se candidatar.', texto: 'Desta vez você não foi selecionado(a) para {vaga} (protocolo {protocolo}).\n\nSeu perfil continua no Trabalhe Conosco, e você pode se candidatar a outras vagas quando quiser.' },
  convite: { assunto: 'Convite para entrevista · {vaga}', titulo: '{nome}, você foi convidado(a) para uma entrevista.', texto: '{mensagem}\n\nConfirme sua presença pelo app (ou avise se não puder nesse horário).' },
  pergunta: { assunto: 'O RH tem uma pergunta · {vaga}', titulo: '{nome}, o RH precisa de uma informação.', texto: '{mensagem}\n\nResponda pelo app, na sua candidatura.' },
  recado: { assunto: 'Mensagem do RH · {vaga}', titulo: '{nome}, uma mensagem sobre sua candidatura.', texto: '{mensagem}' },
  responsavel: { assunto: 'Você é responsável pelo processo · {vaga}', titulo: '{nome}, você é responsável por um processo seletivo.', texto: 'O RH nomeou você responsável pelo processo {vaga} ({codigo}). Prazo do processo: {prazo}.\n\nNo app, os candidatos aparecem em Vagas › Meus processos: você abre as fichas, vê o currículo e move até a entrevista. O resultado final fica com o RH.' },
};
/** Os modelos com o título em destaque (fundo verde-claro), como já eram. */
const COM_COR: ChaveDoModelo[] = ['entrevista', 'aprovado', 'convite'];

/** Troca {campo} pelo valor; campo desconhecido fica como está (a tela do RH não deixa salvar campo estranho). */
const preencher = (t: string, v: Record<string, string>) => t.replace(/\{([a-z_]+)\}/g, (todo, c: string) => (c in v ? v[c] : todo));

// deno-lint-ignore no-explicit-any
async function lerModelo(admin: any, chave: ChaveDoModelo): Promise<Texto> {
  const { data } = await admin.from('email_modelos').select('assunto, titulo, texto').eq('chave', chave).maybeSingle();
  return data?.assunto && data?.titulo && data?.texto ? data as Texto : PADRAO[chave];
}

/** Monta a mensagem a partir do modelo (o salvo pelo RH ou o embutido). */
function montar(chave: ChaveDoModelo, t: Texto, valores: Record<string, string>, destaque?: Mensagem['destaque']): Mensagem {
  return {
    assunto: preencher(t.assunto, valores).replace(/\s+/g, ' ').trim(),
    titulo: preencher(t.titulo, valores).trim(),
    paragrafos: preencher(t.texto, valores).split(/\n+/).map((p) => p.trim()).filter(Boolean),
    destaque,
    cor: COM_COR.includes(chave) ? '#E6F8F3' : undefined,
  };
}

/** A chave do aviso de cada etapa (voltar não avisa; Recebida não tem aviso). */
function chaveDaEtapa(etapa: string, resultado: string | null): ChaveDoModelo | null {
  if (etapa === 'analise') return 'analise';
  if (etapa === 'entrevista') return 'entrevista';
  if (etapa === 'resultado' && resultado === 'aprovado') return 'aprovado';
  if (etapa === 'resultado' && resultado === 'nao_selecionado') return 'nao_selecionado';
  return null;
}

/** Os valores de exemplo do "Mandar teste para mim" (os mesmos da prévia no app). */
const EXEMPLO: Record<string, string> = {
  nome: 'Leonardo', vaga: 'Educador Social de Música', protocolo: '2026-000418', data: '21/10/2026 09:42',
  mensagem: 'Olá, Leonardo! Sua entrevista será no dia 24/10, às 14:00, na Sede. Leve um documento com foto.',
  codigo: 'SOC-2026-031', prazo: '30/11/2026',
};
const BOTAO: Record<ChaveDoModelo, string> = {
  confirmacao: 'Acompanhar candidatura', analise: 'Acompanhar candidatura', entrevista: 'Acompanhar candidatura', aprovado: 'Acompanhar candidatura',
  nao_selecionado: 'Acompanhar candidatura', convite: 'Confirmar presença', pergunta: 'Responder no app', recado: 'Abrir no app', responsavel: 'Abrir o processo',
};

function html(m: Mensagem, link: string, botao = 'Acompanhar candidatura'): string {
  const destaque = m.destaque ? `
  <div style="background:#E6F8F3;border-radius:14px;padding:16px;text-align:center;margin:0 0 18px">
    <div style="font-size:12px;color:#555">${esc(m.destaque.rotulo)}</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:.04em">${esc(m.destaque.valor)}</div>
    <div style="font-size:12px;color:#555">${esc(m.destaque.rodape)}</div>
  </div>` : '';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:Poppins,Arial,sans-serif;color:#1F2322">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="font-size:15px;font-weight:700;margin:0 0 20px">anabrasil</p>
  <h1 style="font-size:22px;margin:0 0 12px;${m.cor ? `background:${m.cor};padding:14px 16px;border-radius:14px;` : ''}">${esc(m.titulo)}</h1>
  ${m.paragrafos.map((p) => `<p style="margin:0 0 12px;color:#333;line-height:1.55">${esc(p)}</p>`).join('\n  ')}
  ${destaque}
  <a href="${esc(link)}" style="display:inline-block;background:#1F2322;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;margin-top:6px">${esc(botao)}</a>
  <p style="margin:26px 0 0;font-size:12px;color:#777">Trabalhe Conosco · ANA Brasil</p>
</div>
<div style="height:6px;background:linear-gradient(90deg,#F5DFBB 0 20%,#FBCE00 20% 40%,#F37964 40% 60%,#81E2CF 60% 80%,#01ADFF 80% 100%)"></div>
</body></html>`;
}

const texto = (m: Mensagem, link: string, botao = 'Acompanhar') =>
  [m.titulo, '', ...m.paragrafos, ...(m.destaque ? ['', `${m.destaque.rotulo}: ${m.destaque.valor} (${m.destaque.rodape})`] : []), '', `${botao}: ${link}`, ''].join('\n');

async function enviar(para: string, m: Mensagem, link: string, botao?: string): Promise<void> {
  const porta = Number(Deno.env.get('SMTP_PORT') || 587);
  const tlsEnv = Deno.env.get('SMTP_TLS');
  const tlsDireto = tlsEnv ? tlsEnv !== 'false' : porta === 465;
  const usuario = Deno.env.get('SMTP_USER') || '';
  const smtp = {
    host: Deno.env.get('SMTP_HOST') || '', port: porta, secure: tlsDireto, requireTLS: !tlsDireto,
    auth: { user: usuario, pass: Deno.env.get('SMTP_PASS') || '' },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  };
  if (!smtp.host || !usuario) throw new Error('SMTP não configurado.');
  const remetente = Deno.env.get('VAGAS_REMETENTE') || `ANA Brasil · Trabalhe Conosco <${usuario}>`;
  const transporte = nodemailer.createTransport(smtp);
  try {
    await transporte.sendMail({ from: remetente, to: para, subject: m.assunto, text: texto(m, link, botao), html: html(m, link, botao) });
  } finally {
    transporte.close();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SITE = (Deno.env.get('SITE_URL') || 'https://app.anabrasil.org').replace(/\/$/, '');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem, error: erroDeQuem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (erroDeQuem || !quem?.user) return json({ error: 'Não autorizado.' }, 401);

  let corpo: { candidatura_id?: string; aviso?: boolean; responsavel_vaga_id?: string; mensagem_id?: string; teste_modelo?: Texto & { chave?: string } } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }

  // 5. "Mandar teste para mim" (passo 7, 21/10/2026): só o RH; vai para o e-mail de quem pediu, com valores de exemplo.
  if (corpo.teste_modelo) {
    const { data: ehRh } = await userClient.rpc('is_rh_or_admin', { _user_id: quem.user.id });
    if (!ehRh) return json({ error: 'Só o RH testa os modelos.' }, 403);
    const t = corpo.teste_modelo;
    const chave = String(t.chave ?? '') as ChaveDoModelo;
    if (!(chave in PADRAO)) return json({ error: 'Modelo desconhecido.' }, 400);
    const texto: Texto = { assunto: String(t.assunto ?? '').slice(0, 150), titulo: String(t.titulo ?? '').slice(0, 150), texto: String(t.texto ?? '').slice(0, 2000) };
    if (!texto.assunto.trim() || !texto.titulo.trim() || !texto.texto.trim()) return json({ error: 'Assunto, título e texto não podem ficar vazios.' }, 400);
    const destaque = chave === 'confirmacao' ? { rotulo: 'Protocolo', valor: EXEMPLO.protocolo, rodape: `enviada em ${EXEMPLO.data}` }
      : chave === 'convite' ? { rotulo: 'Entrevista', valor: 'sexta-feira, 24/10 às 14:00', rodape: 'Presencial · Sede' } : undefined;
    const m = montar(chave, texto, EXEMPLO, destaque);
    m.assunto = `[Teste] ${m.assunto}`;
    try { await enviar(quem.user.email!, m, `${SITE}/vagas`, BOTAO[chave]); }
    catch (e) { return json({ error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, 502); }
    return json({ enviado: true, para: quem.user.email });
  }

  // 4. Mensagem da equipe (passo 5, 20/10/2026): o texto inteiro vai no e-mail, com o botão para o app.
  if (corpo.mensagem_id) {
    const adm = createClient(SUPABASE_URL, SERVICE);
    const { data: msg } = await adm
      .from('candidatura_mensagens')
      .select('id, candidatura_id, autor, tipo, texto, entrevista, email_enviado_em, candidaturas(id, user_id, protocolo, perfil, retirada_em, vagas(titulo))')
      .eq('id', String(corpo.mensagem_id))
      .maybeSingle();
    if (!msg || msg.autor !== 'equipe') return json({ error: 'Mensagem não encontrada.' }, 404);
    const { data: rh } = await userClient.rpc('is_rh_or_admin', { _user_id: quem.user.id });
    const { data: responsavel } = rh ? { data: false } : await userClient.rpc('responsavel_pela_candidatura', { _candidatura_id: msg.candidatura_id, _user_id: quem.user.id });
    if (!rh && !responsavel) return json({ error: 'Só o RH ou o responsável pelo processo escreve ao candidato.' }, 403);
    if (msg.email_enviado_em) return json({ enviado: false, motivo: 'já enviado' });
    const cand = msg.candidaturas as unknown as { id: string; user_id: string; protocolo: string; perfil: Record<string, unknown> | null; retirada_em: string | null; vagas: { titulo?: string } | null };
    if (cand.retirada_em) return json({ enviado: false, motivo: 'retirada' });
    const { data: dono } = await adm.auth.admin.getUserById(cand.user_id);
    if (!dono?.user?.email) return json({ error: 'Candidato sem e-mail.' }, 404);
    const primeiro = String(cand.perfil?.nome_social || cand.perfil?.nome || 'candidato').split(' ')[0];
    const tituloDaVaga = String(cand.vagas?.titulo ?? 'Trabalhe Conosco');
    const chave: ChaveDoModelo = msg.tipo === 'convite' ? 'convite' : msg.tipo === 'pergunta' ? 'pergunta' : 'recado';
    let destaque: Mensagem['destaque'];
    if (msg.tipo === 'convite') {
      const e = (msg.entrevista ?? {}) as { dia?: string; hora?: string; formato?: string; local?: string };
      const dia = e.dia ? new Date(`${e.dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '';
      destaque = { rotulo: 'Entrevista', valor: `${dia} às ${e.hora ?? ''}`, rodape: [e.formato === 'online' ? 'On-line' : e.formato === 'telefone' ? 'Por telefone' : 'Presencial', e.local].filter(Boolean).join(' · ') };
    }
    const m = montar(chave, await lerModelo(adm, chave), { nome: primeiro, vaga: tituloDaVaga, mensagem: String(msg.texto) }, destaque);
    try { await enviar(dono.user.email, m, `${SITE}/vagas/minha-area/${cand.id}`, BOTAO[chave]); }
    catch (e) { return json({ error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, 502); }
    await adm.from('candidatura_mensagens').update({ email_enviado_em: new Date().toISOString() }).eq('id', msg.id);
    return json({ enviado: true });
  }

  // 3. Responsável nomeado (passo 3, 19/10/2026): só o RH pede; vai para o responsável da vaga.
  if (corpo.responsavel_vaga_id) {
    const { data: ehRh } = await userClient.rpc('is_rh_or_admin', { _user_id: quem.user.id });
    if (!ehRh) return json({ error: 'Só o RH nomeia responsável.' }, 403);
    const adm = createClient(SUPABASE_URL, SERVICE);
    const { data: v } = await adm.from('vagas').select('id, slug, titulo, codigo, responsavel_id, prazo_processo').eq('id', String(corpo.responsavel_vaga_id)).maybeSingle();
    if (!v?.responsavel_id) return json({ error: 'Vaga sem responsável.' }, 404);
    const { data: resp } = await adm.auth.admin.getUserById(v.responsavel_id);
    if (!resp?.user?.email) return json({ error: 'Responsável sem e-mail.' }, 404);
    const { data: perfilResp } = await adm.from('profiles').select('name').eq('user_id', v.responsavel_id).maybeSingle();
    const primeiro = String(perfilResp?.name || resp.user.email).split(/[\s@]/)[0];
    const prazo = v.prazo_processo ? String(v.prazo_processo).split('-').reverse().join('/') : 'sem prazo definido';
    const m = montar('responsavel', await lerModelo(adm, 'responsavel'), { nome: primeiro, vaga: String(v.titulo), codigo: String(v.codigo), prazo });
    try { await enviar(resp.user.email, m, `${SITE}/vagas/${v.slug}/candidatos`, BOTAO.responsavel); }
    catch (e) { return json({ error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, 502); }
    return json({ enviado: true });
  }
  const id = String(corpo.candidatura_id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'candidatura_id inválido.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE);
  const { data: c, error } = await admin
    .from('candidaturas')
    .select('id, user_id, protocolo, created_at, etapa, resultado, etapa_avisada, retirada_em, confirmacao_enviada_em, perfil, vagas(titulo)')
    .eq('id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!c) return json({ error: 'Candidatura não encontrada.' }, 404);

  const perfil = (c.perfil ?? {}) as Record<string, unknown>;
  const nome = String(perfil.nome_social || perfil.nome || 'candidato').split(' ')[0];
  const vaga = String((c.vagas as { titulo?: string } | null)?.titulo ?? 'Trabalhe Conosco');
  const link = `${SITE}/vagas/minha-area/${c.id}`;

  // O e-mail vai sempre para a conta do candidato, lida aqui.
  const { data: dono } = await admin.auth.admin.getUserById(c.user_id);
  const para = dono?.user?.email;
  if (!para) return json({ error: 'Candidato sem e-mail.' }, 404);

  try {
    if (corpo.aviso) {
      const { data: rh } = await userClient.rpc('is_rh_or_admin', { _user_id: quem.user.id });
      // O responsável pelo processo também move (até Entrevista) e avisa (passo 3, 19/10/2026).
      const { data: responsavel } = rh ? { data: false } : await userClient.rpc('responsavel_pela_candidatura', { _candidatura_id: c.id, _user_id: quem.user.id });
      if (!rh && !responsavel) return json({ error: 'Só o RH ou o responsável pelo processo avisa o candidato.' }, 403);
      if (c.retirada_em) return json({ enviado: false, motivo: 'retirada' });
      const marca = `${c.etapa}${c.resultado ? ':' + c.resultado : ''}`;
      if (c.etapa_avisada === marca) return json({ enviado: false, motivo: 'já avisado' });
      const chave = chaveDaEtapa(c.etapa, c.resultado);
      if (!chave) return json({ enviado: false, motivo: 'etapa sem aviso' });
      const m = montar(chave, await lerModelo(admin, chave), { nome, vaga, protocolo: c.protocolo });
      await enviar(para, m, link, BOTAO[chave]);
      await admin.from('candidaturas').update({ etapa_avisada: marca }).eq('id', c.id);
      return json({ enviado: true });
    }

    if (c.user_id !== quem.user.id) return json({ error: 'Candidatura não encontrada.' }, 404);
    if (c.confirmacao_enviada_em) return json({ enviado: false, motivo: 'já enviado' });
    const enviadaEm = quando(c.created_at);
    const m = montar('confirmacao', await lerModelo(admin, 'confirmacao'), { nome, vaga, protocolo: c.protocolo, data: enviadaEm },
      { rotulo: 'Protocolo', valor: c.protocolo, rodape: `enviada em ${enviadaEm}` });
    await enviar(para, m, link, BOTAO.confirmacao);
    await admin.from('candidaturas').update({ confirmacao_enviada_em: new Date().toISOString() }).eq('id', c.id);
    return json({ enviado: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[candidatura-confirmacao] falhou:', msg);
    return json({ error: msg.slice(0, 300) }, 502);
  }
});

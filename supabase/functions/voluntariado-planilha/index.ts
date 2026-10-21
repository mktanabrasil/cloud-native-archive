import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

addEventListener('unhandledrejection', (e) => { console.error('[voluntariado-planilha] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[voluntariado-planilha] erro solto:', e.error); e.preventDefault(); });

/**
 * Voluntariado do Natal Feliz (21/10/2026): a planilha do Google que se
 * atualiza sozinha, para a comunicação compartilhar com a gestão.
 *
 * Uma planilha só ("Voluntariado Natal Feliz 2026", no Drive compartilhado
 * Setor Marketing), criada pelo painel. Cada inscrição nova entra como uma
 * linha NO FIM (append): o app nunca reescreve nem apaga o que já está lá,
 * então a gestão pode acrescentar colunas à direita e anotar. Apagar no app
 * não tira a linha da planilha.
 *
 * Usa a mesma conta Google conectada no Drive da Pizza (pizza_drive_conexao,
 * escopo drive, que também vale para a API do Sheets). Precisa da "Google
 * Sheets API" ativada no projeto do Google Cloud.
 *
 * Cores (21/10/2026): cada linha chega com a cor da unidade em A:H e sem
 * negrito (o Google copiava o formato do cabeçalho). As linhas que já
 * estavam lá são acertadas uma vez (voluntariado_planilha.cores_em).
 *
 * Quem chama:
 *  - o formulário público, logo depois de cada inscrição (sem login): só
 *    escreve o que está pendente, não devolve dado de ninguém;
 *  - o painel (comunicação e admin): estado, criar a planilha, enviar
 *    pendentes agora.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
const OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
const NOME_DA_PLANILHA = 'Voluntariado Natal Feliz 2026';
const ABA = 'Inscrições';
const CABECALHO = ['Protocolo', 'Quando', 'Nome', 'WhatsApp', 'Unidade', 'Área', '1ª opção', '2ª opção'];
const POR_VEZ = 200;

const AREAS: Record<string, string> = { educacao: 'Educação', social: 'Social' };
const AJUDA: Record<string, string> = {
  cozinha: 'Cozinha / Servimento', montagem: 'Montagem / Desmontagem', decoracao: 'Decoração', logistica: 'Logística', som: 'Som', projecao: 'Projeção',
  recreacao_kids: 'Recreação Kids', inflaveis: 'Brinquedos infláveis', atividades_adultos: 'Atividades adultos', presentes_kids: 'Presentes Kids',
  intercessao: 'Intercessão / Suporte espiritual', alojamentos: 'Alojamentos',
  limpeza_pre: 'Limpeza pré-evento', limpeza_durante: 'Limpeza durante o evento', limpeza_pos: 'Limpeza pós-evento',
  estacionamento: 'Estacionamento', seguranca: 'Segurança',
};

/** A cor de cada unidade (pelo nome, como vai na coluna E): Social em tons quentes, CEIs e GOE em frios. */
const COR_DA_UNIDADE: Record<string, string> = {
  'ANA Jardim Nilópolis': '#FFD9D2', 'ANA DIC': '#FFE5C2', 'ANA Jardim Santana': '#FFF2B8', 'ANA Piauí': '#F9D6E6',
  'Grupo de Oração Esperança': '#E8DAF5',
  'CEI Bem Querer Prof. Pierre Weil': '#D6ECFF', 'CEI Bem Querer Sen. João de Medeiros Calmon': '#CFF3EC',
  'CEI Bem Querer Célia A. J. Velardi Gaspar': '#DDF2D0', 'CEI Bem Querer Rogério L. P. Santana': '#E3E7FF',
  'CEI Bem Querer Prof. Anísio Spínola': '#D0F0F8', 'CEI Bem Querer Min. Gustavo Capanema': '#EAF5C8',
  'CEI Bem Querer Gov. Leonel de Moura Brizola': '#F3E2D3', 'CEI Bem Querer Paulo Reglus Neves Freire': '#E0EAF0',
  'CEI Bem Querer Mayara Masson Christofoletti': '#F6DDF0', 'CEI Bem Querer Profa. Renata Ferramola': '#D9F2E4',
  'CEI Bem Querer Vandir Justino da Costa Dias': '#FBE7D7',
};
const SEM_COR = '#EEEEEE';

const rgb = (hex: string) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });

/** Pinta as linhas (número da linha na planilha, 1 = cabeçalho) com a cor da unidade, sem negrito, de A a H. */
async function pintar(token: string, planilha: string, linhas: Array<{ linha: number; unidade: string }>) {
  if (!linhas.length) return;
  const info = await google(token, 'GET', `https://sheets.googleapis.com/v4/spreadsheets/${planilha}?fields=sheets.properties.sheetId`);
  const aba = info?.sheets?.[0]?.properties?.sheetId ?? 0;
  await google(token, 'POST', `https://sheets.googleapis.com/v4/spreadsheets/${planilha}:batchUpdate`, {
    requests: linhas.map(({ linha, unidade }) => ({
      repeatCell: {
        range: { sheetId: aba, startRowIndex: linha - 1, endRowIndex: linha, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: rgb(COR_DA_UNIDADE[unidade.trim()] ?? SEM_COR), textFormat: { bold: false } } },
        fields: 'userEnteredFormat(backgroundColor,textFormat.bold)',
      },
    })),
  });
}

/** Uma vez só: acerta a cor das linhas que já estavam na planilha antes das cores. */
async function acertarCoresAntigas(admin: Admin, token: string, planilha: string) {
  const r = await google(token, 'GET', `https://sheets.googleapis.com/v4/spreadsheets/${planilha}/values/${encodeURIComponent('E2:E')}`);
  const valores: string[][] = r?.values ?? [];
  await pintar(token, planilha, valores.map((v, i) => ({ linha: i + 2, unidade: v?.[0] ?? '' })).filter((l) => l.unidade));
  await admin.from('voluntariado_planilha').update({ cores_em: new Date().toISOString() }).eq('id', 1);
}

// deno-lint-ignore no-explicit-any
type Admin = any;

class ErroGoogle extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function google(token: string, metodo: string, url: string, corpo?: unknown) {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroGoogle(r.status, `Google ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}

/** O acesso da conta conectada no Drive da Pizza. */
async function token(admin: Admin): Promise<{ token: string; driveId: string; email: string } | null> {
  const { data: c } = await admin.from('pizza_drive_conexao').select('refresh_token, drive_id, google_email').eq('id', 1).maybeSingle();
  if (!c) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error === 'invalid_grant' ? 'o Google desconectou a conta: conecte de novo no painel da Pizza' : `o Google não renovou o acesso (${r.status})`);
  return { token: j.access_token as string, driveId: c.drive_id as string, email: c.google_email as string };
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

const whatsapp = (d: string) =>
  d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;

// deno-lint-ignore no-explicit-any
const linha = (i: any) => [i.protocolo, quando(i.created_at), i.nome, whatsapp(i.whatsapp), i.unidade_nome, AREAS[i.area] ?? i.area, AJUDA[i.opcao1] ?? i.opcao1, i.opcao2 ? (AJUDA[i.opcao2] ?? i.opcao2) : ''];

const mensagem = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/accessNotConfigured|has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) return 'A API do Google Sheets não está ativada no projeto do Google Cloud. Ative "Google Sheets API" e tente de novo.';
  if (e instanceof ErroGoogle && e.status === 404) return 'A planilha não foi encontrada: foi apagada ou a conta conectada perdeu o acesso.';
  return msg.slice(0, 300);
};

/** Escreve no fim da planilha as inscrições que ainda não estão lá. */
async function enviarPendentes(admin: Admin): Promise<{ enviadas: number; pendentes: number; motivo?: string }> {
  const { data: p } = await admin.from('voluntariado_planilha').select('planilha_id, cores_em').eq('id', 1).maybeSingle();
  if (!p) return { enviadas: 0, pendentes: 0, motivo: 'planilha ainda não criada' };
  const g = await token(admin);
  if (!g) return { enviadas: 0, pendentes: 0, motivo: 'Drive não conectado' };
  if (!p.cores_em) await acertarCoresAntigas(admin, g.token, p.planilha_id).catch((e) => console.error('[voluntariado-planilha] cores antigas:', mensagem(e)));

  // Prende as pendentes de uma vez (um UPDATE só): duas chamadas juntas não pegam a mesma.
  const limite = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: livres } = await admin.from('voluntarios_natal').select('id')
    .is('planilha_em', null).or(`planilha_tentando_em.is.null,planilha_tentando_em.lt.${limite}`)
    .order('created_at').limit(POR_VEZ);
  const ids = (livres ?? []).map((l: { id: string }) => l.id);
  let enviadas = 0;
  if (ids.length) {
    const { data: presas } = await admin.from('voluntarios_natal').update({ planilha_tentando_em: new Date().toISOString() })
      .in('id', ids).is('planilha_em', null).or(`planilha_tentando_em.is.null,planilha_tentando_em.lt.${limite}`)
      .select('id, protocolo, nome, whatsapp, unidade_nome, area, opcao1, opcao2, created_at');
    // deno-lint-ignore no-explicit-any
    const lista = ((presas ?? []) as any[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (lista.length) {
      try {
        const r = await google(g.token, 'POST',
          `https://sheets.googleapis.com/v4/spreadsheets/${p.planilha_id}/values/${encodeURIComponent('A:H')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
          { values: lista.map(linha) });
        // Onde as linhas entraram ("'Inscrições'!A3:H5"): cada uma ganha a cor da unidade, sem o negrito do cabeçalho.
        const primeira = Number(String(r?.updates?.updatedRange ?? '').match(/![A-Z]+(\d+)/)?.[1] ?? 0);
        if (primeira) await pintar(g.token, p.planilha_id, lista.map((l, i) => ({ linha: primeira + i, unidade: l.unidade_nome }))).catch((e) => console.error('[voluntariado-planilha] cores:', mensagem(e)));
        await admin.from('voluntarios_natal').update({ planilha_em: new Date().toISOString(), planilha_tentando_em: null }).in('id', lista.map((l) => l.id));
        await admin.from('voluntariado_planilha').update({ erro: null }).eq('id', 1);
        enviadas = lista.length;
      } catch (e) {
        await admin.from('voluntarios_natal').update({ planilha_tentando_em: null }).in('id', lista.map((l) => l.id));
        await admin.from('voluntariado_planilha').update({ erro: mensagem(e) }).eq('id', 1);
        throw e;
      }
    }
  }
  const { count } = await admin.from('voluntarios_natal').select('id', { count: 'exact', head: true }).is('planilha_em', null);
  return { enviadas, pendentes: count ?? 0 };
}

/** Cria a planilha no Setor Marketing, com o cabeçalho em negrito e a 1ª linha fixa. */
async function criar(admin: Admin, quem: string): Promise<string> {
  const g = await token(admin);
  if (!g) throw new Error('Conecte o Drive no painel da Pizza da Alegria antes (a planilha usa a mesma conta).');
  const arq = await google(g.token, 'POST', 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
    { name: NOME_DA_PLANILHA, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [g.driveId] });
  const id = arq.id as string;
  const info = await google(g.token, 'GET', `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties.sheetId`);
  const aba = info?.sheets?.[0]?.properties?.sheetId ?? 0;
  await google(g.token, 'POST', `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
    requests: [
      { updateSheetProperties: { properties: { sheetId: aba, title: ABA, gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } },
      { updateCells: {
        rows: [{ values: CABECALHO.map((t) => ({ userEnteredValue: { stringValue: t }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.96, blue: 0.93 } } })) }],
        fields: 'userEnteredValue,userEnteredFormat(textFormat,backgroundColor)', start: { sheetId: aba, rowIndex: 0, columnIndex: 0 },
      } },
      { updateDimensionProperties: { range: { sheetId: aba, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 }, properties: { pixelSize: 170 }, fields: 'pixelSize' } },
    ],
  });
  await admin.from('voluntariado_planilha').upsert({ id: 1, planilha_id: id, criada_por: quem, criada_em: new Date().toISOString(), erro: null, cores_em: new Date().toISOString() });
  // Tudo o que já existe entra agora, do mais antigo ao mais novo.
  await admin.from('voluntarios_natal').update({ planilha_em: null, planilha_tentando_em: null }).not('id', 'is', null);
  return id;
}

const link = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  // deno-lint-ignore no-explicit-any
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio = enviar pendentes */ }

  if (!corpo.estado && !corpo.criar && !corpo.sincronizar) {
    // O formulário público: só escreve o que estiver pendente.
    try { return json(await enviarPendentes(admin)); }
    catch (e) { return json({ error: mensagem(e) }, 500); }
  }

  // Daqui para baixo, só a comunicação e o admin.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (!quem?.user) return json({ error: 'Não autorizado.' }, 401);
  const { data: ehComunicacao } = await userClient.rpc('is_marketing_user', { _user_id: quem.user.id });
  if (!ehComunicacao) return json({ error: 'Só a comunicação.' }, 403);

  try {
    if (corpo.estado) {
      const { data: p } = await admin.from('voluntariado_planilha').select('planilha_id, criada_por, criada_em, erro').eq('id', 1).maybeSingle();
      const { data: c } = await admin.from('pizza_drive_conexao').select('google_email').eq('id', 1).maybeSingle();
      const { count } = await admin.from('voluntarios_natal').select('id', { count: 'exact', head: true }).is('planilha_em', null);
      return json({
        drive_conectado: !!c, google_email: c?.google_email ?? null,
        planilha: p ? { link: link(p.planilha_id), criada_por: p.criada_por, criada_em: p.criada_em, erro: p.erro } : null,
        pendentes: p ? (count ?? 0) : 0,
      });
    }
    if (corpo.criar) {
      const { data: ja } = await admin.from('voluntariado_planilha').select('planilha_id').eq('id', 1).maybeSingle();
      if (ja) return json({ link: link(ja.planilha_id), ja_existia: true });
      const id = await criar(admin, quem.user.email ?? quem.user.id);
      const r = await enviarPendentes(admin).catch((e) => ({ enviadas: 0, pendentes: -1, motivo: mensagem(e) }));
      console.log(`[voluntariado-planilha] ${quem.user.email} criou a planilha ${id}`);
      return json({ link: link(id), ...r });
    }
    return json(await enviarPendentes(admin));
  } catch (e) {
    return json({ error: mensagem(e) }, e instanceof ErroGoogle ? 400 : 500);
  }
});

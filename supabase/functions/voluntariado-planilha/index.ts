import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

addEventListener('unhandledrejection', (e) => { console.error('[voluntariado-planilha] promessa solta:', e.reason); e.preventDefault(); });
addEventListener('error', (e) => { console.error('[voluntariado-planilha] erro solto:', e.error); e.preventDefault(); });

/**
 * Voluntariado do Natal Feliz: a planilha do Google que se atualiza sozinha.
 *
 * Desde 23/10/2026 as inscrições caem direto na planilha da coordenação
 * ("Mapeamento Natal Feliz 2026", aba Voluntários), que já tem as colunas e
 * as listas suspensas (etiquetas). O app escreve de A a K, uma linha por
 * inscrição, na primeira linha livre depois da última com nome; a coluna L
 * (Observações) e o resto da planilha são da coordenação, e o app nunca
 * reescreve nem apaga o que já está lá. Os valores saem com os nomes exatos
 * das etiquetas da planilha, para virarem as etiquetas coloridas dela.
 * A planilha e a aba ficam em voluntariado_planilha (id 1).
 *
 * Usa a mesma conta Google conectada no Drive da Pizza (pizza_drive_conexao,
 * escopo drive, que também vale para a API do Sheets); ela precisa ser
 * Editora da planilha da coordenação.
 *
 * Quem chama:
 *  - o formulário público, logo depois de cada inscrição (sem login): só
 *    escreve o que está pendente, não devolve dado de ninguém;
 *  - o painel (comunicação e admin): estado e enviar pendentes agora.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
const OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
const POR_VEZ = 200;

/**
 * As colunas da aba Voluntários (A a K):
 * Nome Voluntário | Área / Setor | Horário | Telefone | Vínculo | Unidade |
 * 2ª opção | Indicado por | Igreja | Protocolo | Inscrito em
 */
const VINCULO: Record<string, string> = { funcionario: 'Funcionário(a) ANA', alcance: 'Alcance JNI', comunidade: 'Voluntário(a)' };
/** Os nomes das etiquetas da coluna Horário da planilha. */
const HORARIO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', dia_anterior: 'Dia anterior', pos_evento: 'Pós-Evento', dia_todo: 'Dia todo' };
/** Os nomes das etiquetas de Área / Setor (e 2ª opção) da planilha. */
const AREA: Record<string, string> = {
  cozinha: 'Cozinha / Servimento Refeições', inflaveis: 'Brinquedos Infláveis', estacoes: 'Estações',
  louvor_kids: 'Louvor Kids', som: 'Som', recreacao_kids: 'Recreação Kids', presentes_kids: 'Presentes Kids',
  montagem: 'Montagem/Desmontagem Espaços', decoracao: 'Decoração', limpeza_pre: 'Limpeza Pré',
};

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
async function token(admin: Admin): Promise<{ token: string; email: string } | null> {
  const { data: c } = await admin.from('pizza_drive_conexao').select('refresh_token, google_email').eq('id', 1).maybeSingle();
  if (!c) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error === 'invalid_grant' ? 'o Google desconectou a conta: conecte de novo no painel da Pizza' : `o Google não renovou o acesso (${r.status})`);
  return { token: j.access_token as string, email: c.google_email as string };
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

const whatsapp = (d: string) =>
  d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;

// deno-lint-ignore no-explicit-any
const linha = (i: any) => [
  i.nome, AREA[i.opcao1] ?? i.opcao1, HORARIO[i.horario] ?? '', whatsapp(i.whatsapp), VINCULO[i.vinculo] ?? i.vinculo ?? '',
  i.unidade_nome ?? '', i.opcao2 ? (AREA[i.opcao2] ?? i.opcao2) : '', i.indicado_por ?? '', i.igreja ?? '', i.protocolo, quando(i.created_at),
];

const mensagem = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/accessNotConfigured|has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) return 'A API do Google Sheets não está ativada no projeto do Google Cloud. Ative "Google Sheets API" e tente de novo.';
  if (e instanceof ErroGoogle && e.status === 404) return 'A planilha não foi encontrada: foi apagada ou a conta conectada perdeu o acesso.';
  if (e instanceof ErroGoogle && e.status === 403) return 'A conta conectada não pode editar a planilha da coordenação: compartilhe com ela como Editora.';
  return msg.slice(0, 300);
};

const intervalo = (aba: string, r: string) => encodeURIComponent(`'${aba.replace(/'/g, "''")}'!${r}`);

/** A primeira linha livre: a seguinte à última com nome na coluna A (a linha 1 é o cabeçalho). */
async function linhaLivre(tk: string, planilha: string, aba: string): Promise<number> {
  const r = await google(tk, 'GET', `https://sheets.googleapis.com/v4/spreadsheets/${planilha}/values/${intervalo(aba, 'A2:A')}`);
  return 2 + (r?.values?.length ?? 0);
}

/** Escreve na planilha as inscrições que ainda não estão lá. */
async function enviarPendentes(admin: Admin): Promise<{ enviadas: number; pendentes: number; motivo?: string }> {
  const { data: p } = await admin.from('voluntariado_planilha').select('planilha_id, aba').eq('id', 1).maybeSingle();
  if (!p) return { enviadas: 0, pendentes: 0, motivo: 'planilha não configurada' };
  const aba = p.aba || 'Voluntários';
  const g = await token(admin);
  if (!g) return { enviadas: 0, pendentes: 0, motivo: 'Drive não conectado' };

  // A trava: uma chamada por vez procura a linha livre e escreve. A outra sai;
  // quem está com a trava repassa a fila antes de soltar.
  const agora = new Date().toISOString();
  const limite = new Date(Date.now() - 60_000).toISOString();
  const { data: trava } = await admin.from('voluntariado_planilha').update({ escrevendo_em: agora })
    .eq('id', 1).or(`escrevendo_em.is.null,escrevendo_em.lt.${limite}`).select('id');
  if (!trava?.length) return { enviadas: 0, pendentes: -1, motivo: 'outra chamada está escrevendo' };

  let enviadas = 0;
  try {
    for (let rodada = 0; rodada < 5; rodada++) {
      const { data: lista } = await admin.from('voluntarios_natal')
        .select('id, protocolo, nome, whatsapp, vinculo, horario, unidade_nome, indicado_por, igreja, opcao1, opcao2, created_at')
        .is('planilha_em', null).order('created_at').limit(POR_VEZ);
      // deno-lint-ignore no-explicit-any
      const fila = (lista ?? []) as any[];
      if (!fila.length) break;
      const primeira = await linhaLivre(g.token, p.planilha_id, aba);
      await google(g.token, 'PUT',
        `https://sheets.googleapis.com/v4/spreadsheets/${p.planilha_id}/values/${intervalo(aba, `A${primeira}:K${primeira + fila.length - 1}`)}?valueInputOption=RAW`,
        { values: fila.map(linha) });
      await admin.from('voluntarios_natal').update({ planilha_em: new Date().toISOString(), planilha_tentando_em: null }).in('id', fila.map((l) => l.id));
      enviadas += fila.length;
    }
    await admin.from('voluntariado_planilha').update({ erro: null }).eq('id', 1);
  } catch (e) {
    await admin.from('voluntariado_planilha').update({ erro: mensagem(e) }).eq('id', 1);
    throw e;
  } finally {
    await admin.from('voluntariado_planilha').update({ escrevendo_em: null }).eq('id', 1);
  }
  const { count } = await admin.from('voluntarios_natal').select('id', { count: 'exact', head: true }).is('planilha_em', null);
  return { enviadas, pendentes: count ?? 0 };
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
      // Desde 23/10/2026 a planilha é a da coordenação, configurada no banco.
      const { data: ja } = await admin.from('voluntariado_planilha').select('planilha_id').eq('id', 1).maybeSingle();
      if (ja) return json({ link: link(ja.planilha_id), ja_existia: true });
      return json({ error: 'A planilha agora é a da coordenação (Mapeamento Natal Feliz 2026); ela é configurada pelo banco.' }, 400);
    }
    return json(await enviarPendentes(admin));
  } catch (e) {
    return json({ error: mensagem(e) }, e instanceof ErroGoogle ? 400 : 500);
  }
});

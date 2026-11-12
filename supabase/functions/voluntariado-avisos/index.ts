import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { BOAS_VINDAS, TOLERANCIA_MIN, emLotes, ePara, notificacaoDoAviso, whatsappDoFormulario, type Notificacao } from './regras.ts';
import { enviar, novasChaves, type Celular, type Chaves } from './envio.ts';

/**
 * voluntariado-avisos — os avisos no celular da Central do Voluntário
 * (13/11/2026). Web Push: o navegador do celular entrega a notificação mesmo
 * com a Central fechada (no iPhone, só com a Central na Tela de Início).
 *
 * Ações (corpo JSON, sem login; ninguém consegue mandar o que não está na fila):
 *  - chave:       a chave pública (VAPID) para o celular assinar. Na primeira
 *                 vez, cria o par e guarda em voluntariado_avisos_config.
 *  - processar:   manda os avisos que chegaram na hora (o pg_cron chama a cada
 *                 minuto quando há algum; o painel chama no "Enviar agora").
 *                 Aviso que passou da hora há mais de 20 min não vai mais.
 *  - boas_vindas: { whatsapp, endpoint } — a primeira notificação, logo que a
 *                 pessoa liga os avisos, só para o celular dela.
 *
 * Os gestores (voluntariado_gestores, desde 12/11/2026) entram na Central pelo
 * número, sem inscrição, e recebem todos os avisos.
 *
 * O envio de cada notificação está em envio.ts.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function chaves(admin: SupabaseClient): Promise<Chaves> {
  const { data, error } = await admin.from('voluntariado_avisos_config').select('vapid_publica, vapid_privada').eq('id', 1).maybeSingle();
  if (error || !data) throw new Error('A configuração dos avisos não existe no banco (falta rodar a migração).');
  if (data.vapid_publica && data.vapid_privada) return { publica: data.vapid_publica, privada: data.vapid_privada };
  // Primeira vez: cria o par. Se duas chamadas criarem juntas, vale a que gravou primeiro.
  const novo = novasChaves();
  await admin.from('voluntariado_avisos_config').update({ vapid_publica: novo.publica, vapid_privada: novo.privada }).eq('id', 1).is('vapid_publica', null);
  const { data: final } = await admin.from('voluntariado_avisos_config').select('vapid_publica, vapid_privada').eq('id', 1).single();
  return { publica: final!.vapid_publica, privada: final!.vapid_privada };
}

/** Manda para vários celulares e limpa os que não existem mais. */
async function enviarPara(admin: SupabaseClient, celulares: Celular[], n: Notificacao, k: Chaves) {
  const res = await emLotes(celulares, 20, async (c) => ({ c, r: await enviar(c, n, k) }));
  const expirados = res.filter((x) => x.r === 'expirado').map((x) => x.c.id);
  const entregues = res.filter((x) => x.r === 'ok').map((x) => x.c.id);
  if (expirados.length) await admin.from('voluntariado_dispositivos').delete().in('id', expirados);
  if (entregues.length) await admin.from('voluntariado_dispositivos').update({ ultimo_envio: new Date().toISOString() }).in('id', entregues);
  return { entregues: entregues.length, falhas: res.length - entregues.length };
}

async function processar(admin: SupabaseClient) {
  const agora = Date.now();
  // O que passou da hora há muito tempo: marca como pulado, sem mandar.
  await admin.from('voluntariado_avisos').update({ enviado_em: new Date(agora).toISOString(), pulado: true })
    .is('enviado_em', null).lt('enviar_em', new Date(agora - TOLERANCIA_MIN * 60_000).toISOString());
  const { data: fila } = await admin.from('voluntariado_avisos').select('id')
    .is('enviado_em', null).lte('enviar_em', new Date(agora).toISOString()).order('enviar_em');
  if (!fila?.length) return { avisos: 0 };

  const k = await chaves(admin);
  const { data: todos } = await admin.from('voluntariado_dispositivos')
    .select('id, endpoint, p256dh, auth, gestor_id, voluntario:voluntarios_natal(opcao1, horario)');
  const relatorio = [];
  for (const { id } of fila) {
    // Reserva o aviso antes de mandar: duas chamadas juntas não mandam duas vezes.
    const { data: meu } = await admin.from('voluntariado_avisos').update({ enviado_em: new Date().toISOString() })
      .eq('id', id).is('enviado_em', null).select('id, titulo, texto, areas, horarios').maybeSingle();
    if (!meu) continue;
    const para = (todos ?? []).filter((c) => {
      if (c.gestor_id) return true; // o gestor recebe todos
      const v = (Array.isArray(c.voluntario) ? c.voluntario[0] : c.voluntario) as { opcao1: string; horario: string | null } | null;
      return !!v && ePara(meu.areas, meu.horarios, v.opcao1, v.horario);
    }) as Celular[];
    const r = await enviarPara(admin, para, notificacaoDoAviso(meu), k);
    await admin.from('voluntariado_avisos').update(r).eq('id', id);
    relatorio.push({ id, ...r });
  }
  return { avisos: relatorio.length, relatorio };
}

async function boasVindas(admin: SupabaseClient, whatsapp: string, endpoint: string) {
  const tel = whatsappDoFormulario(whatsapp);
  const { data: v } = await admin.from('voluntarios_natal').select('id').eq('whatsapp', tel).maybeSingle();
  const { data: g } = v ? { data: null } : await admin.from('voluntariado_gestores').select('id').eq('whatsapp', tel).maybeSingle();
  if (!v && !g) return json({ error: 'nao_encontrado' }, 404);
  const { data: c } = await admin.from('voluntariado_dispositivos').select('id, endpoint, p256dh, auth')
    .eq(v ? 'voluntario_id' : 'gestor_id', (v ?? g)!.id).eq('endpoint', String(endpoint ?? '').trim()).maybeSingle();
  if (!c) return json({ error: 'celular_nao_encontrado' }, 404);
  const r = await enviarPara(admin, [c as Celular], BOAS_VINDAS, await chaves(admin));
  return json({ ok: r.entregues === 1 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // deno-lint-ignore no-explicit-any
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  try {
    if (corpo.acao === 'chave') return json({ chave: (await chaves(admin)).publica });
    if (corpo.acao === 'processar') return json(await processar(admin));
    if (corpo.acao === 'boas_vindas') return await boasVindas(admin, corpo.whatsapp, corpo.endpoint);
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

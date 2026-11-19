import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { gerarSenha } from './senha.ts';

/**
 * Gera a senha de uma conta da equipe (19/11/2026, PR 2 das senhas).
 *
 * Quem chama: o marketing ou a administração geral, logado (JWT).
 * Para quem: qualquer conta da equipe (com perfil, nem administração geral nem
 * marketing, que trocam a própria senha). Nunca a própria conta.
 *
 * O que faz, nesta ordem: sorteia a senha (padrão FdGhJiuPn); libera a troca
 * no cadeado (PR 1); grava a senha no login; derruba as sessões abertas;
 * registra quem gerou (senhas_geradas e Auditoria). Devolve a senha UMA vez;
 * ela não fica guardada em lugar nenhum.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401);

    const URL_ = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: quem, error: erroQuem } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
    if (erroQuem || !quem?.user) return json({ error: 'Não autorizado.' }, 401);
    const callerId = quem.user.id;

    const admin = createClient(URL_, SERVICE);
    const [{ data: ehAdmin }, { data: ehMkt }] = await Promise.all([
      admin.rpc('is_admin', { _user_id: callerId }),
      admin.rpc('is_marketing_user', { _user_id: callerId }),
    ]);
    if (!ehAdmin && !ehMkt) return json({ error: 'Só o marketing e a administração geral geram senhas.' }, 403);

    let corpo: { userId?: unknown } = {};
    try { corpo = await req.json(); } catch { /* sem corpo */ }
    const userId = typeof corpo.userId === 'string' ? corpo.userId : '';
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Conta inválida.' }, 400);
    if (userId === callerId) return json({ error: 'A sua própria senha você troca pelo "Esqueci a senha".' }, 400);

    const { data: daEquipe, error: erroEquipe } = await admin.rpc('senha_da_equipe', { _uid: userId });
    if (erroEquipe) {
      console.error('[senha-gerar] senha_da_equipe:', erroEquipe.message);
      return json({ error: 'O banco ainda não tem a atualização das senhas. Fale com o marketing.' }, 500);
    }
    if (!daEquipe) return json({ error: 'Esta conta é da administração geral ou do marketing: a pessoa troca a própria senha.' }, 400);

    const { data: perfil } = await admin.from('profiles').select('name, email, unit').eq('user_id', userId).maybeSingle();
    const { data: autor } = await admin.from('profiles').select('name').eq('user_id', callerId).maybeSingle();

    const senha = gerarSenha();

    // As sessões caem ANTES de liberar: quem está logado nesta conta não usa os
    // 2 minutos da liberação para escolher a própria senha (revisão de 19/11).
    const { error: erroSessoes } = await admin.rpc('encerrar_sessoes', { _user_id: userId });
    if (erroSessoes) console.error('[senha-gerar] sessões:', erroSessoes.message);

    const { error: erroLiberar } = await admin.rpc('liberar_troca_de_senha', { _user_id: userId });
    if (erroLiberar) {
      console.error('[senha-gerar] liberar:', erroLiberar.message);
      return json({ error: 'Não consegui liberar a troca no cadeado. Nada foi mudado.' }, 500);
    }
    const { error: erroTroca } = await admin.auth.admin.updateUserById(userId, { password: senha });
    if (erroTroca) {
      await admin.rpc('cancelar_liberacao', { _user_id: userId });
      console.error('[senha-gerar] troca:', erroTroca.message);
      return json({ error: 'Não consegui gravar a senha nova. A senha antiga continua valendo.' }, 500);
    }

    const nomeDoAutor = autor?.name || quem.user.email || 'Painel';
    await admin.from('senhas_geradas').insert({ user_id: userId, gerada_por: callerId, gerada_por_nome: nomeDoAutor, origem: 'painel' });
    await admin.from('audit_logs').insert({
      actor_id: callerId, actor_name: nomeDoAutor, action: 'senha_gerada', entity_type: 'usuario', entity_id: userId,
      unit: perfil?.unit ?? null, details: { conta: perfil?.email ?? null, nome: perfil?.name ?? null, origem: 'painel', sessoes_encerradas: !erroSessoes },
    });
    console.log(`[senha-gerar] ${nomeDoAutor} gerou a senha de ${perfil?.email ?? userId}`);

    return json({ senha, sessoes_encerradas: !erroSessoes });
  } catch (e) {
    console.error('[senha-gerar] erro inesperado:', e);
    return json({ error: 'Erro interno.' }, 500);
  }
});

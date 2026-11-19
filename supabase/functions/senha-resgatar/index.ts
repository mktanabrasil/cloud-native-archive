import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { gerarSenha } from '../senha-gerar/senha.ts';

/**
 * "Gerar minha senha" (19/11/2026, PR 3 das senhas).
 *
 * Público: quem chama é a página /senha-nova, aberta pelo link do e-mail. O
 * link só leva à página; a senha muda quando a pessoa toca no botão de lá (um
 * leitor de e-mail que abre links sozinho não gasta o código).
 *
 * Recebe o código do e-mail; se vale (não usado, menos de 1 hora), marca como
 * usado, gera a senha (padrão FdGhJiuPn), libera no cadeado, troca, derruba as
 * sessões e registra (senhas_geradas com origem 'email', e Auditoria).
 * Devolve a senha e o e-mail da conta, uma vez.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const VENCIDO = 'Este link venceu ou já foi usado. Peça outro em "Esqueceu a senha?", na tela de entrada.';

async function sha256(texto: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return Array.from(d, x => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    let corpo: { token?: unknown } = {};
    try { corpo = await req.json(); } catch { /* sem corpo */ }
    const token = typeof corpo.token === 'string' ? corpo.token.trim() : '';
    if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return json({ error: VENCIDO }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: uso, error: erroUso } = await admin.rpc('usar_pedido_de_senha', { _token_hash: await sha256(token) });
    if (erroUso) {
      console.error('[senha-resgatar] usar_pedido_de_senha:', erroUso.message);
      return json({ error: 'O banco ainda não tem a atualização das senhas. Fale com o marketing.' }, 500);
    }
    const pedido = (uso as { user_id: string; motivo: string }[] | null)?.[0];
    if (!pedido) return json({ error: VENCIDO }, 400);
    const userId = pedido.user_id;

    // Ainda é conta da equipe? (pode ter virado marketing entre o e-mail e o clique)
    const { data: daEquipe } = await admin.rpc('senha_da_equipe', { _uid: userId });
    if (daEquipe !== true) return json({ error: 'Esta conta escolhe a própria senha: use "Esqueceu a senha?" na tela de entrada.' }, 400);

    const senha = gerarSenha();
    // As sessões caem ANTES de liberar: ninguém logado nesta conta usa os 2
    // minutos da liberação para escolher a própria senha (revisão de 19/11).
    const { error: erroSessoes } = await admin.rpc('encerrar_sessoes', { _user_id: userId });
    if (erroSessoes) console.error('[senha-resgatar] sessões:', erroSessoes.message);
    const { error: erroLiberar } = await admin.rpc('liberar_troca_de_senha', { _user_id: userId });
    if (erroLiberar) {
      console.error('[senha-resgatar] liberar:', erroLiberar.message);
      return json({ error: 'Não consegui gerar a senha agora. Peça outro link em "Esqueceu a senha?".' }, 500);
    }
    // Só a senha. Confirmar o e-mail é papel da aprovação do acesso.
    const { error: erroTroca } = await admin.auth.admin.updateUserById(userId, { password: senha });
    if (erroTroca) {
      await admin.rpc('cancelar_liberacao', { _user_id: userId });
      console.error('[senha-resgatar] troca:', erroTroca.message);
      return json({ error: 'Não consegui gerar a senha agora. Peça outro link em "Esqueceu a senha?".' }, 500);
    }
    const { data: perfil } = await admin.from('profiles').select('name, email, unit').eq('user_id', userId).maybeSingle();
    await admin.from('senhas_geradas').insert({ user_id: userId, gerada_por: userId, gerada_por_nome: perfil?.name ?? null, origem: 'email' });
    await admin.from('audit_logs').insert({
      actor_id: userId, actor_name: perfil?.name ?? null, action: 'senha_gerada', entity_type: 'usuario', entity_id: userId,
      unit: perfil?.unit ?? null, details: { conta: perfil?.email ?? null, origem: 'email', motivo: pedido.motivo },
    });
    console.log(`[senha-resgatar] senha gerada pelo e-mail para ${perfil?.email ?? userId}`);
    return json({ senha, email: perfil?.email ?? null });
  } catch (e) {
    console.error('[senha-resgatar] erro inesperado:', e);
    return json({ error: 'Erro interno. Tente de novo em instantes.' }, 500);
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    // Admin client
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify if caller is admin
    const { data: isAdminData, error: roleErr } = await adminClient.rpc('is_admin', { _user_id: callerId });
    if (roleErr || !isAdminData) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem excluir usuários.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'userId inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't allow deleting self
    if (userId === callerId) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir a sua própria conta.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete user from auth
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteErr) {
      console.error('Erro ao excluir usuário:', deleteErr);
      // "Database error deleting user" = outra tabela ainda aponta para a conta (28/09/2026).
      const travada = /database error/i.test(deleteErr.message ?? '');
      const motivo = travada
        ? 'Não foi possível excluir: há registros no banco ligados a esta conta. Fale com o suporte do app.'
        : `Não foi possível excluir o usuário (${deleteErr.message}).`;
      return new Response(JSON.stringify({ error: motivo }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also delete from profiles and user_roles just in case cascading didn't work (though it should)
    await adminClient.from('profiles').delete().eq('user_id', userId);
    await adminClient.from('user_roles').delete().eq('user_id', userId);

    console.log(`[AUDIT] Admin ${callerId} excluiu o usuário ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
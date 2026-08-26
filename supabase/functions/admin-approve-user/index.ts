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

    const body = await req.json();
    const { requestId, userId, role, permissionLevel, unit } = body;

    if (!requestId || !userId || !role) {
      return new Response(JSON.stringify({ error: 'Parâmetros ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Quem pode aprovar. Antes daqui só se exigia estar logado: o `callerId`
    // era calculado e nunca usado, então qualquer conta aprovava qualquer
    // pedido — inclusive um pedido de admin, o que transformava qualquer
    // usuário em administrador geral.
    const { data: isAdminData } = await adminClient.rpc('is_admin', { _user_id: callerId });
    const isAdmin = isAdminData === true;

    if (!isAdmin) {
      const { data: perfil } = await adminClient
        .from('profiles')
        .select('permission_level, is_active')
        .eq('user_id', callerId)
        .maybeSingle();

      const ehGestor = perfil?.is_active !== false && perfil?.permission_level === 'gestor_unidade';
      if (!ehGestor) {
        return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores e gestores podem aprovar acessos.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Escalar para administrador é privilégio de administrador. Sem esta
      // linha, aprovar um pedido de admin seria o caminho mais curto para
      // virar um.
      if (role === 'admin' || permissionLevel === 'admin_geral') {
        return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem conceder acesso de administrador.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 1. Update access request status
    const { error: requestErr } = await adminClient
      .from('access_requests')
      .update({ 
        status: 'approved', 
        reviewed_at: new Date().toISOString(),
        reviewed_by: callerId
      })
      .eq('id', requestId);

    if (requestErr) {
      throw requestErr;
    }

    // 2. Insert or update user role
    const { error: roleErr } = await adminClient
      .from('user_roles')
      .upsert({ user_id: userId, role: role }, { onConflict: 'user_id' });

    if (roleErr) {
      throw roleErr;
    }

    // 2.5 Update profile and ensure it is active
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ 
        is_active: true,
        permission_level: permissionLevel,
        unit: unit,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (profileErr) {
      console.warn('Erro ao ativar perfil:', profileErr);
    }

    // 3. Confirm user email in Auth
    const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (authErr) {
      console.error('Erro ao confirmar email:', authErr);
      // We don't necessarily want to fail the whole operation if email confirmation fails,
      // but in this case it's the main reason for the Edge Function.
    }

    console.log(`[AUDIT] Admin ${callerId} aprovou e ativou usuário ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

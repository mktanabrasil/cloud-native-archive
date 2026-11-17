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

    // Verify caller is admin
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

    // Check if caller is admin/manager
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();

    if (!callerRole || (callerRole.role !== 'admin' && callerRole.role !== 'criador')) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem criar usuários.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { email, password, name, role, unit, bond_type, partner_category } = body;
    // O Painel manda `permission_level` (o nome do campo do formulário); até
    // 17/11/2026 só se lia `permissionLevel`, e o nível escolhido nunca chegava.
    const permissionLevel = body.permissionLevel ?? body.permission_level;

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'Parâmetros ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Conceder administrador é privilégio de administrador (a mesma regra da
    // admin-approve-user). Antes o papel nem chegava a ser gravado (passo 2);
    // agora que chega, a gestão não pode criar um admin.
    if (callerRole.role !== 'admin' && (role === 'admin' || permissionLevel === 'admin_geral')) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem conceder acesso de administrador.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Create user in Auth
    const { data: newAuthUser, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authErr) {
      throw authErr;
    }

    const userId = newAuthUser.user.id;

    // 2. O papel. A handle_new_user já criou a linha (usuario_padrao), e o
    // insert de antes batia na chave única e falhava em silêncio: o papel
    // escolhido nunca era gravado. Upsert, como na admin-approve-user.
    const { error: roleErr } = await adminClient
      .from('user_roles')
      .upsert({ user_id: userId, role: role }, { onConflict: 'user_id' });

    if (roleErr) {
      // Cleanup auth user if role creation fails? 
      // Better to just report error and let admin fix manually
      console.error('Error creating role:', roleErr);
    }

    // 2.5 O pedido de acesso que a conta nova gera sozinha (17/11/2026).
    //
    // A handle_new_user cria um pedido "pendente" para toda conta nova, e o
    // pré-cadastro também passa por ela: cada pessoa cadastrada aqui caía na
    // lista de Solicitações como "viewer, sem unidade", e aprovar esse pedido
    // regravava a unidade como Administração. Quem pré-cadastra já decidiu:
    // o pedido sai resolvido. Vem ANTES do perfil de propósito: o gatilho
    // antigo de aprovação (handle_access_request_approval) mexe no perfil
    // quando o pedido vira "approved", e o passo 3 grava por cima o nível, a
    // unidade e o vínculo escolhidos aqui. Se o passo 3 falhar, o pedido volta
    // a pendente e o Painel mostra o erro.
    const { error: pedidoErr } = await adminClient
      .from('access_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userData.user.id })
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (pedidoErr) {
      console.error('Error resolving access request:', pedidoErr);
    }

    // 3. Update profile (profile is usually created by trigger, but we ensure fields are set)
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ 
        name,
        email,
        is_active: true,
        permission_level: permissionLevel || 'usuario_padrao',
        unit: unit || 'Administração',
        bond_type: bond_type || null,
        partner_category: bond_type === 'parceiro' ? (partner_category || null) : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (profileErr) {
      console.error('Error updating profile:', profileErr);
      // O pedido não pode sumir da lista com o perfil pela metade: volta a
      // pendente, e quem cadastrou fica sabendo.
      await adminClient.from('access_requests')
        .update({ status: 'pending', reviewed_at: null, reviewed_by: null })
        .eq('user_id', userId).eq('status', 'approved');
      return new Response(JSON.stringify({ error: `A conta de ${email} foi criada, mas o perfil não foi salvo (${profileErr.message}). Ajuste a pessoa no Painel; o pedido dela ficou nas Solicitações.` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AUDIT] Admin ${userData.user.id} criou usuário ${userId} (${email})`);

    return new Response(JSON.stringify({ success: true, userId }), {
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

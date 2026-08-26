/**
 * Pré-cadastro de usuário pela tela de Usuários.
 *
 * Recuperada da produção em 26/08/2026 com `supabase functions download`: ela
 * estava publicada e rodando havia meses, mas não existia no repositório —
 * ninguém conseguia revisar o que ela fazia sem baixá-la primeiro.
 *
 * O código veio como estava, sem alteração: ele já confere quem chamou e exige
 * `admin_geral` ou `gestor_unidade`. Fica aqui para que a próxima auditoria
 * encontre o que roda de fato.
 */
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

    // Verify if caller is admin or manager
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('permission_level')
      .eq('user_id', callerId)
      .single();

    if (profileErr || !profile || !['admin_geral', 'gestor_unidade'].includes(profile.permission_level)) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores e gestores podem realizar pré-cadastros.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { email, name, unit, permissionLevel } = body;

    if (!email || !name) {
      return new Response(JSON.stringify({ error: 'E-mail e nome são obrigatórios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Create user in auth.users (no password, random one)
    const randomPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createErr) {
      console.error('Erro ao criar usuário no auth:', createErr);
      return new Response(JSON.stringify({ error: createErr.message || 'Erro ao criar usuário.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user.id;

    // 2. Update profile (profile should be created by trigger, but we need to set details)
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({
        name,
        unit,
        permission_level: permissionLevel,
        status: 'pre-registered',
        is_active: false,
      })
      .eq('user_id', userId);

    if (updateErr) {
      console.error('Erro ao atualizar perfil:', updateErr);
      return new Response(JSON.stringify({ error: 'Usuário criado, mas erro ao configurar perfil.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Set role in user_roles
    let mappedRole: 'admin' | 'editor' | 'criador' | 'viewer' = 'viewer';
    if (permissionLevel === 'admin_geral') mappedRole = 'admin';
    else if (permissionLevel === 'gestor_unidade') mappedRole = 'criador';
    else if (permissionLevel === 'editor') mappedRole = 'editor';

    await adminClient
      .from('user_roles')
      .upsert({ user_id: userId, role: mappedRole });

    console.log(`[AUDIT] Admin/Gestor ${callerId} realizou pré-cadastro para ${email}`);

    return new Response(JSON.stringify({ success: true, userId }), {
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
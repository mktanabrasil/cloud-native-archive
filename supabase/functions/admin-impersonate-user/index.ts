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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Só administrador. A checagem já existiu aqui e foi removida em algum
    // momento; com contas de gestão entrando no app, "qualquer pessoa logada"
    // deixou de ser uma restrição.
    const { data: isAdminData, error: roleErr } = await adminClient.rpc('is_admin', { _user_id: callerId });
    if (roleErr || !isAdminData) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem entrar como outro usuário.' }), {
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

    // Get target user email
    const { data: targetUserData, error: getUserErr } = await adminClient.auth.admin.getUserById(userId);
    if (getUserErr || !targetUserData?.user?.email) {
      return new Response(JSON.stringify({ error: 'Usuário alvo não encontrado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const targetEmail = targetUserData.user.email;

    // Generate magic link
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    });

    if (linkErr || !linkData?.properties) {
      console.error('Erro gerando magic link:', linkErr);
      return new Response(JSON.stringify({ error: 'Não foi possível gerar acesso.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AUDIT] Admin ${callerId} impersonando usuário ${userId} (${targetEmail})`);

    return new Response(
      JSON.stringify({
        success: true,
        email: targetEmail,
        token_hash: linkData.properties.hashed_token,
        action_link: linkData.properties.action_link,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

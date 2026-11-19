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

    // Pedido de Professora (Semanário, 17/11/2026): tudo vem do pedido, nada
    // do navegador. Aprova o admin, a gestão, o marketing ou a orientadora
    // pedagógica do CEI pedido; o resto da função segue igual.
    const { data: pedido } = await adminClient
      .from('access_requests')
      .select('id, user_id, status, requested_bond, requested_unit')
      .eq('id', requestId)
      .maybeSingle();
    // Só pedido que existe, da pessoa informada, e ainda pendente (revisão de
    // 19/11): reaprovar embaralharia a senha de uma conta que já funciona.
    if (!pedido) return responder({ error: 'Pedido não encontrado.' }, 404);
    if (pedido.user_id !== userId) return responder({ error: 'Este pedido é de outra pessoa.' }, 400);
    if (pedido.status !== 'pending') return responder({ error: 'Este pedido já foi resolvido.' }, 409);
    if (pedido?.requested_bond === 'professora') {
      return await aprovarProfessora(pedido as Pedido, callerId, userClient, adminClient, SUPABASE_URL, SUPABASE_ANON_KEY);
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
    const { data: trocado, error: requestErr } = await adminClient
      .from('access_requests')
      .update({ 
        status: 'approved', 
        reviewed_at: new Date().toISOString(),
        reviewed_by: callerId
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id');

    if (requestErr) {
      throw requestErr;
    }
    // Quem chegar primeiro resolve: se outra aprovação passou no meio, nada muda.
    if (!trocado?.length) return responder({ error: 'Este pedido já foi resolvido.' }, 409);

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

    const { avisoEnviado, avisoErro } = await avisarAprovado(adminClient, userId, SUPABASE_URL, SUPABASE_ANON_KEY);
    return responder({ success: true, avisoEnviado, avisoErro });
  } catch (err) {
    console.error('Erro inesperado:', err);
    return responder({ error: (err as Error).message || 'Erro interno.' }, 500);
  }
});

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Aprova um pedido de Professora (17/11/2026). Vínculo, nível e unidade saem
 * do pedido; a conta é a do pedido. A orientadora só aprova pedido pendente
 * do CEI dela.
 */
type Cliente = ReturnType<typeof createClient>;
interface Pedido { id: string; user_id: string; status: string; requested_bond: string | null; requested_unit: string | null }

async function aprovarProfessora(pedido: Pedido, callerId: string, userClient: Cliente, adminClient: Cliente, url: string, anon: string): Promise<Response> {
  const { data: ehAdmin } = await adminClient.rpc('is_admin', { _user_id: callerId });
  const { data: ehMarketing } = ehAdmin ? { data: true } : await adminClient.rpc('is_marketing_user', { _user_id: callerId });
  let pode = ehAdmin === true || ehMarketing === true;
  if (!pode) {
    const { data: perfil } = await adminClient.from('profiles').select('permission_level, is_active').eq('user_id', callerId).maybeSingle();
    pode = perfil?.is_active !== false && perfil?.permission_level === 'gestor_unidade';
  }
  if (!pode) {
    const { data: ehOrientadora } = await userClient.rpc('eh_orientadora_de', { _unidade: pedido.requested_unit });
    if (ehOrientadora !== true) return responder({ error: 'Só a orientadora pedagógica do CEI, o marketing ou a gestão aprovam este pedido.' }, 403);
  }
  // Quem chegar primeiro resolve: pedido já aprovado ou recusado não volta, para ninguém.
  if (pedido.status !== 'pending') return responder({ error: 'Este pedido já foi resolvido.' }, 409);
  if (!pedido.requested_unit) return responder({ error: 'O pedido chegou sem o CEI.' }, 400);

  // A troca de status é a trava: se alguém recusou ou aprovou no meio do caminho, nada muda.
  const { data: trocado, error: e1 } = await adminClient.from('access_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: callerId })
    .eq('id', pedido.id).eq('status', 'pending').select('id');
  if (e1) throw e1;
  if (!trocado?.length) return responder({ error: 'Este pedido já foi resolvido.' }, 409);
  const { error: e2 } = await adminClient.from('user_roles').upsert({ user_id: pedido.user_id, role: 'viewer' }, { onConflict: 'user_id' });
  if (e2) throw e2;
  const { error: e3 } = await adminClient.from('profiles').update({
    is_active: true, permission_level: 'usuario_padrao', bond_type: 'professora', unit: pedido.requested_unit, updated_at: new Date().toISOString(),
  }).eq('user_id', pedido.user_id);
  if (e3) throw e3;
  const { error: e4 } = await adminClient.auth.admin.updateUserById(pedido.user_id, { email_confirm: true });
  if (e4) console.error('Erro ao confirmar email:', e4);
  console.log(`[AUDIT] ${callerId} aprovou a professora ${pedido.user_id} (${pedido.requested_unit})`);

  const { avisoEnviado, avisoErro } = await avisarAprovado(adminClient, pedido.user_id, url, anon);
  return responder({ success: true, avisoEnviado, avisoErro });
}

/** 4. Avisar a pessoa de que o acesso saiu. */
async function avisarAprovado(adminClient: Cliente, userId: string, SUPABASE_URL: string, SUPABASE_ANON_KEY: string): Promise<{ avisoEnviado: boolean; avisoErro: string | null }> {
    // 4. Avisar a pessoa de que o acesso saiu.
    //
    // A conta já existe neste ponto — ela criou a senha ao solicitar —, então
    // não cabe convite: o que se envia é um link de entrada. `shouldCreateUser`
    // fica falso de propósito: se o e-mail não existir mais, é para falhar, não
    // para criar conta nova.
    //
    // O envio usa o remetente configurado no Supabase. O embutido é de
    // desenvolvimento e tem limite baixo por hora; com um SMTP próprio
    // configurado no painel, o limite deixa de existir e o remetente passa a
    // ser o de vocês.
    //
    // Falha aqui NÃO derruba a aprovação: o acesso já foi concedido, e quem
    // aprovou precisa saber que o aviso não saiu para avisar por fora.
    let avisoEnviado = false;
    let avisoErro: string | null = null;

    // Conta da equipe (19/11/2026, PR 3 das senhas): a senha escolhida no
    // pedido deixa de valer, e o aviso é o e-mail "Gerar minha senha" (função
    // senha-pedir). Sem o SQL das senhas, segue o aviso de sempre, abaixo.
    const { data: daEquipe, error: erroEquipe } = await adminClient.rpc('senha_da_equipe', { _uid: userId });
    if (!erroEquipe && daEquipe === true) {
      try {
        const sorteio = crypto.getRandomValues(new Uint8Array(24));
        const descartavel = btoa(String.fromCharCode(...sorteio));
        const { error: erroLiberar } = await adminClient.rpc('liberar_troca_de_senha', { _user_id: userId });
        if (erroLiberar) throw new Error(`liberar: ${erroLiberar.message}`);
        const { error: erroTroca } = await adminClient.auth.admin.updateUserById(userId, { password: descartavel });
        if (erroTroca) {
          await adminClient.rpc('cancelar_liberacao', { _user_id: userId });
          throw new Error(`senha do pedido: ${erroTroca.message}`);
        }
        const { data: perfil } = await adminClient.from('profiles').select('email').eq('user_id', userId).maybeSingle();
        if (!perfil?.email) throw new Error('perfil sem e-mail');
        const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const r = await fetch(`${SUPABASE_URL}/functions/v1/senha-pedir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}`, apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ email: perfil.email, motivo: 'aprovado' }),
        });
        const resposta = await r.json().catch(() => ({})) as { enviado?: boolean; erro?: string };
        if (!r.ok || resposta.enviado !== true) throw new Error(resposta.erro || `senha-pedir respondeu ${r.status}`);
        avisoEnviado = true;
      } catch (e) {
        avisoErro = e instanceof Error ? e.message : String(e);
        console.warn('Aprovado, mas o e-mail "Gerar minha senha" não saiu:', avisoErro);
      }
      return { avisoEnviado, avisoErro };
    }

    try {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const destino = Deno.env.get('APP_URL') ?? 'https://app.anabrasil.org';
      const { data: perfil } = await adminClient
        .from('profiles')
        .select('email')
        .eq('user_id', userId)
        .maybeSingle();

      if (!perfil?.email) throw new Error('perfil sem e-mail');

      const { error: envioErr } = await anonClient.auth.signInWithOtp({
        email: perfil.email,
        options: { shouldCreateUser: false, emailRedirectTo: destino },
      });
      if (envioErr) throw envioErr;
      avisoEnviado = true;
    } catch (e) {
      avisoErro = e instanceof Error ? e.message : String(e);
      console.warn('Aprovado, mas o aviso por e-mail não saiu:', avisoErro);
    }

    return { avisoEnviado, avisoErro };
}

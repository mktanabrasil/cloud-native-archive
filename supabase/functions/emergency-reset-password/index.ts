/**
 * Porta desativada.
 *
 * Esta função trocava a senha de qualquer conta a partir do e-mail, sem provar
 * que quem pediu era o dono: a única checagem era se o e-mail existia em
 * `profiles`. Quem soubesse um e-mail entrava na conta — inclusive nas de
 * administrador. O formulário de login chamava isso quando a pessoa digitava o
 * próprio e-mail no campo de senha.
 *
 * A redefinição legítima continua existindo por outro caminho: o link enviado
 * por e-mail (`resetPassword` no AuthContext), que só chega a quem tem a caixa
 * de entrada.
 *
 * O corpo foi removido em vez de o arquivo ser apagado de propósito: a função
 * publicada não some do Supabase quando o arquivo sai do repositório. Enquanto
 * a versão antiga estiver no ar, a porta segue aberta — é preciso republicar
 * esta ou excluí-la pelo painel.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ error: 'Esta redefinição foi desativada. Use "Esqueceu a senha?" para receber o link por e-mail.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

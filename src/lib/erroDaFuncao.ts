/**
 * A mensagem que a Edge Function mandou, em vez de "Edge Function returned a
 * non-2xx status code" (28/09/2026).
 *
 * Quando a função responde com erro, o supabase-js devolve `data` vazio e o
 * corpo da resposta fica guardado em `error.context` (a Response). A função
 * sempre responde `{ error: "..." }` em português; é essa frase que a pessoa
 * precisa ver, não o código HTTP.
 */
export async function mensagemDaFuncao(error: unknown, data: unknown, padrao: string): Promise<string> {
  const doCorpo = (d: unknown) => (d && typeof d === 'object' && typeof (d as { error?: unknown }).error === 'string' ? (d as { error: string }).error : null);
  const direto = doCorpo(data);
  if (direto) return direto;
  const resposta = (error as { context?: unknown })?.context;
  if (resposta && typeof (resposta as Response).clone === 'function') {
    try {
      const corpo = await (resposta as Response).clone().json();
      const msg = doCorpo(corpo);
      if (msg) return msg;
    } catch { /* corpo sem JSON: fica o padrão */ }
  }
  return padrao;
}

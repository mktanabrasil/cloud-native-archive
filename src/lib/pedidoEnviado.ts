/**
 * Marca que um pedido de acesso acabou de ser enviado nesta aba.
 *
 * Existe por causa de uma sequência que não dá para evitar no cliente: o
 * `signUp` do Supabase devolve **sessão**, e o roteador reage à sessão levando
 * a pessoa para dentro do app — antes de o `signOut` seguinte acontecer. Sem
 * uma marca fora do React, dois efeitos apareciam:
 *
 * 1. o app piscava, logado, para quem ainda não foi aprovado;
 * 2. na volta, o componente remontava e a tela de espera se perdia — a pessoa
 *    caía no formulário de login sem entender o que houve.
 *
 * A marca vive na aba (`sessionStorage`): atravessa a remontagem, some quando
 * ela fecha a página, e não vaza para outras abas nem para outra pessoa no
 * mesmo navegador.
 */
const CHAVE = 'ana_pedido_enviado';

export function pedidoFoiEnviado(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === '1';
  } catch {
    // Aba sem armazenamento (janela privada restrita, política do navegador):
    // a tela de espera não sobrevive à remontagem, e só. Nada quebra.
    return false;
  }
}

export function marcarPedidoEnviado(ligado: boolean): void {
  try {
    if (ligado) sessionStorage.setItem(CHAVE, '1');
    else sessionStorage.removeItem(CHAVE);
  } catch {
    /* mesmo caso acima: seguir sem a marca é aceitável */
  }
}

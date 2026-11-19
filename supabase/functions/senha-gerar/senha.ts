/**
 * A senha no padrão FdGhJiuPn (decisão de 19/11/2026): 9 letras sorteadas,
 * maiúsculas e minúsculas, sem as que se confundem ao ditar (I, l, O). Sem
 * rede nem Deno: os testes do app (vitest) alcançam.
 */
export const LETRAS_DA_SENHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const TAMANHO_DA_SENHA = 9;

/**
 * Sorteia com `crypto.getRandomValues`, descartando os bytes que dariam viés
 * (o alfabeto não divide 256), e exige ao menos uma maiúscula e uma minúscula.
 */
export function gerarSenha(sortear: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const total = LETRAS_DA_SENHA.length;
  const limite = 256 - (256 % total);
  for (;;) {
    let s = '';
    while (s.length < TAMANHO_DA_SENHA) {
      for (const b of sortear(TAMANHO_DA_SENHA * 2)) {
        if (b >= limite) continue;
        s += LETRAS_DA_SENHA[b % total];
        if (s.length === TAMANHO_DA_SENHA) break;
      }
    }
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) return s;
  }
}

export const senhaNoPadrao = (s: string) => new RegExp(`^[${LETRAS_DA_SENHA}]{${TAMANHO_DA_SENHA}}$`).test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s);

/**
 * O número do WhatsApp de quem vota.
 *
 * Guardado só com dígitos, com DDD, sem o 55: é isso que faz "um voto por
 * número" valer mesmo que a pessoa digite com parênteses numa vez e sem na
 * outra. Na tela, mascarado: "(19) •••••-5432".
 */

/** Só dígitos; tira o 55 do Brasil se vier com 12 ou 13 dígitos. */
export function normalizarTelefone(entrada: string): string {
  let d = (entrada ?? '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
}

/** DDD + 8 ou 9 dígitos. */
export const telefoneValido = (entrada: string): boolean => {
  const d = normalizarTelefone(entrada);
  return d.length === 10 || d.length === 11;
};

/** "(19) 99876-5432" enquanto digita. */
export function formatarTelefone(entrada: string): string {
  const d = normalizarTelefone(entrada).slice(0, 11);
  if (d.length <= 2) return d;
  // O hífen só entra quando o número está completo: antes disso a pessoa
  // ainda está digitando e o traço pulando de lugar confunde.
  if (d.length < 10) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "(19) •••••-5432": só o DDD e os quatro últimos. */
export function mascararTelefone(normalizado: string): string {
  const d = normalizarTelefone(normalizado);
  if (d.length < 6) return '•••';
  const fim = d.slice(-4);
  const meio = '•'.repeat(Math.max(0, d.length - 6));
  return `(${d.slice(0, 2)}) ${meio}-${fim}`;
}

/** "•••-5432", para listas apertadas. */
export const fimDoTelefone = (normalizado: string): string => `•••-${normalizarTelefone(normalizado).slice(-4)}`;

export const pinValido = (pin: string): boolean => /^\d{4}$/.test(pin);

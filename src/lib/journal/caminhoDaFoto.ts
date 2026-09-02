/**
 * Onde as fotos do Jornal moram no balde.
 *
 * Existe porque a convenção estava escrita em dois lugares — o envio manual do
 * painel e o envio em lote da importação — e as duas cópias precisam concordar.
 * Foi assim que as fotos do Jornal acabaram misturadas com as do Informativo:
 * o prefixo era `news/` nos dois, e quando o Informativo saiu do ar não deu
 * para varrer um sem levar o outro.
 *
 * As fotos antigas continuam em `news/` e seguem funcionando — o endereço fica
 * gravado na página, ninguém reescreve. Isto vale só para as novas.
 */
const PREFIXO = 'jornal';

/** `jornal/ano/mês/uuid.ext`. A extensão vem sem ponto. */
export function caminhoDaFoto(extensao: string, agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${PREFIXO}/${ano}/${mes}/${crypto.randomUUID()}.${extensao}`;
}

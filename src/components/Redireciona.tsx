import { Navigate, useLocation } from 'react-router-dom';
import { ABAS_DO_MARKETING, ABA_INICIAL_DO_MARKETING, rotaDoMarketing } from '@/config/navigation';

/** Junta a busca do destino com a do link (a do link vence). */
function juntarBusca(destino: string, doLink: string): string {
  const busca = new URLSearchParams(destino);
  new URLSearchParams(doLink).forEach((valor, chave) => busca.set(chave, valor));
  const texto = busca.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Endereço de antes (16/11/2026): leva ao novo, com o resto do link junto. O
 * `#` vai inteiro: é nele que o e-mail de confirmação do Calendário Anual
 * traz a sessão.
 */
export function Redireciona({ para }: { para: string }) {
  const location = useLocation();
  const [caminho, buscaDoDestino = ''] = para.split('?');
  return <Navigate to={{ pathname: caminho, search: juntarBusca(buscaDoDestino, location.search), hash: location.hash }} replace />;
}

/** `/marketing` (e o `/marketing?aba=pizza` de antes): a aba vira o endereço. */
export function MarketingSemAba() {
  const location = useLocation();
  const busca = new URLSearchParams(location.search);
  const pedida = busca.get('aba');
  busca.delete('aba');
  const aba = ABAS_DO_MARKETING.find((a) => a === pedida) ?? ABA_INICIAL_DO_MARKETING;
  return <Navigate to={{ pathname: rotaDoMarketing(aba), search: juntarBusca('', busca.toString()), hash: location.hash }} replace />;
}

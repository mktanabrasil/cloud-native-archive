import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import type { MeusPedidos, PedidoPago } from '@/lib/pizza/api';
import { salvarComprovante, type DadosDoComprovante } from '@/lib/pizza/comprovante';
import { RETIRADA, RETIRADA_COMPLETA, SABORES, dataEHora, formaDoMercadoPago, reais, resumoDosSabores } from '@/lib/pizza/modelo';
import { QrDaRetirada } from './QrDaRetirada';

/**
 * "Seus pedidos" (10/11/2026, mockup aprovado:
 * https://claude.ai/artifact/9SBAvUhduZ9fr21iGGJUuq). Abre no formulário
 * quando nome e WhatsApp batem com pedidos já feitos: os pagos, com o QR Code
 * e o comprovante de novo (já no formato do celular), e os que ficaram sem
 * pagar, com "Pagar este pedido". "Fazer outro pedido" fecha e o formulário
 * segue, já preenchido.
 */

const COR = { fundo: '#FFFBF5', tinta: '#2B1A14', mut: '#7A6359', linha: '#EADBC8', vermelho: '#D8463A', vermelhoEsc: '#A9322A', marrom: '#6B2E1C', creme: '#F4E7D2', verde: '#2E8B57' };

const itens = (s: Record<string, number>) =>
  SABORES.filter(([k]) => (s[k] ?? 0) > 0).map(([k, r]) => ({ sabor: r as string, qtd: s[k] }));

/** Os dados do comprovante a partir de um pedido pago. */
export function comprovanteDoPedido(p: PedidoPago): DadosDoComprovante {
  return {
    numero: p.numero, nome: p.nome, unidade: p.unidade_nome, itens: itens(p.sabores),
    preco: p.quantidade ? p.total / p.quantidade : 55, total: p.total,
    forma: formaDoMercadoPago(p.mp_forma, p.mp_bandeira), pagoEm: dataEHora(p.pago_em), codigo: p.codigo ?? '', retirada: RETIRADA,
  };
}

export function SeusPedidos({ dados, nome, aoOutroPedido, aoPagar, pagando }: {
  dados: MeusPedidos;
  nome: string;
  aoOutroPedido: () => void;
  aoPagar: (pedido: string) => void;
  pagando: string | null;
}) {
  const [vendo, setVendo] = useState<PedidoPago | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fechar = useRef(aoOutroPedido);
  fechar.current = aoOutroPedido;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar.current(); };
    window.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, []);

  async function baixar(p: PedidoPago) {
    setBaixando(true); setErro(null);
    try { await salvarComprovante(comprovanteDoPedido(p)); }
    catch { setErro('Não deu para gerar o comprovante. Tente de novo.'); }
    finally { setBaixando(false); }
  }

  const primeiro = nome.trim().split(/\s+/)[0] ?? '';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(43, 26, 20, 0.55)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="seus-pedidos-titulo"
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col gap-3.5 overflow-y-auto rounded-t-[24px] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:rounded-[24px]"
        style={{ background: COR.fundo, color: COR.tinta }} data-testid="seus-pedidos">
        {vendo ? (
          <>
            <h2 id="seus-pedidos-titulo" className="text-lg font-bold">Seu comprovante</h2>
            <div className="flex flex-col items-center gap-2.5">
              <div className="rounded-[22px] border-[1.5px] bg-white p-3" style={{ borderColor: COR.linha }}><QrDaRetirada numero={vendo.numero} lado={250} /></div>
              <b className="text-2xl font-extrabold tracking-wide" style={{ color: COR.vermelhoEsc }}>{vendo.numero}</b>
              <div className="w-full rounded-2xl px-4 py-2.5 text-center" style={{ background: COR.marrom, color: COR.creme }}>
                <b className="block text-[15px]">Mostre este QR Code na retirada</b>
                <span className="text-[13px] opacity-90">{RETIRADA_COMPLETA}</span>
              </div>
            </div>
            {erro && <p role="alert" className="rounded-xl px-3 py-2.5 text-sm font-medium" style={{ background: '#FDE7E2', color: '#8A2418' }}>{erro}</p>}
            <button type="button" onClick={() => baixar(vendo)} disabled={baixando} className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white disabled:opacity-60" style={{ background: COR.verde }}>
              <Download className="h-5 w-5" /> {baixando ? 'Gerando…' : 'Baixar comprovante'}
            </button>
            <button type="button" onClick={() => { setVendo(null); setErro(null); }} className="h-12 rounded-2xl border-[1.5px] bg-white text-[15px] font-bold" style={{ borderColor: COR.linha }}>Voltar aos meus pedidos</button>
          </>
        ) : (
          <>
            <h2 id="seus-pedidos-titulo" className="text-lg font-bold">Você já tem pedidos{primeiro ? `, ${primeiro}` : ''}</h2>
            <ul className="flex flex-col gap-2.5">
              {dados.pagos.map((p) => (
                <li key={p.numero} className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] bg-white p-3.5 text-sm" style={{ borderColor: COR.linha }} data-testid="pedido-pago">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-base" style={{ color: COR.vermelhoEsc }}>{p.numero}</b>
                    <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: '#E3F2E9', color: '#1E6B41' }}>{p.retirada ? 'Retirado' : 'Pago'}</span>
                  </div>
                  <span>{resumoDosSabores(p.sabores).replace(/ · /g, ', ')} · {reais(p.total)}</span>
                  <span style={{ color: COR.mut }}>{formaDoMercadoPago(p.mp_forma, p.mp_bandeira)} · {dataEHora(p.pago_em)}{p.retirada ? '' : ' · a retirar em 17/12'}</span>
                  <button type="button" onClick={() => setVendo(p)} className="mt-1 h-11 rounded-xl text-[14px] font-bold text-white" style={{ background: COR.verde }}>Ver QR Code e baixar comprovante</button>
                </li>
              ))}
              {dados.pendentes.map((p) => (
                <li key={p.pedido} className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] bg-white p-3.5 text-sm" style={{ borderColor: COR.linha }} data-testid="pedido-sem-pagar">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-base">Pedido de {dataEHora(p.criado_em).slice(0, 5)}</b>
                    <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: '#FFF1BF', color: '#7A5A00' }}>Pagamento não concluído</span>
                  </div>
                  <span>{resumoDosSabores(p.sabores).replace(/ · /g, ', ')} · {reais(p.total)}</span>
                  <button type="button" onClick={() => aoPagar(p.pedido)} disabled={!!pagando} className="mt-1 h-11 rounded-xl border-2 bg-white text-[14px] font-bold disabled:opacity-60" style={{ borderColor: COR.linha }}>
                    {pagando === p.pedido ? 'Abrindo o pagamento…' : 'Pagar este pedido'}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={aoOutroPedido} className="h-14 rounded-2xl text-base font-bold text-white" style={{ background: COR.vermelho }}>Fazer outro pedido</button>
          </>
        )}
      </div>
    </div>
  );
}

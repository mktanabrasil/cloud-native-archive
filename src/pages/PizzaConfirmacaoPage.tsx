import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Check, Clock, FileUp, Minus, Plus, X } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { enviarConfirmacao, pagarDeNovo, pagarOnline, pedirCopiaParaODrive, situacaoDoPedido, type SituacaoOnline } from '@/lib/pizza/api';
import {
  FORMAS, FORMAS_NA_UNIDADE, RETIRADA, ROTULO_DA_AREA, SABORES, UNIDADES_POR_AREA, comprovanteObrigatorio, encerrado, mensagemDoErro,
  pagarOnlineLigado, problemaDoArquivo, problemaDoEnvio, reais, resumoDosSabores, totalDePizzas, unidadeDaPizza, valor,
  type Forma, type Quantidades, type Sabor,
} from '@/lib/pizza/modelo';

/**
 * /pizza-da-alegria — confirmação de pagamento da Pizza da Alegria (mockup
 * aprovado em 07/10/2026). Link público, como o da enquete, só para controle:
 * quem JÁ PAGOU na unidade confirma o nome, a unidade em que trabalha, os
 * sabores, a forma de pagamento e anexa o comprovante.
 *
 * Desde 09/11/2026, com `pagarOnlineLigado()`, não há mais pagamento na
 * unidade: a pessoa pede aqui e paga pelo Mercado Pago (Checkout Pro, Pix ou
 * cartão), sem comprovante. A volta do Mercado Pago chega em
 * /pizza-da-alegria?pedido=<id>, e a página espera a aprovação para mostrar o
 * número. Desligado, fica a confirmação com comprovante, como antes.
 *
 * Cores fixas da arte da campanha (vermelho, creme, amarelo), nos dois temas:
 * a página é uma peça da campanha, não uma tela do app.
 */

const COR = { vermelho: '#D8463A', vermelhoEsc: '#A9322A', creme: '#F4E7D2', fundo: '#FFFBF5', tinta: '#2B1A14', mut: '#7A6359', linha: '#EADBC8', marrom: '#6B2E1C', amarelo: '#FBCE00', verde: '#2E8B57' };

function Secao({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: COR.vermelhoEsc }}>{n} · {titulo}</h2>
      {children}
    </section>
  );
}

const campo = 'h-12 w-full rounded-xl border-2 bg-white px-3 text-base text-[#2B1A14] outline-none focus:border-[#D8463A]';

type Feito = { numero: string; resumo: string; total: number; forma: string; unidade: string };

/** Volta do Mercado Pago: pergunta a situação até aprovar (Pix pode levar alguns minutos). */
function VoltaDoPagamento({ pedido, aoAprovar, aoVoltar }: { pedido: string; aoAprovar: (f: Feito) => void; aoVoltar: () => void }) {
  const [s, setS] = useState<SituacaoOnline | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);
  const [rodada, setRodada] = useState(0);
  const aprovar = useRef(aoAprovar);
  aprovar.current = aoAprovar;

  useEffect(() => {
    let vivo = true;
    let vezes = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    async function olhar() {
      try {
        const r = await situacaoDoPedido(pedido);
        if (!vivo) return;
        setS(r); setErro(null);
        if (r.status === 'aprovado' && r.numero) {
          pedirCopiaParaODrive();
          aprovar.current({ numero: r.numero, resumo: resumoDosSabores(r.sabores), total: r.total, forma: 'Mercado Pago', unidade: r.unidade });
          return;
        }
        // Pendente: olha de novo a cada 5 s, por uns 5 minutos.
        if (r.status === 'pendente' && ++vezes < 60) espera = setTimeout(olhar, 5000);
      } catch (e) {
        if (vivo) setErro(mensagemDoErro(e));
      }
    }
    olhar();
    return () => { vivo = false; clearTimeout(espera); };
  }, [pedido, rodada]);

  async function tentarDeNovo() {
    setTentando(true); setErro(null);
    try { window.location.assign((await pagarDeNovo(pedido)).link); }
    catch (e) { setErro(mensagemDoErro(e)); setTentando(false); }
  }

  const recusado = s?.status === 'recusado' || s?.status === 'cancelado';
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-10 text-center" data-testid="volta">
      {!s && !erro && <p style={{ color: COR.mut }}>Conferindo o pagamento…</p>}
      {s?.status === 'pendente' && (
        <>
          <span className="grid h-16 w-16 place-items-center rounded-[20px]" style={{ background: COR.amarelo, color: '#4A2A10' }}><Clock className="h-9 w-9" /></span>
          <h1 className="text-xl font-bold">Aguardando a confirmação do pagamento</h1>
          <p className="text-sm" style={{ color: COR.mut }}>Se você pagou com Pix, a confirmação pode levar alguns minutos. Deixe esta página aberta. O seu número aparece aqui assim que o Mercado Pago confirmar.</p>
          <button type="button" onClick={() => setRodada((n) => n + 1)} className="h-12 rounded-xl border-[1.5px] bg-white px-5 font-bold" style={{ borderColor: COR.linha }}>Conferir de novo</button>
          <button type="button" onClick={tentarDeNovo} disabled={tentando} className="text-sm font-semibold underline" style={{ color: COR.vermelhoEsc }}>Ainda não paguei: abrir o pagamento</button>
        </>
      )}
      {recusado && (
        <>
          <h1 className="text-xl font-bold">O pagamento não foi concluído</h1>
          <p className="text-sm" style={{ color: COR.mut }}>{s?.status === 'cancelado' ? 'O prazo para pagar este pedido acabou.' : 'O Mercado Pago recusou o pagamento.'} Nada foi cobrado. Você pode tentar de novo, com Pix ou outro cartão.</p>
          <button type="button" onClick={tentarDeNovo} disabled={tentando} className="h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-60" style={{ background: COR.vermelho }}>{tentando ? 'Abrindo…' : `Tentar de novo · ${reais(s?.total ?? 0)}`}</button>
        </>
      )}
      {s?.status === 'estornado' && <h1 className="text-xl font-bold">Este pagamento foi devolvido.</h1>}
      {erro && <p role="alert" className="rounded-xl px-3 py-2.5 text-sm font-medium" style={{ background: '#FDE7E2', color: '#8A2418' }}>{erro}</p>}
      <button type="button" onClick={aoVoltar} className="text-sm font-semibold underline" style={{ color: COR.mut }}>Fazer outro pedido</button>
    </div>
  );
}

export default function PizzaConfirmacaoPage() {
  const online = pagarOnlineLigado();
  useTituloDaAba(online ? 'Pizza da Alegria · Pedir e pagar' : 'Pizza da Alegria · Confirmar pagamento');
  const [params, setParams] = useSearchParams();
  const pedidoDeVolta = params.get('pedido');
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState<string>('');
  const [qtd, setQtd] = useState<Quantidades>({});
  // Ligado, só se paga pelo Mercado Pago (sem pagamento na unidade, decisão de 09/11/2026).
  // Desligado, fica a confirmação de quem pagou na unidade, como antes.
  const [forma, setForma] = useState<Forma | null>(online ? 'mercado_pago' : null);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<Feito | null>(null);
  const foto = useRef<HTMLInputElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const pizzas = totalDePizzas(qtd);
  const u = unidadeDaPizza(unidade);
  const fechado = encerrado();

  const mudar = (s: Sabor, d: number) => { setQtd((q) => ({ ...q, [s]: Math.max(0, Math.min(50, (q[s] ?? 0) + d)) })); setErro(null); };

  function anexar(lista: FileList | null) {
    const f = lista?.[0];
    if (foto.current) foto.current.value = '';
    if (arquivo.current) arquivo.current.value = '';
    if (!f) return;
    const p = problemaDoArquivo(f);
    if (p) { setErro(p); return; }
    setComprovante(f); setErro(null);
  }

  async function enviar() {
    const p = problemaDoEnvio({ nome, unidade: unidade || null, quantidades: qtd, forma, comprovante });
    if (p) { setErro(p); return; }
    setEnviando(true); setErro(null);
    if (forma === 'mercado_pago') {
      try {
        const { link } = await pagarOnline({ nome, unidadeId: unidade, quantidades: qtd });
        window.location.assign(link); // segue "enviando" até a página do Mercado Pago abrir
      } catch (e) {
        setErro(mensagemDoErro(e)); setEnviando(false);
      }
      return;
    }
    try {
      const numero = await enviarConfirmacao({ nome, unidadeId: unidade, quantidades: qtd, forma: forma!, comprovante });
      pedirCopiaParaODrive();
      setFeito({ numero, resumo: resumoDosSabores(qtd as Record<string, number>), total: valor(pizzas), forma: FORMAS.find(([k]) => k === forma)?.[1] ?? '', unidade: u?.name ?? '' });
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: COR.fundo, color: COR.tinta }}>
      <div className="mx-auto w-full max-w-[560px] flex-1">
        <img src="/pizza-da-alegria-faixa.webp" alt="Pizza da Alegria, ANA Brasil" className="block aspect-[1793/877] w-full object-cover" />
        <div className="flex flex-col gap-0.5 px-5 py-3.5 text-white" style={{ background: COR.vermelho }}>
          <b className="text-sm uppercase tracking-[0.06em]">{feito ? 'Pizza da Alegria' : online ? 'Pedir e pagar' : 'Confirmar pagamento'}</b>
          <span className="text-[13px] opacity-90">{feito ? 'Obrigado por participar!' : online ? 'Peça e pague aqui, com Pix ou cartão · até 30/11 · retirada 04/12' : 'Já pagou na unidade? Confirme aqui · até 30/11 · retirada 04/12'}</span>
        </div>

        {!feito && pedidoDeVolta ? (
          <VoltaDoPagamento pedido={pedidoDeVolta} aoAprovar={(f) => { setFeito(f); window.scrollTo?.({ top: 0 }); }} aoVoltar={() => setParams({}, { replace: true })} />
        ) : feito ? (
          <div className="flex flex-col gap-5 px-5 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-[20px] text-white" style={{ background: COR.verde }}><Check className="h-9 w-9" strokeWidth={2.6} /></span>
              <h1 className="text-xl font-bold">Confirmação enviada</h1>
              <b className="text-3xl font-extrabold tracking-wide" style={{ color: COR.vermelhoEsc }} data-testid="numero">{feito.numero}</b>
              <span className="text-sm" style={{ color: COR.mut }}>Tire um print desta tela.</span>
            </div>
            <dl className="grid gap-2 rounded-2xl border-[1.5px] bg-white p-4 text-sm" style={{ borderColor: COR.linha }}>
              {[['Unidade', feito.unidade], ['Pizzas', feito.resumo], ['Total', `${reais(feito.total)} · ${feito.forma}`], ['Retirada', `${RETIRADA}, na unidade`]].map(([r, v]) => (
                <div key={r} className="flex justify-between gap-3"><dt style={{ color: COR.mut }}>{r}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
          </div>
        ) : fechado ? (
          <div className="flex flex-col gap-3 px-5 py-10 text-center">
            <h1 className="text-xl font-bold">As confirmações foram encerradas em 30/11.</h1>
            <p style={{ color: COR.mut }}>A retirada é na sua unidade, na {RETIRADA}.</p>
          </div>
        ) : (
          <form className="flex flex-col gap-7 px-5 py-6" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate aria-label="Confirmar pagamento">
            <Secao n={1} titulo="Quem é você">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Nome completo
                <input className={campo} style={{ borderColor: COR.linha }} autoComplete="name" maxLength={120} value={nome} onChange={(e) => { setNome(e.target.value); setErro(null); }} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Unidade em que você trabalha
                <select className={campo} style={{ borderColor: COR.linha }} value={unidade} onChange={(e) => { setUnidade(e.target.value); setErro(null); }}>
                  <option value="">Escolha a unidade</option>
                  {UNIDADES_POR_AREA.map(({ area, unidades }) => (
                    <optgroup key={area} label={ROTULO_DA_AREA[area]}>
                      {unidades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              {u && (
                <div className="flex flex-col gap-1 rounded-2xl p-4" style={{ background: COR.marrom, color: COR.creme }} data-testid="retirada">
                  <small className="text-[10.5px] uppercase tracking-[0.1em] opacity-80">Retirada</small>
                  <b className="text-lg leading-tight">Na sua unidade: {u.name}</b>
                  <span className="text-[13px] opacity-90">{RETIRADA[0].toUpperCase() + RETIRADA.slice(1)}</span>
                </div>
              )}
            </Secao>

            <Secao n={2} titulo="Confirme os sabores de cada pizza">
              <ul className="flex flex-col gap-2">
                {SABORES.map(([k, rotulo]) => (
                  <li key={k} className="flex items-center gap-3 rounded-xl border-[1.5px] bg-white px-3 py-2" style={{ borderColor: COR.linha }}>
                    <span className="flex-1 text-[15px] font-medium">{rotulo}</span>
                    <button type="button" aria-label={`Menos ${rotulo}`} onClick={() => mudar(k, -1)} className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: COR.creme, color: COR.marrom }}><Minus className="h-4 w-4" /></button>
                    <b className="w-6 text-center tabular-nums" aria-label={`${rotulo}: ${qtd[k] ?? 0}`}>{qtd[k] ?? 0}</b>
                    <button type="button" aria-label={`Mais ${rotulo}`} onClick={() => mudar(k, 1)} className="grid h-9 w-9 place-items-center rounded-[10px] text-white" style={{ background: COR.vermelho }}><Plus className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 font-bold" style={{ background: COR.amarelo, color: '#4A2A10' }} aria-live="polite">
                <span>{pizzas} {pizzas === 1 ? 'pizza' : 'pizzas'}</span><b className="text-2xl tabular-nums" data-testid="total">{reais(valor(pizzas))}</b>
              </div>
            </Secao>

            {online ? (
              <Secao n={3} titulo="Pagamento">
                <p className="rounded-2xl border-[1.5px] bg-white px-4 py-3 text-[13px]" style={{ borderColor: COR.linha, color: COR.mut }} data-testid="como-pagar">
                  <b className="block text-[15px]" style={{ color: COR.tinta }}>Pix ou cartão, pelo Mercado Pago</b>
                  Ao tocar no botão, abre a página de pagamento do Mercado Pago. Depois de pagar, você volta para cá e recebe o número da confirmação.
                </p>
              </Secao>
            ) : (
              <Secao n={3} titulo="Como você pagou">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de pagamento">
                  {FORMAS_NA_UNIDADE.map(([k, rotulo]) => (
                    <button key={k} type="button" role="radio" aria-checked={forma === k} onClick={() => { setForma(k); setErro(null); }}
                      className="rounded-full border-[1.5px] px-4 py-2.5 text-sm font-semibold"
                      style={forma === k ? { background: COR.tinta, color: '#fff', borderColor: COR.tinta } : { background: '#fff', borderColor: COR.linha }}>
                      {rotulo}
                    </button>
                  ))}
                </div>
              </Secao>
            )}

            {!online && <Secao n={4} titulo={`Comprovante${forma && !comprovanteObrigatorio(forma) ? ' (opcional)' : ''}`}>
              <input ref={foto} type="file" accept="image/*" capture="environment" className="hidden" data-testid="foto" onChange={(e) => anexar(e.target.files)} />
              <input ref={arquivo} type="file" accept="image/*,application/pdf,.pdf" className="hidden" data-testid="arquivo" onChange={(e) => anexar(e.target.files)} />
              {comprovante ? (
                <div className="flex items-center gap-3 rounded-xl border-[1.5px] bg-white p-3" style={{ borderColor: COR.linha }}>
                  <span className="grid h-12 w-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold" style={{ background: COR.creme, color: COR.marrom }}>{/pdf$/i.test(comprovante.name) ? 'PDF' : 'FOTO'}</span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm">{comprovante.name}</b><span className="text-xs" style={{ color: COR.mut }}>Anexado</span></span>
                  <button type="button" aria-label="Tirar o comprovante" onClick={() => setComprovante(null)} className="grid h-9 w-9 place-items-center rounded-lg" style={{ color: COR.mut }}><X className="h-5 w-5" /></button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl p-4 text-center" style={{ background: COR.creme }}>
                  <button type="button" onClick={() => foto.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white" style={{ background: COR.tinta }}><Camera className="h-5 w-5" /> Tirar foto</button>
                  <button type="button" onClick={() => arquivo.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold"><FileUp className="h-5 w-5" /> Escolher arquivo</button>
                  <small className="text-xs" style={{ color: COR.mut }}>Comprovante do Pix ou o papel da maquininha · foto ou PDF{forma === 'dinheiro' ? ' · no dinheiro, opcional' : ''}</small>
                </div>
              )}
            </Secao>}

            {erro && <p role="alert" className="rounded-xl px-3 py-2.5 text-sm font-medium" style={{ background: '#FDE7E2', color: '#8A2418' }}>{erro}</p>}

            <button type="submit" disabled={enviando} className="h-14 rounded-2xl text-base font-bold text-white disabled:opacity-60" style={{ background: COR.vermelho }}>
              {forma === 'mercado_pago'
                ? (enviando ? 'Abrindo o Mercado Pago…' : `Pagar ${reais(valor(pizzas))} pelo Mercado Pago`)
                : (enviando ? 'Enviando…' : 'Enviar confirmação')}
            </button>
          </form>
        )}
      </div>
      <InstitutionalFooterBar className="ana-fio" />
    </div>
  );
}

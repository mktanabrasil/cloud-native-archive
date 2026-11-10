import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Lock, ScanLine, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { listarConfirmacoes, pedirCopiaParaODrive, type Confirmacao } from '@/lib/pizza/api';
import { RETIRADA_LOCAL, resumoDosSabores } from '@/lib/pizza/modelo';
import { desfazerRetirada, numeroLido, registrarRetirada, semAcento, type PedidoNaRetirada, type ResultadoDaRetirada } from '@/lib/pizza/retirada';

/**
 * /pizza-da-alegria/retirada — a retirada com leitor (mockup aprovado em
 * 10/11/2026: https://claude.ai/artifact/41wgaj3mM5yXTcrXmwSMwB).
 *
 * No notebook com o leitor USB: o campo fica sempre pronto, o leitor "digita"
 * o endereço do QR Code e aperta Enter, e a baixa sai na hora, com um bipe
 * diferente para "já retirado" e "não encontrado". Sem leitor, digita-se o
 * número ou procura-se pelo nome (quem pagou na unidade não tem QR Code).
 * Pela câmera do celular, o QR Code abre esta página com ?n=PZ-XXXXX e ela
 * pede um toque para confirmar (um link aberto por engano não dá baixa).
 *
 * Fica fora da moldura do app: tela cheia, só o que importa no dia.
 */

const COR = {
  fundo: '#FFFBF5', cartao: '#FFFFFF', tinta: '#2B1A14', mut: '#7A6359', linha: '#EADBC8', grade: '#F1E6D6',
  vermelho: '#D8463A', vermelhoEsc: '#A9322A', creme: '#F4E7D2', marrom: '#6B2E1C', teal: '#1F9E89',
};
const ESTADO = {
  registrada: { bg: '#E3F2E9', tx: '#1E6B41' },
  ja_retirada: { bg: '#FFF1BF', tx: '#7A5A00' },
  nao_encontrado: { bg: '#FBE3E0', tx: '#A9322A' },
};
const ATUALIZA_A_CADA_MS = 30_000;
/** A planilha do Drive acompanha, sem uma escrita por bipe: espera 4 s de calma. */
const PLANILHA_DEPOIS_MS = 4_000;

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '');
const dataEHora = (iso: string | null) => (iso ? `${new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })} às ${hora(iso)}` : '');

/** Um bipe por resultado: agudo e curto quando deu certo; dois graves quando não. */
function bipe(tipo: ResultadoDaRetirada['status'] | 'erro') {
  try {
    const W = window as unknown as { __bipe?: AudioContext; AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (W.__bipe ??= new Ctx());
    const tons: Array<[number, number, number]> = tipo === 'registrada' ? [[1320, 0, 0.12]] : tipo === 'ja_retirada' ? [[520, 0, 0.14], [520, 0.2, 0.14]] : [[220, 0, 0.35]];
    for (const [freq, inicio, dur] of tons) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = tipo === 'registrada' ? 'sine' : 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, ctx.currentTime + inicio);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + dur);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + inicio); o.stop(ctx.currentTime + inicio + dur + 0.02);
    }
  } catch { /* sem som, segue */ }
}

function Resultado({ r }: { r: ResultadoDaRetirada | 'erro' }) {
  if (r === 'erro') {
    return (
      <div className="flex flex-col gap-1.5 rounded-2xl p-5" style={{ background: ESTADO.nao_encontrado.bg, color: ESTADO.nao_encontrado.tx }} role="status" data-testid="resultado">
        <span className="flex items-center gap-2 text-2xl font-extrabold"><AlertTriangle className="h-7 w-7" /> Não deu para registrar</span>
        <span className="text-[15px]" style={{ color: COR.tinta }}>Confira a internet e leia o QR Code de novo.</span>
      </div>
    );
  }
  const c = ESTADO[r.status];
  const p: PedidoNaRetirada | null = r.status === 'nao_encontrado' ? null : r.pedido;
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl p-5" style={{ background: c.bg, color: c.tx }} role="status" data-testid="resultado" data-estado={r.status}>
      <span className="flex items-center gap-2 text-2xl font-extrabold sm:text-[28px]">
        {r.status === 'registrada' && <><Check className="h-8 w-8" strokeWidth={3} /> Retirada registrada</>}
        {r.status === 'ja_retirada' && <><AlertTriangle className="h-8 w-8" /> Já foi retirado</>}
        {r.status === 'nao_encontrado' && <><X className="h-8 w-8" strokeWidth={3} /> Pedido não encontrado</>}
      </span>
      {p && (
        <span className="text-[16px]" style={{ color: COR.tinta }}>
          <b>{p.numero}</b> · {p.nome} · {p.unidade_nome}
        </span>
      )}
      {r.status === 'registrada' && <span className="text-[18px]" style={{ color: COR.tinta }}>Entregar: <b>{resumoDosSabores(p!.sabores).replace(/ · /g, ', ')}</b></span>}
      {r.status === 'ja_retirada' && (
        <span className="text-[15px]" style={{ color: COR.tinta }}>
          Retirado em {dataEHora(p!.retirada_em)}{p!.retirada_por ? `, registrado por ${p!.retirada_por}` : ''}. <b>Não entregue de novo.</b>
        </span>
      )}
      {r.status === 'nao_encontrado' && <span className="text-[15px]" style={{ color: COR.tinta }}>O código lido não é de um pedido da Pizza. Confira o número no comprovante ou procure pelo nome.</span>}
    </div>
  );
}

export default function PizzaRetiradaPage() {
  useTituloDaAba('Pizza da Alegria · Retirada');
  const { isAuthenticated, loading: carregandoLogin } = useAuth();
  const { isMarketing, bondType, isActive, loading: carregandoPapel } = useUserRole();
  const pode = isMarketing || (bondType === 'financeiro' && isActive);
  const [params, setParams] = useSearchParams();
  const doLink = numeroLido(params.get('n') ?? '');

  const [lista, setLista] = useState<Confirmacao[] | null>(null);
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<ResultadoDaRetirada | 'erro' | null>(null);
  const [recentes, setRecentes] = useState<PedidoNaRetirada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const planilha = useRef<number | null>(null);

  const carregar = useCallback(() => { listarConfirmacoes().then(setLista).catch(() => { /* fica a última lista */ }); }, []);
  useEffect(() => {
    if (!pode) return;
    carregar();
    const t = window.setInterval(carregar, ATUALIZA_A_CADA_MS);
    return () => window.clearInterval(t);
  }, [pode, carregar]);
  useEffect(() => () => { if (planilha.current) window.clearTimeout(planilha.current); }, []);

  const focar = () => window.setTimeout(() => campo.current?.focus(), 0);
  const atualizarPlanilha = () => {
    if (planilha.current) window.clearTimeout(planilha.current);
    planilha.current = window.setTimeout(() => pedirCopiaParaODrive(), PLANILHA_DEPOIS_MS);
  };

  async function registrar(numero: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await registrarRetirada(numero);
      setResultado(r);
      bipe(r.status);
      if (r.status === 'registrada') {
        setRecentes((l) => [r.pedido, ...l.filter((p) => p.numero !== r.pedido.numero)].slice(0, 12));
        atualizarPlanilha();
      }
      carregar();
    } catch {
      setResultado('erro');
      bipe('erro');
    } finally {
      setOcupado(false);
      setTexto('');
      focar();
    }
  }

  async function desfazer(p: PedidoNaRetirada) {
    try {
      await desfazerRetirada(p.numero);
      setRecentes((l) => l.filter((x) => x.numero !== p.numero));
      if (resultado && resultado !== 'erro' && resultado.status !== 'nao_encontrado' && resultado.pedido.numero === p.numero) setResultado(null);
      toast.success(`Retirada de ${p.numero} desfeita.`);
      atualizarPlanilha();
      carregar();
    } catch {
      toast.error('Não deu para desfazer. Tente de novo.');
    }
    focar();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const n = numeroLido(texto);
    if (n) { registrar(n); return; }
    // Uma busca por nome com um resultado só: Enter registra esse.
    if (achados.length === 1 && !achados[0].retirada) registrar(achados[0].numero);
  }

  const achados = useMemo(() => {
    const q = semAcento(texto.trim());
    if (q.length < 2 || numeroLido(texto) || /^pz/i.test(texto.trim()) || /^https?:/i.test(texto.trim())) return [];
    return (lista ?? []).filter((c) => semAcento(c.nome).includes(q)).slice(0, 8);
  }, [texto, lista]);

  const total = lista?.length ?? 0;
  const retirados = (lista ?? []).filter((c) => c.retirada).length;
  const doLinkNaLista = doLink ? (lista ?? []).find((c) => c.numero === doLink) : undefined;

  if (carregandoLogin || (isAuthenticated && carregandoPapel)) return null;
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center" style={{ background: COR.fundo, color: COR.tinta }}>
        <Lock className="h-10 w-10" style={{ color: COR.mut }} />
        <h1 className="text-xl font-bold">Retirada da Pizza da Alegria</h1>
        <p className="max-w-md" style={{ color: COR.mut }}>
          {doLink ? <>Este é o QR Code do pedido <b>{doLink}</b>. </> : null}
          Para dar baixa, entre com a sua conta da equipe e leia o QR Code de novo.
        </p>
        <Link to="/login" className="rounded-xl px-5 py-2.5 font-bold text-white" style={{ background: COR.vermelho }}>Entrar</Link>
      </div>
    );
  }
  if (!pode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center" style={{ background: COR.fundo, color: COR.tinta }}>
        <Lock className="h-10 w-10" style={{ color: COR.mut }} />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm" style={{ color: COR.mut }}>A retirada da Pizza da Alegria é da comunicação e do ADM.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6" style={{ background: COR.creme, color: COR.tinta }}>
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 rounded-3xl p-4 sm:p-6" style={{ background: COR.fundo }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: COR.vermelhoEsc }}>Pizza da Alegria 2026</span>
            <h1 className="text-[24px] font-extrabold leading-tight">Retirada</h1>
            <p className="text-[13px]" style={{ color: COR.mut }}>{RETIRADA_LOCAL} · 17/12/2026</p>
          </div>
          <div className="text-right" data-testid="contador">
            <span className="text-[30px] font-extrabold tabular-nums">{retirados}</span>
            <span className="text-[14px]" style={{ color: COR.mut }}> de {total} {total === 1 ? 'pedido retirado' : 'pedidos retirados'}</span>
          </div>
        </div>

        {/* Veio pela câmera do celular: confirma com um toque. */}
        {doLink && !resultado && (
          <div className="flex flex-col gap-3 rounded-2xl border-2 p-5" style={{ borderColor: COR.vermelho, background: COR.cartao }} data-testid="do-link">
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: COR.vermelhoEsc }}>QR Code lido pela câmera</span>
            {lista === null ? <span style={{ color: COR.mut }}>Procurando o pedido {doLink}…</span> : doLinkNaLista ? (
              <>
                <span className="text-[18px]"><b>{doLinkNaLista.numero}</b> · {doLinkNaLista.nome} · {doLinkNaLista.unidade_nome}</span>
                <span className="text-[16px]">Pizzas: <b>{resumoDosSabores(doLinkNaLista.sabores).replace(/ · /g, ', ')}</b></span>
                {doLinkNaLista.retirada
                  ? <span className="font-semibold" style={{ color: ESTADO.ja_retirada.tx }}>Este pedido já foi retirado{doLinkNaLista.retirada_em ? ` em ${dataEHora(doLinkNaLista.retirada_em)}` : ''}.</span>
                  : (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={ocupado} onClick={() => registrar(doLinkNaLista.numero)} className="rounded-xl px-5 py-3 text-[16px] font-bold text-white disabled:opacity-60" style={{ background: COR.vermelho }}>Confirmar retirada</button>
                      <button type="button" onClick={() => { params.delete('n'); setParams(params, { replace: true }); }} className="rounded-xl border-2 px-5 py-3 text-[16px] font-semibold" style={{ borderColor: COR.linha }}>Cancelar</button>
                    </div>
                  )}
              </>
            ) : <span style={{ color: ESTADO.nao_encontrado.tx }}>Nenhum pedido com o número {doLink}.</span>}
          </div>
        )}

        <form onSubmit={enviar} className="flex flex-wrap items-center gap-3 rounded-2xl border-[2.5px] border-dashed p-4" style={{ borderColor: COR.vermelho }}>
          <ScanLine className="h-7 w-7 shrink-0" style={{ color: COR.vermelho }} />
          <div className="min-w-0 flex-[1_1_220px]">
            <b className="text-[15px]">Leitor pronto</b>
            <p className="text-[13px]" style={{ color: COR.mut }}>Aponte o leitor para o QR Code do comprovante, ou digite o número ou o nome.</p>
          </div>
          <label htmlFor="campo-retirada" className="sr-only">Número do pedido ou nome</label>
          <input
            id="campo-retirada" ref={campo} value={texto} autoFocus
            // O resultado anterior some quando a próxima leitura (ou busca) começa.
            onChange={(e) => { setTexto(e.target.value); if (e.target.value) setResultado(null); }} autoComplete="off" spellCheck={false}
            onBlur={() => window.setTimeout(() => { if (document.activeElement === document.body) campo.current?.focus(); }, 150)}
            placeholder="PZ-…  ou nome" className="min-w-0 flex-[1_1_260px] rounded-xl border-2 px-4 py-3 text-[20px] font-semibold outline-none focus:border-[#D8463A]"
            style={{ borderColor: COR.linha, background: COR.cartao, color: COR.tinta }}
          />
        </form>

        {achados.length > 0 && (
          <ul className="flex flex-col gap-1.5" data-testid="achados">
            {achados.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5 text-[14px]" style={{ borderColor: COR.grade, background: COR.cartao }}>
                <b style={{ color: COR.vermelho }}>{c.numero}</b>
                <span className="font-semibold">{c.nome}</span>
                <span style={{ color: COR.mut }}>{c.unidade_nome} · {resumoDosSabores(c.sabores).replace(/ · /g, ', ')}</span>
                {c.retirada
                  ? <span className="ml-auto font-semibold" style={{ color: ESTADO.ja_retirada.tx }}>Já retirado{c.retirada_em ? ` às ${hora(c.retirada_em)}` : ''}</span>
                  : <button type="button" disabled={ocupado} onClick={() => registrar(c.numero)} className="ml-auto rounded-lg px-3 py-1.5 font-bold text-white disabled:opacity-60" style={{ background: COR.vermelho }}>Registrar retirada</button>}
              </li>
            ))}
          </ul>
        )}

        {resultado && <Resultado r={resultado} />}

        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">Últimas retiradas</h2>
          {recentes.length === 0
            ? <p className="text-[13px]" style={{ color: COR.mut }}>As baixas feitas nesta tela aparecem aqui, com a opção de desfazer.</p>
            : (
              <ul className="flex flex-col gap-1.5" data-testid="recentes">
                {recentes.map((p) => (
                  <li key={p.numero} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2 text-[13.5px]" style={{ borderColor: COR.grade, background: COR.cartao }}>
                    <b style={{ color: COR.vermelho }}>{p.numero}</b>
                    <span>{p.nome}</span>
                    <span style={{ color: COR.mut }}>{p.unidade_nome} · {p.quantidade} {p.quantidade === 1 ? 'pizza' : 'pizzas'} · {hora(p.retirada_em)}</span>
                    <button type="button" onClick={() => desfazer(p)} className="ml-auto rounded px-2 py-1 font-semibold" style={{ color: COR.vermelho }}>Desfazer</button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  );
}

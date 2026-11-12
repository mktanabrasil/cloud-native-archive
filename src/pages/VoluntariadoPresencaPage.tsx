import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Lock, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { semAcento } from '@/lib/pizza/retirada';
import { listarInscricoes, type Inscricao } from '@/lib/voluntariado/api';
import {
  DIA_DO_NATAL_FELIZ, DIA_DO_TREINAMENTO, agoraEmBrasilia, desfazerPresenca, listarPresencas, momentoDoDia, protocoloLido, registrarPresenca,
  type Momento, type Presenca, type ResultadoDaPresenca,
} from '@/lib/voluntariado/central';
import { rotuloDaAjuda, rotuloDoHorario, rotuloDoVinculo } from '@/lib/voluntariado/modelo';
import { CabecalhoDaCentral, MolduraDaCentral } from '@/components/voluntariado/central/PecasDaCentral';

/**
 * /voluntariado/natalfeliz26/presenca — a presença na entrada (13/11/2026),
 * no molde da retirada da Pizza: procura-se pelo nome ou pelo protocolo e um
 * toque registra. Desde 12/11/2026 a Central não tem mais o QR da credencial
 * (a pedido dele); o ?p=VL-XXXXX continua aceito. Só a comunicação registra.
 */

const ATUALIZA_A_CADA_MS = 30_000;
const ROTULO_DO_MOMENTO: Record<Momento, string> = {
  treinamento: `Treinamento · ${DIA_DO_TREINAMENTO.slice(8)}/${DIA_DO_TREINAMENTO.slice(5, 7)}`,
  evento: `Natal Feliz · ${DIA_DO_NATAL_FELIZ.slice(8)}/${DIA_DO_NATAL_FELIZ.slice(5, 7)}`,
};
const hora = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '');

/** Um bipe por resultado: agudo quando deu certo; dois graves quando não (o mesmo da Pizza). */
function bipe(tipo: ResultadoDaPresenca['status'] | 'erro') {
  try {
    const W = window as unknown as { __bipe?: AudioContext; AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (W.__bipe ??= new Ctx());
    const tons: Array<[number, number, number]> = tipo === 'registrada' ? [[1320, 0, 0.12]] : tipo === 'ja_registrada' ? [[520, 0, 0.14], [520, 0.2, 0.14]] : [[220, 0, 0.35]];
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

const ESTADO = {
  registrada: 'bg-[#81E2CF]/30 text-[#0F5A4C] dark:text-[#9FF0DF]',
  ja_registrada: 'bg-[#FBCE00]/25 text-[#6B5200] dark:text-[#FBE38A]',
  nao_encontrado: 'bg-[#f37964]/20 text-[#9E2A22] dark:text-[#FFB4A8]',
};

function Resultado({ r }: { r: ResultadoDaPresenca | 'erro' }) {
  if (r === 'erro') {
    return (
      <div className={cn('flex flex-col gap-1 rounded-[20px] p-5', ESTADO.nao_encontrado)} role="status" data-testid="resultado">
        <span className="flex items-center gap-2 text-2xl font-bold"><AlertTriangle className="h-7 w-7" /> Não deu para registrar</span>
        <span className="text-[15px] text-foreground">Confira a internet e leia a credencial de novo.</span>
      </div>
    );
  }
  const v = r.voluntario;
  return (
    <div className={cn('flex flex-col gap-1 rounded-[20px] p-5', ESTADO[r.status])} role="status" data-testid="resultado" data-estado={r.status}>
      <span className="flex items-center gap-2 text-2xl font-bold sm:text-[28px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {r.status === 'registrada' && <><Check className="h-8 w-8" strokeWidth={3} /> Presença registrada</>}
        {r.status === 'ja_registrada' && <><AlertTriangle className="h-8 w-8" /> Já estava registrada</>}
        {r.status === 'nao_encontrado' && <><X className="h-8 w-8" strokeWidth={3} /> Credencial não encontrada</>}
      </span>
      {v && <span className="text-[17px] text-foreground"><b>{v.nome}</b> · {v.protocolo}</span>}
      {v && <span className="text-[15px] text-foreground">{rotuloDaAjuda(v.opcao1)}{v.horario ? ` · ${rotuloDoHorario(v.horario)}` : ''} · {v.unidade_nome ?? rotuloDoVinculo(v.vinculo)}</span>}
      {r.status === 'ja_registrada' && <span className="text-[14px] text-foreground">Registrada às {hora(r.registrado_em)}.</span>}
      {r.status === 'nao_encontrado' && <span className="text-[14px] text-foreground">O código lido não é de uma inscrição. Procure pelo nome.</span>}
    </div>
  );
}

export default function VoluntariadoPresencaPage() {
  useTituloDaAba('Presença · Voluntariado');
  const { isAuthenticated, loading: carregandoLogin } = useAuth();
  const { isMarketing, loading: carregandoPapel } = useUserRole();
  const [params, setParams] = useSearchParams();
  const doLink = protocoloLido(params.get('p') ? `?p=${params.get('p')}` : '');

  const [momento, setMomento] = useState<Momento>(() => momentoDoDia(agoraEmBrasilia().dia));
  const [lista, setLista] = useState<Inscricao[] | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<ResultadoDaPresenca | 'erro' | null>(null);
  const [recentes, setRecentes] = useState<Array<{ protocolo: string; nome: string; momento: Momento; em: string }>>([]);
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    listarInscricoes().then(setLista).catch(() => { /* fica a última */ });
    listarPresencas().then(setPresencas).catch(() => { /* fica a última */ });
  }, []);
  useEffect(() => {
    if (!isMarketing) return;
    carregar();
    const t = window.setInterval(carregar, ATUALIZA_A_CADA_MS);
    return () => window.clearInterval(t);
  }, [isMarketing, carregar]);

  const focar = () => window.setTimeout(() => campo.current?.focus(), 0);
  const presentes = useMemo(() => new Set(presencas.filter((p) => p.momento === momento).map((p) => p.voluntario_id)), [presencas, momento]);

  async function registrar(protocolo: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await registrarPresenca(protocolo, momento);
      setResultado(r);
      bipe(r.status);
      if (r.status === 'registrada' && r.voluntario) {
        setRecentes((l) => [{ protocolo: r.voluntario!.protocolo, nome: r.voluntario!.nome, momento, em: r.registrado_em ?? new Date().toISOString() }, ...l.filter((x) => !(x.protocolo === r.voluntario!.protocolo && x.momento === momento))].slice(0, 12));
      }
      if (doLink) { params.delete('p'); setParams(params, { replace: true }); }
      carregar();
    } catch {
      setResultado('erro'); bipe('erro');
    } finally {
      setOcupado(false); setTexto(''); focar();
    }
  }

  async function desfazer(x: { protocolo: string; momento: Momento }) {
    try {
      await desfazerPresenca(x.protocolo, x.momento);
      setRecentes((l) => l.filter((y) => !(y.protocolo === x.protocolo && y.momento === x.momento)));
      setResultado(null);
      toast.success(`Presença de ${x.protocolo} desfeita.`);
      carregar();
    } catch { toast.error('Não deu para desfazer. Tente de novo.'); }
    focar();
  }

  const achados = useMemo(() => {
    const q = semAcento(texto.trim());
    if (q.length < 2 || protocoloLido(texto) || /^vl-?/i.test(texto.trim()) || /^https?:/i.test(texto.trim())) return [];
    return (lista ?? []).filter((i) => semAcento(i.nome).includes(q)).slice(0, 8);
  }, [texto, lista]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const p = protocoloLido(texto);
    if (p) { registrar(p); return; }
    if (achados.length === 1 && !presentes.has(achados[0].id)) registrar(achados[0].protocolo);
  }

  const total = lista?.length ?? 0;
  const doLinkNaLista = doLink ? (lista ?? []).find((i) => i.protocolo === doLink) : undefined;

  if (carregandoLogin || (isAuthenticated && carregandoPapel)) return null;
  if (!isAuthenticated || !isMarketing) {
    return (
      <MolduraDaCentral>
        <CabecalhoDaCentral rotulo="Natal Feliz 2026 · Voluntários" titulo="Presença" />
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-16 pt-8 text-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-bold">Presença dos voluntários</h2>
          <p className="text-muted-foreground">
            {doLink ? <>Esta é a credencial <b>{doLink}</b>. </> : null}
            {isAuthenticated ? 'A presença é registrada pela equipe de comunicação.' : 'Para registrar a presença, entre com a sua conta da equipe e leia a credencial de novo.'}
          </p>
          {!isAuthenticated && <Button asChild><Link to="/login">Entrar</Link></Button>}
        </main>
      </MolduraDaCentral>
    );
  }

  return (
    <MolduraDaCentral>
      <CabecalhoDaCentral largo rotulo="Natal Feliz 2026 · Voluntários" titulo="Presença"
        direita={<Link to="/marketing?aba=voluntariado" className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-white/20"><ArrowLeft className="h-4 w-4" /> Painel</Link>}
        pilulas={<span className="text-white/90" data-testid="contador"><b className="text-[26px] font-bold tabular-nums text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{presentes.size}</b><span className="text-[14px]"> de {total} presentes</span></span>} />
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-4 px-4 pb-16 pt-5">
        <div className="inline-flex max-w-full gap-0.5 self-start rounded-full bg-black/[0.05] p-1 dark:bg-white/[0.07]" role="group" aria-label="Qual presença">
          {(['treinamento', 'evento'] as Momento[]).map((m) => (
            <button key={m} type="button" aria-pressed={momento === m} onClick={() => { setMomento(m); setResultado(null); focar(); }}
              className={cn('rounded-full px-4 py-2 text-[14px] transition-colors', momento === m ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground')}>
              {ROTULO_DO_MOMENTO[m]}
            </button>
          ))}
        </div>

        {doLink && !resultado && (
          <div className="flex flex-col gap-3 rounded-[20px] border-2 border-[#81E2CF] bg-card p-5" data-testid="do-link">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Credencial lida pela câmera</span>
            {lista === null ? <span className="text-muted-foreground">Procurando {doLink}…</span> : doLinkNaLista ? (
              <>
                <span className="text-[18px]"><b>{doLinkNaLista.nome}</b> · {doLinkNaLista.protocolo}</span>
                <span className="text-[15px] text-muted-foreground">{rotuloDaAjuda(doLinkNaLista.opcao1)} · {doLinkNaLista.unidade_nome ?? rotuloDoVinculo(doLinkNaLista.vinculo)}</span>
                {presentes.has(doLinkNaLista.id)
                  ? <span className="font-semibold">A presença em {ROTULO_DO_MOMENTO[momento]} já está registrada.</span>
                  : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="lg" disabled={ocupado} onClick={() => registrar(doLinkNaLista.protocolo)}>Registrar presença</Button>
                      <Button size="lg" variant="outline" onClick={() => { params.delete('p'); setParams(params, { replace: true }); }}>Cancelar</Button>
                    </div>
                  )}
              </>
            ) : <span className="font-semibold text-destructive">Nenhuma inscrição com o código {doLink}.</span>}
          </div>
        )}

        <form onSubmit={enviar} className="flex flex-wrap items-center gap-3 rounded-[20px] border-[2.5px] border-dashed border-[#81E2CF] bg-card/70 p-4">
          <Search className="h-7 w-7 shrink-0" />
          <div className="min-w-0 flex-[1_1_220px]">
            <b className="text-[15px]">Procurar voluntário</b>
            <p className="text-[13px] text-muted-foreground">Digite o nome ou o protocolo (VL-…) e registre a presença com um toque.</p>
          </div>
          <label htmlFor="campo-presenca" className="sr-only">Nome ou protocolo</label>
          <input
            id="campo-presenca" ref={campo} value={texto} autoFocus autoComplete="off" spellCheck={false}
            onChange={(e) => { setTexto(e.target.value); if (e.target.value) setResultado(null); }}
            onBlur={() => window.setTimeout(() => { if (document.activeElement === document.body) campo.current?.focus(); }, 150)}
            placeholder="Nome ou VL-…" className="min-w-0 flex-[1_1_260px] rounded-[14px] border-2 border-input bg-card px-4 py-3 text-[20px] font-semibold outline-none focus:border-[#81E2CF]"
          />
        </form>

        {achados.length > 0 && (
          <ul className="flex flex-col gap-1.5" data-testid="achados">
            {achados.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] border border-border bg-card px-3 py-2.5 text-[14px]">
                <b>{i.protocolo}</b>
                <span className="font-semibold">{i.nome}</span>
                <span className="text-muted-foreground">{rotuloDaAjuda(i.opcao1)} · {i.unidade_nome ?? rotuloDoVinculo(i.vinculo)}</span>
                {presentes.has(i.id)
                  ? <span className="ml-auto font-semibold text-muted-foreground">Já presente</span>
                  : <Button size="sm" className="ml-auto" disabled={ocupado} onClick={() => registrar(i.protocolo)}>Registrar presença</Button>}
              </li>
            ))}
          </ul>
        )}

        {resultado && <Resultado r={resultado} />}

        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">Últimas presenças</h2>
          {recentes.length === 0
            ? <p className="text-[13px] text-muted-foreground">As presenças registradas nesta tela aparecem aqui, com a opção de desfazer.</p>
            : (
              <ul className="flex flex-col gap-1.5" data-testid="recentes">
                {recentes.map((x) => (
                  <li key={`${x.protocolo}-${x.momento}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] border border-border bg-card px-3 py-2 text-[13.5px]">
                    <b>{x.protocolo}</b>
                    <span>{x.nome}</span>
                    <span className="text-muted-foreground">{ROTULO_DO_MOMENTO[x.momento]} · {hora(x.em)}</span>
                    <button type="button" onClick={() => desfazer(x)} className="ml-auto rounded px-2 py-1 font-semibold text-destructive">Desfazer</button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </main>
    </MolduraDaCentral>
  );
}

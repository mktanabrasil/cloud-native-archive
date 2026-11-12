import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import {
  ABAS_DA_CENTRAL, CAMINHO_DA_CENTRAL, NaoEncontrado, agoraEmBrasilia, esquecerNumero, guardarNumero, lerCentral, numeroGuardado, primeiroNome,
  type AbaDaCentral, type DadosDaCentral,
} from '@/lib/voluntariado/central';
import { CAMINHO_DO_FORMULARIO, digitosDoWhatsapp, encerrado, mascaraDoWhatsapp, ULTIMO_DIA } from '@/lib/voluntariado/modelo';
import { AvatarDaPessoa, CAPA_DO_NATAL, CabecalhoDaCentral, DocaDaCentral, MolduraDaCentral } from '@/components/voluntariado/central/PecasDaCentral';
import { AvisosDaCentral, CronogramaDaCentral, InicioDaCentral, LocalDaCentral, PerfilDaCentral, cabecalhoDaAba } from '@/components/voluntariado/central/AbasDaCentral';

/**
 * /voluntariado/natalfeliz26/central — a Central do Voluntário (13/11/2026).
 *
 * Entra com o WhatsApp da inscrição; o celular guarda o número, e nas outras
 * vezes a Central abre direto. Cinco abas na doca (Início, Cronograma,
 * Avisos, Local, Perfil; os Avisos no meio desde 12/11/2026, no lugar da
 * credencial com QR), e tudo se atualiza sozinho (a cada minuto, ao voltar para a tela e quando chega um
 * aviso). O desenho segue o mockup aprovado, nas cores do app e com a arte do
 * Natal Feliz (pedido de 12/11/2026).
 */

const ATUALIZA_A_CADA_MS = 60_000;
const CHAVE_DOS_VISTOS = 'ana.central-do-voluntario.avisos-vistos';

const lerVistos = () => { try { return localStorage.getItem(CHAVE_DOS_VISTOS) ?? ''; } catch { return ''; } };
const gravarVistos = (iso: string) => { try { localStorage.setItem(CHAVE_DOS_VISTOS, iso); } catch { /* sem guardar, o ponto volta */ } };

export default function VoluntariadoCentralPage() {
  useTituloDaAba('Central do Voluntário');
  const { aba: abaDoEndereco } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const avisoDoLink = params.get('aviso');
  const abaValida = !abaDoEndereco || (ABAS_DA_CENTRAL as readonly string[]).includes(abaDoEndereco);
  const aba = (abaValida ? abaDoEndereco ?? 'inicio' : 'inicio') as AbaDaCentral;

  const [numero, setNumero] = useState<string | null>(() => numeroGuardado());
  const [dados, setDados] = useState<DadosDaCentral | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [agora, setAgora] = useState(() => agoraEmBrasilia());
  const [vistos, setVistos] = useState(lerVistos);
  // Na aba Avisos, os novos continuam marcados enquanto a pessoa lê.
  const [vistosNaAba, setVistosNaAba] = useState(vistos);
  const dadosRef = useRef<DadosDaCentral | null>(null);
  dadosRef.current = dados;

  const carregar = useCallback((n: string) => {
    lerCentral(n).then((d) => { setDados(d); setFalhou(false); }).catch((e) => {
      if (e instanceof NaoEncontrado) { esquecerNumero(); setNumero(null); setDados(null); return; }
      if (!dadosRef.current) setFalhou(true); // com dados na tela, fica a última versão
    });
  }, []);

  useEffect(() => {
    if (!numero) return;
    carregar(numero);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') carregar(numero); }, ATUALIZA_A_CADA_MS);
    const volta = () => { if (document.visibilityState === 'visible') { carregar(numero); setAgora(agoraEmBrasilia()); } };
    const doAviso = (e: MessageEvent) => { if (e.data?.tipo === 'aviso') carregar(numero); };
    document.addEventListener('visibilitychange', volta);
    navigator.serviceWorker?.addEventListener?.('message', doAviso);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', volta);
      navigator.serviceWorker?.removeEventListener?.('message', doAviso);
    };
  }, [numero, carregar]);

  useEffect(() => {
    const t = window.setInterval(() => setAgora(agoraEmBrasilia()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => { window.scrollTo?.(0, 0); }, [abaDoEndereco]);

  // Abriu a aba Avisos: o que chegou até agora conta como visto (o ponto da barra some).
  const ultimo = dados?.avisos[0]?.enviado_em ?? '';
  useEffect(() => {
    if (aba !== 'avisos' || !ultimo || ultimo <= vistos) return;
    setVistosNaAba(vistos);
    gravarVistos(ultimo);
    setVistos(ultimo);
  }, [aba, ultimo, vistos]);

  if (!abaValida) return <Navigate to={CAMINHO_DA_CENTRAL} replace />;
  // O toque na notificação abre .../central?aviso=ID: vai para a aba Avisos, com ele em destaque.
  if (avisoDoLink && aba !== 'avisos') return <Navigate to={`${CAMINHO_DA_CENTRAL}/avisos?aviso=${encodeURIComponent(avisoDoLink)}`} replace />;

  if (!numero) {
    return (
      <MolduraDaCentral>
        <EntradaDaCentral aoEntrar={(n, d) => { guardarNumero(n); setDados(d); setNumero(n); }} />
      </MolduraDaCentral>
    );
  }

  const temNovo = aba !== 'avisos' && !!ultimo && ultimo > vistos;
  const sair = () => { esquecerNumero(); setNumero(null); setDados(null); navigate(CAMINHO_DA_CENTRAL, { replace: true }); };

  const direita = dados ? (
    <Link to={`${CAMINHO_DA_CENTRAL}/perfil`} aria-label="Perfil" className="rounded-full ring-2 ring-white/15"><AvatarDaPessoa nome={dados.voluntario.nome} /></Link>
  ) : null;
  const cabecalho = dados ? cabecalhoDaAba(aba, dados) : { titulo: 'Natal Feliz 2026' };

  return (
    <MolduraDaCentral>
      <CabecalhoDaCentral saudacao={dados ? `Olá, ${primeiroNome(dados.voluntario.nome)}` : undefined} direita={direita} titulo={cabecalho.titulo} pilulas={cabecalho.pilulas} />
      <main className="relative mx-auto w-full max-w-[600px] flex-1 px-4 pb-32 pt-4">
        {!dados ? (
          falhou ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
              <b className="text-[17px]">Não deu para abrir a Central.</b>
              <p className="text-[14px] text-muted-foreground">Confira a internet e tente de novo.</p>
              <Button onClick={() => { setFalhou(false); carregar(numero); }}>Tentar de novo</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
              <div className="h-[72px] animate-pulse rounded-[20px] bg-black/[0.06] dark:bg-white/[0.06]" />
              <div className="h-20 animate-pulse rounded-[20px] bg-black/[0.06] dark:bg-white/[0.06]" />
              <div className="h-44 animate-pulse rounded-[20px] bg-black/[0.06] dark:bg-white/[0.06]" />
            </div>
          )
        ) : aba === 'inicio' ? <InicioDaCentral d={dados} agora={agora} whatsapp={numero} />
          : aba === 'cronograma' ? <CronogramaDaCentral d={dados} agora={agora} />
          : aba === 'avisos' ? <AvisosDaCentral avisos={dados.avisos} whatsapp={numero} destaque={avisoDoLink} vistosAte={vistosNaAba} />
          : aba === 'local' ? <LocalDaCentral />
          : <PerfilDaCentral d={dados} whatsapp={numero} aoSair={sair} />}
      </main>
      {dados && <DocaDaCentral aba={aba} avisoNovo={temNovo} />}
    </MolduraDaCentral>
  );
}

/** A entrada: o WhatsApp da inscrição. */
function EntradaDaCentral({ aoEntrar }: { aoEntrar: (numero: string, d: DadosDaCentral) => void }) {
  const [tel, setTel] = useState('');
  const [erro, setErro] = useState<'nao_encontrado' | 'rede' | 'curto' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const abertas = !encerrado();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const n = digitosDoWhatsapp(tel);
    if (n.length < 10) { setErro('curto'); return; }
    setOcupado(true); setErro(null);
    try { aoEntrar(n, await lerCentral(n)); }
    catch (x) { setErro(x instanceof NaoEncontrado ? 'nao_encontrado' : 'rede'); }
    finally { setOcupado(false); }
  }

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col sm:justify-center sm:py-8">
      {/* A arte inteira (com os apoiadores no pé); a folha encosta na faixa grafite logo abaixo. */}
      <div className="relative shrink-0 overflow-hidden bg-[#1F2322] pb-7 sm:rounded-t-[28px]">
        <img src={CAPA_DO_NATAL} alt="Natal Feliz 2026 da ANA Brasil, com apoio de NZT, JNI e INCC" width={2000} height={1125} className="block aspect-[2000/1125] w-full object-cover" />
        <span aria-hidden className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
        <span className="absolute left-4 top-[calc(0.9rem+env(safe-area-inset-top))] flex items-center gap-2 rounded-full bg-[#1F2322]/70 py-1 pl-1 pr-3 text-white backdrop-blur">
          <img src="/logo.png" alt="" width={26} height={26} className="rounded-full" />
          <span className="text-[14px]" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, letterSpacing: '-0.05em' }}>anabrasil</span>
        </span>
      </div>
      <form onSubmit={entrar} className="relative -mt-7 flex flex-1 flex-col gap-4 rounded-t-[28px] bg-card px-5 pb-8 pt-6 shadow-[0_-12px_30px_-18px_hsl(165_30%_12%/0.5)] sm:flex-none sm:rounded-[28px] sm:rounded-t-[28px]" noValidate>
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Natal Feliz 2026 · Dia do Voluntariado</span>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em]">Central do Voluntário</h1>
          <p className="text-[14.5px] text-muted-foreground">Sua credencial, o cronograma, o local e os avisos. Entre com o WhatsApp que você usou na inscrição.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="whatsapp-da-central" className="text-[13.5px] font-semibold">WhatsApp</label>
          <div className="flex items-center gap-2.5 rounded-full border border-input bg-[#F2F4F3] px-4 focus-within:ring-2 focus-within:ring-ring dark:bg-background">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              id="whatsapp-da-central" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(19) 99999-9999"
              value={tel} onChange={(e) => { setTel(mascaraDoWhatsapp(e.target.value)); setErro(null); }}
              className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70"
              aria-invalid={!!erro} aria-describedby={erro ? 'erro-da-central' : undefined}
            />
          </div>
          {erro && (
            <p id="erro-da-central" role="alert" className="text-[13.5px] font-semibold text-destructive">
              {erro === 'curto' ? 'Digite o WhatsApp com o DDD.'
                : erro === 'rede' ? 'Não deu para entrar agora. Confira a internet e tente de novo.'
                  : 'Não achamos uma inscrição com esse WhatsApp. Confira o número.'}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="h-12 w-full rounded-full text-[15px]" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</Button>
        {abertas && (
          <p className="text-center text-[13.5px] text-muted-foreground">
            Ainda não se inscreveu? <Link to={CAMINHO_DO_FORMULARIO} className="font-semibold text-foreground underline underline-offset-2">Inscrições até {ULTIMO_DIA}</Link>
          </p>
        )}
        <p className="mt-auto pt-2 text-center text-[12px] text-muted-foreground">Acesso exclusivo para os voluntários do Natal Feliz 2026.<br />Neste celular, você só entra uma vez.</p>
      </form>
    </main>
  );
}

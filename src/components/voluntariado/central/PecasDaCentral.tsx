import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, BellRing, CalendarDays, Check, Home, MapPin, Share, SquarePlus, User, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TemaFlutuante } from '@/components/ThemeToggle';
import { UiV2 } from '@/lib/uiV2';
import { cn } from '@/lib/utils';
import {
  avisosLigadosAqui, caminhoDaAba, desligarAvisos, iniciais, ligarAvisos, suporteDeAvisos,
  type AbaDaCentral, type SuporteDeAvisos,
} from '@/lib/voluntariado/central';

/**
 * As peças da Central do Voluntário (13/11/2026). O desenho segue o mockup
 * aprovado (topo escuro com a saudação, cartões, barra de baixo com um botão
 * em destaque no meio), nas cores do app (grafite, verde ANA e as cores do
 * rodapé) e com a arte do Natal Feliz: pedido de 12/11/2026. No meio, os
 * Avisos (no lugar da credencial com QR, também a pedido dele).
 */

/** As cores do app. */
export const VERDE_ANA = '#81E2CF';
export const GRAFITE = '#1F2322';
export const CAPA_DO_NATAL = '/voluntariado-natal-feliz-capa.webp';
/** As cinco cores do rodapé do app, no fio do topo. */
const FIO = 'linear-gradient(90deg, #01ADFF 0 20%, #81E2CF 20% 40%, #FBCE00 40% 60%, #F37964 60% 80%, #E2B979 80% 100%)';

export function MolduraDaCentral({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('ui-v2');
    return () => document.body.classList.remove('ui-v2');
  }, []);
  return (
    <UiV2>
      <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#F2F4F3] text-foreground dark:bg-background">
        {children}
        <TemaFlutuante />
      </div>
    </UiV2>
  );
}

/** A arte do Natal Feliz no fundo de um bloco escuro: entra pela direita e some antes do texto. */
export function ArteAoFundo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 bg-cover bg-right opacity-[0.32]', className)}
      style={{ backgroundImage: `url(${CAPA_DO_NATAL})`, maskImage: 'linear-gradient(to left, #000 8%, transparent 72%)', WebkitMaskImage: 'linear-gradient(to left, #000 8%, transparent 72%)' }}
    />
  );
}

/**
 * O topo escuro (como no mockup): a assinatura e a saudação, os botões da
 * direita, o rótulo em amarelo e o título; no Início, as pílulas do dia.
 */
export function CabecalhoDaCentral({ saudacao, direita, rotulo = 'Dia do Voluntariado', titulo, pilulas, largo = false }: {
  saudacao?: ReactNode; direita?: ReactNode; rotulo?: string; titulo: ReactNode; pilulas?: ReactNode; largo?: boolean;
}) {
  return (
    <header className="relative overflow-hidden rounded-b-[28px] text-white" style={{ background: `radial-gradient(120% 90% at 100% 0%, rgba(129,226,207,0.20), transparent 60%), linear-gradient(165deg, #2A302E 0%, ${GRAFITE} 60%)` }}>
      <ArteAoFundo />
      <div className={cn('relative mx-auto flex flex-col gap-3 px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))]', largo ? 'max-w-[960px]' : 'max-w-[600px]')}>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <img src="/logo.png" alt="" width={30} height={30} className="shrink-0 rounded-[8px]" />
            <span className="truncate text-[15px] font-medium text-white/90">{saudacao ?? <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, letterSpacing: '-0.05em' }}>anabrasil</span>}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">{direita}</div>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FBCE00]">{rotulo}</span>
          <h1 className="text-[25px] font-bold leading-tight tracking-[-0.01em] text-white">{titulo}</h1>
        </div>
        {pilulas && <div className="flex flex-wrap gap-1.5">{pilulas}</div>}
      </div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] opacity-90" style={{ background: FIO }} />
    </header>
  );
}

export function Pilula({ icone: Icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.13] px-3 py-1.5 text-[12.5px] font-semibold text-white"><Icone className="h-3.5 w-3.5" />{children}</span>;
}

const ITENS_DA_DOCA: Array<{ aba: AbaDaCentral; rotulo: string; Icone: LucideIcon }> = [
  { aba: 'inicio', rotulo: 'Início', Icone: Home },
  { aba: 'cronograma', rotulo: 'Cronograma', Icone: CalendarDays },
  { aba: 'avisos', rotulo: 'Avisos', Icone: Bell },
  { aba: 'local', rotulo: 'Local', Icone: MapPin },
  { aba: 'perfil', rotulo: 'Perfil', Icone: User },
];

/** A barra de baixo do mockup: cinco lugares, com os avisos em destaque no meio (o ponto = aviso novo). */
export function DocaDaCentral({ aba, avisoNovo = false }: { aba: AbaDaCentral; avisoNovo?: boolean }) {
  return (
    <nav
      aria-label="Central do Voluntário"
      data-barra-de-baixo="sempre"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/[0.06] bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_hsl(165_30%_12%/0.35)] dark:border-white/10 print:hidden"
    >
      <div className="mx-auto grid max-w-[600px] grid-cols-5 items-end px-1 pb-2 pt-1.5">
        {ITENS_DA_DOCA.map(({ aba: a, rotulo, Icone }) => {
          const ativo = a === aba;
          if (a === 'avisos') {
            return (
              <Link key={a} to={caminhoDaAba(a)} aria-current={ativo ? 'page' : undefined} aria-label={avisoNovo ? 'Avisos (novos)' : 'Avisos'}
                className={cn('-mt-7 flex flex-col items-center gap-1 text-[10.5px] tracking-[-0.01em]', ativo ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground')}>
                <span className={cn('relative grid h-[58px] w-[58px] place-items-center rounded-full border-4 border-card shadow-[0_8px_18px_-8px_hsl(165_30%_12%/0.6)] transition-transform',
                  ativo ? 'scale-105 bg-[#81E2CF] text-[#1F2322] dark:bg-white' : 'bg-[#1F2322] text-[#81E2CF] dark:bg-[#81E2CF] dark:text-[#1F2322]')} aria-hidden>
                  <Icone className="h-6 w-6" strokeWidth={2.1} />
                  {avisoNovo && <span className="absolute right-2.5 top-2.5 h-3 w-3 rounded-full border-2 border-[#1F2322] bg-[#FBCE00] dark:border-[#81E2CF]" data-testid="ponto-de-aviso" />}
                </span>
                <span>{rotulo}</span>
              </Link>
            );
          }
          return (
            <Link key={a} to={caminhoDaAba(a)} aria-current={ativo ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-1 py-1 text-[10.5px] tracking-[-0.01em] transition-colors', ativo ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground')}>
              <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-colors', ativo && 'bg-[#81E2CF]/45 text-foreground dark:bg-[#81E2CF]/25')} aria-hidden>
                <Icone className="h-[20px] w-[20px]" strokeWidth={ativo ? 2.1 : 1.8} />
              </span>
              <span className="max-w-full truncate">{rotulo}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AvatarDaPessoa({ nome, grande = false }: { nome: string; grande?: boolean }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full font-semibold', grande ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-[14px]')} style={{ background: VERDE_ANA, color: GRAFITE }} aria-hidden>
      {iniciais(nome)}
    </span>
  );
}

/** Um cartão sólido, como os do mockup. */
export function Cartao({ children, className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[20px] border border-black/[0.06] bg-card p-4 dark:border-white/[0.08]', className)} {...p}>{children}</div>;
}

/** O rótulo de seção em caixa alta (como "SEU CAMINHO" no mockup). */
export function Secao({ children }: { children: ReactNode }) {
  return <span className="mt-1 px-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{children}</span>;
}

// --- Os avisos -------------------------------------------------------------------------------

/** Ligar os avisos neste celular, com o caminho do iPhone (Tela de Início) e o de quem bloqueou. */
export function CartaoDosAvisos({ whatsapp, compacto = false }: { whatsapp: string; compacto?: boolean }) {
  const [suporte] = useState<SuporteDeAvisos>(() => { try { return suporteDeAvisos(); } catch { return 'sem_suporte'; } });
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const bloqueado = suporte === 'ok' && typeof Notification !== 'undefined' && Notification.permission === 'denied';

  useEffect(() => { avisosLigadosAqui().then(setLigado); }, []);

  async function ligar() {
    setOcupado(true);
    try {
      const r = await ligarAvisos(whatsapp);
      if (r === 'negado') toast.error('Os avisos foram bloqueados. Para ligar, libere as notificações deste site nas configurações do navegador.');
      else { setLigado(true); toast.success('Avisos ligados neste celular.'); }
    } catch {
      toast.error('Não deu para ligar os avisos. Confira a internet e tente de novo.');
    } finally { setOcupado(false); }
  }
  async function desligar() {
    setOcupado(true);
    try { await desligarAvisos(whatsapp); setLigado(false); toast.success('Avisos desligados neste celular.'); }
    catch { toast.error('Não deu para desligar agora. Tente de novo.'); }
    finally { setOcupado(false); }
  }

  if (ligado === null || suporte === 'sem_suporte') return null;

  if (ligado) {
    return (
      <Cartao className={cn('flex items-center gap-3', compacto && 'py-3')} data-testid="avisos-ligados">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#81E2CF]/35 text-foreground"><BellRing className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <b className="block text-[14.5px] font-semibold">Avisos ligados neste celular</b>
          <span className="block text-[13px] text-muted-foreground">Os lembretes chegam como notificação.</span>
        </div>
        {compacto && <Button variant="ghost" size="sm" disabled={ocupado} onClick={desligar}><BellOff className="h-4 w-4" /> Desligar</Button>}
      </Cartao>
    );
  }

  if (suporte === 'iphone_instalar') {
    return (
      <Cartao className="flex flex-col gap-3" data-testid="avisos-iphone">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FBCE00]/25 text-foreground"><Bell className="h-[18px] w-[18px]" /></span>
          <div>
            <b className="block text-[14.5px] font-semibold">Receba os avisos no iPhone</b>
            <span className="block text-[13px] text-muted-foreground">No iPhone, os avisos chegam com a Central na Tela de Início.</span>
          </div>
        </div>
        <ol className="flex flex-col gap-2 rounded-[14px] bg-muted/70 px-3.5 py-3 text-[13.5px]">
          <li className="flex items-center gap-2"><b className="w-4">1</b> Toque em <Share className="mx-0.5 inline h-4 w-4" aria-label="Compartilhar" /> <b>Compartilhar</b>, embaixo, no Safari.</li>
          <li className="flex items-center gap-2"><b className="w-4">2</b> Escolha <SquarePlus className="mx-0.5 inline h-4 w-4" aria-hidden /> <b>Adicionar à Tela de Início</b>.</li>
          <li className="flex items-center gap-2"><b className="w-4">3</b> Abra a <b>Central ANA</b> pela Tela de Início e ligue os avisos.</li>
        </ol>
      </Cartao>
    );
  }

  return (
    <Cartao className="flex items-center gap-3" data-testid="ligar-avisos">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FBCE00]/25 text-foreground"><Bell className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <b className="block text-[14.5px] font-semibold">{bloqueado ? 'Avisos bloqueados' : 'Ativar avisos'}</b>
        <span className="block text-[13px] leading-snug text-muted-foreground">
          {bloqueado ? 'Libere as notificações deste site nas configurações do navegador.' : 'Lembretes do treinamento e do Natal Feliz no seu celular.'}
        </span>
      </div>
      {!bloqueado && <Button size="sm" className="rounded-full px-4" disabled={ocupado} onClick={ligar}>{ocupado ? 'Ligando…' : 'Ativar'}</Button>}
    </Cartao>
  );
}

export function SelinhoFeito({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1E7A5F] dark:text-[#81E2CF]"><Check className="h-3.5 w-3.5" strokeWidth={3} />{children}</span>;
}

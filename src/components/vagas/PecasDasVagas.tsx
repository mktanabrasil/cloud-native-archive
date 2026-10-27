import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility, ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, BookOpen, Brain, Briefcase, Calculator, ChefHat, ClipboardList, DoorOpen, Drama, Dumbbell,
  GraduationCap, HandHeart, HeartHandshake, HeartPulse, Home, Keyboard, Laptop, Leaf, Lightbulb, Music, Palette, School,
  Sparkles, Tent, Users, Wrench,
} from 'lucide-react';
import { fraseDaVaga, iconeDaVaga, type IconeDoTrabalho } from '@/lib/vagas/icones';
import { programaDaVaga, type Programa, type Vista } from '@/lib/vagas/vitrine';
import { useAuth } from '@/contexts/AuthContext';
import { ROTAS_DO_CANDIDATO, ehCandidato, primeiroNome } from '@/lib/vagas/conta';
import { UiV2 } from '@/lib/uiV2';
import { TemaFlutuante } from '@/components/ThemeToggle';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { RodapePublico } from '@/components/events/RodapePublico';
import { ROTULO_DA_AREA, ROTULO_DA_CONTRATACAO, ROTULO_DA_MODALIDADE, type Area, type Vaga } from '@/lib/vagas/modelo';

/**
 * Peças do portal de vagas (fase 1, telas 01 e 03 do mockup aprovado).
 * A cor da área vem da faixa da marca: Social verde-água, Educação amarelo e,
 * desde 28/09/2026, Administração azul (era coral). O texto sobre essas cores
 * é sempre grafite, nos dois temas: elas são claras.
 */

export const COR_DA_AREA: Record<Area, string> = {
  social: '#81E2CF',
  educacao: '#FBCE00',
  administracao: '#01ADFF',
};

export const ICONE_DA_AREA: Record<Area, typeof Home> = {
  social: Users,
  educacao: BookOpen,
  administracao: Briefcase,
};

/** O ponto da cor da área, sempre ao lado do nome (esboço V2: a cor fala pela bolinha, não pela pílula). */
export function PontoDaArea({ area, className = 'h-2 w-2' }: { area: Area; className?: string }) {
  return <span className={`${className} shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10`} style={{ background: COR_DA_AREA[area] }} aria-hidden />;
}

export function SeloDaArea({ area }: { area: Area }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
      <PontoDaArea area={area} /> {ROTULO_DA_AREA[area]}
    </span>
  );
}

export function SeloAberta() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> Aberta
    </span>
  );
}

const ICONE: Record<IconeDoTrabalho, typeof Home> = {
  music: Music, dumbbell: Dumbbell, laptop: Laptop, tent: Tent, palette: Palette, leaf: Leaf, drama: Drama, 'heart-pulse': HeartPulse,
  lightbulb: Lightbulb, briefcase: Briefcase, 'chef-hat': ChefHat, sparkles: Sparkles, wrench: Wrench, 'door-open': DoorOpen,
  'book-open': BookOpen, school: School, 'heart-handshake': HeartHandshake, brain: Brain, 'hand-heart': HandHeart, users: Users,
  'clipboard-list': ClipboardList, keyboard: Keyboard, 'graduation-cap': GraduationCap, accessibility: Accessibility, calculator: Calculator,
};

/** Etiqueta neutra (benefício, informação): a única pílula que fica, só com contorno. */
export function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-medium text-foreground">{children}</span>;
}

/**
 * Os programas por lei (28/09/2026): o mesmo cartão, com o ícone oficial que
 * o site da ANA já usa e a lei de cada um na faixa.
 */
export const PROGRAMAS: Record<Programa, { rotulo: string; icone: typeof Home; imagem: string; alt: string; lei: string; frase: string }> = {
  aprendiz: {
    rotulo: 'Programa', icone: GraduationCap, imagem: '/icones-vagas/jovem-aprendiz.png', alt: 'Jovem Aprendiz Paulista',
    lei: 'Lei da Aprendizagem (Lei 10.097/2000)', frase: 'O primeiro emprego com formação, de 14 a 24 anos.',
  },
  pcd: {
    rotulo: 'Vaga afirmativa', icone: Accessibility, imagem: '/icones-vagas/acessibilidade.jpg', alt: 'Símbolos de acessibilidade: física, intelectual, auditiva e visual',
    lei: 'Lei de Cotas (Lei 8.213/1991, art. 93)', frase: 'Para pessoas com deficiência física, intelectual, auditiva ou visual.',
  },
};

/** O que todas as vagas da vitrine têm em comum: sai do cartão e fica uma vez só, acima da lista. */
export interface ComumDasVagas { contratacao: Vaga['contratacao'] | null; cidade: string | null }

export function comumDasVagas(vagas: Vaga[]): ComumDasVagas {
  if (!vagas.length) return { contratacao: null, cidade: null };
  const [a] = vagas;
  return {
    contratacao: vagas.every(v => v.contratacao === a.contratacao) ? a.contratacao : null,
    cidade: a.cidade && vagas.every(v => v.cidade === a.cidade) ? a.cidade : null,
  };
}

/** "Nova" só nas vagas publicadas nos últimos 7 dias. */
const ehNova = (vaga: Vaga) => !!vaga.publicada_em && Date.now() - new Date(vaga.publicada_em).getTime() < 7 * 864e5;

/**
 * O cartão da vaga, proposta C do esboço V2 (26/10/2026): o cargo grande, o
 * ícone do trabalho como marca-d'água na cor da área e um botão redondo. Na
 * grade o cartão é deitado e comprido; na lista, uma faixa com o fio da cor da
 * área à esquerda (lista B). O que toda vaga tem igual (situação, cidade,
 * contratação) não se repete aqui: fica no topo da vitrine.
 */
export function CartaoDaVaga({ vaga, vista = 'grade', comum }: { vaga: Vaga; vista?: Vista; comum?: ComumDasVagas }) {
  const programa = programaDaVaga(vaga);
  const prog = programa ? PROGRAMAS[programa] : null;
  const { icone, movimento } = iconeDaVaga(vaga.titulo, vaga.area);
  const Icone = prog ? prog.icone : ICONE[icone];
  const cor = prog ? '#F37964' : COR_DA_AREA[vaga.area];
  const frase = prog ? (vaga.descricao.trim() ? fraseDaVaga(vaga.descricao, []) : prog.frase) : fraseDaVaga(vaga.descricao, vaga.requisitos);
  const partes = [
    comum?.cidade && comum.cidade === vaga.cidade ? null : vaga.cidade || ROTULO_DA_MODALIDADE[vaga.modalidade],
    vaga.carga_horaria || null,
    comum?.contratacao && comum.contratacao === vaga.contratacao ? null : ROTULO_DA_CONTRATACAO[vaga.contratacao],
  ].filter(Boolean);
  const nova = ehNova(vaga);
  const rotulo = (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
      {prog ? <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: cor }} aria-hidden /> : <PontoDaArea area={vaga.area} />}
      <span className="truncate">{prog ? prog.rotulo : ROTULO_DA_AREA[vaga.area]}{partes.length > 0 && <> · {partes.join(' · ')}</>}</span>
      {nova && <span className="shrink-0 text-info">· nova</span>}
    </span>
  );
  // O ícone do trabalho, grande e claro, como marca-d'água. Continua se mexendo ao
  // passar o mouse. Nos programas por lei (PcD, Jovem Aprendiz) fica só o ícone
  // oficial, no selo (pedido de 27/10/2026).
  const marca = (tamanho: string, posicao: string) => !prog && (
    <span className={`vg-ico pointer-events-none absolute -z-10 ${posicao}`} data-mov={movimento} aria-hidden>
      <Icone className={`${tamanho} opacity-30 transition-[opacity,transform] duration-300 group-hover:-rotate-6 group-hover:scale-105 group-hover:opacity-[.46]`} style={{ color: cor }} strokeWidth={1.4} />
    </span>
  );
  const botao = (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card/70 backdrop-blur transition-[background-color,transform,border-color] duration-200 group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:h-[42px] sm:w-[42px]">
      <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden />
    </span>
  );
  // Programas por lei: o ícone oficial que o site da ANA já usa.
  const selo = prog && (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white ring-1 ring-inset ring-black/10">
      <img src={prog.imagem} alt={prog.alt} className={programa === 'pcd' ? 'h-full w-full object-contain' : 'h-[88%] w-[88%] object-contain'} />
    </span>
  );

  if (vista === 'lista') {
    return (
      <Link to={`/vagas/${vaga.slug}`}
        style={{ ['--cor-da-vaga' as string]: cor }}
        className="vg-cartao group relative isolate grid min-h-[78px] grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3.5 overflow-hidden rounded-[20px] border border-black/5 bg-card py-3 pr-3.5 text-foreground transition-[border-color,transform] duration-200 hover:border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/5 dark:hover:border-white/15 sm:min-h-[92px] sm:grid-cols-[4px_minmax(0,1fr)_minmax(0,auto)_auto] sm:gap-[18px] sm:rounded-[22px] sm:py-3.5 sm:pr-[18px] sm:hover:translate-x-1">
        <span className="self-stretch rounded-r" style={{ background: cor }} aria-hidden />
        {marca('h-16 w-16 sm:h-[118px] sm:w-[118px]', 'right-12 top-1/2 -translate-y-1/2 -rotate-[8deg] sm:right-[70px]')}
        <span className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[17px] font-bold leading-tight sm:text-[21px]">{vaga.titulo}</h3>
          {rotulo}
          <span className="truncate text-[12.5px] text-muted-foreground sm:hidden">{frase}</span>
        </span>
        <span className="hidden max-w-[380px] pr-24 text-right text-[13.5px] leading-snug text-muted-foreground sm:line-clamp-2 sm:block">{frase}{prog && <small className="block text-[11.5px]">{prog.lei}</small>}</span>
        <span className="flex items-center gap-2">{selo}{botao}</span>
      </Link>
    );
  }

  return (
    <Link
      to={`/vagas/${vaga.slug}`}
      style={{ ['--cor-da-vaga' as string]: cor }}
        className="vg-cartao group relative isolate grid min-h-[124px] grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto] gap-x-3 gap-y-1 overflow-hidden rounded-[22px] border border-black/5 bg-card px-4 py-3.5 text-foreground transition-[border-color,transform] duration-200 hover:border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/5 dark:hover:border-white/15 sm:min-h-[168px] sm:gap-x-4 sm:gap-y-1.5 sm:rounded-[24px] sm:px-[22px] sm:py-5 sm:hover:-translate-y-0.5"
    >
      {marca('h-[104px] w-[104px] sm:h-[150px] sm:w-[150px]', '-right-3 top-1/2 -translate-y-1/2 -rotate-[8deg]')}
      <span className="col-span-2 flex items-start justify-between gap-2">{rotulo}{selo}</span>
      <h3 className="max-w-[16ch] self-center text-[20px] font-bold leading-[1.12] tracking-[-0.01em] sm:text-[24px]">{vaga.titulo}</h3>
      <span className="col-start-1 flex min-w-0 flex-col text-[13px] text-muted-foreground sm:text-sm">
        <span className="line-clamp-2">{frase || 'Veja o que a vaga pede.'}</span>
        {prog && <small className="text-[11.5px]">{prog.lei}</small>}
      </span>
      <span className="col-start-2 row-start-3 self-end">{botao}</span>
    </Link>
  );
}

/**
 * Topo das páginas públicas de vagas: a marca leva à vitrine. À direita, o
 * que cabe a quem está olhando: o visitante entra ou cria conta; o candidato
 * vai para a área dele; a equipe (RH ou não) volta para o app.
 */
export function TopoDasVagas() {
  const { user, isAuthenticated } = useAuth();
  const candidato = isAuthenticated && ehCandidato(user);
  const equipe = isAuthenticated && !candidato;
  return (
    <header className="glass-1 sticky top-3 z-40 mx-3 mt-3 rounded-[18px] lg:mx-6">
      <div className="flex h-14 items-center justify-between pl-3 pr-4">
        <Link to="/vagas" className="flex items-center gap-2 text-foreground">
          <img src="/logo.png" alt="" width={32} height={32} />
          <span className="text-[17px] leading-none" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, letterSpacing: '-0.05em' }}>anabrasil</span>
        </Link>
        {equipe ? (
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao app</Link>
        ) : candidato ? (
          <Link to={ROTAS_DO_CANDIDATO.minhaArea} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#81E2CF] text-sm font-bold text-[#1F2322]" aria-hidden>{primeiroNome(user).slice(0, 1).toUpperCase() || '·'}</span>
            Minha área
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link to={ROTAS_DO_CANDIDATO.entrar} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-muted">Entrar</Link>
            <Link to={ROTAS_DO_CANDIDATO.criarConta} className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Criar conta</Link>
          </div>
        )}
      </div>
    </header>
  );
}

/** A moldura das duas páginas: topo, miolo, rodapé da ANA e o fio de cinco cores. */
export function MolduraDasVagas({ children, abas = null }: { children: ReactNode; abas?: ReactNode }) {
  // Esboço V2: Vagas e RH também entram no vidro.
  useEffect(() => {
    document.body.classList.add('ui-v2');
    return () => document.body.classList.remove('ui-v2');
  }, []);
  return (
    <UiV2>
    <div className="vg-fundo flex min-h-screen flex-col text-foreground">
      <div className="ana-mesh" aria-hidden="true" />
      <TopoDasVagas />
      {abas}
      <main className="flex-1">{children}</main>
      <RodapePublico />
      <InstitutionalFooterBar />
      <TemaFlutuante />
    </div>
    </UiV2>
  );
}

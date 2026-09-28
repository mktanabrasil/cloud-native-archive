import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility, ArrowLeft, ArrowRight, ChevronRight, BookOpen, Brain, Briefcase, Calculator, ChefHat, ClipboardList, DoorOpen, Drama, Dumbbell,
  GraduationCap, HandHeart, HeartHandshake, HeartPulse, Home, Keyboard, Laptop, Leaf, Lightbulb, MapPin, Music, Palette, School,
  Sparkles, Tent, Users, Wrench,
} from 'lucide-react';
import { fraseDaVaga, iconeDaVaga, type IconeDoTrabalho } from '@/lib/vagas/icones';
import { programaDaVaga, type Programa, type Vista } from '@/lib/vagas/vitrine';
import { useAuth } from '@/contexts/AuthContext';
import { ROTAS_DO_CANDIDATO, ehCandidato, primeiroNome } from '@/lib/vagas/conta';
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

export function SeloDaArea({ area }: { area: Area }) {
  const Icone = ICONE_DA_AREA[area];
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-[#1F2322]" style={{ background: COR_DA_AREA[area] }}>
      <Icone className="h-3.5 w-3.5" aria-hidden /> {ROTULO_DA_AREA[area]}
    </span>
  );
}

export function SeloAberta() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Aberta
    </span>
  );
}

/**
 * Os tons de cada área no cartão (modelo 1, versão B, 28/09/2026): o fundo
 * clarinho, a faixa de baixo um pouco mais forte e, no escuro, os pares
 * escuros. O quadradinho do ícone leva a cor cheia da área.
 */
export const TONS_DA_AREA: Record<Area, { fundo: string; faixa: string; fundoEscuro: string; faixaEscura: string }> = {
  social: { fundo: '#EAF8F4', faixa: '#D3F2EA', fundoEscuro: '#15302A', faixaEscura: '#1B3D35' },
  educacao: { fundo: '#FFF8DC', faixa: '#FFEEAE', fundoEscuro: '#2D2812', faixaEscura: '#3A3316' },
  administracao: { fundo: '#E6F6FF', faixa: '#C9EBFF', fundoEscuro: '#102A38', faixaEscura: '#163847' },
};

const ICONE: Record<IconeDoTrabalho, typeof Home> = {
  music: Music, dumbbell: Dumbbell, laptop: Laptop, tent: Tent, palette: Palette, leaf: Leaf, drama: Drama, 'heart-pulse': HeartPulse,
  lightbulb: Lightbulb, briefcase: Briefcase, 'chef-hat': ChefHat, sparkles: Sparkles, wrench: Wrench, 'door-open': DoorOpen,
  'book-open': BookOpen, school: School, 'heart-handshake': HeartHandshake, brain: Brain, 'hand-heart': HandHeart, users: Users,
  'clipboard-list': ClipboardList, keyboard: Keyboard, 'graduation-cap': GraduationCap, accessibility: Accessibility, calculator: Calculator,
};

export function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground">{children}</span>;
}

/**
 * Os programas por lei (28/09/2026): o mesmo cartão, com o ícone oficial que
 * o site da ANA já usa, fundo neutro e a lei de cada um na faixa.
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

/**
 * O cartão da vaga na vitrine (modelo 1, versão B, aprovado em 28/09/2026):
 * o cartão todo num tom clarinho da área; no alto, a área e "Aberta"; embaixo,
 * uma faixa com o ícone do trabalho (no quadradinho da cor cheia da área) e
 * uma frase do que a pessoa vai fazer. Ao passar o mouse, o ícone se mexe do
 * jeito do trabalho (a nota dança, a chave aperta, o capelo é jogado).
 *
 * Na vista em lista (28/09), uma vaga por linha: o ícone ao lado do título,
 * sem a faixa. Jovem Aprendiz e PcD usam o ícone oficial e fundo neutro.
 */
export function CartaoDaVaga({ vaga, vista = 'grade' }: { vaga: Vaga; vista?: Vista }) {
  const programa = programaDaVaga(vaga);
  const prog = programa ? PROGRAMAS[programa] : null;
  const tons = prog ? { fundo: '#F4F3EF', faixa: '#EAE7E0', fundoEscuro: '#222524', faixaEscura: '#2B2F2D' } : TONS_DA_AREA[vaga.area];
  const { icone, movimento } = iconeDaVaga(vaga.titulo, vaga.area);
  const Icone = ICONE[icone];
  const IconeDoChip = prog ? prog.icone : ICONE_DA_AREA[vaga.area];
  const frase = prog ? (vaga.descricao.trim() ? fraseDaVaga(vaga.descricao, []) : prog.frase) : fraseDaVaga(vaga.descricao, vaga.requisitos);
  const onde = <>{vaga.cidade || ROTULO_DA_MODALIDADE[vaga.modalidade]}{vaga.carga_horaria && <> · {vaga.carga_horaria}</>} · {ROTULO_DA_CONTRATACAO[vaga.contratacao]}</>;
  const cores = { ['--vg-t-fundo' as string]: tons.fundo, ['--vg-t-fundo-e' as string]: tons.fundoEscuro, ['--vg-t-faixa' as string]: tons.faixa, ['--vg-t-faixa-e' as string]: tons.faixaEscura };
  const quadradinho = (tam: 'faixa' | 'lista') => prog ? (
    <span className={`vg-ico grid shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white shadow-[inset_0_0_0_1px_rgba(31,35,34,0.12)] ${tam === 'lista' ? 'h-[46px] w-[46px]' : 'h-[52px] w-[52px]'}`}>
      <img src={prog.imagem} alt={tam === 'faixa' ? '' : prog.alt} className={programa === 'pcd' ? 'h-full w-full object-contain' : 'h-[88%] w-[88%] object-contain'} />
    </span>
  ) : (
    <span className={`vg-ico grid shrink-0 place-items-center rounded-[12px] text-[#1F2322] shadow-[inset_0_0_0_1px_rgba(31,35,34,0.12)] ${tam === 'lista' ? 'h-[44px] w-[44px]' : 'h-[40px] w-[40px]'}`} style={{ background: COR_DA_AREA[vaga.area] }} data-mov={movimento}>
      <Icone className="h-[19px] w-[19px]" aria-hidden />
    </span>
  );

  if (vista === 'lista') {
    return (
      <Link to={`/vagas/${vaga.slug}`} style={cores}
        className="vg-cartao group flex items-center gap-3 rounded-[18px] px-3.5 py-3 text-foreground shadow-[inset_0_0_0_1px_rgba(31,35,34,0.05)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [background:var(--vg-t-fundo)] dark:[background:var(--vg-t-fundo-e)]">
        {quadradinho('lista')}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-base font-bold leading-tight">{vaga.titulo}</b>
          <span className="truncate text-[13px] text-muted-foreground">{prog ? prog.rotulo : ROTULO_DA_AREA[vaga.area]} · {onde}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      to={`/vagas/${vaga.slug}`}
      className="vg-cartao group flex flex-col gap-1.5 rounded-[20px] p-[18px] pb-4 text-foreground shadow-[inset_0_0_0_1px_rgba(31,35,34,0.05)] transition hover:-translate-y-[3px] hover:shadow-[inset_0_0_0_1px_rgba(31,35,34,0.05),0_14px_28px_rgba(31,35,34,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [background:var(--vg-t-fundo)] dark:[background:var(--vg-t-fundo-e)]"
      style={cores}
    >
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[#1F2322] dark:text-foreground ${prog ? 'bg-white shadow-[inset_0_0_0_1px_rgba(31,35,34,0.12)] dark:bg-background' : '[background:var(--vg-t-faixa)] dark:[background:var(--vg-t-faixa-e)]'}`}>
          <IconeDoChip className="h-3.5 w-3.5" aria-hidden />{prog ? prog.rotulo : ROTULO_DA_AREA[vaga.area]}
        </span>
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-white px-2.5 text-[12.5px] font-semibold text-emerald-800 dark:bg-background dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />Aberta
        </span>
      </span>
      <h3 className="text-[21px] font-bold leading-tight">{vaga.titulo}</h3>
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden />{onde}</span>
      {/* empurra a faixa para o pé do cartão, com pelo menos 14 px de respiro */}
      <span className="min-h-3.5 flex-1" aria-hidden />
      <span className="flex items-center gap-3 rounded-[14px] p-3 text-[13.5px] leading-snug text-[#1F2322] [background:var(--vg-t-faixa)] dark:text-foreground dark:[background:var(--vg-t-faixa-e)]">
        {quadradinho('faixa')}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span>{frase || 'Veja o que a vaga pede.'}</span>
          {prog && <small className="text-[11.5px] opacity-75">{prog.lei}</small>}
        </span>
        <ArrowRight className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
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
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/vagas" className="flex items-center gap-2.5 font-bold text-foreground">
          <img src="/logo.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-lg lowercase tracking-tight">anabrasil</span>
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
  return (
    <div className="vg-fundo flex min-h-screen flex-col text-foreground">
      <TopoDasVagas />
      {abas}
      <main className="flex-1">{children}</main>
      <RodapePublico />
      <InstitutionalFooterBar />
    </div>
  );
}

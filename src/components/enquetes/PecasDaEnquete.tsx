import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { CorDeOpcao, DiaEmDestaque, OpcaoDeEnquete } from '@/lib/enquetes/modelo';
import { pedacosDoTexto, percentual } from '@/lib/enquetes/modelo';

/**
 * As peças visuais da enquete, usadas na página de voto, na de resultado e
 * na prévia do formulário. Cores da paleta da marca em tons suaves, texto
 * escuro por cima, como no mockup aprovado em 23/09/2026.
 */

/** Classes por cor: borda/preenchimento do rádio e da barra, fundo suave, número. */
const TOM: Record<CorDeOpcao, { forte: string; suave: string; ink: string; borda: string }> = {
  azul: { forte: 'bg-[#01ADFF]', suave: 'bg-[#E3F4FF] dark:bg-[#10314A]', ink: 'text-[#0A6EA3] dark:text-[#7CCBFF]', borda: 'border-[#01ADFF]' },
  verde: { forte: 'bg-[#81E2CF]', suave: 'bg-[#E4F8F3] dark:bg-[#153A32]', ink: 'text-[#0E6B58] dark:text-[#8FE3CF]', borda: 'border-[#81E2CF]' },
  amarelo: { forte: 'bg-[#FBCE00]', suave: 'bg-[#FFF5CC] dark:bg-[#3A3212]', ink: 'text-[#7A5A00] dark:text-[#F1D45C]', borda: 'border-[#FBCE00]' },
  coral: { forte: 'bg-[#F37964]', suave: 'bg-[#FDE9E4] dark:bg-[#4A241D]', ink: 'text-[#B23A26] dark:text-[#FFA795]', borda: 'border-[#F37964]' },
  areia: { forte: 'bg-[#F5DFBB]', suave: 'bg-[#FBF3E6] dark:bg-[#3A3226]', ink: 'text-[#7A5A2A] dark:text-[#E8CFA8]', borda: 'border-[#F5DFBB]' },
  grafite: { forte: 'bg-[#1F2322] dark:bg-[#EEF2F0]', suave: 'bg-muted', ink: 'text-foreground', borda: 'border-foreground' },
};

export const tomDaCor = (cor: CorDeOpcao) => TOM[cor] ?? TOM.grafite;

export function Marca({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 font-bold">
      <img src="/logo.png" alt="" width={22} height={22} className="rounded-md" />
      <span>anabrasil</span>
      {children}
    </div>
  );
}

/** O texto de contexto, com **negrito** vindo dos asteriscos. */
export function TextoDaEnquete({ texto, className = '' }: { texto: string; className?: string }) {
  if (!texto.trim()) return null;
  return (
    <p className={`text-[13.5px] text-muted-foreground whitespace-pre-wrap ${className}`}>
      {pedacosDoTexto(texto).map((p, i) => (p.negrito ? <b key={i} className="text-foreground">{p.texto}</b> : <span key={i}>{p.texto}</span>))}
    </p>
  );
}

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** "SEG 12 · Feriado", em fila, cada um na cor dele. */
export function DiasEmDestaque({ dias, onToque }: { dias: DiaEmDestaque[]; onToque?: (indice: number) => void }) {
  if (dias.length === 0) return null;
  return (
    <div className="flex gap-1.5 rounded-2xl bg-muted/60 p-2.5" data-testid="dias-em-destaque">
      {dias.map((d, i) => {
        const data = new Date(`${d.data}T12:00:00`);
        const tom = d.cor ? tomDaCor(d.cor) : null;
        const Tag = onToque ? 'button' : 'div';
        return (
          <Tag
            key={`${d.data}-${i}`}
            type={onToque ? 'button' : undefined}
            onClick={onToque ? () => onToque(i) : undefined}
            className={`flex min-w-[52px] flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center ${tom ? tom.suave : ''} ${onToque ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            <small className="text-[10px] font-semibold tracking-wider text-muted-foreground">{DIAS[data.getDay()]}</small>
            <b className={`text-xl leading-none ${tom ? tom.ink : 'text-foreground'}`}>{data.getDate()}</b>
            <i className={`min-h-[14px] text-[10px] font-semibold not-italic ${tom ? tom.ink : 'text-muted-foreground'}`}>{d.rotulo}</i>
          </Tag>
        );
      })}
    </div>
  );
}

interface OpcaoProps {
  opcao: OpcaoDeEnquete;
  votada?: boolean;
  /** Mostra número, percentual e barra. */
  votos?: number | null;
  total?: number;
  desabilitada?: boolean;
  onEscolher?: (opcao: OpcaoDeEnquete) => void;
  compacta?: boolean;
}

/** O cartão de uma opção: rádio, título, subtítulo e, quando há, a contagem. */
export function CartaoDeOpcao({ opcao, votada = false, votos = null, total = 0, desabilitada = false, onEscolher, compacta = false }: OpcaoProps) {
  const tom = tomDaCor(opcao.cor);
  const comResultado = votos !== null && votos !== undefined;
  const pct = comResultado ? percentual(votos, total) : 0;
  const Tag = onEscolher ? 'button' : 'div';
  return (
    <Tag
      type={onEscolher ? 'button' : undefined}
      role={onEscolher ? 'radio' : undefined}
      aria-checked={onEscolher ? votada : undefined}
      disabled={onEscolher ? desabilitada : undefined}
      onClick={onEscolher && !desabilitada ? () => onEscolher(opcao) : undefined}
      data-testid={`opcao-${opcao.id}`}
      className={`relative grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border text-left transition-colors ${compacta ? 'p-3 pb-4' : 'p-3.5 pb-5'} ${
        votada ? `border-2 ${tom.borda} ${tom.suave}` : 'border-border bg-background'
      } ${onEscolher && !desabilitada ? 'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''} ${desabilitada && !votada ? 'opacity-70' : ''}`}
    >
      <span className={`grid h-[22px] w-[22px] place-items-center rounded-full border-2 ${tom.borda} ${votada ? `${tom.forte} text-white` : 'bg-background'}`} aria-hidden="true">
        {votada && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex flex-col gap-0.5">
        <b className="text-[15px] leading-tight break-words">{opcao.titulo}</b>
        {opcao.subtitulo && <span className="text-xs text-muted-foreground">{opcao.subtitulo}</span>}
      </span>
      {comResultado ? (
        <span className="text-right">
          <b className={`block text-[22px] leading-none tabular-nums ${tom.ink}`}>{votos}</b>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            {votos} {votos === 1 ? 'voto' : 'votos'} · {pct}%
          </span>
        </span>
      ) : (
        <span />
      )}
      {comResultado && (
        <span className="absolute bottom-2 left-3.5 right-3.5 h-[5px] overflow-hidden rounded-full bg-muted">
          <span className={`block h-full rounded-full ${tom.forte}`} style={{ width: `${pct}%` }} />
        </span>
      )}
    </Tag>
  );
}

/** O fio das cinco cores, como no checklist. */
export function FioDaMarca({ className = '' }: { className?: string }) {
  return (
    <span
      className={`block h-1 rounded-full ${className}`}
      style={{ background: 'linear-gradient(90deg,#01ADFF 0 20%,#81E2CF 20% 40%,#FBCE00 40% 60%,#F37964 60% 80%,#F5DFBB 80%)' }}
      aria-hidden="true"
    />
  );
}

export function RodapeDaEnquete({ texto = 'Feito no app da ANA Brasil' }: { texto?: string }) {
  return (
    <div className="mt-auto flex flex-col gap-2 pt-4 text-[11px] text-muted-foreground">
      <span>{texto}</span>
      <FioDaMarca />
    </div>
  );
}

import type { ReactNode } from 'react';
import type { AppEvent, Unit } from '@/types';
import { localFixo } from '@/lib/events/local';
import { TituloDoEvento } from './TituloDoEvento';

/**
 * A capa de um evento sem banner (decisão de 22/09/2026, mockup aprovado).
 *
 * Antes era um retângulo chapado na cor do evento com o título em caixa alta.
 * Agora é a foto da unidade responsável, com a cor da unidade por cima a 55%
 * e uma sombra na base, e o título em branco no rodapé. Fica a mesma foto na
 * vitrine, no herói, no detalhe e na prévia do formulário.
 *
 * Qual foto: a da unidade do evento. Evento da Administração usa a foto da
 * unidade do local, quando o local é uma unidade. Sem foto (sede, "Outro
 * local"), volta ao card chapado de antes — nada quebra.
 *
 * As fotos vivem em `public/unidades/`, 1200 px, WebP (~100 KB), como o
 * banner do Mercado: caminho absoluto porque a vitrine é embutida no site.
 */
export const FOTO_DA_UNIDADE: Partial<Record<Unit, string>> = {
  'Nilópolis': '/unidades/nilopolis.webp',
  'DIC': '/unidades/dic.webp',
  'Santana': '/unidades/santana.webp',
};

/** A cor da unidade, em hex, para o véu sobre a foto (mesmas do tema). */
const COR_DA_UNIDADE: Record<Unit, string> = {
  'DIC': '#01ADFF',
  'Nilópolis': '#81E2CF',
  'Santana': '#FBCE00',
  'Administração': '#F37964',
};

/** A unidade cuja foto ilustra o evento, ou null quando não há foto. */
export function unidadeDaFoto(evento: { unit: Unit; location?: string | null }): Unit | null {
  if (FOTO_DA_UNIDADE[evento.unit]) return evento.unit;
  const doLocal = localFixo(evento.location)?.unidade;
  return doLocal && FOTO_DA_UNIDADE[doLocal] ? doLocal : null;
}

interface Props {
  evento: Pick<AppEvent, 'unit' | 'location' | 'title' | 'custom_color'>;
  /** Mostra o título sobre a capa (card, detalhe). O herói já escreve o seu. */
  comTitulo?: boolean;
  /** Tamanho do título: 'card' | 'detalhe'. */
  tamanho?: 'card' | 'detalhe';
  className?: string;
  children?: ReactNode;
}

export function CapaDaUnidade({ evento, comTitulo = true, tamanho = 'card', className = '', children }: Props) {
  const unidade = unidadeDaFoto(evento);
  const titulo = comTitulo && (
    <span
      className={`absolute left-4 right-4 bottom-3 font-bold text-white leading-[1.15] break-words drop-shadow ${tamanho === 'detalhe' ? 'text-2xl md:text-4xl' : 'text-lg md:text-xl'}`}
      data-testid="titulo-na-capa"
    >
      <TituloDoEvento texto={evento.title} />
    </span>
  );

  if (!unidade) {
    // Sem foto: o card chapado de sempre.
    return (
      <div
        className={`capa-sem-imagem relative w-full h-full overflow-hidden ${className}`}
        style={{ backgroundColor: evento.custom_color || '#94a3b8' }}
        data-testid="capa-chapada"
      >
        {titulo}
        {children}
      </div>
    );
  }

  return (
    <div className={`capa-da-unidade relative w-full h-full overflow-hidden ${className}`} data-testid="capa-da-unidade" data-unidade={unidade}>
      <img
        src={FOTO_DA_UNIDADE[unidade]}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0" style={{ backgroundColor: COR_DA_UNIDADE[unidade], opacity: 0.55 }} />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/15 to-transparent" />
      {titulo}
      {children}
    </div>
  );
}

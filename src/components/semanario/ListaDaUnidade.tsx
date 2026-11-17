import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROTAS } from '@/config/navigation';
import { lerDaSemana } from '@/lib/semanario/api';
import {
  ROTULO_DA_SITUACAO, diaComSemana, diasCompletos, hojeIso, periodoCurto, periodoPorExtenso, prazoDaDevolutiva,
  prazoDeEnvio, proximaSegunda, segundaDaSemana, situacao, somarDias as somar, type Semanario,
} from '@/lib/semanario/regras';
import { cn } from '@/lib/utils';
import { Selo, Vidro, quando } from './pecas';

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '·';

/**
 * Os semanários de uma semana (17/11/2026), para quem lê: a orientadora
 * pedagógica vê os do CEI dela; o marketing, os de todas as unidades (a RLS
 * recorta). Só leitura por enquanto: a devolutiva chega no próximo passo.
 */
export function ListaDaUnidade({ titulo, marketing }: { titulo: string; marketing: boolean }) {
  const hoje = hojeIso();
  const proxima = proximaSegunda(hoje);
  const semanas = [proxima, segundaDaSemana(hoje), somar(proxima, -14), somar(proxima, -21)];
  const [semana, setSemana] = useState(proxima);
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [lista, setLista] = useState<Semanario[]>([]);

  // Trocando de semana depressa, só a resposta da semana escolhida por último vale.
  const pedida = useRef(semana);
  const carregar = useCallback(async (s: string) => {
    pedida.current = s;
    setEstado('carregando');
    try { const l = await lerDaSemana(s); if (pedida.current === s) { setLista(l); setEstado('pronto'); } }
    catch { if (pedida.current === s) setEstado('erro'); }
  }, []);
  useEffect(() => { void carregar(semana); }, [carregar, semana]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 lg:px-6">
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            Semana de {periodoPorExtenso(semana)} · envio até {diaComSemana(prazoDeEnvio(semana))} · devolutiva até {diaComSemana(prazoDaDevolutiva(semana))}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Semana">
          {semanas.map(s => (
            <button key={s} type="button" aria-pressed={s === semana} onClick={() => setSemana(s)}
              className={cn('rounded-full border px-3 py-1.5 text-[13px]', s === semana
                ? 'border-transparent bg-foreground font-semibold text-background'
                : 'border-black/10 bg-white/55 dark:border-white/10 dark:bg-white/5')}>
              {periodoCurto(s).replace(' a ', '–')}
            </button>
          ))}
        </div>
      </div>

      {estado === 'carregando' && <p className="py-10 text-center text-[14px] text-muted-foreground">Carregando os semanários…</p>}
      {estado === 'erro' && (
        <div className="py-10 text-center">
          <p className="text-[14px]">Não consegui carregar os semanários agora.</p>
          <Button className="mt-3" onClick={() => void carregar(semana)}>Tentar de novo</Button>
        </div>
      )}
      {estado === 'pronto' && lista.length === 0 && (
        <Vidro className="mt-5 p-6 text-center text-[14px] text-muted-foreground">Nenhum semanário desta semana ainda.</Vidro>
      )}
      {estado === 'pronto' && lista.length > 0 && (
        <Vidro className="mt-5 px-4 py-1">
          <ul className="divide-y divide-black/[.07] dark:divide-white/[.08]">
            {lista.map(s => {
              const sit = situacao(s, hoje);
              const detalhe = s.status === 'preenchimento' ? `${ROTULO_DA_SITUACAO[sit]} · ${diasCompletos(s.dias)} de 5 dias` : s.status === 'enviado' ? `${ROTULO_DA_SITUACAO[sit]} · enviado ${quando(s.enviado_em)}` : ROTULO_DA_SITUACAO[sit];
              return (
                <li key={s.id}>
                  <Link to={`${ROTAS.semanario}/${s.id}`} className="-mx-2 flex items-center gap-3 rounded-[14px] px-2 py-3 hover:bg-[hsl(var(--ativo))]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f37964]/25 text-[12px] font-bold" aria-hidden>{iniciais(s.professora_nome)}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px]">{s.professora_nome || 'Professora'}</b>
                      <span className="block text-[12px] text-muted-foreground">{[marketing ? s.unidade : null, s.agrupamento || 'Sem agrupamento'].filter(Boolean).join(' · ')}</span>
                      {/* No celular a situação desce para baixo do nome, sem cortar a linha. */}
                      <span className="mt-1 block sm:hidden"><Selo situacao={sit} className="whitespace-normal">{detalhe}</Selo></span>
                    </span>
                    <span className="hidden sm:inline-flex"><Selo situacao={sit}>{detalhe}</Selo></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Vidro>
      )}
    </main>
  );
}

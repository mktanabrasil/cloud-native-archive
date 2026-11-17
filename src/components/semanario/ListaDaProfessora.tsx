import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ROTAS } from '@/config/navigation';
import { criar, lerMeus } from '@/lib/semanario/api';
import {
  DIAS, ROTULO_DA_SITUACAO, diaCompleto, diaComecado, diasCompletos, diaComSemana, hojeIso, periodoPorExtenso,
  prazoDeEnvio, proximaSegunda, segundaDaSemana, situacao, somarDias as somar, type Semanario,
} from '@/lib/semanario/regras';
import { cn } from '@/lib/utils';
import { CaixaDaDevolutiva, Selo, Vidro } from './pecas';


/** Mensagem legível para os erros do banco ao criar. */
export function erroAoCriar(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === '23505') return 'Você já tem um semanário desta semana com esse agrupamento. Abra o que já existe ou dê um agrupamento a ele antes de começar outro.';
  if (err?.code === '42501') return 'Só a professora de um CEI (ou do GOE) cria um semanário. Confira o seu cadastro com a coordenação.';
  return err?.message || 'Não foi possível começar o semanário agora.';
}

/**
 * O início do Semanário para a professora (mockup aprovado em 17/11/2026): a
 * semana em andamento, a devolutiva mais recente e as semanas anteriores.
 */
export function ListaDaProfessora({ professoraId }: { professoraId: string }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [lista, setLista] = useState<Semanario[]>([]);
  const hoje = hojeIso();
  const estaSemana = segundaDaSemana(hoje);
  const proxima = proximaSegunda(hoje);
  // Para que semana começar: esta, a próxima (o normal) e as duas seguintes.
  const opcoes = [estaSemana, proxima, somar(proxima, 7), somar(proxima, 14)];
  const [semanaNova, setSemanaNova] = useState(proxima);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try { setLista(await lerMeus(professoraId)); setEstado('pronto'); }
    catch { setEstado('erro'); }
  }, [professoraId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrir = (id: string) => navigate(`${ROTAS.semanario}/${id}`);
  const comecar = async () => {
    setCriando(true);
    try { abrir((await criar(semanaNova)).id); }
    catch (e) { toast.error(erroAoCriar(e)); setCriando(false); }
  };

  const { andamento, anteriores, devolutiva } = useMemo(() => {
    const andamento = lista.filter(s => s.semana >= estaSemana).sort((a, b) => a.semana.localeCompare(b.semana));
    const anteriores = lista.filter(s => s.semana < estaSemana);
    // A devolutiva mais recente, se veio nas últimas duas semanas.
    const limite = somar(estaSemana, -14);
    const devolutiva = lista.filter(s => s.devolutiva && s.devolutiva_em && s.semana >= limite)
      .sort((a, b) => (b.devolutiva_em ?? '').localeCompare(a.devolutiva_em ?? ''))[0];
    return { andamento, anteriores, devolutiva };
  }, [lista, estaSemana]);

  if (estado === 'carregando') return <p className="px-6 py-10 text-center text-[14px] text-muted-foreground">Carregando os seus semanários…</p>;
  if (estado === 'erro') return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-[14px]">Não consegui carregar os seus semanários agora.</p>
      <Button className="mt-3" onClick={() => { setEstado('carregando'); void carregar(); }}>Tentar de novo</Button>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 lg:px-6">
      <div className="mt-2">
        <h1 className="font-display text-[30px] font-bold tracking-tight">Semanário</h1>
        <p className="mt-1 text-[14.5px] text-muted-foreground">O planejamento da semana, no modelo da Orientação Pedagógica. Vocês preenchem; o documento sai sempre igual.</p>
      </div>

      {andamento.length === 0 && (
        <Vidro className="mt-5 p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Próxima semana</p>
          <h2 className="mt-1 font-display text-[22px] font-bold tracking-tight">{periodoPorExtenso(proxima)}</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">Ainda não começado · enviar até <b className="text-foreground">{diaComSemana(prazoDeEnvio(proxima))}</b></p>
        </Vidro>
      )}

      {andamento.map(s => {
        const sit = situacao(s, hoje);
        const feitos = diasCompletos(s.dias);
        return (
          <Vidro key={s.id} className="mt-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{s.semana === proxima ? 'Próxima semana' : s.semana === estaSemana ? 'Esta semana' : 'Mais adiante'}</p>
                <h2 className="mt-1 font-display text-[22px] font-bold tracking-tight">{periodoPorExtenso(s.semana)}</h2>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">{s.agrupamento || 'Sem agrupamento'} · {feitos} de 5 dias preenchidos</p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Dias">
                  {DIAS.map(d => (
                    <span key={d.chave} className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
                      diaCompleto(s.dias[d.chave]) ? 'bg-[#81e2cf]/40' : diaComecado(s.dias[d.chave]) ? 'bg-[#fbce00]/30' : 'bg-black/[.05] text-muted-foreground dark:bg-white/[.06]')}>
                      {d.curto} {somar(s.semana, d.deslocamento).slice(8, 10)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Selo situacao={sit}>{ROTULO_DA_SITUACAO[sit]}</Selo>
                {s.status === 'preenchimento' && <span className="text-[12.5px] text-muted-foreground">Enviar até <b className="text-foreground">{diaComSemana(prazoDeEnvio(s.semana))}</b></span>}
                <Button className="rounded-full" onClick={() => abrir(s.id)}>{s.status === 'preenchimento' ? 'Continuar' : 'Abrir'}</Button>
              </div>
            </div>
          </Vidro>
        );
      })}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px]">
        <label htmlFor="semana-nova" className="text-muted-foreground">Começar um semanário para</label>
        <select id="semana-nova" value={semanaNova} onChange={e => setSemanaNova(e.target.value)}
          className="h-9 w-full min-w-0 max-w-full rounded-full border sm:w-auto border-black/15 bg-white/70 px-3 text-[13.5px] dark:border-white/15 dark:bg-white/5">
          {opcoes.map(o => <option key={o} value={o}>{periodoPorExtenso(o)}{o === estaSemana ? ' (esta semana)' : o === proxima ? ' (próxima)' : ''}</option>)}
        </select>
        <Button variant="outline" className="gap-1.5 rounded-full" disabled={criando} onClick={() => void comecar()}><Plus className="h-4 w-4" /> Começar</Button>
      </div>

      {devolutiva && (
        <div className="mt-6">
          <CaixaDaDevolutiva texto={devolutiva.devolutiva!} por={devolutiva.devolutiva_por} em={devolutiva.devolutiva_em}
            titulo={`Devolutiva da orientadora · ${periodoPorExtenso(devolutiva.semana)}`} />
        </div>
      )}

      {anteriores.length > 0 && (
        <>
          <h2 className="mt-8 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Semanas anteriores</h2>
          <Vidro className="mt-2 px-5 py-1">
            <ul className="divide-y divide-black/[.07] dark:divide-white/[.08]">
              {anteriores.map(s => {
                const sit = situacao(s, hoje);
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => abrir(s.id)} className="flex w-full flex-wrap items-center gap-3 py-3.5 text-left">
                      <span className="min-w-0 flex-1"><b className="block text-[14.5px]">{periodoPorExtenso(s.semana)}</b><span className="text-[12.5px] text-muted-foreground">{s.agrupamento || 'Sem agrupamento'}</span></span>
                      <Selo situacao={sit}>{ROTULO_DA_SITUACAO[sit]}</Selo>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Vidro>
        </>
      )}
    </main>
  );
}

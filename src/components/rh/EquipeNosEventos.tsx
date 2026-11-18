import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UNIT_BG_COLORS, type Unit } from '@/types';
import {
  caiNoFimDeSemana, horasDoEvento, mesDe, mesPorExtenso, mesValido, numerosDoMes, porFuncionario, situacaoNoRh, somarMeses, textoDasHoras, textoParaCopiar, totalDaPessoa,
  type EventoDaEquipe,
} from '@/lib/rh/equipeNosEventos';
import { conferirEvento, lerEventosDaEquipe } from '@/lib/rh/equipeNosEventosApi';

const FUSO = 'America/Sao_Paulo';
/** Maiúscula só na primeira letra (o capitalize do CSS punha em toda palavra: "Às", "De"). */
const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const dia = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit' }).format(new Date(iso));
const mesCurto = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, month: 'short' }).format(new Date(iso)).replace('.', '');
const quando = (e: EventoDaEquipe) => {
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...o }).format(new Date(iso));
  const semana = f(e.start_datetime, { weekday: 'long' }).replace('-feira', '');
  return `${semana}, ${f(e.start_datetime, { hour: '2-digit', minute: '2-digit' })}${e.end_datetime ? ` às ${f(e.end_datetime, { hour: '2-digit', minute: '2-digit' })}` : ''}`;
};
const dataEHora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(new Date(iso));

async function copiar(texto: string, aviso: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
  catch { toast.error('Não consegui copiar', { description: 'Selecione o texto e copie à mão.' }); }
}

/**
 * Administração › RH › Eventos e Por funcionário (18/11/2026, PR 3, mockup
 * aprovado na mesma data). Os eventos confirmados ou concluídos do mês com
 * funcionários escalados (os nomes vêm do formulário de eventos). O RH confere
 * cada um; se a unidade trocar os nomes depois, o evento volta a pedir
 * conferência. "Por funcionário" vira a mesma lista do avesso: cada pessoa,
 * os eventos e as horas do mês, para o banco de horas.
 */
export function EquipeNosEventos({ vista }: { vista: 'eventos' | 'funcionarios' }) {
  const [params, setParams] = useSearchParams();
  const atual = mesDe(new Date());
  const pedido = params.get('mes');
  const mes = mesValido(pedido) ? pedido : atual;
  const irPara = (m: string) => {
    const n = new URLSearchParams(params);
    if (m === atual) n.delete('mes'); else n.set('mes', m);
    setParams(n, { replace: true });
  };
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro' | 'semBanco'>('carregando');
  const [eventos, setEventos] = useState<EventoDaEquipe[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Trocando de mês depressa, só a resposta do mês pedido por último vale.
  const pedidoAtual = useRef(mes);
  const carregar = useCallback(async () => {
    pedidoAtual.current = mes;
    setEstado('carregando');
    try { const l = await lerEventosDaEquipe(mes); if (pedidoAtual.current === mes) { setEventos(l); setEstado('pronto'); } }
    catch (e) { if (pedidoAtual.current === mes) setEstado((e as { semBanco?: boolean }).semBanco ? 'semBanco' : 'erro'); }
  }, [mes]);
  useEffect(() => { void carregar(); }, [carregar]);

  const numeros = useMemo(() => numerosDoMes(eventos), [eventos]);
  const pessoas = useMemo(() => porFuncionario(eventos), [eventos]);

  const marcar = async (e: EventoDaEquipe, conferido: boolean) => {
    setOcupado(e.id);
    try {
      await conferirEvento(e.id, conferido, e.equipe_funcionarios);
      const agora = new Date().toISOString();
      setEventos(l => l.map(x => (x.id === e.id
        ? { ...x, conferido_em: conferido ? agora : null, conferido_por_nome: conferido ? 'você' : null, equipe_conferida: conferido ? x.equipe_funcionarios : null }
        : x)));
    } catch (err) {
      toast.error('Não foi possível marcar', { description: (err as Error).message });
    } finally { setOcupado(null); }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">{vista === 'eventos' ? 'A equipe nos eventos' : 'Por funcionário'}</h1>
          <p className="text-sm text-muted-foreground">
            {vista === 'eventos' ? 'Eventos confirmados com funcionários escalados' : 'Os eventos e as horas de cada pessoa, para o banco de horas'}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-[14px] bg-muted p-1" role="group" aria-label="Mês">
          <button type="button" aria-label="Mês anterior" onClick={() => irPara(somarMeses(mes, -1))} className="rounded-[10px] p-1.5 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[150px] text-center text-[13.5px] font-semibold">{primeiraMaiuscula(mesPorExtenso(mes))}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => irPara(somarMeses(mes, 1))} className="rounded-[10px] p-1.5 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {estado === 'carregando' && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {estado === 'erro' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar os eventos.</p>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      )}
      {estado === 'semBanco' && (
        <p role="alert" className="text-sm text-muted-foreground">Esta aba ainda depende de uma atualização do banco. Fale com o marketing.</p>
      )}

      {estado === 'pronto' && (
        <>
          <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] md:grid-cols-4">
            {([
              ['eventos com funcionários', numeros.eventos, false],
              ['funcionários escalados', numeros.funcionarios, false],
              ['a conferir pelo RH', numeros.aConferir, numeros.aConferir > 0],
              ['em fim de semana', numeros.fimDeSemana, false],
            ] as const).map(([rotulo, n, alerta], i) => (
              <div key={rotulo} className={['flex flex-col border-black/10 p-4 dark:border-white/10 sm:px-5', i % 2 === 1 ? 'border-l' : '', i >= 2 ? 'border-t md:border-t-0' : '', i > 0 ? 'md:border-l' : ''].join(' ')}>
                <span className={`font-display text-[28px] font-bold leading-none tabular-nums ${alerta ? 'text-[hsl(var(--warning))]' : ''}`}>{n}</span>
                <span className="mt-1 text-[13px] text-muted-foreground">{rotulo}</span>
              </div>
            ))}
          </div>

          {eventos.length === 0 && (
            <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhum evento confirmado com funcionários em {mesPorExtenso(mes)}. Os nomes entram pelo formulário de eventos, em "Quem vai ajudar no dia?".
            </p>
          )}

          {vista === 'eventos' && eventos.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-[20px] border border-black/5 bg-card px-4 dark:border-white/5" aria-label="Eventos com funcionários">
              {eventos.map(e => {
                const sit = situacaoNoRh(e);
                return (
                  <li key={e.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
                    <div className="overflow-hidden rounded-[10px] border border-border text-center tabular-nums">
                      <div className="bg-foreground py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">{mesCurto(e.start_datetime)}</div>
                      <div className="py-1 text-[17px] font-bold">{dia(e.start_datetime)}</div>
                    </div>
                    <div className="min-w-0">
                      <b className="block text-[15px]">{e.title}</b>
                      <p className="text-[12.5px] text-muted-foreground">
                        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${UNIT_BG_COLORS[e.unit as Unit] ?? 'bg-muted-foreground/50'}`} aria-hidden />
                        {e.unit} · {primeiraMaiuscula(quando(e))} · {textoDasHoras(horasDoEvento(e))}{caiNoFimDeSemana(e) ? ' · fim de semana' : ''}{e.location ? ` · ${e.location}` : ''}
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Funcionários de ${e.title}`}>
                        {e.equipe_funcionarios.map(n => <li key={n} className="rounded-full bg-[#efedfd] px-2.5 py-0.5 text-[12.5px] text-[#5b4bd6] dark:bg-[#262247] dark:text-[#b9b0ff]">{n}</li>)}
                      </ul>
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                      {sit === 'conferido' && <span className="rounded-full bg-[hsl(var(--success)/0.12)] px-2.5 py-0.5 text-[12px] font-semibold text-[hsl(var(--success))]">Conferido · {dataEHora(e.conferido_em!)}{e.conferido_por_nome ? ` · ${e.conferido_por_nome}` : ''}</span>}
                      {sit === 'a_conferir' && <span className="rounded-full bg-[hsl(var(--warning)/0.14)] px-2.5 py-0.5 text-[12px] font-semibold text-[hsl(var(--warning))]">A conferir</span>}
                      {sit === 'mudou' && <span className="rounded-full bg-[hsl(var(--warning)/0.14)] px-2.5 py-0.5 text-[12px] font-semibold text-[hsl(var(--warning))]">A equipe mudou depois da conferência</span>}
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" aria-label={`Copiar a lista de ${e.title}`} onClick={() => void copiar(e.equipe_funcionarios.join('\n'), 'Lista copiada')}>
                          <Copy className="h-3.5 w-3.5" /> Copiar lista
                        </Button>
                        {sit === 'conferido' ? (
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" disabled={ocupado === e.id} aria-label={`Desfazer a conferência de ${e.title}`} onClick={() => void marcar(e, false)}>
                            <RotateCcw className="h-3.5 w-3.5" /> Desfazer
                          </Button>
                        ) : (
                          <Button size="sm" className="h-8 gap-1 rounded-full" disabled={ocupado === e.id} onClick={() => void marcar(e, true)} aria-label={`Marcar ${e.title} como conferido`}>
                            {ocupado === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Conferido
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {vista === 'funcionarios' && pessoas.length > 0 && (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => void copiar(textoParaCopiar(pessoas), 'Lista do mês copiada')}>
                  <Copy className="h-3.5 w-3.5" /> Copiar o mês
                </Button>
              </div>
              <div className="overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">Funcionário</th>
                      <th className="px-4 py-2.5 font-semibold">Eventos</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Horas no mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoas.map(f => (
                      <tr key={f.nome} className="border-t border-border align-top">
                        <td className="px-4 py-3 font-semibold">{f.nome}</td>
                        <td className="px-4 py-3">
                          <ul className="space-y-0.5">
                            {f.eventos.map(ev => (
                              <li key={ev.id} className="text-[13px]">
                                <span className="tabular-nums text-muted-foreground">{dataEHora(ev.start_datetime)}</span> · {ev.title} <span className="text-muted-foreground">({ev.unit}) · {textoDasHoras(ev.horas)}{ev.fimDeSemana ? ' · fim de semana' : ''}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{totalDaPessoa(f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">As horas são do horário de cada evento (início ao término). Evento de vários dias aparece como "vários dias", fora do total, para o RH contar. O banco de horas de cada pessoa é com o RH.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

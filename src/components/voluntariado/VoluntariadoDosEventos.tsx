import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UNIT_BG_COLORS, type Unit } from '@/types';
import { formatarWhatsapp } from '@/lib/events/equipe';
import { mesDe, mesPorExtenso, mesValido, somarMeses } from '@/lib/rh/equipeNosEventos';
import {
  chaveDaPessoa, contatosParaCopiar, emOrdem, filtrarPessoas, numerosDoMes, pessoasDosEventos, situacaoDe,
  type Confirmacao, type EventoDoVoluntariado, type Situacao,
} from '@/lib/voluntariado/voluntariado';
import { confirmarVoluntario, desfazerConfirmacao, lerConfirmacoes, lerEventosDoVoluntariado } from '@/lib/voluntariado/voluntariadoApi';

const FUSO = 'America/Sao_Paulo';
const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...o }).format(new Date(iso));
const dia = (iso: string) => fmt(iso, { day: '2-digit' });
const mesCurto = (iso: string) => fmt(iso, { month: 'short' }).replace('.', '');
const diaEMes = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit', year: '2-digit' });
const quando = (e: EventoDoVoluntariado) =>
  `${fmt(e.start_datetime, { weekday: 'long' }).replace('-feira', '')}, ${fmt(e.start_datetime, { hour: '2-digit', minute: '2-digit' })}${e.end_datetime ? ` às ${fmt(e.end_datetime, { hour: '2-digit', minute: '2-digit' })}` : ''}`;

async function copiar(texto: string, aviso: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
  catch { toast.error('Não consegui copiar', { description: 'Selecione o texto e copie à mão.' }); }
}

type Estado = 'carregando' | 'pronto' | 'erro' | 'semBanco';
const estadoDoErro = (e: unknown): Estado => ((e as { semBanco?: boolean }).semBanco ? 'semBanco' : 'erro');

function Avisos({ estado, tentar }: { estado: Estado; tentar: () => void }) {
  if (estado === 'carregando') return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (estado === 'erro') return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar o voluntariado.</p>
      <Button variant="outline" size="sm" onClick={tentar}>Tentar de novo</Button>
    </div>
  );
  if (estado === 'semBanco') return <p role="alert" className="text-sm text-muted-foreground">Esta página ainda depende de uma atualização do banco. Fale com o marketing.</p>;
  return null;
}

function Numeros({ itens }: { itens: ReadonlyArray<readonly [string, number, boolean]> }) {
  return (
    <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] md:grid-cols-4">
      {itens.map(([rotulo, n, alerta], i) => (
        <div key={rotulo} className={['flex flex-col border-black/10 p-4 dark:border-white/10 sm:px-5', i % 2 === 1 ? 'border-l' : '', i >= 2 ? 'border-t md:border-t-0' : '', i > 0 ? 'md:border-l' : ''].join(' ')}>
          <span className={`font-display text-[28px] font-bold leading-none tabular-nums ${alerta ? 'text-[hsl(var(--warning))]' : ''}`}>{n}</span>
          <span className="mt-1 text-[13px] text-muted-foreground">{rotulo}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Confirmar e desfazer, com a lista de confirmações compartilhada pela tela.
 * Se outra pessoa confirmou nesse meio-tempo, relê a lista em vez de duplicar.
 */
function useConfirmacoes(recarregar: () => Promise<Confirmacao[]>) {
  const [confirmacoes, setConfirmacoes] = useState<Confirmacao[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const confirmar = async (p: { nome: string; whatsapp: string; primeiroEventoId: string | null }) => {
    const chave = chaveDaPessoa(p);
    setOcupado(chave);
    try {
      const nova = await confirmarVoluntario({ nome: p.nome, whatsapp: p.whatsapp, primeiro_evento_id: p.primeiroEventoId });
      if (nova) setConfirmacoes(c => [...c, nova]);
      else setConfirmacoes(await recarregar());
    } catch (err) {
      toast.error('Não foi possível confirmar', { description: (err as Error).message });
    } finally { setOcupado(null); }
  };
  const desfazer = async (c: Confirmacao) => {
    const chave = chaveDaPessoa(c);
    setOcupado(chave);
    try {
      await desfazerConfirmacao(c.id);
      setConfirmacoes(l => l.filter(x => x.id !== c.id));
    } catch (err) {
      toast.error('Não foi possível desfazer', { description: (err as Error).message });
    } finally { setOcupado(null); }
  };
  return { confirmacoes, setConfirmacoes, ocupado, confirmar, desfazer };
}

/** O selo e o botão de cada pessoa. */
function StatusDaPessoa({ nome, situacao, ocupado, confirmar, desfazer }: {
  nome: string; situacao: Situacao; ocupado: boolean; confirmar: () => void; desfazer: (c: Confirmacao) => void;
}) {
  if (situacao.status === 'confirmado') {
    const c = situacao.confirmacao;
    return (
      <span className="inline-flex items-center gap-1">
        <span className="rounded-full bg-[hsl(var(--success)/0.12)] px-2.5 py-0.5 text-[12px] font-semibold text-[hsl(var(--success))]"
          title={`Confirmado em ${diaEMes(c.criado_em)}${c.criado_por_nome ? ` · ${c.criado_por_nome}` : ''}`}>
          Confirmado
        </span>
        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-muted-foreground" disabled={ocupado} aria-label={`Desfazer a confirmação de ${nome}`} onClick={() => desfazer(c)}>
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        </Button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-full bg-[hsl(var(--warning)/0.14)] px-2.5 py-0.5 text-[12px] font-semibold text-[hsl(var(--warning))]">A confirmar</span>
      <Button size="sm" className="h-7 gap-1 rounded-full px-2.5 text-[12.5px]" disabled={ocupado} aria-label={`Confirmar ${nome}`} onClick={confirmar}>
        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirmar
      </Button>
    </span>
  );
}

/** "Mesmo WhatsApp de Fulano": pode ser a mesma pessoa escrita de outro jeito, ou alguém da família. */
const MesmoNumero = ({ s }: { s: Situacao }) =>
  s.status === 'a_confirmar' && s.mesmoNumero ? <span className="text-[12px] text-muted-foreground">mesmo WhatsApp de {s.mesmoNumero} (confirmado)</span> : null;

/**
 * Administração › Voluntariado › Eventos (18/11/2026, PR 4): os voluntários
 * que as unidades indicaram nos eventos confirmados do mês, com o WhatsApp e
 * o status. O cadastro é feito em outra plataforma; aqui é só o controle.
 */
export function VoluntariosNosEventos() {
  const [params, setParams] = useSearchParams();
  const atual = mesDe(new Date());
  const pedido = params.get('mes');
  const mes = mesValido(pedido) ? pedido : atual;
  const irPara = (m: string) => {
    const n = new URLSearchParams(params);
    if (m === atual) n.delete('mes'); else n.set('mes', m);
    setParams(n, { replace: true });
  };
  const [estado, setEstado] = useState<Estado>('carregando');
  const [eventos, setEventos] = useState<EventoDoVoluntariado[]>([]);
  const { confirmacoes, setConfirmacoes, ocupado, confirmar, desfazer } = useConfirmacoes(lerConfirmacoes);

  // Trocando de mês depressa, só a resposta do mês pedido por último vale.
  const pedidoAtual = useRef(mes);
  const carregar = useCallback(async () => {
    pedidoAtual.current = mes;
    setEstado('carregando');
    try {
      const [l, c] = await Promise.all([lerEventosDoVoluntariado(mes), lerConfirmacoes()]);
      if (pedidoAtual.current === mes) { setEventos(l); setConfirmacoes(c); setEstado('pronto'); }
    } catch (e) { if (pedidoAtual.current === mes) setEstado(estadoDoErro(e)); }
  }, [mes, setConfirmacoes]);
  useEffect(() => { void carregar(); }, [carregar]);

  const numeros = useMemo(() => numerosDoMes(eventos, confirmacoes), [eventos, confirmacoes]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Voluntários nos eventos</h1>
          <p className="text-sm text-muted-foreground">Quem as unidades indicaram nos eventos confirmados, com o WhatsApp</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-[14px] bg-muted p-1" role="group" aria-label="Mês">
          <button type="button" aria-label="Mês anterior" onClick={() => irPara(somarMeses(mes, -1))} className="rounded-[10px] p-1.5 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[150px] text-center text-[13.5px] font-semibold">{primeiraMaiuscula(mesPorExtenso(mes))}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => irPara(somarMeses(mes, 1))} className="rounded-[10px] p-1.5 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <Avisos estado={estado} tentar={() => void carregar()} />

      {estado === 'pronto' && (
        <>
          <Numeros itens={[
            ['eventos com voluntários', numeros.eventos, false],
            ['voluntários indicados', numeros.voluntarios, false],
            ['a confirmar', numeros.aConfirmar, numeros.aConfirmar > 0],
            ['confirmados', numeros.confirmados, false],
          ]} />

          {eventos.length === 0 && (
            <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhum evento confirmado com voluntários em {mesPorExtenso(mes)}. Os voluntários entram pelo formulário de eventos, em "Quem vai ajudar no dia?".
            </p>
          )}

          {eventos.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-[20px] border border-black/5 bg-card px-4 dark:border-white/5" aria-label="Eventos com voluntários">
              {eventos.map(e => (
                <li key={e.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
                  <div className="overflow-hidden rounded-[10px] border border-border text-center tabular-nums">
                    <div className="bg-foreground py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">{mesCurto(e.start_datetime)}</div>
                    <div className="py-1 text-[17px] font-bold">{dia(e.start_datetime)}</div>
                  </div>
                  <div className="min-w-0">
                    <b className="block text-[15px]">{e.title}</b>
                    <p className="text-[12.5px] text-muted-foreground">
                      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${UNIT_BG_COLORS[e.unit as Unit] ?? 'bg-muted-foreground/50'}`} aria-hidden />
                      {e.unit} · {primeiraMaiuscula(quando(e))}{e.location ? ` · ${e.location}` : ''}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5" aria-label={`Voluntários de ${e.title}`}>
                      {e.equipe_voluntarios.map((v, i) => {
                        const s = situacaoDe(v, confirmacoes);
                        const chave = chaveDaPessoa(v);
                        return (
                          <li key={`${i}-${chave}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] bg-muted/50 px-3 py-1.5 text-[13.5px]">
                            <span className="font-semibold">{v.nome}</span>
                            <span className="tabular-nums text-muted-foreground">{formatarWhatsapp(v.whatsapp)}</span>
                            <MesmoNumero s={s} />
                            <span className="ml-auto">
                              <StatusDaPessoa nome={v.nome} situacao={s} ocupado={ocupado === chave}
                                confirmar={() => void confirmar({ nome: v.nome, whatsapp: v.whatsapp, primeiroEventoId: e.id })} desfazer={c => void desfazer(c)} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="col-span-2 flex items-start sm:col-span-1 sm:justify-end">
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" aria-label={`Copiar os contatos de ${e.title}`} onClick={() => void copiar(contatosParaCopiar(e.equipe_voluntarios), 'Contatos copiados')}>
                      <Copy className="h-3.5 w-3.5" /> Copiar contatos
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {eventos.length > 0 && <p className="text-xs text-muted-foreground">O cadastro é feito na plataforma de voluntariado; aqui fica só o controle. Quem foi confirmado aparece confirmado nos próximos eventos (mesmo nome e WhatsApp).</p>}
        </>
      )}
    </div>
  );
}

type Filtro = 'todos' | 'a_confirmar' | 'confirmados';

/**
 * Administração › Voluntariado › Voluntários (18/11/2026, PR 4): todos os
 * que já apareceram nos eventos, com o status e os eventos de cada um.
 */
export function ListaDeVoluntarios() {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [eventos, setEventos] = useState<EventoDoVoluntariado[]>([]);
  const [termo, setTermo] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const { confirmacoes, setConfirmacoes, ocupado, confirmar, desfazer } = useConfirmacoes(lerConfirmacoes);

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try {
      const [l, c] = await Promise.all([lerEventosDoVoluntariado(null), lerConfirmacoes()]);
      setEventos(l); setConfirmacoes(c); setEstado('pronto');
    } catch (e) { setEstado(estadoDoErro(e)); }
  }, [setConfirmacoes]);
  useEffect(() => { void carregar(); }, [carregar]);

  const pessoas = useMemo(
    () => emOrdem(pessoasDosEventos(eventos, confirmacoes)).map(p => ({ ...p, situacao: situacaoDe(p, confirmacoes) })),
    [eventos, confirmacoes],
  );
  const contagem = { todos: pessoas.length, a_confirmar: pessoas.filter(p => p.situacao.status === 'a_confirmar').length, confirmados: pessoas.filter(p => p.situacao.status === 'confirmado').length };
  const lista = filtrarPessoas(pessoas, termo).filter(p => filtro === 'todos' || (filtro === 'confirmados') === (p.situacao.status === 'confirmado'));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Voluntários</h1>
        <p className="text-sm text-muted-foreground">Todos que já foram indicados nos eventos, com o status e os eventos de cada um</p>
      </div>

      <Avisos estado={estado} tentar={() => void carregar()} />

      {estado === 'pronto' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-[14px] bg-muted p-1" role="group" aria-label="Status">
                {([['todos', 'Todos'], ['a_confirmar', 'A confirmar'], ['confirmados', 'Confirmados']] as const).map(([f, rotulo]) => (
                  <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}
                    className={`rounded-[10px] px-3 py-1.5 text-[13px] ${filtro === f ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground'}`}>
                    {rotulo} <span className="tabular-nums text-muted-foreground">{contagem[f]}</span>
                  </button>
                ))}
              </div>
              <label className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Procurar voluntário" placeholder="Procurar por nome ou WhatsApp" value={termo} onChange={e => setTermo(e.target.value)} className="pl-9" />
              </label>
            </div>
            {lista.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => void copiar(contatosParaCopiar(lista), 'Contatos copiados')}>
                <Copy className="h-3.5 w-3.5" /> Copiar contatos
              </Button>
            )}
          </div>

          {pessoas.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhum voluntário indicado ainda. Eles entram pelo formulário de eventos, em "Quem vai ajudar no dia?", e aparecem aqui quando o evento é confirmado.
            </p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém nesta lista{termo.trim() ? ` com "${termo.trim()}"` : ''}.</p>
          ) : (
            <div className="overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Voluntário</th>
                    <th className="px-4 py-2.5 font-semibold">WhatsApp</th>
                    <th className="px-4 py-2.5 font-semibold">Eventos</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(p => (
                    <tr key={p.chave} className="border-t border-border align-top">
                      <td className="px-4 py-3">
                        <span className="font-semibold">{p.nome}</span>
                        <span className="block"><MesmoNumero s={p.situacao} /></span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatarWhatsapp(p.whatsapp)}</td>
                      <td className="px-4 py-3">
                        {p.eventos.length === 0 ? <span className="text-[13px] text-muted-foreground">o evento saiu da lista</span> : (
                          <ul className="space-y-0.5">
                            {p.eventos.map(ev => (
                              <li key={ev.id} className="text-[13px]">
                                <span className="tabular-nums text-muted-foreground">{diaEMes(ev.start_datetime)}</span> · {ev.title} <span className="text-muted-foreground">({ev.unit})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusDaPessoa nome={p.nome} situacao={p.situacao} ocupado={ocupado === p.chave}
                          confirmar={() => void confirmar({ nome: p.nome, whatsapp: p.whatsapp, primeiroEventoId: p.primeiroEventoId })} desfazer={c => void desfazer(c)} />
                        {p.situacao.status === 'confirmado' && (
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            em {diaEMes(p.situacao.confirmacao.criado_em)}{p.situacao.confirmacao.criado_por_nome ? ` · ${p.situacao.confirmacao.criado_por_nome}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

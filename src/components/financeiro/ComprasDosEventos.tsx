import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UNIT_BG_COLORS, type Unit } from '@/types';
import { mesDe, mesPorExtenso, mesValido, somarMeses } from '@/lib/rh/equipeNosEventos';
import {
  ROTULO_DA_SITUACAO, itensDoEvento, lerValor, marcasSoltas, listaDoMes, numerosDoMes, reais, textoDoEvento, textoDoMes,
  type EventoDoFinanceiro, type ItemDoFinanceiro, type MarcaDoItem, type Situacao, type Tipo,
} from '@/lib/financeiro/compras';
import { lerComprasDoMes, marcarItem } from '@/lib/financeiro/comprasApi';

const FUSO = 'America/Sao_Paulo';
const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...o }).format(new Date(iso));
const dia = (iso: string) => fmt(iso, { day: '2-digit' });
const mesCurto = (iso: string) => fmt(iso, { month: 'short' }).replace('.', '');
const dataCurta = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit' });
const quando = (e: EventoDoFinanceiro) =>
  `${fmt(e.start_datetime, { weekday: 'long' }).replace('-feira', '')}, ${fmt(e.start_datetime, { hour: '2-digit', minute: '2-digit' })}${e.end_datetime ? ` às ${fmt(e.end_datetime, { hour: '2-digit', minute: '2-digit' })}` : ''}`;
// Dias de calendário em São Paulo (o evento de hoje à noite "é hoje", não "falta 1 dia").
const diaCivil = (d: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d));
const faltam = (iso: string, agora: Date) => {
  const d = Math.round((diaCivil(new Date(iso)) - diaCivil(agora)) / 86_400_000);
  return d < 0 ? null : d === 0 ? 'é hoje' : d === 1 ? 'falta 1 dia' : `faltam ${d} dias`;
};

const COR: Record<Situacao, string> = {
  a_cotar: 'bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]',
  cotado: 'bg-[#e5f4fd] text-[#0b5f8a] dark:bg-[#14303f] dark:text-[#9fd3f2]',
  comprado: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
};

async function copiar(texto: string, aviso: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
  catch { toast.error('Não consegui copiar', { description: 'Selecione o texto e copie à mão.' }); }
}

/** Um item: a situação em três botões e, cotado ou comprado, valor e fornecedor (opcionais). */
function LinhaDoItem({ item, eventoId, aoMudar }: { item: ItemDoFinanceiro; eventoId: string; aoMudar: (marca: MarcaDoItem) => void }) {
  const [salvando, setSalvando] = useState(0);
  // Um salvamento espera o anterior (sair do campo e clicar num botão logo em seguida não se atropelam).
  const fila = useRef<Promise<void>>(Promise.resolve());
  const [valor, setValor] = useState(item.valor != null ? reais(item.valor) : '');
  const [fornecedor, setFornecedor] = useState(item.fornecedor ?? '');
  useEffect(() => { setValor(item.valor != null ? reais(item.valor) : ''); setFornecedor(item.fornecedor ?? ''); }, [item.valor, item.fornecedor]);

  // Clicar numa situação confirma o pedido como está agora; só mexer em valor ou
  // fornecedor mantém a assinatura antiga, e o aviso "o pedido mudou" continua.
  const gravar = (situacao: Situacao, v: number | null, f: string | null, assinatura: string | null) => {
    setSalvando(n => n + 1);
    fila.current = fila.current.then(async () => {
      try {
        await marcarItem({ eventoId, chave: item.chave, situacao, valor: v, fornecedor: f, assinatura });
        aoMudar({ chave: item.chave, situacao, valor: v, fornecedor: f, assinatura, atualizado_em: new Date().toISOString(), atualizado_por_nome: 'você' });
      } catch (e) { toast.error('Não foi possível salvar', { description: (e as Error).message }); }
      finally { setSalvando(n => n - 1); }
    });
  };
  /** O que está digitado agora (valor inválido fica com o último salvo). */
  const digitado = () => {
    const v = lerValor(valor);
    return { v: v === undefined ? item.valor : v, f: fornecedor.trim() || null, invalido: v === undefined };
  };
  const salvarDetalhes = () => {
    const { v, f, invalido } = digitado();
    if (invalido) { toast.error('Valor inválido', { description: 'Use só números, como 1.800,00.' }); return; }
    if (v === item.valor && f === item.fornecedor) return;
    gravar(item.situacao, v, f, item.mudou ? item.assinaturaMarcada : item.assinatura);
  };
  const escolher = (s: Situacao) => {
    if (s === 'a_cotar') { gravar(s, null, null, item.assinatura); return; }
    const { v, f } = digitado();
    gravar(s, v, f, item.assinatura);
  };
  const ocupado = salvando > 0;

  // Pedido mudou depois de marcado: volta a valer como "A cotar" até alguém marcar de novo.
  const efetiva: Situacao = item.mudou ? 'a_cotar' : item.situacao;

  return (
    <li className="flex flex-col gap-2 rounded-[12px] border border-black/5 bg-muted/40 px-3 py-2 dark:border-white/5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-[13.5px]"><b>{item.nome}</b>{item.quantidade && <span className="text-muted-foreground"> · {item.quantidade}</span>}</p>
        {item.detalhe && <p className="text-[12px] text-muted-foreground">{item.detalhe}</p>}
        {item.mudou && <p className="text-[12px] font-semibold text-[hsl(var(--warning))]">O pedido mudou depois de marcado: confira</p>}
        {item.situacao !== 'a_cotar' && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Input aria-label={`Valor de ${item.nome}`} placeholder="Valor (R$)" value={valor} onChange={e => setValor(e.target.value)} onBlur={salvarDetalhes} className="h-8 w-32 text-xs" inputMode="decimal" />
            <Input aria-label={`Fornecedor de ${item.nome}`} placeholder="Fornecedor" value={fornecedor} maxLength={120} onChange={e => setFornecedor(e.target.value)} onBlur={salvarDetalhes} className="h-8 w-44 text-xs" />
          </div>
        )}
      </div>
      <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-border" role="group" aria-label={`Situação de ${item.nome}`}>
        {(['a_cotar', 'cotado', 'comprado'] as const).map(s => (
          <button key={s} type="button" aria-pressed={efetiva === s} aria-busy={ocupado || undefined}
            onClick={() => escolher(s)}
            className={`px-2.5 py-1 text-[12px] ${efetiva === s ? `font-semibold ${COR[s]}` : 'text-muted-foreground hover:text-foreground'}`}>
            {ROTULO_DA_SITUACAO[s]}
          </button>
        ))}
      </div>
    </li>
  );
}

/**
 * Administração › Financeiro (19/11/2026, PR 1 do Financeiro; mockup e
 * decisões do mesmo dia): o que a ANA compra ou cota em cada evento, lido do
 * formulário. Alimentação com fornecedor "ANA" e transporte de fora;
 * equipamentos e impressos ficam de fora. Pendentes aparecem com selo.
 */
export function ComprasDosEventos({ vista }: { vista: 'eventos' | 'lista' }) {
  const [params, setParams] = useSearchParams();
  const [agora] = useState(() => new Date());
  const atual = mesDe(agora);
  const pedido = params.get('mes');
  const mes = mesValido(pedido) ? pedido : atual;
  const irPara = (m: string) => {
    const n = new URLSearchParams(params);
    if (m === atual) n.delete('mes'); else n.set('mes', m);
    setParams(n, { replace: true });
  };
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro' | 'semBanco'>('carregando');
  const [eventos, setEventos] = useState<EventoDoFinanceiro[]>([]);

  const pedidoAtual = useRef(mes);
  const carregar = useCallback(async () => {
    pedidoAtual.current = mes;
    setEstado('carregando');
    try { const l = await lerComprasDoMes(mes); if (pedidoAtual.current === mes) { setEventos(l); setEstado('pronto'); } }
    catch (e) { if (pedidoAtual.current === mes) setEstado((e as { semBanco?: boolean }).semBanco ? 'semBanco' : 'erro'); }
  }, [mes]);
  useEffect(() => { void carregar(); }, [carregar]);

  // A marca nova entra no evento sem recarregar a lista inteira.
  const aoMudar = (eventoId: string) => (marca: MarcaDoItem) => {
    setEventos(l => l.map(e => e.id !== eventoId ? e : { ...e, itens: [...e.itens.filter(m => m.chave !== marca.chave), marca] }));
  };

  const numeros = useMemo(() => numerosDoMes(eventos), [eventos]);
  const lista = useMemo(() => listaDoMes(eventos).filter(l => !tipo || l.tipo === tipo), [eventos, tipo]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">{vista === 'eventos' ? 'Compras e cotações dos eventos' : 'Lista do mês'}</h1>
          <p className="text-sm text-muted-foreground">{vista === 'eventos' ? 'O que fica por conta da ANA em cada evento' : 'Tudo do mês junto, por tipo, para cotar de uma vez'}</p>
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
          <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar as compras.</p>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      )}
      {estado === 'semBanco' && <p role="alert" className="text-sm text-muted-foreground">Esta página ainda depende de uma atualização do banco. Fale com o marketing.</p>}

      {estado === 'pronto' && (
        <>
          <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] md:grid-cols-4">
            {([['eventos com compras', String(numeros.eventos), ''], ['a cotar', String(numeros.aCotar), numeros.aCotar > 0 ? 'text-[hsl(var(--warning))]' : ''], ['cotados', String(numeros.cotados), ''], ['comprados', String(numeros.comprados), '']] as const).map(([rotulo, n, cor], i) => (
              <div key={rotulo} className={['flex flex-col border-black/10 p-4 dark:border-white/10 sm:px-5', i % 2 === 1 ? 'border-l' : '', i >= 2 ? 'border-t md:border-t-0' : '', i > 0 ? 'md:border-l' : ''].join(' ')}>
                <span className={`font-display text-[28px] font-bold leading-none tabular-nums ${cor}`}>{n}</span>
                <span className="mt-1 text-[13px] text-muted-foreground">{rotulo}</span>
              </div>
            ))}
          </div>
          {numeros.total > 0 && <p className="-mt-2 text-[13px] text-muted-foreground">Total cotado e comprado no mês: <b className="text-foreground tabular-nums">{reais(numeros.total)}</b></p>}

          {eventos.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhum evento com compras da ANA em {mesPorExtenso(mes)}. Entram aqui a alimentação marcada como "ANA fornece" e o transporte de fora, do formulário de eventos.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-[14px] bg-muted p-1" role="group" aria-label="Tipo">
                  {([[null, 'Tudo'], ['alimentacao', 'Alimentação'], ['transporte', 'Transporte']] as const).map(([t, rotulo]) => (
                    <button key={rotulo} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}
                      className={`rounded-[10px] px-3 py-1.5 text-[13px] ${tipo === t ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground'}`}>{rotulo}</button>
                  ))}
                </div>
                {vista === 'lista' && (
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => void copiar(textoDoMes(eventos), 'Lista do mês copiada (cola na planilha)')}>
                    <Copy className="h-3.5 w-3.5" /> Copiar o mês
                  </Button>
                )}
              </div>

              {vista === 'eventos' && (
                <ul className="flex flex-col gap-3" aria-label="Eventos com compras">
                  {eventos.map(e => {
                    const itens = itensDoEvento(e).filter(i => !tipo || i.tipo === tipo);
                    if (itens.length === 0) return null;
                    const grupos = Array.from(new Set(itens.map(i => i.grupo)));
                    const prazo = faltam(e.start_datetime, agora);
                    const soltas = marcasSoltas(e).filter(m => !tipo || (tipo === 'transporte') === m.chave.startsWith('transporte:'));
                    return (
                      <li key={e.id} className="rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5">
                        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
                          <div className="overflow-hidden rounded-[10px] border border-border text-center tabular-nums">
                            <div className="bg-foreground py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">{mesCurto(e.start_datetime)}</div>
                            <div className="py-1 text-[17px] font-bold">{dia(e.start_datetime)}</div>
                          </div>
                          <div className="min-w-0">
                            <b className="block text-[15px]">{e.title}</b>
                            <p className="text-[12.5px] text-muted-foreground">
                              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${UNIT_BG_COLORS[e.unit as Unit] ?? 'bg-muted-foreground/50'}`} aria-hidden />
                              {e.unit} · {primeiraMaiuscula(quando(e))}{e.location ? ` · ${e.location}` : ''}{prazo ? ` · ${prazo}` : ''}
                              {e.status === 'pendente' && <span className="ml-1.5 rounded-full bg-[hsl(var(--warning)/0.14)] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--warning))]">aguardando aprovação</span>}
                            </p>
                          </div>
                          <div className="col-span-2 flex items-start sm:col-span-1 sm:justify-end">
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" aria-label={`Copiar a lista de ${e.title}`} onClick={() => void copiar(textoDoEvento(e), 'Lista copiada')}>
                              <Copy className="h-3.5 w-3.5" /> Copiar lista
                            </Button>
                          </div>
                        </div>
                        {grupos.map(g => (
                          <div key={g} className="mt-3">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#b26a00] dark:text-[#f3c27a]">{g}{itens.find(i => i.grupo === g)?.tipo === 'alimentacao' ? ' · a ANA fornece' : ''}</p>
                            <ul className="flex flex-col gap-1.5" aria-label={`${g} de ${e.title}`}>
                              {itens.filter(i => i.grupo === g).map(i => <LinhaDoItem key={i.chave} item={i} eventoId={e.id} aoMudar={aoMudar(e.id)} />)}
                            </ul>
                          </div>
                        ))}
                        {soltas.length > 0 && (
                          <p className="mt-3 rounded-[12px] bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-[12.5px] text-[hsl(var(--warning))]">
                            <b>Saiu do pedido ou mudou de nome:</b>{' '}
                            {soltas.map(m => `${m.nome} (${ROTULO_DA_SITUACAO[m.situacao]}${m.valor != null ? ` · ${reais(m.valor)}` : ''})`).join('; ')}. Confira com a unidade.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {vista === 'lista' && (
                <div className="overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-semibold">Item</th><th className="px-4 py-2.5 font-semibold">Quantidade</th><th className="px-4 py-2.5 font-semibold">Evento</th>
                        <th className="px-4 py-2.5 font-semibold">Data</th><th className="px-4 py-2.5 font-semibold">Situação</th><th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(l => (
                        <tr key={`${l.eventoId}-${l.chave}`} className="border-t border-border align-top">
                          <td className="px-4 py-2.5"><span className="text-[11px] uppercase text-muted-foreground">{l.grupo}</span><br /><b>{l.nome}</b></td>
                          <td className="px-4 py-2.5 tabular-nums">{l.quantidade || '—'}</td>
                          <td className="px-4 py-2.5">{l.evento} <span className="text-muted-foreground">({l.unidade})</span>{l.pendente && <span className="block text-[11px] font-semibold text-[hsl(var(--warning))]">aguardando aprovação</span>}</td>
                          <td className="px-4 py-2.5 tabular-nums">{dataCurta(l.data)}</td>
                          <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${COR[l.mudou ? 'a_cotar' : l.situacao]}`}>{l.mudou ? 'Pedido mudou' : ROTULO_DA_SITUACAO[l.situacao]}</span>{l.fornecedor && <span className="block text-[12px] text-muted-foreground">{l.fornecedor}</span>}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{l.valor != null ? reais(l.valor) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Comida de doação, de parceiro ou da própria unidade não entra: não é compra da ANA. Equipamentos e impressos também ficam de fora.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

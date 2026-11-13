import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { acrescentarItem, apagarItem, editarItem, salvarAno } from '@/lib/calendario/api';
import {
  DIAS_DA_SEMANA, LIMITE_DO_TEXTO, MESES, UNIDADES_DO_CALENDARIO, chaveDoDia, diaDaSemana, itensDoDia, percursosCompletos,
  autoriaDe, autoriaDoItem, rotuloDasUnidades, semanasDoMes, type AnoDoCalendario, type ItemDoCalendario,
} from '@/lib/calendario/regras';

const COR_DA_UNIDADE: Record<string, string> = {
  DIC: 'bg-[hsl(var(--unit-dic))]', Nilópolis: 'bg-[hsl(var(--unit-nilopolis))]', Santana: 'bg-[hsl(var(--unit-santana))]',
};
const FIM_DE_SEMANA = 'bg-[#eff8fe] dark:bg-[hsl(201_40%_16%)]';

function Pilula({ item, pequena = false }: { item: ItemDoCalendario; pequena?: boolean }) {
  const tom = item.tipo === 'feriado'
    ? 'bg-[#fde3dd] font-semibold text-[#a53a26] dark:bg-[#5a2a20] dark:text-[#ffc9bd]'
    : item.tipo === 'atividade' ? 'bg-primary/45 font-semibold text-foreground' : 'bg-black/[.045] text-muted-foreground dark:bg-white/[.07]';
  return (
    <span className={`flex items-start gap-1 rounded-[7px] px-1.5 py-[3px] leading-snug ${pequena ? 'text-[10.5px]' : 'text-[12.5px]'} ${tom} ${item.oculto ? 'line-through opacity-50' : ''}`}>
      {item.tipo === 'atividade' && (
        <span className="mt-[3px] flex shrink-0 gap-[2px]" aria-hidden="true">
          {(item.unidades.length ? item.unidades : [...UNIDADES_DO_CALENDARIO]).map(u => <span key={u} className={`h-1.5 w-1.5 rounded-full ${COR_DA_UNIDADE[u]}`} />)}
        </span>
      )}
      <span className="line-clamp-3">{item.tipo === 'feriado' ? `${item.texto} · feriado` : item.texto}</span>
    </span>
  );
}

interface Props {
  ano: AnoDoCalendario;
  itens: ItemDoCalendario[];
  editavel: boolean;
  mes: number;
  onMes: (m: number) => void;
  onAno: (a: AnoDoCalendario) => void;
  onItens: (i: ItemDoCalendario[]) => void;
}

export function MesAMes({ ano, itens, editavel, mes, onMes, onAno, onItens }: Props) {
  // O mês abre com o dia 1 escolhido: no computador o formulário já aparece ao
  // lado (13/11/2026). No celular, a janela do dia só abre no toque.
  const [sel, setSel] = useState<string | null>(() => chaveDoDia(ano.ano, mes, 1));
  const [diaNoCelular, setDiaNoCelular] = useState(false);
  const [mesDoSel, setMesDoSel] = useState(mes);
  if (mesDoSel !== mes) { setMesDoSel(mes); setSel(chaveDoDia(ano.ano, mes, 1)); }
  const percursos = useMemo(() => percursosCompletos(ano.percursos), [ano.percursos]);
  const [tema, setTema] = useState(percursos[mes - 1].tema);
  const [sugestoes, setSugestoes] = useState(percursos[mes - 1].sugestoes);
  const [mesDosCampos, setMesDosCampos] = useState(mes);
  if (mesDosCampos !== mes) { setMesDosCampos(mes); setTema(percursos[mes - 1].tema); setSugestoes(percursos[mes - 1].sugestoes); }
  const revisado = ano.meses_revisados.includes(mes);

  const salvarPercurso = async () => {
    const atual = percursos[mes - 1];
    if (atual.tema === tema.trim() && atual.sugestoes === sugestoes.trim()) return;
    const novos = percursos.map(p => (p.mes === mes ? { ...p, tema: tema.trim(), sugestoes: sugestoes.trim() } : p));
    try { onAno(await salvarAno(ano.ano, { percursos: novos })); toast.success('Tema do mês salvo'); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); }
  };
  const alternarRevisado = async () => {
    const meses = revisado ? ano.meses_revisados.filter(m => m !== mes) : [...ano.meses_revisados, mes].sort((a, b) => a - b);
    try { onAno(await salvarAno(ano.ano, { meses_revisados: meses })); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); }
  };

  const semanas = semanasDoMes(ano.ano, mes);
  const diasComAlgo = semanas.flat().filter((d): d is number => d !== null).filter(d => itensDoDia(itens, chaveDoDia(ano.ano, mes, d)).length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-[28px]">{MESES[mes - 1]} · {ano.ano}</h1>
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {MESES.map((m, i) => (
            <button key={m} type="button" onClick={() => onMes(i + 1)} aria-current={i + 1 === mes ? 'true' : undefined}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] ${i + 1 === mes ? 'bg-foreground font-semibold text-background' : 'glass-1'}`}>
              {ano.meses_revisados.includes(i + 1) && i + 1 !== mes && <Check className="h-3 w-3 text-[hsl(var(--sel))]" aria-label="revisado" />}{m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="glass-2 min-w-0 rounded-[22px] p-4">
          <div className="grid gap-3 sm:grid-cols-2" data-tutorial="cal-tema-mes">
            <div><label htmlFor="cal-tema-mes" className="text-[12.5px] font-semibold">Tema do mês <span className="font-normal text-muted-foreground">(vai no título da página)</span></label>
              <Input id="cal-tema-mes" className="mt-1" value={tema} maxLength={80} disabled={!editavel} onChange={e => setTema(e.target.value)} onBlur={salvarPercurso} />
              {autoriaDe(ano, `percurso:${mes}`) && <p className="mt-1 text-[11.5px] text-muted-foreground">Por {autoriaDe(ano, `percurso:${mes}`)}</p>}</div>
            <div><label htmlFor="cal-sugestao-mes" className="text-[12.5px] font-semibold">Sugestão de atividade</label>
              <Input id="cal-sugestao-mes" className="mt-1" value={sugestoes} maxLength={120} disabled={!editavel} placeholder="—" onChange={e => setSugestoes(e.target.value)} onBlur={salvarPercurso} /></div>
          </div>

          {/* O alvo do tutorial embrulha as duas: no computador vale a grade, no celular a lista. */}
          <div data-tutorial="cal-grade">
          {/* Computador: a grade, como a página do PDF. */}
          <div className="mt-4 hidden overflow-hidden rounded-[14px] border border-black/10 bg-card lg:block dark:border-white/10" data-testid="grade-do-mes">
            <div className="grid grid-cols-7 border-b border-black/10 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-white/10">
              {DIAS_DA_SEMANA.map(d => <span key={d} className="py-2">{d}</span>)}
            </div>
            {semanas.map((s, k) => (
              <div key={k} className="grid grid-cols-7 border-b border-black/[.07] last:border-b-0 dark:border-white/[.07]">
                {s.map((d, j) => {
                  const chave = d ? chaveDoDia(ano.ano, mes, d) : '';
                  const doDia = d ? itensDoDia(itens, chave) : [];
                  return d ? (
                    <button key={j} type="button" onClick={() => setSel(chave)} aria-label={`Dia ${d}`}
                      className={`flex min-h-[96px] flex-col items-stretch justify-start border-l border-black/[.07] p-1.5 text-left first:border-l-0 hover:bg-accent/50 dark:border-white/[.07] ${(j === 0 || j === 6) ? FIM_DE_SEMANA : ''} ${sel === chave ? 'outline outline-2 -outline-offset-2 outline-[hsl(var(--sel))]' : ''}`}>
                      <span className={`text-[12px] font-semibold ${doDia.some(i => i.tipo === 'feriado') ? 'text-[#c4472f]' : 'text-foreground/70'}`}>{d}</span>
                      <span className="mt-1 block space-y-1">{doDia.map(i => <Pilula key={i.id} item={i} pequena />)}</span>
                    </button>
                  ) : <span key={j} className={`min-h-[96px] border-l border-black/[.07] first:border-l-0 dark:border-white/[.07] ${(j === 0 || j === 6) ? FIM_DE_SEMANA : ''}`} />;
                })}
              </div>
            ))}
          </div>

          {/* Celular: os dias com algo, em lista; o "+" abre o dia. */}
          <div className="mt-4 space-y-2 lg:hidden" data-testid="lista-do-mes">
            {diasComAlgo.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">Nada neste mês ainda.</p>}
            {diasComAlgo.map(d => {
              const chave = chaveDoDia(ano.ano, mes, d);
              const fds = [0, 6].includes(diaDaSemana(chave));
              return (
                <div key={d} className={`flex gap-3 rounded-[16px] p-3 ${fds ? FIM_DE_SEMANA : 'bg-card/80'}`}>
                  <span className="w-10 shrink-0 text-center leading-none"><b className="font-display text-[20px]">{d}</b><span className="block text-[10.5px] font-semibold uppercase text-muted-foreground">{DIAS_DA_SEMANA[diaDaSemana(chave)].slice(0, 3)}</span></span>
                  <div className="min-w-0 flex-1 space-y-1">{itensDoDia(itens, chave).map(i => <Pilula key={i.id} item={i} />)}</div>
                  <button type="button" onClick={() => { setSel(chave); setDiaNoCelular(true); }} aria-label={`Abrir o dia ${d}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-card"><Plus className="h-4 w-4" /></button>
                </div>
              );
            })}
            <Button variant="outline" className="w-full" onClick={() => { setSel(chaveDoDia(ano.ano, mes, 1)); setDiaNoCelular(true); }}><Plus className="h-4 w-4" /> Acrescentar em outro dia</Button>
          </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#fde3dd]" /> Feriado (da agenda)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-black/10" /> Data relevante (dá para esconder do PDF)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/45" /> Atividade das unidades</span>
          </div>
        </section>

        {/* O dia: no computador ao lado; no celular, numa janela. */}
        <aside className="hidden lg:block">
          <div data-tutorial="cal-dia">
          {sel ? <PainelDoDia chave={sel} ano={ano} itens={itens} editavel={editavel} onItens={onItens} />
            : <div className="glass-2 rounded-[22px] p-4 text-[13.5px] text-muted-foreground">Toque num dia para ver o que já tem e acrescentar uma atividade.</div>}
          </div>
          <MesRevisado revisado={revisado} editavel={editavel} onAlternar={alternarRevisado} mes={mes} onMes={onMes} autoria={autoriaDe(ano, `revisado:${mes}`)} />
        </aside>
        <div className="lg:hidden"><MesRevisado revisado={revisado} editavel={editavel} onAlternar={alternarRevisado} mes={mes} onMes={onMes} autoria={autoriaDe(ano, `revisado:${mes}`)} /></div>
      </div>

      <Dialog open={diaNoCelular && !!sel} onOpenChange={o => { if (!o) setDiaNoCelular(false); }}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>O dia</DialogTitle><DialogDescription>O que já tem neste dia e o que acrescentar.</DialogDescription></DialogHeader>
          {sel && <PainelDoDia chave={sel} ano={ano} itens={itens} editavel={editavel} onItens={onItens} escolherDia />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MesRevisado({ revisado, editavel, onAlternar, mes, onMes, autoria }: { revisado: boolean; editavel: boolean; onAlternar: () => void; mes: number; onMes: (m: number) => void; autoria?: string | null }) {
  return (
    <div className="mt-3 space-y-2">
      <Button variant={revisado ? 'default' : 'outline'} className="w-full gap-2" disabled={!editavel} onClick={onAlternar} data-testid="mes-revisado" data-tutorial="cal-revisado">
        <Check className="h-4 w-4" /> {revisado ? `${MESES[mes - 1]} revisado` : `Marcar ${MESES[mes - 1].toLowerCase()} como revisado`}
      </Button>
      {revisado && autoria && <p className="text-center text-[11.5px] text-muted-foreground">Revisado por {autoria}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 gap-1" disabled={mes === 1} onClick={() => onMes(mes - 1)}><ChevronLeft className="h-4 w-4" /> {mes > 1 ? MESES[mes - 2] : ''}</Button>
        <Button variant="ghost" className="flex-1 gap-1" disabled={mes === 12} onClick={() => onMes(mes + 1)}>{mes < 12 ? MESES[mes] : ''} <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function PainelDoDia({ chave, ano, itens, editavel, onItens, escolherDia = false }: { chave: string; ano: AnoDoCalendario; itens: ItemDoCalendario[]; editavel: boolean; onItens: (i: ItemDoCalendario[]) => void; escolherDia?: boolean }) {
  const [dia, setDia] = useState(chave);
  if (!escolherDia && dia !== chave) setDia(chave);
  const [texto, setTexto] = useState('');
  const [unidades, setUnidades] = useState<string[]>([]);
  const [destaque, setDestaque] = useState(true);
  const [indo, setIndo] = useState(false);
  const [a, m, d] = dia.split('-').map(Number);
  const doDia = itensDoDia(itens, dia);
  const titulo = `${DIAS_DA_SEMANA[diaDaSemana(dia)]}, ${d} de ${MESES[m - 1].toLowerCase()}`;

  const alternarUnidade = (u: string) => setUnidades(us => (us.includes(u) ? us.filter(x => x !== u) : [...us, u]));
  const acrescentar = async () => {
    const t = texto.trim();
    if (t.length < 2) { toast.error('Escreva o que acontece neste dia'); return; }
    setIndo(true);
    try {
      const novo = await acrescentarItem({ ano: ano.ano, dia, texto: t, unidades: unidades.length === UNIDADES_DO_CALENDARIO.length ? [] : unidades, destaque });
      onItens([...itens, novo]); setTexto(''); setUnidades([]);
      toast.success('Acrescentado');
    } catch (e) { toast.error((e as Error).message || 'Não foi possível acrescentar'); }
    finally { setIndo(false); }
  };
  const apagar = async (i: ItemDoCalendario) => {
    try { await apagarItem(i.id); onItens(itens.filter(x => x.id !== i.id)); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível apagar'); }
  };
  const alternarOculto = async (i: ItemDoCalendario) => {
    try { const novo = await editarItem(i.id, { oculto: !i.oculto }); onItens(itens.map(x => (x.id === i.id ? novo : x))); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível alterar'); }
  };

  return (
    <div className="glass-2 rounded-[22px] p-4" data-testid="painel-do-dia">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Dia selecionado</p>
      {escolherDia
        ? <Input type="date" aria-label="Dia" className="mt-1" value={dia} min={`${ano.ano}-01-01`} max={`${ano.ano}-12-31`} onChange={e => e.target.value && setDia(e.target.value)} />
        : <h2 className="font-display text-[20px] font-bold">{titulo}</h2>}
      <div className="mt-3 space-y-2">
        {doDia.length === 0 && <p className="text-[13px] text-muted-foreground">Nada neste dia ainda.</p>}
        {doDia.map(i => (
          <div key={i.id} className={`flex items-start justify-between gap-2 rounded-[12px] bg-card/90 p-2.5 text-[13px] ${i.oculto ? 'opacity-60' : ''}`}>
            <span className="min-w-0">
              <b className={`font-semibold ${i.oculto ? 'line-through' : ''}`}>{i.texto}</b>
              <span className="block text-[11.5px] text-muted-foreground">
                {i.tipo === 'atividade' ? `Atividade · ${rotuloDasUnidades(i.unidades)}` : i.tipo === 'feriado' ? 'Feriado · da agenda' : `Data relevante${i.oculto ? ' · escondida do PDF' : ''}`}
              </span>
              {autoriaDoItem(i) && <span className="block text-[11.5px] text-muted-foreground" data-testid="autoria-do-item">{autoriaDoItem(i)}</span>}
            </span>
            {i.tipo === 'feriado' && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Feriado: não sai" />}
            {i.tipo === 'data' && editavel && (
              <button type="button" onClick={() => alternarOculto(i)} aria-label={i.oculto ? 'Mostrar no PDF' : 'Esconder do PDF'} className="shrink-0 text-muted-foreground hover:text-foreground">
                {i.oculto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
            {i.tipo === 'atividade' && editavel && (
              <button type="button" onClick={() => apagar(i)} aria-label={`Apagar ${i.texto}`} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
            )}
          </div>
        ))}
      </div>
      {editavel && (
        <div className="mt-4 rounded-[14px] border border-dashed border-black/15 bg-card/50 p-3 dark:border-white/15">
          <p className="text-[13px] font-semibold">Acrescentar neste dia</p>
          <Input className="mt-2" value={texto} maxLength={LIMITE_DO_TEXTO} placeholder="Ex.: Reunião com as famílias" onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void acrescentar(); }} aria-label="O que acontece" />
          <p className="mt-3 text-[12px] font-semibold">Para quais unidades</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Unidades">
            <button type="button" aria-pressed={unidades.length === 0} onClick={() => setUnidades([])}
              className={`rounded-full border px-2.5 py-1 text-[12px] ${unidades.length === 0 ? 'border-foreground/40 bg-accent font-semibold' : 'border-black/10 bg-card'}`}>Todas</button>
            {UNIDADES_DO_CALENDARIO.map(u => (
              <button key={u} type="button" aria-pressed={unidades.includes(u)} onClick={() => alternarUnidade(u)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${unidades.includes(u) ? 'border-foreground/40 bg-accent font-semibold' : 'border-black/10 bg-card'}`}>
                <span className={`h-2 w-2 rounded-full ${COR_DA_UNIDADE[u]}`} />{u}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={destaque} onChange={e => setDestaque(e.target.checked)} /> Em destaque no PDF (negrito)</label>
          <Button className="mt-3 w-full gap-2" onClick={acrescentar} disabled={indo}><Plus className="h-4 w-4" /> Acrescentar</Button>
        </div>
      )}
      {a !== ano.ano && <p className="mt-2 text-[12px] text-destructive">Escolha um dia de {ano.ano}.</p>}
    </div>
  );
}

import { useState } from 'react';
import { BookOpen, CalendarDays, Check, ChevronRight, Image as ImageIcon, ListChecks, Lock, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarAno } from '@/lib/calendario/api';
import { MESES, andamento, autoriaDe, diaEMes, mudancasPorMes, noFichario, type AlteracaoDoCalendario, type AnoDoCalendario } from '@/lib/calendario/regras';
import { SituacaoDoPdf } from './SituacaoDoPdf';
import { CartaoDasFolhasExtras } from './FolhasExtras';
import type { FolhaExtra, ItemDoCalendario } from '@/lib/calendario/regras';

export type Parte = 'inicio' | 'percursos' | 'mes' | 'textos' | 'revisao' | 'extra';

const PASSOS = ['Preenchimento pelas coordenadoras', 'Revisão do marketing', 'Aprovado · PDF liberado'];
/** Depois de aprovado e impresso (19/11/2026): o 4º passo é o fichário digital. */
const PASSOS_DO_FICHARIO = ['Preenchimento', 'Revisão do marketing', 'Aprovado e impresso', 'Fichário digital'];
const indiceDoStatus = { preenchimento: 0, revisao: 1, aprovado: 2 } as const;

/** "Fechado desde a impressão": as partes que não mudam mais no fichário. */
const Fechado = () => <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground" data-testid="parte-fechada"><Lock className="h-3.5 w-3.5" /> Fechado desde a impressão.</p>;

function Selo({ children, tom }: { children: React.ReactNode; tom: 'ok' | 'falta' | 'info' }) {
  const t = { ok: 'bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_30%_18%)]', falta: 'bg-[hsl(39_90%_92%)] text-[hsl(var(--warning))] dark:bg-[hsl(39_40%_18%)]', info: 'bg-[hsl(201_80%_93%)] text-[hsl(var(--info))] dark:bg-[hsl(201_40%_18%)]' }[tom];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${t}`}>{children}</span>;
}

/**
 * A tela inicial do Calendário Anual (mockup aprovado em 13/11/2026): onde
 * está o processo e as partes a preencher. O PDF, a revisão e a aprovação
 * chegam no próximo passo; aqui eles já aparecem, travados.
 */
export function InicioDoCalendario({ ano, editavel, marketing, alteracoes = [], onAno, abrir, onPrevia, onBaixar, folhas }: { ano: AnoDoCalendario; editavel: boolean; marketing: boolean; alteracoes?: AlteracaoDoCalendario[]; onAno: (a: AnoDoCalendario) => void; abrir: (p: Parte, mes?: number, folha?: string) => void; onPrevia?: () => void; onBaixar?: () => void;
  /** As folhas extras (19/11/2026): o cartão aparece no fichário (e sempre para o marketing). */
  folhas?: { lista: FolhaExtra[]; itens: ItemDoCalendario[]; podeCriar: boolean; podeMexer: (f: FolhaExtra) => boolean } }) {
  const fichario = noFichario(ano);
  const mudancas = mudancasPorMes(alteracoes);
  const mesesQueMudaram = Object.keys(mudancas).map(Number).sort((x, y) => x - y);
  const a = andamento(ano);
  const textosEditados = Object.keys(ano.textos ?? {}).length;
  const [tema, setTema] = useState(ano.tema);
  const salvarTema = async () => {
    try { onAno(await salvarAno(ano.ano, { tema: tema.trim() })); toast.success('Tema do ano salvo'); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); }
  };
  const passos = fichario ? PASSOS_DO_FICHARIO : PASSOS;
  const passo = fichario ? 3 : indiceDoStatus[ano.status];
  const proximoMes = MESES.findIndex((_, i) => !ano.meses_revisados.includes(i + 1)) + 1 || 1;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-tight sm:text-[34px]">Calendário Anual {ano.ano}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">{fichario
            ? <>Impresso{ano.impresso_em ? ` em ${diaEMes(ano.impresso_em)}` : ''}. Agora é um fichário: acrescentem no mês a mês, e os meses que mudarem ficam marcados.</>
            : 'As coordenadoras do Social preenchem; o marketing revisa e monta o PDF final, no formato de sempre.'}</p>
        </div>
        <ol className="flex flex-wrap items-center gap-2" aria-label="Andamento" data-tutorial="cal-andamento">
          {passos.map((t, i) => (
            <li key={t} className="flex items-center gap-2" aria-current={i === passo ? 'step' : undefined}>
              <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] ${i === passo ? 'bg-foreground font-semibold text-background' : i < passo ? 'bg-white/70 dark:bg-white/10' : 'bg-white/40 text-muted-foreground dark:bg-white/5'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i === passo ? 'bg-primary text-foreground' : i < passo ? 'bg-primary/70' : 'bg-muted'}`}>{i < passo ? <Check className="h-3 w-3" /> : i + 1}</span>{t}
              </span>
              {i < passos.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </li>
          ))}
        </ol>
      </div>

      {ano.observacao && ano.status === 'preenchimento' && (
        <div className="mt-4 rounded-[16px] border border-[hsl(var(--info))]/30 bg-[hsl(201_80%_96%)] p-3 text-[14px] dark:bg-[hsl(201_40%_14%)]" role="status">
          <b>O marketing devolveu com uma observação:</b> {ano.observacao}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="glass-2 rounded-[22px] p-5" data-tutorial="cal-tema">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><ImageIcon className="h-5 w-5" /></span>{a.tema ? <Selo tom="ok"><Check className="h-3 w-3" /> Feito</Selo> : <Selo tom="falta">Falta o tema</Selo>}</div>
            <h2 className="mt-3 text-[17px] font-semibold">1. Capa e tema do ano</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">O tema de {ano.ano}, que vai na capa. A foto da capa é escolhida pelo marketing.</p>
            <Input className="mt-3" value={tema} maxLength={120} disabled={!editavel} aria-label="Tema do ano" placeholder="Ex. de 2026: “Plantando hoje, o amanhã que sonhamos”" onChange={e => setTema(e.target.value)} />
            {autoriaDe(ano, 'tema') && <p className="mt-1.5 text-[12px] text-muted-foreground">Por {autoriaDe(ano, 'tema')}</p>}
            {fichario && !editavel && <Fechado />}
            {editavel && <Button variant="outline" className="mt-3" disabled={tema.trim() === ano.tema.trim()} onClick={salvarTema}>Salvar o tema</Button>}
          </section>
          <section className="glass-2 rounded-[22px] p-5" data-tutorial="cal-percursos">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><ListChecks className="h-5 w-5" /></span><Selo tom={a.percursos === 12 ? 'ok' : 'falta'}>{a.percursos === 12 && <Check className="h-3 w-3" />} {a.percursos} de 12</Selo></div>
            <h2 className="mt-3 text-[17px] font-semibold">2. Percursos do ano</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">O tema transversal de cada mês e as sugestões de atividades. Vieram os de 2026, para revisar.</p>
            {fichario && !editavel && <Fechado />}
            <Button variant="outline" className="mt-4" onClick={() => abrir('percursos')}>Abrir</Button>
          </section>
          {fichario ? (
          <section className="glass-2 rounded-[22px] p-5 sm:col-span-2" data-tutorial="cal-mes" data-testid="mes-a-mes-fichario">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><CalendarDays className="h-5 w-5" /></span>
              {mesesQueMudaram.length > 0
                ? <span className="inline-flex items-center rounded-full bg-[#fde3dd] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#a53a26] dark:bg-[#5a2a20] dark:text-[#ffc9bd]">{mesesQueMudaram.length} {mesesQueMudaram.length === 1 ? 'mês mudou' : 'meses mudaram'} desde a impressão</span>
                : <Selo tom="ok"><Check className="h-3 w-3" /> Igual ao impresso</Selo>}</div>
            <h2 className="mt-3 text-[17px] font-semibold">3. Mês a mês · aberto o ano todo</h2>
            <p className="mt-1 max-w-[70ch] text-[13.5px] leading-relaxed text-muted-foreground">{marketing ? 'As unidades acrescentam e tiram atividades a qualquer momento.' : 'Acrescentem atividades a qualquer momento; cada gestão apaga só as suas (as que acrescentou ou as só da sua unidade).'} Cada mudança marca o mês, e é a folha dele que precisa sair de novo para o fichário.</p>
            <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {MESES.map((m, i) => {
                const n = mudancas[i + 1]?.length ?? 0;
                return (
                  <button key={m} type="button" onClick={() => abrir('mes', i + 1)} className={`flex flex-col items-center rounded-[12px] px-1 py-2 text-[12px] ${n ? 'bg-[#fde3dd] font-semibold text-[#a53a26] dark:bg-[#5a2a20] dark:text-[#ffc9bd]' : 'bg-white/70 dark:bg-white/5'}`}>
                    {m.slice(0, 3)}<span className="mt-0.5 text-[10.5px] font-normal">{n ? `${n} ${n === 1 ? 'mudança' : 'mudanças'}` : 'igual'}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="gap-2" onClick={() => abrir('mes', mesesQueMudaram[0] ?? (new Date().getFullYear() === ano.ano ? new Date().getMonth() + 1 : 1))}><CalendarDays className="h-4 w-4" /> Abrir o mês a mês</Button>
              {onBaixar && <Button variant="outline" className="gap-2" onClick={onBaixar}><Printer className="h-4 w-4" /> Baixar para imprimir</Button>}
            </div>
          </section>
          ) : (
          <section className="glass-2 rounded-[22px] p-5" data-tutorial="cal-mes">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><CalendarDays className="h-5 w-5" /></span><Selo tom={a.meses === 12 ? 'ok' : 'info'}>{a.meses} de 12 meses revisados</Selo></div>
            <h2 className="mt-3 text-[17px] font-semibold">3. Mês a mês</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">Feriados e datas relevantes de {ano.ano} já estão no calendário. Acrescentem as atividades e os eventos das unidades.</p>
            <div className="mt-3 grid grid-cols-12 gap-1" aria-hidden="true">{MESES.map((m, i) => <span key={m} className={`h-2 rounded-full ${ano.meses_revisados.includes(i + 1) ? 'bg-[hsl(var(--sel))]' : 'bg-black/10 dark:bg-white/10'}`} />)}</div>
            <Button variant="outline" className="mt-4" onClick={() => abrir('mes', proximoMes)}>Abrir</Button>
          </section>
          )}
          <section className="glass-2 rounded-[22px] p-5" data-tutorial="cal-textos">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><BookOpen className="h-5 w-5" /></span><Selo tom="info">{textosEditados === 0 ? 'Vieram de 2026' : `${textosEditados} ${textosEditados === 1 ? 'seção editada' : 'seções editadas'}`}</Selo></div>
            <h2 className="mt-3 text-[17px] font-semibold">4. Textos do projeto</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">As páginas 2 a 10 do PDF: SCFV, objetivos, unidades, CCII, justificativa, metodologia e avaliação. Vieram os de 2026, para revisar.</p>
            {fichario && !editavel && <Fechado />}
            <Button variant="outline" className="mt-4" onClick={() => abrir('textos')}>Abrir</Button>
          </section>
          {folhas && <CartaoDasFolhasExtras ano={ano} itens={folhas.itens} folhas={folhas.lista} podeCriar={folhas.podeCriar} podeMexer={folhas.podeMexer} onAbrir={id => abrir('extra', undefined, id)} />}
        </div>
        <aside className="space-y-4">
          <SituacaoDoPdf ano={ano} marketing={marketing} editavel={editavel} onAno={onAno} onPrevia={onPrevia} onRevisao={() => abrir('revisao')} onBaixar={onBaixar} />
        </aside>
      </div>
    </div>
  );
}

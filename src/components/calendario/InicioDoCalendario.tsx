import { useState } from 'react';
import { BookOpen, CalendarDays, Check, ChevronRight, FileText, Image as ImageIcon, ListChecks, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarAno } from '@/lib/calendario/api';
import { MESES, andamento, type AnoDoCalendario } from '@/lib/calendario/regras';

export type Parte = 'inicio' | 'percursos' | 'mes' | 'coordenadoras';

const PASSOS = ['Preenchimento pelas coordenadoras', 'Revisão do marketing', 'Aprovado · PDF liberado'];
const indiceDoStatus = { preenchimento: 0, revisao: 1, aprovado: 2 } as const;

function Selo({ children, tom }: { children: React.ReactNode; tom: 'ok' | 'falta' | 'info' }) {
  const t = { ok: 'bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_30%_18%)]', falta: 'bg-[hsl(39_90%_92%)] text-[hsl(var(--warning))] dark:bg-[hsl(39_40%_18%)]', info: 'bg-[hsl(201_80%_93%)] text-[hsl(var(--info))] dark:bg-[hsl(201_40%_18%)]' }[tom];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${t}`}>{children}</span>;
}

/**
 * A tela inicial do Calendário Anual (mockup aprovado em 13/11/2026): onde
 * está o processo e as partes a preencher. O PDF, a revisão e a aprovação
 * chegam no próximo passo; aqui eles já aparecem, travados.
 */
export function InicioDoCalendario({ ano, editavel, marketing, onAno, abrir }: { ano: AnoDoCalendario; editavel: boolean; marketing: boolean; onAno: (a: AnoDoCalendario) => void; abrir: (p: Parte, mes?: number) => void }) {
  const a = andamento(ano);
  const [tema, setTema] = useState(ano.tema);
  const salvarTema = async () => {
    try { onAno(await salvarAno(ano.ano, { tema: tema.trim() })); toast.success('Tema do ano salvo'); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); }
  };
  const passo = indiceDoStatus[ano.status];
  const proximoMes = MESES.findIndex((_, i) => !ano.meses_revisados.includes(i + 1)) + 1 || 1;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-tight sm:text-[34px]">Calendário Anual {ano.ano}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">As coordenadoras do Social preenchem; o marketing revisa e monta o PDF final, no formato de sempre.</p>
        </div>
        <ol className="flex flex-wrap items-center gap-2" aria-label="Andamento" data-tutorial="cal-andamento">
          {PASSOS.map((t, i) => (
            <li key={t} className="flex items-center gap-2" aria-current={i === passo ? 'step' : undefined}>
              <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] ${i === passo ? 'bg-foreground font-semibold text-background' : i < passo ? 'bg-white/70 dark:bg-white/10' : 'bg-white/40 text-muted-foreground dark:bg-white/5'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i === passo ? 'bg-primary text-foreground' : i < passo ? 'bg-primary/70' : 'bg-muted'}`}>{i < passo ? <Check className="h-3 w-3" /> : i + 1}</span>{t}
              </span>
              {i < PASSOS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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
            {editavel && <Button variant="outline" className="mt-3" disabled={tema.trim() === ano.tema.trim()} onClick={salvarTema}>Salvar o tema</Button>}
          </section>
          <section className="glass-2 rounded-[22px] p-5" data-tutorial="cal-percursos">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><ListChecks className="h-5 w-5" /></span><Selo tom={a.percursos === 12 ? 'ok' : 'falta'}>{a.percursos === 12 && <Check className="h-3 w-3" />} {a.percursos} de 12</Selo></div>
            <h2 className="mt-3 text-[17px] font-semibold">2. Percursos do ano</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">O tema transversal de cada mês e as sugestões de atividades. Vieram os de 2026, para revisar.</p>
            <Button variant="outline" className="mt-4" onClick={() => abrir('percursos')}>Abrir</Button>
          </section>
          <section className="glass-2 rounded-[22px] p-5" data-tutorial="cal-mes">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><CalendarDays className="h-5 w-5" /></span><Selo tom={a.meses === 12 ? 'ok' : 'info'}>{a.meses} de 12 meses revisados</Selo></div>
            <h2 className="mt-3 text-[17px] font-semibold">3. Mês a mês</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">Feriados e datas relevantes de {ano.ano} já estão no calendário. Acrescentem as atividades e os eventos das unidades.</p>
            <div className="mt-3 grid grid-cols-12 gap-1" aria-hidden="true">{MESES.map((m, i) => <span key={m} className={`h-2 rounded-full ${ano.meses_revisados.includes(i + 1) ? 'bg-[hsl(var(--sel))]' : 'bg-black/10 dark:bg-white/10'}`} />)}</div>
            <Button variant="outline" className="mt-4" onClick={() => abrir('mes', proximoMes)}>Abrir</Button>
          </section>
          <section className="glass-2 rounded-[22px] p-5 opacity-80">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-primary/60"><BookOpen className="h-5 w-5" /></span><Selo tom="info">No próximo passo</Selo></div>
            <h2 className="mt-3 text-[17px] font-semibold">4. Textos do projeto</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">SCFV, objetivos, justificativa, unidades, CCII, metodologia e avaliação. Vêm de 2026, para revisar; chegam junto com o PDF.</p>
          </section>
        </div>
        <aside className="space-y-4">
          <section className="glass-2 rounded-[22px] p-4" data-tutorial="cal-pdf">
            <p className="flex items-center gap-2 text-[13px] font-semibold"><FileText className="h-4 w-4" /> O PDF de {ano.ano}</p>
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">58 páginas, A4 deitado, no mesmo formato de 2026. A prévia, o envio ao marketing e a aprovação chegam no próximo passo.</p>
            <div className="mt-3 flex gap-2 rounded-[14px] bg-white/60 p-3 text-[12.5px] leading-snug dark:bg-white/5"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>O PDF final é do marketing. Ele aparece aqui para baixar <b>depois de aprovado</b>.</span></div>
          </section>
          {marketing && (
            <section className="glass-2 rounded-[22px] p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold"><Users className="h-4 w-4" /> Quem preenche</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Só entra quem o marketing liberar aqui.</p>
              <Button variant="outline" className="mt-3 w-full" onClick={() => abrir('coordenadoras')}>Coordenadoras com acesso</Button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

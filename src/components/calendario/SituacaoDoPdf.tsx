import { useState } from 'react';
import { Check, Download, Eye, FileText, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { enviarAoMarketing, linkDoArquivo } from '@/lib/calendario/api';
import { diaEMes, type AnoDoCalendario } from '@/lib/calendario/regras';

/** O que ainda falta para as coordenadoras enviarem ao marketing. */
export function faltasParaEnviar(ano: Pick<AnoDoCalendario, 'tema' | 'meses_revisados'>): string[] {
  const faltas: string[] = [];
  if (!ano.tema.trim()) faltas.push('o tema do ano');
  const meses = 12 - new Set(ano.meses_revisados).size;
  if (meses > 0) faltas.push(`marcar ${meses} ${meses === 1 ? 'mês' : 'meses'} como revisado${meses === 1 ? '' : 's'}`);
  return faltas;
}

/** Baixa o PDF aprovado por um link temporário do balde privado. */
export async function baixarPdfAprovado(ano: AnoDoCalendario) {
  if (!ano.pdf_url) return;
  try {
    const url = await linkDoArquivo(ano.pdf_url, `Calendário Anual ${ano.ano}.pdf`);
    const a = document.createElement('a');
    a.href = url; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { toast.error((e as Error).message || 'Não deu para baixar agora.'); }
}

function Selo({ children, tom }: { children: React.ReactNode; tom: 'ok' | 'falta' }) {
  const t = { ok: 'bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_30%_18%)]', falta: 'bg-[hsl(39_90%_92%)] text-[hsl(var(--warning))] dark:bg-[hsl(39_40%_18%)]' }[tom];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${t}`}>{children}</span>;
}

/**
 * O cartão do PDF no início (13/11/2026): a prévia, o envio ao marketing, a
 * espera da revisão e o PDF aprovado para baixar.
 */
export function SituacaoDoPdf({ ano, marketing, editavel, onAno, onPrevia, onRevisao }: {
  ano: AnoDoCalendario;
  marketing: boolean;
  editavel: boolean;
  onAno: (a: AnoDoCalendario) => void;
  onPrevia?: () => void;
  onRevisao?: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const faltas = faltasParaEnviar(ano);

  const enviar = async () => {
    setEnviando(true);
    try { onAno(await enviarAoMarketing(ano.ano)); toast.success('Enviado ao marketing'); setConfirmar(false); }
    catch (e) { toast.error((e as Error).message || 'Não deu para enviar agora.'); }
    finally { setEnviando(false); }
  };

  return (
    <section className="glass-2 rounded-[22px] p-4" data-tutorial="cal-pdf">
      <p className="flex items-center gap-2 text-[13px] font-semibold"><FileText className="h-4 w-4" /> O PDF de {ano.ano}</p>

      {ano.status === 'preenchimento' && (
        <>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">58 páginas, A4 deitado, no mesmo formato de 2026. A prévia monta o PDF com o que está preenchido agora.</p>
          {onPrevia && <Button variant="outline" className="mt-3 w-full gap-2" onClick={onPrevia}><Eye className="h-4 w-4" /> Ver a prévia</Button>}
          {!marketing && editavel && (
            <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
              <Button className="w-full gap-2" disabled={faltas.length > 0} onClick={() => setConfirmar(true)}><Send className="h-4 w-4" /> Enviar ao marketing</Button>
              <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                {faltas.length > 0 ? <>Antes de enviar, falta: {faltas.join(' e ')}.</> : 'Tudo pronto. Depois de enviar, a edição fecha até o marketing aprovar ou devolver.'}
              </p>
            </div>
          )}
          <div className="mt-3 flex gap-2 rounded-[14px] bg-white/60 p-3 text-[12.5px] leading-snug dark:bg-white/5"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>O PDF final é do marketing. Ele aparece aqui para baixar <b>depois de aprovado</b>.</span></div>
        </>
      )}

      {ano.status === 'revisao' && (
        <>
          <div className="mt-2"><Selo tom="falta">Em revisão</Selo></div>
          <p className="mt-2 text-[13.5px] leading-snug">
            Enviado ao marketing{ano.enviado_por ? ` por ${ano.enviado_por}` : ''}{ano.enviado_em ? ` em ${diaEMes(ano.enviado_em)}` : ''}. Enquanto o marketing revisa, a edição fica fechada.
          </p>
          {onPrevia && <Button variant="outline" className="mt-3 w-full gap-2" onClick={onPrevia}><Eye className="h-4 w-4" /> Ver a prévia</Button>}
          <Button className="mt-2 w-full gap-2" disabled><Lock className="h-4 w-4" /> Baixar o PDF</Button>
        </>
      )}

      {ano.status === 'aprovado' && (
        <>
          <div className="mt-2"><Selo tom="ok"><Check className="h-3 w-3" /> Aprovado</Selo></div>
          <p className="mt-2 text-[13.5px] leading-snug">
            <b>Aprovado pelo marketing{ano.aprovado_em ? ` em ${diaEMes(ano.aprovado_em)}` : ''}.</b> O calendário de {ano.ano} está pronto.
          </p>
          <Button className="mt-3 w-full gap-2" disabled={!ano.pdf_url} onClick={() => void baixarPdfAprovado(ano)}><Download className="h-4 w-4" /> Baixar o PDF</Button>
        </>
      )}

      {marketing && onRevisao && (
        <Button variant={ano.status === 'revisao' ? 'default' : 'outline'} className="mt-2 w-full" onClick={onRevisao}>
          {ano.status === 'revisao' ? 'Revisar e aprovar' : 'Revisão do marketing'}
        </Button>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar o calendário ao marketing?</AlertDialogTitle>
            <AlertDialogDescription>
              Depois de enviar, a edição fica fechada para as coordenadoras. Se o marketing devolver, a observação aparece no topo e o calendário volta a ficar editável.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Ainda não</AlertDialogCancel>
            <AlertDialogAction disabled={enviando} onClick={e => { e.preventDefault(); void enviar(); }}>{enviando ? 'Enviando…' : 'Enviar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ExternalLink, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { chamarPlanilha, type EstadoDaPlanilha } from '@/lib/voluntariado/api';

/**
 * A planilha do Google do voluntariado (21/10/2026): uma só, com o mesmo
 * link sempre, para compartilhar com a gestão. Cada inscrição nova entra no
 * fim sozinha; o app nunca mexe no que já está lá (a gestão pode criar
 * colunas à direita), e apagar no app não tira a linha de lá. Usa a conta
 * Google conectada no Drive da Pizza.
 */
export function PlanilhaDoGoogle({ inscritos }: { inscritos: number }) {
  const [estado, setEstado] = useState<EstadoDaPlanilha | null>(null);
  const [falhou, setFalhou] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const carregar = () => chamarPlanilha<EstadoDaPlanilha>({ estado: true }).then((e) => { setEstado(e); setFalhou(null); }).catch((e) => setFalhou(e instanceof Error ? e.message : String(e)));
  useEffect(() => { carregar(); }, []);

  async function criar() {
    setOcupado(true); setConfirmando(false);
    try {
      const r = await chamarPlanilha<{ link: string; enviadas?: number }>({ criar: true });
      toast.success('Planilha criada no Setor Marketing', { description: `${r.enviadas ?? 0} inscrições já entraram nela.` });
      window.open(r.link, '_blank', 'noopener');
      await carregar();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não deu para criar a planilha.'); }
    finally { setOcupado(false); }
  }

  async function sincronizar() {
    setOcupado(true);
    try { const r = await chamarPlanilha<{ enviadas: number }>({ sincronizar: true }); toast.success(r.enviadas ? `${r.enviadas} enviadas para a planilha.` : 'A planilha já estava em dia.'); await carregar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não deu para enviar.'); await carregar(); }
    finally { setOcupado(false); }
  }

  const caixa = 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4';
  if (falhou) return <div className={caixa} role="alert"><span className="text-sm text-red-700 dark:text-red-400">Planilha do Google: {falhou}</span><Button variant="outline" size="sm" onClick={carregar}>Tentar de novo</Button></div>;
  if (!estado) return null;

  if (!estado.drive_conectado) {
    return <div className={caixa} data-testid="planilha-google"><span className="text-sm text-muted-foreground"><FileSpreadsheet className="mr-1.5 inline h-4 w-4" />Para a planilha do Google, conecte antes o Drive na aba <b>Pizza da Alegria</b> (usa a mesma conta).</span></div>;
  }

  if (!estado.planilha) {
    return (
      <div className={caixa} data-testid="planilha-google">
        <span className="flex min-w-0 items-start gap-2 text-sm">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span><b>Planilha do Google que se atualiza sozinha</b><br /><span className="text-muted-foreground">Uma planilha só, no Setor Marketing, para compartilhar com a gestão. Antes de criar, apague as inscrições de teste: as {inscritos} de agora entram nela.</span></span>
        </span>
        <Button size="sm" disabled={ocupado} onClick={() => setConfirmando(true)}><FileSpreadsheet className="h-4 w-4" /> Criar planilha do Google</Button>
        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Criar a planilha com {inscritos} {inscritos === 1 ? 'inscrição' : 'inscrições'}?</AlertDialogTitle>
              <AlertDialogDescription>As inscrições de teste já foram apagadas? Depois de criada, apagar aqui no app não tira a linha de lá: a gestão tira à mão.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Ainda não</AlertDialogCancel>
              <AlertDialogAction onClick={criar}>Criar planilha</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const p = estado.planilha;
  return (
    <div className={caixa} data-testid="planilha-google">
      <span className="flex min-w-0 items-start gap-2 text-sm">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <span>
          <b>Planilha do Google</b> · se atualiza sozinha
          <span className="block text-muted-foreground">
            {p.erro ? <span className="text-red-700 dark:text-red-400">{p.erro}</span>
              : estado.pendentes ? `${estado.pendentes} ${estado.pendentes === 1 ? 'inscrição ainda não entrou' : 'inscrições ainda não entraram'}.`
                : 'Tudo em dia. Apagar aqui não tira a linha de lá.'}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        {(estado.pendentes > 0 || p.erro) && <Button variant="outline" size="sm" disabled={ocupado} onClick={sincronizar}><RefreshCw className="h-4 w-4" /> Enviar agora</Button>}
        <Button asChild size="sm"><a href={p.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir planilha do Google</a></Button>
      </span>
    </div>
  );
}

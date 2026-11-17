import { useEffect, useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  aprovarPedidoDeProfessora, lerPedidosDeProfessora, recusarPedidoDeProfessora, type PedidoDeProfessora,
} from '@/lib/semanario/api';
import { Vidro } from './pecas';

const diaDoPedido = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const nomeDaUnidade = (u: string) => (/^goe$/i.test(u.trim()) ? 'GOE' : `CEI ${u.trim()}`);

/**
 * Os pedidos de acesso como Professora do CEI da orientadora (PR 7,
 * 17/11/2026). Ela aprova ou recusa aqui; o marketing faz o mesmo no Painel, e
 * quem chegar primeiro resolve. Sem pedido pendente, nada aparece.
 */
export function PedidosDeProfessoras() {
  const [pedidos, setPedidos] = useState<PedidoDeProfessora[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recusar, setRecusar] = useState<PedidoDeProfessora | null>(null);

  useEffect(() => {
    let vivo = true;
    void lerPedidosDeProfessora().then(l => { if (vivo && l) setPedidos(l); });
    return () => { vivo = false; };
  }, []);

  if (!pedidos.length) return null;
  const tirar = (id: string) => setPedidos(l => l.filter(p => p.id !== id));

  const aprovar = async (p: PedidoDeProfessora) => {
    setOcupado(p.id);
    try {
      const r = await aprovarPedidoDeProfessora(p);
      tirar(p.id);
      toast.success(`${p.name} tem acesso ao Semanário`, {
        description: r.avisoEnviado ? 'Ela recebeu um e-mail com o link de entrada.' : 'O e-mail de aviso não saiu: avise a professora por outro caminho.',
      });
    } catch (e) {
      toast.error('Não foi possível aprovar', { description: (e as Error).message });
      // Pode ter sido resolvido no Painel enquanto isso: relê.
      void lerPedidosDeProfessora().then(l => { if (l) setPedidos(l); });
    } finally { setOcupado(null); }
  };

  const recusarAgora = async () => {
    const p = recusar;
    if (!p) return;
    setOcupado(p.id);
    try {
      const ok = await recusarPedidoDeProfessora(p.id);
      tirar(p.id);
      if (ok) toast.success('Pedido recusado', { description: `${p.name} não entra no app.` });
      else toast.info('Este pedido já tinha sido resolvido', { description: 'Alguém resolveu pelo Painel.' });
    } catch (e) {
      toast.error('Não foi possível recusar', { description: (e as Error).message });
    } finally { setOcupado(null); setRecusar(null); }
  };

  return (
    <Vidro className="mt-5 px-4 py-3">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold">
        <UserPlus className="h-4 w-4 text-[hsl(var(--info))]" aria-hidden />
        {pedidos.length === 1 ? '1 professora pediu acesso' : `${pedidos.length} professoras pediram acesso`}
      </h2>
      <p className="text-[12.5px] text-muted-foreground">Confira se é professora do seu CEI. Aprovada, ela entra no app e vê só o Semanário.</p>
      <ul className="mt-2 divide-y divide-black/[.07] dark:divide-white/[.08]">
        {pedidos.map(p => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14px]">{p.name}</b>
              <span className="block truncate text-[12px] text-muted-foreground">{p.email} · {nomeDaUnidade(p.requested_unit)} · pediu em {diaDoPedido(p.requested_at)}</span>
            </span>
            <span className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" disabled={!!ocupado} onClick={() => setRecusar(p)}>
                <X className="h-4 w-4" /> Recusar
              </Button>
              <Button size="sm" className="gap-1 rounded-full" disabled={!!ocupado} onClick={() => void aprovar(p)} aria-label={`Aprovar ${p.name}`}>
                {ocupado === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!recusar} onOpenChange={o => !o && setRecusar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar o pedido de {recusar?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Ela não entra no app com este pedido. Se for engano, fale com o marketing.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!!ocupado} onClick={e => { e.preventDefault(); void recusarAgora(); }}>Recusar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Vidro>
  );
}

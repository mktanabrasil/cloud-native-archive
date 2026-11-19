import { useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { gerarSenhaDe } from '@/lib/senhas/painel';

export interface ContaParaGerar { id: string; name: string; email: string; jaGerada: boolean }

/**
 * "Gerar nova senha" (19/11/2026, PR 2 das senhas; mockup aprovado). Primeiro
 * confirma, porque a senha antiga para na hora e quem está logado sai; depois
 * mostra a senha UMA vez, para copiar e entregar.
 */
export function GerarSenhaDialog({ conta, onFechar, onGerada }: { conta: ContaParaGerar | null; onFechar: () => void; onGerada: () => void }) {
  const [estado, setEstado] = useState<'confirmar' | 'gerando' | 'pronta' | 'erro'>('confirmar');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [copiou, setCopiou] = useState('');
  const [sessoesEncerradas, setSessoesEncerradas] = useState(true);

  useEffect(() => { if (conta) { setEstado('confirmar'); setSenha(''); setErro(''); setCopiou(''); } }, [conta]);

  const gerar = async () => {
    if (!conta) return;
    setEstado('gerando');
    try {
      const r = await gerarSenhaDe(conta.id);
      setSenha(r.senha); setSessoesEncerradas(r.sessoesEncerradas); setEstado('pronta'); onGerada();
    } catch (e) { setErro((e as Error).message); setEstado('erro'); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(senha); setCopiou('Copiada'); }
    catch { setCopiou('Selecione a senha e copie com Ctrl+C'); }
  };
  // Fechar com a senha na tela pede confirmação implícita: o botão diz que ela não volta.
  const fechar = () => { if (estado !== 'gerando') onFechar(); };

  return (
    <Dialog open={!!conta} onOpenChange={o => { if (!o) fechar(); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> {estado === 'pronta' ? 'Senha nova' : conta?.jaGerada ? 'Gerar nova senha' : 'Gerar senha'}</DialogTitle>
          <DialogDescription>{conta?.name} · {conta?.email}</DialogDescription>
        </DialogHeader>

        {(estado === 'confirmar' || estado === 'gerando') && (
          <div className="space-y-3 text-sm">
            <p>O app gera uma senha no padrão <b className="font-mono">FdGhJiuPn</b>, e a pessoa entra com ela.</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li><b className="text-foreground">A senha atual para de funcionar na hora.</b></li>
              <li>Quem estiver logado com esta conta é desconectado, em qualquer aparelho, em até 1 hora.</li>
              <li>A senha nova aparece uma vez só, para você copiar e entregar.</li>
            </ul>
          </div>
        )}

        {estado === 'pronta' && (
          <div className="space-y-3">
            <p className="select-all break-all rounded-xl border border-dashed border-border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-wider" data-testid="senha-gerada">{senha}</p>
            <div className="flex items-center gap-2">
              <Button onClick={() => void copiar()} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar a senha</Button>
              <span className="text-xs text-muted-foreground" aria-live="polite">{copiou}</span>
            </div>
            {sessoesEncerradas
              ? <p className="rounded-xl bg-[hsl(var(--success)/0.1)] p-3 text-xs text-foreground">A senha antiga parou de funcionar e as sessões abertas desta conta foram encerradas.</p>
              : <p role="alert" className="rounded-xl bg-[hsl(var(--warning)/0.12)] p-3 text-xs text-foreground">A senha antiga parou de funcionar, mas não consegui encerrar as sessões abertas. Gere a senha de novo para tentar outra vez.</p>}
            <p className="rounded-xl bg-[hsl(var(--warning)/0.12)] p-3 text-xs text-foreground">Esta é a única vez que a senha aparece. Copie agora e entregue à pessoa. Se perder, gere outra.</p>
          </div>
        )}

        {estado === 'erro' && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{erro}</p>}

        <DialogFooter>
          {estado === 'pronta'
            ? <Button variant="outline" onClick={fechar}>Já copiei, fechar</Button>
            : (
              <>
                <Button variant="outline" onClick={fechar} disabled={estado === 'gerando'}>Cancelar</Button>
                <Button onClick={() => void gerar()} disabled={estado === 'gerando'} className="gap-1.5">
                  {estado === 'gerando' && <Loader2 className="h-4 w-4 animate-spin" />} {estado === 'erro' ? 'Tentar de novo' : 'Gerar a senha'}
                </Button>
              </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

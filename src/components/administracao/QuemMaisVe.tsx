import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emailValido } from '@/lib/administracao/apoiadores';

export interface AcessoLiberado { email: string; adicionado_em: string; adicionado_por: string | null }

/**
 * "Quem mais vê" uma página da Administração (18/11/2026 em Padrinhos e
 * Parceiros; 23/11/2026 também no Voluntariado): os responsáveis que a
 * administração geral libera pelo e-mail da conta, além de quem já vê pelo
 * vínculo. Só a administração geral vê e muda esta parte.
 */
export function QuemMaisVe({ pagina, quemJaVe, ler, mudar }: {
  /** "Padrinhos e Parceiros", "o Voluntariado". */
  pagina: string;
  /** "O marketing e os vínculos Padrinhos e Parceiros já veem." */
  quemJaVe: string;
  ler: () => Promise<AcessoLiberado[]>;
  mudar: (email: string, liberar: boolean) => Promise<void>;
}) {
  const [lista, setLista] = useState<AcessoLiberado[] | null>(null);
  const [erro, setErro] = useState(false);
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    try { setLista(await ler()); setErro(false); } catch { setErro(true); }
  }, [ler]);
  useEffect(() => { void recarregar(); }, [recarregar]);

  const trocar = async (email: string, liberar: boolean) => {
    setOcupado(true);
    try {
      await mudar(email, liberar);
      await recarregar();
      if (liberar) setNovo('');
      toast.success(liberar ? `${email} passa a ver ${pagina}.` : `${email} não vê mais ${pagina}.`);
    } catch (e) {
      toast.error('Não foi possível salvar', { description: (e as Error).message });
    } finally { setOcupado(false); }
  };
  const adicionar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const email = novo.trim().toLowerCase();
    if (!emailValido(email)) { toast.error('Digite um e-mail válido.'); return; }
    if (lista?.some(a => a.email === email)) { toast.error('Esse e-mail já está na lista.'); return; }
    void trocar(email, true);
  };

  return (
    <section className="space-y-2 rounded-[20px] border border-dashed border-border p-4" aria-label={`Quem mais vê ${pagina}`}>
      <h2 className="text-sm font-semibold">Quem mais vê {pagina} <span className="font-normal text-muted-foreground">· só a administração geral vê esta parte</span></h2>
      <p className="max-w-[70ch] text-xs text-muted-foreground">{quemJaVe} Aqui entram os responsáveis, pelo e-mail da conta deles no app.</p>
      {erro ? (
        <p role="alert" className="text-xs text-destructive">Não consegui ler a lista. <button className="underline" onClick={() => void recarregar()}>Tentar de novo</button></p>
      ) : lista === null ? <p className="text-xs text-muted-foreground">Carregando…</p> : (
        <>
          {lista.length === 0 ? <p className="text-xs text-muted-foreground">Ninguém liberado pelo e-mail ainda.</p> : (
            <ul className="flex flex-wrap gap-1.5" aria-label="E-mails liberados">
              {lista.map(a => (
                <li key={a.email} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs">
                  {a.email}
                  <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50" disabled={ocupado} aria-label={`Tirar o acesso de ${a.email}`} onClick={() => void trocar(a.email, false)}><X className="h-3 w-3" /></button>
                </li>
              ))}
            </ul>
          )}
          <form className="flex max-w-md gap-2" onSubmit={adicionar}>
            <Input aria-label="E-mail para liberar" value={novo} onChange={e => setNovo(e.target.value)} placeholder="responsavel@anabrasil.org" className="h-8 min-w-0 flex-1 text-xs" disabled={ocupado} />
            <Button type="submit" variant="outline" className="h-8 gap-1 text-xs" disabled={ocupado || !novo.trim()}>
              {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Liberar
            </Button>
          </form>
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { definirAcessoAtivo, definirSoCalendario, liberarAcesso, listarAcessos, removerAcesso, type AcessoDoCalendario } from '@/lib/calendario/api';
import { emailValido } from '@/lib/vagas/conta';

/**
 * Quem entra no Calendário Anual (14/11/2026): só o marketing mexe. A
 * coordenadora cria a própria senha no primeiro acesso em /calendario; sem o
 * e-mail aqui (ou com ele desligado), ela entra e vê só o aviso.
 *
 * "Só o calendário" (13/11/2026): para quem já tem conta da equipe (as
 * gestoras). Ligado, ela entra só no calendário, e o app inteiro a manda para
 * cá; desligado, volta a ver o que uma gestora vê. Nasce ligado.
 */
export function CoordenadorasDoCalendario({ quem }: { quem: string | null }) {
  const [lista, setLista] = useState<AcessoDoCalendario[] | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [apagando, setApagando] = useState<string | null>(null);
  const ler = () => listarAcessos().then(setLista).catch(() => { setLista([]); toast.error('Não consegui ler a lista agora'); });
  useEffect(() => { void ler(); }, []);

  const liberar = async () => {
    if (nome.trim().length < 2) return toast.error('Escreva o nome');
    if (!emailValido(email)) return toast.error('Confira o e-mail');
    try { await liberarAcesso(email, nome, quem); setNome(''); setEmail(''); toast.success('Acesso liberado'); void ler(); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível liberar'); }
  };
  const alternar = async (a: AcessoDoCalendario) => {
    try { await definirAcessoAtivo(a.email, !a.ativo); void ler(); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível alterar'); }
  };
  const alternarSo = async (a: AcessoDoCalendario) => {
    try { await definirSoCalendario(a.email, !a.so_calendario); toast.success(a.so_calendario ? `${a.nome} volta a ver o app` : `${a.nome} fica só no calendário`); void ler(); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível alterar'); }
  };
  const remover = async (email: string) => {
    try { await removerAcesso(email); setApagando(null); toast.success('Acesso removido'); void ler(); }
    catch (e) { toast.error((e as Error).message || 'Não foi possível remover'); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 lg:px-6">
      <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-[28px]">Coordenadoras com acesso</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">Cadastre o e-mail de cada coordenadora. Quem já tem conta da equipe entra com a senha de sempre em app.anabrasil.org/calendario; quem não tem, cria a senha no primeiro acesso.</p>
      <p className="mt-2 text-[13px] text-muted-foreground"><b className="text-foreground">Só o calendário:</b> ligado, a pessoa entra só aqui, mesmo com conta da equipe; o app inteiro a manda para o calendário. Desligue quando for liberar o resto do app para ela.</p>
      <section className="glass-2 mt-5 rounded-[22px] p-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <Input aria-label="Nome" placeholder="Nome" value={nome} maxLength={120} onChange={e => setNome(e.target.value)} />
          <Input aria-label="E-mail" type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <Button onClick={liberar}>Liberar acesso</Button>
        </div>
      </section>
      <section className="glass-2 mt-4 divide-y divide-black/[.07] rounded-[22px] dark:divide-white/[.07]" data-testid="lista-de-acessos">
        {lista === null && <p className="p-4 text-[13.5px] text-muted-foreground">Carregando…</p>}
        {lista?.length === 0 && <p className="p-4 text-[13.5px] text-muted-foreground">Ninguém liberado ainda.</p>}
        {lista?.map(a => (
          <div key={a.email} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className={`min-w-0 ${a.ativo ? '' : 'opacity-60'}`}><b className="block text-[14px] font-semibold">{a.nome}</b><span className="text-[12.5px] text-muted-foreground">{a.email}</span></span>
            <span className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[12.5px]"><Switch checked={a.ativo} onCheckedChange={() => alternar(a)} aria-label={`Acesso de ${a.nome}`} /> {a.ativo ? 'Liberado' : 'Desligado'}</label>
              <label className="flex items-center gap-2 text-[12.5px]"><Switch checked={a.so_calendario} onCheckedChange={() => alternarSo(a)} aria-label={`Só o calendário para ${a.nome}`} /> Só o calendário</label>
              {apagando === a.email
                ? <><Button size="sm" variant="destructive" onClick={() => remover(a.email)}>Remover</Button><Button size="sm" variant="ghost" onClick={() => setApagando(null)}>Cancelar</Button></>
                : <Button size="icon" variant="ghost" aria-label={`Remover ${a.nome}`} onClick={() => setApagando(a.email)}><Trash2 className="h-4 w-4" /></Button>}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
